import { NextResponse } from "next/server";
import { supabaseHealth } from "@/lib/supabase/rest";

export async function GET() {
  const supabase = await supabaseHealth();
  const local = process.env.VERCEL !== "1" && !process.env.VERCEL_URL;
  const check = async (url: string | undefined) => {
    if (!url) return { ok: false, reason: "Not configured" };
    try { const result = await fetch(url, { signal: AbortSignal.timeout(2000), cache: "no-store" }); return { ok: result.ok, reason: result.ok ? undefined : `HTTP ${result.status}` }; }
    catch { return { ok: false, reason: "Unavailable" }; }
  };
  const [loki, mimir, tempo, grafana] = await Promise.all([
    local ? check("http://localhost:3100/ready") : Promise.resolve({ ok: false, reason: "Local-only service" }),
    local ? check("http://localhost:9009/ready") : Promise.resolve({ ok: false, reason: "Local-only service" }),
    local ? check("http://localhost:3200/ready") : Promise.resolve({ ok: false, reason: "Local-only service" }),
    check(process.env.GRAFANA_URL),
  ]);
  return NextResponse.json({
    ok: supabase.ok,
    mode: local ? "localhost" : "production",
    service: "agent-mission-control",
    supabaseConfigured: supabase.ok,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    telemetryConfigured: Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT),
    model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
    services: { supabase, openai: { ok: Boolean(process.env.OPENAI_API_KEY), reason: process.env.OPENAI_API_KEY ? undefined : "API key missing" }, alloy: { ok: local && Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT), reason: local ? undefined : "Local-only service" }, loki, mimir, tempo, grafana },
  });
}
