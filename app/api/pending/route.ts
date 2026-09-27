import { NextResponse } from "next/server";
import { selectRows } from "@/lib/supabase/rest";

type Article = { id: string; title: string; canonical_url: string; first_seen_at: string; selected: boolean };
type Briefing = { id: string; title: string; status: string; created_at: string };
type Publication = { briefing_id: string; status: string };

export async function GET() {
  try {
    const [articles, briefings] = await Promise.all([
      selectRows<Article[]>("articles", "select=id,title,canonical_url,first_seen_at,selected&selected=eq.false&order=first_seen_at.desc&limit=30"),
      selectRows<Briefing[]>("briefings", "select=id,title,status,created_at&status=in.(draft,approved)&order=created_at.desc&limit=30"),
    ]);
    const publications = briefings.length ? await selectRows<Publication[]>("notion_publications", `select=briefing_id,status&briefing_id=in.(${briefings.map((briefing) => briefing.id).join(",")})`) : [];
    const publishedIds = new Set(publications.filter((publication) => publication.status === "final").map((publication) => publication.briefing_id));
    return NextResponse.json({ articles, briefings: briefings.filter((briefing) => !publishedIds.has(briefing.id)) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Pending queue unavailable" }, { status: 500 }); }
}
