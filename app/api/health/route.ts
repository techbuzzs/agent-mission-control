import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "agent-mission-control",
    supabaseConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    telemetryConfigured: Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT),
    model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
  });
}

