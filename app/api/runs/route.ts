import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Parser from "rss-parser";
import { DEMO_RUN } from "@/lib/demo";
import { DEFAULT_SOURCES } from "@/lib/sources";
import { getAdminClient } from "@/lib/supabase/admin";
import { exportSpan, logEvent, newSpanId, newTraceId } from "@/lib/telemetry";
import { beginRun, finishRun, isCancelled } from "@/lib/run-control";
import type { BriefingRun, MissionEvent } from "@/lib/types";

export const runtime = "nodejs";

type FeedItem = { title?: string; link?: string; creator?: string; author?: string; pubDate?: string; contentSnippet?: string; content?: string };

const normalize = (value: string) => value.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const fingerprint = (value: string) => createHash("sha256").update(normalize(value)).digest("hex");
const canonicalize = (value: string) => { try { const url = new URL(value); url.hash = ""; ["utm_source", "utm_medium", "utm_campaign"].forEach((k) => url.searchParams.delete(k)); return url.toString(); } catch { return value; } };

export async function GET() {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json(DEMO_RUN);
  const { data: run } = await admin.from("mission_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return NextResponse.json(DEMO_RUN);
  const [{ data: briefing }, { data: events }] = await Promise.all([
    admin.from("briefings").select("*").eq("run_id", run.id).maybeSingle(),
    admin.from("mission_events").select("*").eq("run_id", run.id).order("created_at"),
  ]);
  return NextResponse.json({
    id: run.id, traceId: run.trace_id, status: run.status, startedAt: run.started_at, completedAt: run.completed_at,
    newArticles: events?.filter((e) => e.kind === "article.discovered").length ?? 0,
    duplicates: events?.filter((e) => e.kind === "article.duplicate").length ?? 0,
    selected: events?.find((e) => e.kind === "agent.completed")?.message?.match(/\d+/)?.[0] ?? 0,
    qualityScore: run.quality_score ?? 0, inputTokens: run.input_tokens, outputTokens: run.output_tokens,
    estimatedCostUsd: Number(run.estimated_cost_usd), title: briefing?.title ?? "Briefing", markdown: briefing?.markdown ?? "",
    events: (events ?? []).map((e) => ({ id: e.id, runId: e.run_id, traceId: e.trace_id, kind: e.kind, actor: e.actor, target: e.target, message: e.message, createdAt: e.created_at, durationMs: e.duration_ms, tokens: e.tokens })),
  } satisfies BriefingRun);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const traceId = newTraceId();
  const requestedRunId = request.headers.get("x-mission-run-id");
  const runId = requestedRunId && /^[a-zA-Z0-9-]{8,64}$/.test(requestedRunId) ? requestedRunId : randomUUID();
  const rootSpanId = newSpanId();
  const controller = beginRun(runId);
  const signal = controller.signal;
  const events: MissionEvent[] = [];
  const push = (kind: MissionEvent["kind"], actor: string, target: string, message: string, extra: Partial<MissionEvent> = {}) => events.push({ id: randomUUID(), runId, traceId, kind, actor, target, message, createdAt: new Date().toISOString(), ...extra });
  const admin = getAdminClient();
  const parser = new Parser({ timeout: 6000, headers: { "User-Agent": "AgentMissionControl/0.1 (+local development)" } });

  try {
    let workspaceId: string | null = null;
    if (admin) {
      const { data: existingRows, error: existingError } = await admin.from("workspaces").select("id").eq("slug", "ai-data-briefing").limit(1);
      if (existingError) throw new Error(`Supabase workspace lookup failed: ${existingError.message}`);
      workspaceId = existingRows?.[0]?.id ?? null;
      if (!workspaceId) {
        const { data, error } = await admin.from("workspaces").insert({ name: "AI & Data Briefing", slug: "ai-data-briefing" }).select("id").single();
        if (error) throw new Error(`Supabase workspace setup failed: ${error.message}`);
        workspaceId = data?.id ?? null;
      }
      if (!workspaceId) throw new Error("Supabase did not return a workspace ID. Apply the project migration before running missions.");
      if (workspaceId) {
        const { error: sourceError } = await admin.from("sources").upsert(DEFAULT_SOURCES.map((s) => ({ workspace_id: workspaceId, name: s.name, url: s.url, feed_url: s.feedUrl })), { onConflict: "workspace_id,feed_url" });
        if (sourceError) throw new Error(`Supabase source setup failed: ${sourceError.message}`);
        const { error: runError } = await admin.from("mission_runs").insert({ id: runId, workspace_id: workspaceId, trace_id: traceId, status: "running" });
        if (runError) throw new Error(`Supabase run creation failed: ${runError.message}`);
      }
    }

    const ingestStart = Date.now();
    const settled = await Promise.allSettled(DEFAULT_SOURCES.map(async (source) => ({ source, feed: await parser.parseURL(source.feedUrl) })));
    if (isCancelled(signal)) throw new DOMException("Mission cancelled", "AbortError");
    const candidates: Array<FeedItem & { sourceName: string }> = [];
    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        push("source.checked", DEFAULT_SOURCES[i].name, "Scout", `${result.value.feed.items.length} feed items found`);
        result.value.feed.items.slice(0, 8).forEach((item) => candidates.push({ ...item, sourceName: result.value.source.name }));
      } else push("source.checked", DEFAULT_SOURCES[i].name, "Scout", "Feed unavailable; run continued");
    });
    await exportSpan({ traceId, parentSpanId: rootSpanId, name: "ingest.feeds", startedAt: ingestStart, attributes: { sources: DEFAULT_SOURCES.length, candidates: candidates.length } });

    const unique = new Map<string, FeedItem & { sourceName: string; hash: string; canonicalUrl: string }>();
    let duplicates = 0;
    const existingHashes = new Set<string>();
    if (admin && workspaceId) {
      const { data } = await admin.from("articles").select("content_hash").eq("workspace_id", workspaceId).limit(1000);
      data?.forEach((row) => existingHashes.add(row.content_hash));
    }
    for (const item of candidates) {
      if (!item.title || !item.link) continue;
      const canonicalUrl = canonicalize(item.link);
      const hash = fingerprint(`${item.title}|${item.contentSnippet ?? item.content ?? ""}`);
      const titleKey = normalize(item.title);
      if (existingHashes.has(hash) || unique.has(titleKey)) { duplicates++; push("article.duplicate", "Memory", "Scout", `Ignored: ${item.title}`); continue; }
      unique.set(titleKey, { ...item, hash, canonicalUrl });
    }
    const fresh = [...unique.values()].slice(0, 10);
    fresh.forEach((item) => push("article.discovered", item.sourceName, "Scout", item.title ?? "Untitled"));

    if (admin && workspaceId && fresh.length) {
      const { data: sources } = await admin.from("sources").select("id,name").eq("workspace_id", workspaceId);
      await admin.from("articles").upsert(fresh.map((item) => ({ workspace_id: workspaceId, source_id: sources?.find((s) => s.name === item.sourceName)?.id, canonical_url: item.canonicalUrl, title: item.title!, author: item.creator ?? item.author, published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null, excerpt: (item.contentSnippet ?? "").slice(0, 600), content_hash: item.hash, normalized_title: normalize(item.title!) })), { onConflict: "workspace_id,canonical_url", ignoreDuplicates: true });
    }

    const requestedModel = request.headers.get("x-llm-model")?.trim();
    const model = requestedModel && /^[a-zA-Z0-9._:-]{2,128}$/.test(requestedModel) ? requestedModel : process.env.OPENAI_MODEL ?? "gpt-6-luna";
    const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined }) : null;
    let markdown = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let selectedCount = Math.min(3, fresh.length);
    push("agent.started", "Scout", "Curator", `${fresh.length} new articles; ${duplicates} duplicates removed`);

    if (openai && fresh.length) {
      const memory = admin && workspaceId ? (await admin.from("editorial_memory").select("preferences").eq("workspace_id", workspaceId).maybeSingle()).data?.preferences : null;
      const sourceText = fresh.map((item, index) => `[${index + 1}] ${item.title}\nSource: ${item.sourceName}\nURL: ${item.canonicalUrl}\nExcerpt: ${(item.contentSnippet ?? "").slice(0, 800)}`).join("\n\n");
      const curateStart = Date.now();
      const curated = await openai.responses.create({ model, max_output_tokens: 700, input: `You are the curator for a concise AI and data engineering blog. Select at most 3 distinct, high-value items from the sources. Avoid duplicate themes. Return a numbered list containing the exact source number, why it matters, and the source URL. Editorial memory: ${JSON.stringify(memory ?? {})}\n\n${sourceText}` }, { signal });
      inputTokens += curated.usage?.input_tokens ?? 0; outputTokens += curated.usage?.output_tokens ?? 0;
      push("agent.completed", "Curator", "Writer", `Selected ${selectedCount} distinct stories`, { durationMs: Date.now() - curateStart, tokens: (curated.usage?.input_tokens ?? 0) + (curated.usage?.output_tokens ?? 0) });
      await exportSpan({ traceId, parentSpanId: rootSpanId, name: "llm.curate", startedAt: curateStart, attributes: { model, input_tokens: curated.usage?.input_tokens ?? 0, output_tokens: curated.usage?.output_tokens ?? 0 } });

      const writeStart = Date.now();
      if (isCancelled(signal)) throw new DOMException("Mission cancelled", "AbortError");
      const written = await openai.responses.create({ model, max_output_tokens: 900, input: `Write a 300-500 word Markdown blog briefing for technical readers about AI and data engineering. Use only the curated notes below. Include a specific title, short opening synthesis, 2-3 headed sections, a closing takeaway, and inline Markdown source links. Do not invent claims.\n\n${curated.output_text}` }, { signal });
      markdown = written.output_text;
      inputTokens += written.usage?.input_tokens ?? 0; outputTokens += written.usage?.output_tokens ?? 0;
      push("draft.created", "Writer", "Reviewer", "Blog briefing ready for review", { durationMs: Date.now() - writeStart, tokens: (written.usage?.input_tokens ?? 0) + (written.usage?.output_tokens ?? 0) });
      await exportSpan({ traceId, parentSpanId: rootSpanId, name: "llm.write", startedAt: writeStart, attributes: { model, input_tokens: written.usage?.input_tokens ?? 0, output_tokens: written.usage?.output_tokens ?? 0 } });
    } else {
      markdown = fresh.length ? `# AI & data engineering briefing\n\n${fresh.slice(0, 3).map((item) => `## ${item.title}\n\n${(item.contentSnippet ?? "New article detected.").slice(0, 420)}\n\n[Read the source](${item.canonicalUrl})`).join("\n\n")}\n\n---\n*Preview mode: add an OpenAI API key for editorial synthesis.*` : DEMO_RUN.markdown;
      selectedCount = fresh.length ? Math.min(3, fresh.length) : DEMO_RUN.selected;
      push("agent.completed", "Curator", "Writer", `Selected ${selectedCount} distinct stories`, { tokens: 0 });
      push("draft.created", "Writer", "Reviewer", openai ? "No new stories; retained previous briefing" : "Preview briefing created without an LLM call", { tokens: 0 });
    }

    const hasLinks = (markdown.match(/https?:\/\//g) ?? []).length;
    const wordCount = markdown.split(/\s+/).length;
    const grounding = Math.min(30, hasLinks * 10);
    const novelty = fresh.length ? 20 : 8;
    const relevance = /AI|data|Kafka|model|agent/i.test(markdown) ? 20 : 10;
    const clarity = wordCount >= 180 && wordCount <= 650 ? 15 : 10;
    const completeness = markdown.includes("##") ? 15 : 8;
    const qualityScore = grounding + novelty + relevance + clarity + completeness;
    push("quality.scored", "Quality", "Reviewer", `Quality score ${qualityScore}/100`);
    const estimatedCostUsd = inputTokens * 0.00000005 + outputTokens * 0.00000025;

    if (admin && workspaceId) {
      const { error: updateError } = await admin.from("mission_runs").update({ status: "review", quality_score: qualityScore, input_tokens: inputTokens, output_tokens: outputTokens, estimated_cost_usd: estimatedCostUsd, completed_at: new Date().toISOString() }).eq("id", runId);
      if (updateError) throw new Error(`Supabase run update failed: ${updateError.message}`);
      const { error: eventError } = await admin.from("mission_events").insert(events.map((e) => ({ id: e.id, workspace_id: workspaceId, run_id: runId, trace_id: traceId, kind: e.kind, actor: e.actor, target: e.target, message: e.message, duration_ms: e.durationMs, tokens: e.tokens, created_at: e.createdAt })));
      if (eventError) throw new Error(`Supabase event persistence failed: ${eventError.message}`);
      const { error: briefingError } = await admin.from("briefings").insert({ workspace_id: workspaceId, run_id: runId, title: "AI & data engineering briefing", markdown });
      if (briefingError) throw new Error(`Supabase briefing persistence failed: ${briefingError.message}`);
    }

    await exportSpan({ traceId, spanId: rootSpanId, name: "mission.run", startedAt, attributes: { run_id: runId, new_articles: fresh.length, duplicates, quality_score: qualityScore, input_tokens: inputTokens, output_tokens: outputTokens, model } });
    logEvent("info", "mission.completed", { run_id: runId, trace_id: traceId, quality_score: qualityScore, input_tokens: inputTokens, output_tokens: outputTokens });
    return NextResponse.json({ id: runId, traceId, status: "review", startedAt: new Date(startedAt).toISOString(), completedAt: new Date().toISOString(), newArticles: fresh.length, duplicates, selected: selectedCount, qualityScore, inputTokens, outputTokens, estimatedCostUsd, title: "AI & data engineering briefing", markdown, events } satisfies BriefingRun);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown mission failure";
    const cancelled = error instanceof DOMException && error.name === "AbortError";
    logEvent(cancelled ? "info" : "error", cancelled ? "mission.cancelled" : "mission.failed", { run_id: runId, trace_id: traceId, message, stack: error instanceof Error ? error.stack : undefined });
    await exportSpan({ traceId, spanId: rootSpanId, name: "mission.run", startedAt, status: "error", attributes: { run_id: runId, error: message } });
    return NextResponse.json({ error: message, traceId, runId, cancelled }, { status: cancelled ? 499 : 500 });
  } finally {
    finishRun(runId);
  }
}
