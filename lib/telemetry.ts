import { randomUUID } from "node:crypto";

type SpanInput = {
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  attributes?: Record<string, string | number | boolean>;
  status?: "ok" | "error";
};

export function newTraceId() {
  return randomUUID().replaceAll("-", "");
}

export function newSpanId() {
  return randomUUID().replaceAll("-", "").slice(0, 16);
}

export async function exportSpan(input: SpanInput) {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;
  const end = input.endedAt ?? Date.now();
  const attrs = Object.entries(input.attributes ?? {}).map(([key, value]) => ({
    key,
    value: typeof value === "number" ? { doubleValue: value } : typeof value === "boolean" ? { boolValue: value } : { stringValue: String(value) },
  }));
  const body = {
    resourceSpans: [{
      resource: { attributes: [{ key: "service.name", value: { stringValue: "agent-mission-control" } }] },
      scopeSpans: [{ scope: { name: "mission-control" }, spans: [{
        traceId: input.traceId,
        spanId: input.spanId ?? newSpanId(),
        parentSpanId: input.parentSpanId,
        name: input.name,
        kind: 1,
        startTimeUnixNano: `${input.startedAt}000000`,
        endTimeUnixNano: `${end}000000`,
        attributes: attrs,
        status: { code: input.status === "error" ? 2 : 1 },
      }] }],
    }],
  };
  try {
    await fetch(`${endpoint.replace(/\/$/, "")}/v1/traces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Telemetry must never break a mission run.
  }
}

export function logEvent(level: "info" | "error", event: string, fields: Record<string, unknown>) {
  const entry = { timestamp: new Date().toISOString(), level, event, service: "agent-mission-control", ...fields };
  console[level](JSON.stringify(entry));
  const loki = process.env.LOKI_PUSH_URL ?? (process.env.VERCEL ? undefined : "http://localhost:3100/loki/api/v1/push");
  if (loki) void fetch(loki, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ streams: [{ stream: { service_name: "agent-mission-control", level, event }, values: [[`${Date.now()}000000`, JSON.stringify(entry)]] }] }) }).catch(() => undefined);
}
