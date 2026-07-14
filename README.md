# Scotland AGR Map

Professional **Annual Ground Rent** assessment tool for Scotland (SLRG-aligned).  
Each **What3Words 3×3 m square** gets a residual AGR estimate; the public UI leads with a clear £/year figure.

**Build standard:** [docs/PROFESSIONAL_STANDARD.md](docs/PROFESSIONAL_STANDARD.md) · **Data policy:** [docs/DATA_LICENSING.md](docs/DATA_LICENSING.md) (no portal scraping).

**Operational charge maths (valuer residual roll):**  
HABU existing use → **MV − DRC** (Wightman residual) → Pickard economic site capital → **× 5% yield** → Sandilands scenarios.

**Intellectual lineage** (methodology and breakdown notes — does not change residual maths):

| Layer | Thinker | Role |
|-------|---------|------|
| Classical | **Adam Smith** | Ground-rent as distinct, taxable revenue |
| Classical | **David Ricardo** | Differential / locational rent |
| Scottish OG | **William Ogilvie** | Equal natural right in land |
| Programme | **Henry George** | Full site-rent recovery |
| Public finance | **Mason Gaffney** | ATCOR / EBCOR |
| Cycles | **Fred Harrison** | Boom–bust; speculative land prices |
| Modern theory | **Joseph Stiglitz** | Public goods capitalise into land |
| Housing/land | **Laurie Macfarlane** | Housing crisis = land market |
| Community contribution | **Martin Adams (Unitism)** | Land rent shared; optional citizen dividend |
| Scotland macro | **Roger Sandilands** | Rent pool; income-tax shift |
| Valuation | **Andy Wightman** | Residual / HABU site capital |
| Charge base | **Duncan Pickard** | Economic rent after speculation |

Also see: Mill, Paine, **School of Cooperative Individualism** (Georgist source library), **Lars Doucet / CLE** (OpenAVMKit mass appraisal path), McEwen, Churchill 1909, Scottish Land Commission — [docs/methodology.md](docs/methodology.md) · [docs/valuation-roadmap.md](docs/valuation-roadmap.md).

**Integrity:** map residual £ figures are a research estimate (not a rates bill). The Sandilands national rent pool is a separate macro concept used for equal-share and income-tax scaling — map squares are not calibrated to sum to that pool. See methodology “Two rent concepts”.

**Product clarity:** the map default is a plain £/year estimate and short policy choices; valuer steps, integrity caveats, and full lineage live under **How calculated** / **About AGR** and [methodology](docs/methodology.md).

**What3Words:** every estimate snaps to a **3×3 m W3W-aligned cell**. Plot-scale £/year is the household headline; the cell line always shows the 9 m² square charge. With `W3W_API_KEY`, the API reverse-geocodes `///three.word.address` on every lookup.

Built for [SLRG](https://www.slrg.scot) as a standalone public education and advocacy tool.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, MapLibre GL JS |
| Backend | Python FastAPI + valuation service |
| Data layer | `backend/datasources/` (HPI residual + sales schema/store) |
| Config | `data/config/agr.yaml`, `sources.yaml` |
| Sales path | ROS / licensed extracts → `SalesStore` (fixtures for CI only) |
| Tiles | OpenStreetMap (free) |
| W3W | 3 m grid + optional API key |

## Professional data stance

- **Allowed:** UK HPI, ROS open/licensed products, postcodes.io, documented rebuild tables  
- **Forbidden:** scraping Zoopla, Rightmove, ESPC, or grey-market scraped dumps  
- **Next:** acquire ROS pilot sales for Ward 18 / Glasgow → optional OpenAVMKit comparison  

See [docs/DATA_ACQUISITION.md](docs/DATA_ACQUISITION.md).

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

| Endpoint | Purpose |
|----------|---------|
| `GET /square` | AGR for a point / W3W cell |
| `GET /assessment/report` | Professional JSON or markdown report (`format=markdown`) |
| `GET /validation/ratio-study` | Residual vs sales-comp ratios (Ward 18 samples) |
| `GET /validation/ward18-qa-pack` | Full Ward 18 QA: spatial + ratios + mini-roll |
| `GET /sales/status` | Sales pipeline status |

Ops: [docs/OPERATING.md](docs/OPERATING.md) · `.\scripts\run_professional_local.ps1`

### Professional workflow

```powershell
# Validate synthetic fixtures
python -m etl.ingest_sales --path ../data/fixtures/sales/ward18_synthetic.jsonl

# After ROS extract arrives (see docs/ROS_ENQUIRY.md)
python -m etl.convert_sales_csv --input ../data/licensed/raw.csv --output ../data/licensed/sales.jsonl ...
python -m etl.ingest_sales --path ../data/licensed/sales.jsonl --require-production
```

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