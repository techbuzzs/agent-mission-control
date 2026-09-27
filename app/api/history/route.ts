import { NextResponse } from "next/server";
import { DEMO_RUN } from "@/lib/demo";
import { getAdminClient } from "@/lib/supabase/admin";
import type { RunHistoryItem } from "@/lib/types";

export async function GET() {
  const admin = getAdminClient();
  if (!admin) {
    const now = Date.now();
    const demo: RunHistoryItem[] = [
      { id: DEMO_RUN.id, traceId: DEMO_RUN.traceId, status: "approved", startedAt: DEMO_RUN.startedAt, completedAt: DEMO_RUN.completedAt, qualityScore: 87, inputTokens: 3240, outputTokens: 612, estimatedCostUsd: DEMO_RUN.estimatedCostUsd, title: DEMO_RUN.title, markdown: DEMO_RUN.markdown, feedbackVerdict: "approved", feedbackRating: 5 },
      { id: "run-demo-0926", traceId: "36a2ae97fd334291ac891e4fd4d65ccb", status: "review", startedAt: new Date(now - 86400000).toISOString(), completedAt: new Date(now - 86340000).toISOString(), qualityScore: 79, inputTokens: 2870, outputTokens: 544, estimatedCostUsd: 0.00028, title: "AI infrastructure briefing", markdown: "## AI infrastructure briefing\n\nA compact review of evaluation, streaming, and local inference developments.", feedbackVerdict: "edited", feedbackRating: 4 },
      { id: "run-demo-0925", traceId: "8b5f62d50462463ca4588480b32c9054", status: "rejected", startedAt: new Date(now - 172800000).toISOString(), completedAt: new Date(now - 172750000).toISOString(), qualityScore: 61, inputTokens: 2550, outputTokens: 701, estimatedCostUsd: 0.0003, title: "Weekly AI briefing", markdown: "## Weekly AI briefing\n\nDraft rejected because it repeated previously covered themes.", feedbackVerdict: "rejected", feedbackRating: 2 },
    ];
    return NextResponse.json(demo);
  }

  const { data: runs, error } = await admin.from("mission_runs").select("*").order("started_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (runs ?? []).map((run) => run.id);
  if (!ids.length) return NextResponse.json([]);
  const { data: briefings } = await admin.from("briefings").select("id,run_id,title,markdown,status").in("run_id", ids);
  const briefingIds = (briefings ?? []).map((briefing) => briefing.id);
  const { data: feedback } = briefingIds.length ? await admin.from("feedback").select("briefing_id,verdict,rating,created_at").in("briefing_id", briefingIds).order("created_at", { ascending: false }) : { data: [] };
  const history: RunHistoryItem[] = (runs ?? []).map((run) => {
    const briefing = briefings?.find((item) => item.run_id === run.id);
    const review = feedback?.find((item) => item.briefing_id === briefing?.id);
    return { id: run.id, traceId: run.trace_id, status: run.status, startedAt: run.started_at, completedAt: run.completed_at, qualityScore: run.quality_score ?? 0, inputTokens: run.input_tokens, outputTokens: run.output_tokens, estimatedCostUsd: Number(run.estimated_cost_usd), title: briefing?.title ?? "Briefing", markdown: briefing?.markdown ?? "", feedbackVerdict: review?.verdict, feedbackRating: review?.rating };
  });
  return NextResponse.json(history);
}
