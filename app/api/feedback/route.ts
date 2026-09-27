import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/telemetry";

export async function POST(request: Request) {
  const body = await request.json() as { runId?: string; verdict?: "approved" | "rejected" | "edited"; rating?: number; reasons?: string[]; note?: string; markdown?: string };
  const admin = getAdminClient();
  if (!body.runId || !body.verdict) return NextResponse.json({ error: "runId and verdict are required" }, { status: 400 });
  if (!admin) return NextResponse.json({ ok: true, preview: true });
  const { data: briefing } = await admin.from("briefings").select("id,workspace_id").eq("run_id", body.runId).single();
  if (!briefing) return NextResponse.json({ error: "Briefing not found" }, { status: 404 });
  await admin.from("feedback").insert({ workspace_id: briefing.workspace_id, briefing_id: briefing.id, verdict: body.verdict, rating: body.rating, reasons: body.reasons ?? [], note: body.note, edited_markdown: body.markdown });
  await admin.from("briefings").update({ status: body.verdict === "approved" ? "approved" : body.verdict === "rejected" ? "rejected" : "draft", markdown: body.markdown, updated_at: new Date().toISOString() }).eq("id", briefing.id);
  await admin.from("mission_runs").update({ status: body.verdict === "approved" ? "approved" : "review" }).eq("id", body.runId);
  const { data: memory } = await admin.from("editorial_memory").select("preferences").eq("workspace_id", briefing.workspace_id).maybeSingle();
  const preferences = memory?.preferences ?? { preferred_topics: [], avoid: [], style_notes: [] };
  const note = body.note?.trim();
  if (note) preferences.style_notes = [...(preferences.style_notes ?? []), note].slice(-12);
  await admin.from("editorial_memory").upsert({ workspace_id: briefing.workspace_id, preferences, updated_at: new Date().toISOString() });
  logEvent("info", "feedback.recorded", { run_id: body.runId, verdict: body.verdict, rating: body.rating });
  return NextResponse.json({ ok: true });
}

