# Insights campaign dashboard deployment

This archive is an overlay for the current project. Copy its files over the
matching paths in the existing Next.js/FastAPI project. It does not replace the
existing Dockerfiles, Compose file, environment file, Nginx config, or Next.js
configuration.

## What is included

- Daily Performance is grouped by campaign, with Impressions, Video Views, and
  Engagement metric switches.
- Three campaign ranking charts show average Impressions, Video Views, and
  Engagement.
- Platform Summary remains in place.
- Campaign Inspect is available at `/insights/campaign/<campaign-name>`.
- Campaign Inspect always uses the selected campaign's full start/end-date
  lifetime and no longer accepts a user-selected date window.
- Dashboard filters support multiple selections and remain cascading.
- Displayed currency is MNT, converted from stored USD values at ₮3,594/USD.
- Sales, Completion Rate, CPC, and CPM are explicitly declared demo metrics in
  `backend/app/repositories/campaign_detail.py`.
- Spend and all available social metrics remain Oracle-backed.

## Build locally in PowerShell

Run these from the project root:

```powershell
docker build --tag insight-api:latest .\backend
docker build --tag insight-next:latest .

docker save --output .\insight-api.tar insight-api:latest
docker save --output .\insight-next.tar insight-next:latest
```

Use the existing PowerShell SCP/deployment script to transfer both tar files.

## Load and recreate on the Linux server

Run these from the server's `INSIGHT` directory:

```bash
docker load -i insight-api.tar
docker load -i insight-next.tar

docker compose up -d --force-recreate insight-api insight
docker compose ps
docker compose logs --tail 100 insight-api insight
```

Deploy and validate `insight-api` before opening the Next.js page because the
dashboard is server-rendered and immediately calls all dashboard endpoints.

## Backend checks

Replace the dates and campaign name with a known campaign. URL-encode the
campaign name when calling it in a URL.

```bash
docker compose exec -T insight-api python - <<'PY'
import urllib.parse
import urllib.request

base = "http://127.0.0.1:8000"
common = "start=2026-04-19&end=2026-08-17&includeDailyContent=true"
campaign = urllib.parse.quote("REPLACE WITH A REAL CAMPAIGN")

paths = [
    f"/dashboard/summary?{common}",
    f"/dashboard/timeseries?{common}",
    f"/dashboard/rankings?{common}",
    f"/dashboard/campaign-detail?campaign={campaign}",
]

for path in paths:
    with urllib.request.urlopen(base + path, timeout=120) as response:
        body = response.read().decode()
        print(response.status, path, body[:300])
PY
```

Then verify the public routes:

```bash
curl -k -I https://companywebsite.customhandle/insights/
curl -k -I "https://companywebsite.customhandle/insights/api/dashboard/rankings?start=2026-04-19&end=2026-08-17"
```

The first response should end at HTTP 200. The API route should also return
HTTP 200.
