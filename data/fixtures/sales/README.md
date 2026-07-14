# Sales fixtures

## Purpose

Synthetic or redistributable **test** transactions for CI and local development of the `SalesStore` pipeline.

## Rules

- Must set `provenance.licence` to `synthetic-test-only` when synthetic  
- Must set `provenance.source_system` to `fixture_synthetic`  
- **Never** shown in the public UI as real market evidence  
- Real ROS / licensed data lives in `data/licensed/` (gitignored)

## Format

JSON Lines (one JSON object per line). Schema: `backend/datasources/sales_schema.py`.

## Validate

```powershell
cd backend
python -m etl.ingest_sales --path ../data/fixtures/sales/ward18_synthetic.jsonl
```
