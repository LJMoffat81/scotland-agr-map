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

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
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

**Phase 0 complete:** monorepo scaffold, 3m grid snap, placeholder AGR engine, Scotland map UI.

**Phase 1 next:** ROS/HPI ETL, Wightman residual valuation, W3W nonprofit API.