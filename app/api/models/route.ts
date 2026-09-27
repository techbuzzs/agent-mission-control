import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    provider: process.env.OPENAI_BASE_URL ? "openai-compatible" : "openai",
    configuredModel: process.env.OPENAI_MODEL ?? "gpt-6-luna",
    baseUrlConfigured: Boolean(process.env.OPENAI_BASE_URL),
    models: ["gpt-6-luna", "gpt-6-sol", "gpt-6-astra", "gpt-4.1-mini", "gpt-4o-mini"],
    note: "Select a model for this browser session. API credentials remain server-side in environment variables.",
  });
}
