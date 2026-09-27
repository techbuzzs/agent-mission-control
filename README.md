# Agent Mission Control

A local-first, observable multi-agent workflow for turning a small set of Substack feeds into a deduplicated AI and data-engineering blog briefing.

## What works

- RSS ingestion from the configured Substack publications
- metadata-only article memory and pre-LLM duplicate suppression
- low-token curator and writer agents through the OpenAI Responses API
- deterministic 0–100 quality scoring
- editable draft, approval/rejection, and editorial feedback memory
- zoomable agent communication graph and event stream
- in-app token, cost, latency, and trace waterfall visualization
- embedded Grafana overview, tracing, logs, and metrics dashboards
- persisted run history with output, quality, token usage, cost, and editorial decision
- OpenTelemetry export through Grafana Alloy to Tempo, Loki, and Mimir
- provisioned Grafana data sources and dashboard
- Supabase schema, indexes, Realtime tables, and row-level security

## Quick start

1. Follow [docs/MANUAL_SETUP.md](docs/MANUAL_SETUP.md).
2. Run `npm run telemetry:up`.
3. Run `npm run dev`.
4. Open http://localhost:5173 and click **Run briefing**.

Without server-side keys the interface runs in a safe preview mode. Add the service-role and OpenAI keys to `.env.local` for persisted, real agent runs.

## Architecture

```text
Substack RSS → Scout/dedup → Curator LLM → Writer LLM → Quality → Human review
                      ↘ Supabase memory ↗                ↘ feedback memory

Application → OTLP → Grafana Alloy → Tempo / Loki
                     metrics scrape → Mimir → Grafana
```

The runtime contract is event-based, so a Codex or other agent adapter can be added without changing the UI event model.

## Production deployment

Use the packaged Oracle Cloud deployment for the complete application and LGTM stack. See [docs/DEPLOY_ORACLE.md](docs/DEPLOY_ORACLE.md). Vercel remains an option for the web application only when Grafana and the telemetry backends are hosted separately.
