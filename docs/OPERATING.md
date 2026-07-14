# Operating the professional tool

## Daily local loop

```powershell
# One-shot checks + demo roll
.\scripts\run_professional_local.ps1

# API
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn api.main:app --reload --app-dir .

# UI (other terminal)
cd frontend
npm run dev
```

## Core endpoints

| Endpoint | Use |
|----------|-----|
| `GET /square?lat=&lng=` | Live AGR for a W3W cell |
| `GET /assessment/report?format=markdown\|json` | Downloadable assessment pack |
| `GET /validation/ward18-qa-pack` | Spatial + ratio + mini-roll for Ward 18 |
| `GET /validation/ratio-study` | Residual vs sales-comp ratios |
| `GET /sales/status` | Sales store status |
| `GET /layers/councils-agr` | National council AGR choropleth |
| `GET /layers/w3w-grid?...` | Viewport 3×3 m cells with AGR (max_cells) |

### Map layers (product)

| Layer | Coverage | When |
|-------|----------|------|
| Council AGR | All Scotland | Overview choropleth |
| W3W grid | Current map view | Zoom ≥ 12; every cell up to cap (then sampled) |
| Click | Any cell | Full residual assessment |

Full national 3 m precompute is intentionally not stored (~billions of cells).

## Batch mini-roll (CLI)

```powershell
cd backend
python -m etl.batch_assess --ward18 --samples 12 --out ../data/processed/roll_ward18.csv --format csv --include-sales
```

## When ROS data arrives

1. Save extract under `data/licensed/` with `LICENSE.txt`  
2. Convert if needed (`etl.convert_sales_csv`)  
3. `python -m etl.ingest_sales --path ../data/licensed/sales.jsonl --require-production`  
4. Re-run Ward 18 QA pack — aim for `production_ready` on comps  

## Rules

- No portal scraping  
- Research estimates only until licensed sales + sign-off  
- See `PROFESSIONAL_STANDARD.md` and `DATA_LICENSING.md`  
