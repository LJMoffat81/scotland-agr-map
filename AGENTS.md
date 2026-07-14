# AGENTS.md — working on Scotland AGR Map

## Product

Professional **Scotland Annual Ground Rent** tool: place-based estimates on a What3Words 3×3 m grid, SLRG methodology, public education UI.

## Do

- Prefer residual valuer logic and documented config  
- Use only open or licensed data (see `docs/DATA_LICENSING.md`)  
- Keep map residual vs national rent pool distinct  
- Add tests for valuation and data schema changes  
- Preserve clarity UI: public £/year first, depth under tabs  

## Do not

- Scrape property portals (Zoopla, Rightmove, ESPC, …)  
- Commit API keys or full paid datasets  
- Present synthetic fixtures as real ROS sales in the UI  
- Silently change signed-off `agr.yaml` defaults without notes  

## Key paths

| Path | Role |
|------|------|
| `backend/agr/` | Assessment engine |
| `backend/datasources/` | Data contracts and loaders |
| `data/config/` | Parameters and source registry |
| `docs/PROFESSIONAL_STANDARD.md` | Build standard |
| `docs/methodology.md` | Public methodology |

## Tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest tests/ -q
```
