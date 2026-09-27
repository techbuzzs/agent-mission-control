import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "agent-mission-control",
    logging: "Mission lifecycle and errors are written to the terminal running npm run dev:debug and forwarded to Loki when OTLP is enabled.",
    endpoints: { health: "/api/health", metrics: "/api/metrics", runs: "/api/runs" },
  });
}
