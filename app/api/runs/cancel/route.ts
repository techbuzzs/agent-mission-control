import { NextResponse } from "next/server";
import { cancelRun } from "@/lib/run-control";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { runId?: string };
  if (!body.runId) return NextResponse.json({ error: "runId is required" }, { status: 400 });
  return NextResponse.json({ ok: cancelRun(body.runId), runId: body.runId });
}
