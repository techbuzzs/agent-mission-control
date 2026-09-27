# Production deployment on Oracle Cloud

Oracle Cloud is the recommended deployment for this project because the application, Grafana, Alloy, Loki, Tempo, Mimir, and their persistent volumes can run together. Vercel is suitable for the Next.js application alone, but it does not deploy this Docker Compose stack.

## 1. Create the VM

Create an Ubuntu 24.04 compute instance with at least 4 OCPUs, 16 GB RAM, and 100 GB of persistent block storage. An Ampere A1 flexible instance is suitable when capacity is available. Reserve a public IP.

In the OCI VCN security list or network security group, allow inbound:

- TCP 22 from your own IP only
- TCP 80 from `0.0.0.0/0`
- TCP 443 and UDP 443 from `0.0.0.0/0`

Do not expose ports 3000, 3001, 3100, 3200, 4317, 4318, 9009, or 12345.

## 2. Configure DNS

Create two DNS A records pointing to the VM public IP:

```text
mission.example.com          → VM public IP
grafana.mission.example.com  → VM public IP
```

Caddy automatically obtains and renews TLS certificates after DNS resolves and ports 80/443 are reachable.

## 3. Install Docker

Install Docker Engine and the Compose plugin using Docker's Ubuntu instructions. Confirm:

```bash
docker --version
docker compose version
```

## 4. Clone and configure

```bash
git clone https://github.com/techbuzzs/agent-mission-control.git
cd agent-mission-control
cp deploy/oracle/.env.production.example .env.production
nano .env.production
```

Set both hostnames, a strong Grafana admin password, the Supabase values, and the OpenAI API key. Never commit `.env.production`.

In Supabase Authentication URL Configuration, add the public Mission Control URL as the site URL and redirect URL.

## 5. Build and start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

The application becomes available at `https://mission.example.com`; Grafana is served at `https://grafana.mission.example.com` and embedded into the application's Grafana tab.

## 6. Validate

```bash
curl -fsS https://mission.example.com/api/health
curl -fsS https://grafana.mission.example.com/api/health
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 app alloy tempo loki mimir grafana
```

Run one briefing and verify its trace in the embedded Grafana tracing dashboard.

## 7. Updates and backups

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Back up the named Docker volumes, especially Grafana, Loki, Tempo, and Mimir. For a later production-hardening phase, migrate telemetry blocks to OCI Object Storage, use OCI Vault for secrets, disable anonymous Grafana access, and add SSO or an authenticated reverse-proxy policy.

## Vercel alternative

The repository also supports a normal Next.js build with `npm run build:next`. Vercel can host only the application while Grafana/LGTM remains on Oracle Cloud or Grafana Cloud. Set all environment variables in Vercel, including `NEXT_PUBLIC_GRAFANA_URL` pointing to the public Grafana hostname. This split deployment is convenient but introduces two platforms, cross-origin embedding, and additional security configuration, so the single-VM Oracle deployment is the recommended first production release.

