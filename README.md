# Scotland AGR Map

Interactive Annual Ground Rent map for Scotland. Each **What3Words 3×3 m square** (9 sqm) gets its own AGR estimate based on SLRG methodology:

- **Roger Sandilands** — macro rent theory, ATCOR, Scotland GDP scenarios
- **Andy Wightman** — site valuation (residual method, HABU)
- **Duncan Pickard** — de-speculation (economic rent, not market bubble price)

Built for [SLRG](https://www.slrg.scot) as a standalone public education and advocacy tool.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, MapLibre GL JS |
| Backend | Python FastAPI |
| Config | `data/config/agr.yaml` |
| Tiles | OpenStreetMap (free) |
| W3W | Nonprofit API (apply in Phase 0) |

## Quick start

### Build valuation data (first run / monthly refresh)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m etl.build_processed
```

Downloads UK HPI from HM Land Registry (free) and writes `data/processed/councils.json`.

```powershell
python -m etl.build_boundaries   # council polygons
python -m etl.build_wards        # Glasgow Ward 18 validation area
```

Optional: set `W3W_API_KEY` in `backend/.env` after SLRG nonprofit approval.

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn api.main:app --reload --app-dir .
```

API: http://127.0.0.1:8000  
Docs: http://127.0.0.1:8000/docs

### Frontend

```powershell
cd frontend
npm install
$env:NEXT_PUBLIC_API_URL="http://127.0.0.1:8000"
npm run dev
```

App: http://localhost:3000

## Project structure

```
scotland-agr-map/
├── frontend/          # Next.js + MapLibre map UI
├── backend/           # FastAPI AGR engine
├── data/config/       # agr.yaml (SLRG parameters)
├── docs/              # Methodology and references
└── docker-compose.yml
```

## Legacy prototype

The original Streamlit prototype is preserved at git tag `legacy/streamlit-prototype`.

## Status

**Phase 0 complete:** monorepo scaffold, 3m grid snap, Scotland map UI.

**Phase 1 complete:** UK HPI ETL, council-area lookup, Wightman residual valuation, postcode search (postcodes.io).

**Phase 2 complete:** Full AGR breakdown panel, three policy scenarios, live methodology page.

**Phase 3 complete:** Council boundary polygons, ROS INSPIRE parcel lookup, Glasgow Ward 18 validation, W3W API support.

**Phase 4 complete:** Vercel + Railway deployment config, CI, economist sign-off workflow.

## Deploy (standalone site)

Free-tier friendly: **Vercel** (frontend) + **Railway** (API). No paid map or data APIs required.

### 1. Railway — API

1. Create a project at [railway.app](https://railway.app) and connect this GitHub repo.
2. Railway reads `railway.toml` and builds `backend/Dockerfile` (includes `data/`).
3. Set environment variables:

| Variable | Value |
|----------|-------|
| `ALLOWED_ORIGINS` | Your Vercel URL, e.g. `https://scotland-agr-map.vercel.app` |
| `ALLOW_VERCEL_PREVIEWS` | `true` (allows `*.vercel.app` preview deploys) |
| `W3W_API_KEY` | Optional — after SLRG nonprofit approval |

4. Copy the public Railway URL (e.g. `https://scotland-agr-map-api.up.railway.app`).

Health check: `GET /health`

### 2. Vercel — frontend

1. Import the repo at [vercel.com](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set environment variable **before first deploy**:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your Railway API URL |

4. Deploy. `frontend/vercel.json` is included.

### 3. Custom domain (optional)

- Point `agr.slrg.scot` (or similar) to Vercel.
- Add that URL to Railway `ALLOWED_ORIGINS`.

### Economist sign-off

Parameters live in `data/config/agr.yaml`. When the SLRG economist approves, update:

```yaml
economist_signoff:
  status: approved
  signed_by: "Name, credentials"
  signed_at: "2026-06-08"
```

Redeploy Railway. Status appears on `/signoff` and the methodology page.

### Docker (self-hosted alternative)

```powershell
docker compose up --build
```

App: http://localhost:3000 · API: http://localhost:8000