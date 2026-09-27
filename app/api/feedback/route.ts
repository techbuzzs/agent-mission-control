import { NextResponse } from "next/server";
import { insertRows, selectRows, updateRows } from "@/lib/supabase/rest";
import { logEvent } from "@/lib/telemetry";

type Briefing = { id: string; workspace_id: string };
type Memory = { preferences: { preferred_topics?: string[]; avoid?: string[]; style_notes?: string[] } };

export async function POST(request: Request) {
  const body = await request.json() as { runId?: string; verdict?: "approved" | "rejected" | "edited"; rating?: number; reasons?: string[]; note?: string; markdown?: string };
  if (!body.runId || !body.verdict) return NextResponse.json({ error: "runId and verdict are required" }, { status: 400 });
  try {
    const briefing = (await selectRows<Briefing[]>("briefings", `select=id,workspace_id&run_id=eq.${body.runId}&limit=1`))[0];
    if (!briefing) return NextResponse.json({ error: "Briefing not found. Run a new briefing after configuring Supabase." }, { status: 404 });
    const briefingStatus = body.verdict === "approved" ? "approved" : body.verdict === "rejected" ? "rejected" : "draft";
    await insertRows("feedback", { workspace_id: briefing.workspace_id, briefing_id: briefing.id, verdict: body.verdict, rating: body.rating, reasons: body.reasons ?? [], note: body.note, edited_markdown: body.markdown });
    await updateRows("briefings", `id=eq.${briefing.id}`, { status: briefingStatus, markdown: body.markdown, updated_at: new Date().toISOString() });
    await updateRows("mission_runs", `id=eq.${body.runId}`, { status: body.verdict === "approved" ? "approved" : "review" });
    const saved = (await selectRows<Memory[]>("editorial_memory", `select=preferences&workspace_id=eq.${briefing.workspace_id}&limit=1`))[0];
    const preferences = saved?.preferences ?? { preferred_topics: [], avoid: [], style_notes: [] };
    const note = body.note?.trim(); if (note) preferences.style_notes = [...(preferences.style_notes ?? []), note].slice(-12);
    await insertRows("editorial_memory", { workspace_id: briefing.workspace_id, preferences, updated_at: new Date().toISOString() }, true);
    logEvent("info", "feedback.recorded", { run_id: body.runId, verdict: body.verdict, rating: body.rating });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Feedback persistence failed" }, { status: 500 }); }
}
