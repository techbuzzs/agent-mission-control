# Manual setup

## 1. Local prerequisites

- Node.js 22 or later
- Docker Desktop with Docker Compose
- A Supabase project
- An OpenAI API account with billing/credits enabled

## 2. Supabase

1. Open the Supabase SQL editor for the project.
2. Paste and run `supabase/migrations/202609270001_initial.sql`.
3. In **Authentication → Providers → Email**, enable email/password authentication. For local development, turn off email confirmation or configure SMTP.
4. In **Authentication → URL Configuration**, set the site URL to `http://localhost:5173` and add it as a redirect URL.
5. Open **Project Settings → API** and copy the service-role key. Never put it in browser code or commit it.
6. Verify that Realtime lists `mission_events`, `mission_runs`, and `briefings` in the `supabase_realtime` publication.

## 3. Application environment

Copy `.env.example` to `.env.local`. The project URL and publishable key are already present in the local ignored file. Add:

```env
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-6-luna
```

The application works in preview mode without the two server-side keys, but persistence and real model calls require them.

## 4. Start the observability stack

From the repository root:

```powershell
npm run telemetry:up
docker compose -f observability/docker-compose.yml ps
```

Services:

- Grafana: http://localhost:3001 (`admin` / `admin` for admin access)
- Grafana Alloy: http://localhost:12345
- Loki: http://localhost:3100/ready
- Tempo: http://localhost:3200/ready
- Mimir: http://localhost:9009/ready
- OTLP HTTP receiver: http://localhost:4318

Grafana is provisioned with Tempo, Loki, and Mimir data sources plus the **Agent Mission Control — LLM operations** dashboard.
The application embeds four provisioned dashboards—LLM operations, tracing, logs, and metrics—under its **Grafana** tab. Local Grafana permits anonymous Viewer access and iframe embedding; do not use that public-access policy unchanged for sensitive production workloads.

## 5. Run the application

```powershell
npm install
npm run dev
```

Open http://localhost:5173. Click **Run briefing**. A completed run should show:

- four feed checks;
- new and duplicate article counts;
- curator and writer events;
- a blog briefing ready for review;
- token and estimated-cost totals;
- a quality score;
- a trace ID that opens in Grafana.

## 6. Verify telemetry

1. Run a briefing after the LGTM stack is healthy.
2. Open the app's **Telemetry** tab and click **Explore in Grafana**.
3. In Grafana, search Tempo with `{ resource.service.name = "agent-mission-control" }` if the direct trace link is not yet indexed.
4. Open the provisioned dashboard to verify Mimir metrics.
5. In Loki Explore, use `{service_name="agent-mission-control"}`. Span-derived logs may take a few seconds to appear.

## 7. Data and privacy behavior

The database stores source and article metadata, a short feed-provided excerpt, a normalized title, and a one-way SHA-256 fingerprint. It does not persist full article bodies. Prompts and model responses are not exported to telemetry. Trace attributes contain identifiers, timings, token counts, model name, result state, and quality score.

## 8. Production direction on Oracle Cloud

Start with one Oracle Linux VM running the application and the LGTM containers behind HTTPS, with persistent block volumes and backups. Keep Supabase hosted initially. For higher availability, separate the application from telemetry storage, use OCI Object Storage for Loki/Tempo/Mimir-compatible object storage, and put secrets in OCI Vault. Do not expose OTLP, Loki, Tempo, or Mimir ingestion ports publicly.
# Debugging a local run

The app has a Node.js backend, not a Python backend. To run it in a separate visible PowerShell window with server lifecycle/error logs, use:

```powershell
cd E:\Work\codex\agent-mission-control
$env:DEBUG_MISSION_CONTROL = "1"
$env:NODE_OPTIONS = "--trace-warnings"
npm run dev
```

Then run a briefing and watch that terminal. Health, Prometheus metrics, and a compact debug description are also available at `/api/health`, `/api/metrics`, and `/api/debug`.

`localhost:4318` is an OTLP ingestion receiver, not a browser UI. Use Grafana at `http://localhost:3001` to inspect its telemetry.

If a run reports `Supabase workspace setup failed`, open the Supabase SQL editor and apply [the initial migration](../supabase/migrations/202609270001_initial.sql). The reference ID in the error can be supplied to Supabase support if it persists.
