import { NextResponse } from "next/server";
import { publishToNotion } from "@/lib/notion";
import { insertRows, selectRows } from "@/lib/supabase/rest";

type Briefing = { id: string; title: string; markdown: string; workspace_id: string };
export async function POST(request: Request) {
  const body = await request.json() as { runId?: string; status?: "draft" | "final"; title?: string; markdown?: string };
  if (!body.runId || !body.status) return NextResponse.json({ error: "runId and status are required" }, { status: 400 });
  try {
    const briefing = (await selectRows<Briefing[]>("briefings", `select=id,title,markdown,workspace_id&run_id=eq.${body.runId}&limit=1`))[0];
    if (!briefing) throw new Error("Briefing not found. Run and save a briefing first.");
    const page = await publishToNotion({ title: body.title || briefing.title, markdown: body.markdown || briefing.markdown, status: body.status });
    await insertRows("notion_publications", { workspace_id: briefing.workspace_id, briefing_id: briefing.id, notion_page_id: page.id, notion_url: page.url, status: body.status });
    return NextResponse.json({ ok: true, page });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Notion publishing failed" }, { status: 500 }); }
}
