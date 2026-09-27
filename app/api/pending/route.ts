import { NextResponse } from "next/server";
import { selectRows } from "@/lib/supabase/rest";

type Article = { id: string; title: string; canonical_url: string; first_seen_at: string; selected: boolean };
type Briefing = { id: string; title: string; status: string; created_at: string };

export async function GET() {
  try {
    const [articles, briefings] = await Promise.all([
      selectRows<Article[]>("articles", "select=id,title,canonical_url,first_seen_at,selected&selected=eq.false&order=first_seen_at.desc&limit=30"),
      selectRows<Briefing[]>("briefings", "select=id,title,status,created_at&status=in.(draft,approved)&order=created_at.desc&limit=30"),
    ]);
    return NextResponse.json({ articles, briefings });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Pending queue unavailable" }, { status: 500 }); }
}
