import { NextResponse } from "next/server";
import { selectRows } from "@/lib/supabase/rest";
import type { RunHistoryItem } from "@/lib/types";

type Run = { id: string; trace_id: string; status: RunHistoryItem["status"]; started_at: string; completed_at?: string; quality_score?: number; input_tokens: number; output_tokens: number; estimated_cost_usd: number };
type Briefing = { id: string; run_id: string; title: string; markdown: string };
type Feedback = { briefing_id: string; verdict: string; rating?: number };

export async function GET() {
  try {
    const runs = await selectRows<Run[]>("mission_runs", "select=*&order=started_at.desc&limit=50");
    if (!runs.length) return NextResponse.json([]);
    const briefings = await selectRows<Briefing[]>("briefings", `select=id,run_id,title,markdown&run_id=in.(${runs.map((run) => run.id).join(",")})`);
    const feedback = briefings.length ? await selectRows<Feedback[]>("feedback", `select=briefing_id,verdict,rating&briefing_id=in.(${briefings.map((briefing) => briefing.id).join(",")})&order=created_at.desc`) : [];
    return NextResponse.json(runs.map((run) => { const briefing = briefings.find((item) => item.run_id === run.id); const review = feedback.find((item) => item.briefing_id === briefing?.id); return { id: run.id, traceId: run.trace_id, status: run.status, startedAt: run.started_at, completedAt: run.completed_at, qualityScore: run.quality_score ?? 0, inputTokens: run.input_tokens, outputTokens: run.output_tokens, estimatedCostUsd: Number(run.estimated_cost_usd), title: briefing?.title ?? "Briefing", markdown: briefing?.markdown ?? "", feedbackVerdict: review?.verdict, feedbackRating: review?.rating }; }) satisfies RunHistoryItem[]);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase history failed" }, { status: 500 }); }
}
