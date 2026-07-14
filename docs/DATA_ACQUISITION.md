# Data acquisition plan — professional path

## Goal

Supply **completed residential (then all-tenure) sales** for Scotland so the AGR engine can move from aggregate HPI residual to **sales-informed residual / mass appraisal** (OpenAVMKit pilot).

## Primary source: Registers of Scotland

| Need | Action |
|------|--------|
| Residential sales for pilot | Contact ROS re research / open / commercial extract for **Glasgow City** or **Ward 18 area** |
| Fields | Price, completion/settlement date, property type, postcode or coordinates, title/UPRN if available, new-build flag if available |
| Cadastre | Continue INSPIRE parcel WMS; seek better bulk geometry if available under licence |
| Licence | Record in `data/licensed/LICENSE.txt` (local only) |

**Do not** substitute England & Wales Price Paid as “Scotland sales.”

## Secondary sources (aggregates — already in use)

| Source | Role |
|--------|------|
| UK House Price Index | Council-level average prices → current residual MV |
| postcodes.io | Geocoding |
| Boundaries.scot / open LAD geojson | Council / ward polygons |

## Explicitly out of scope

- Scraping Zoopla, Rightmove, ESPC, or similar  
- Purchasing scraped datasets of unknown provenance  

## If commercial portal data is ever considered

1. Written licence covering research + public education map  
2. Field dictionary + refresh schedule  
3. Store under `data/licensed/` only  
4. Independent QA against ROS sample  
5. SLRG sign-off before production use  

## Pilot acceptance criteria (Ward 18)

- [ ] ≥ N arms-length sales in window (e.g. 24–36 months) with usable locations  
- [ ] Load into `SalesStore` with full provenance  
- [ ] Residual vs sales-based land value comparison report  
- [ ] Decision: keep residual-only, blend, or pilot OpenAVMKit layer  

## Contact checklist (SLRG / project lead)

- [ ] ROS research data enquiry submitted  
- [ ] Licence terms reviewed  
- [ ] Storage + retention policy agreed  
- [ ] Public attribution wording agreed  

## Local layout after acquisition

```text
data/licensed/
  LICENSE.txt                 # terms summary + contact
  ros_glasgow_sales_2024.parquet   # example — not in git
  provenance.json             # source, date, row count, hash
```

Load via:

```powershell
cd backend
# CSV from ROS/partner → JSONL
python -m etl.convert_sales_csv --input ../data/licensed/raw.csv --output ../data/licensed/sales.jsonl `
  --source ros --licence ROS-research `
  --map price=Price,date=Date,postcode=Postcode,lat=Lat,lng=Lng,floor_area=FloorArea

# Validate (must be production-eligible)
python -m etl.ingest_sales --path ../data/licensed/sales.jsonl --require-production
```

Enquiry template: [ROS_ENQUIRY.md](ROS_ENQUIRY.md).
