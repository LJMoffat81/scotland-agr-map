"""Convert a flexible CSV of sales into project JSONL schema.

Professional ingest path for ROS/partner extracts after column mapping.
Does not download or scrape anything.

Usage:
    python -m etl.convert_sales_csv --input sales.csv --output ../data/licensed/sales.jsonl \\
        --source ros --licence ROS-research \\
        --map price=Price,date=Date,postcode=Postcode,lat=Latitude,lng=Longitude
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import date, datetime
from pathlib import Path


def _parse_map(spec: str) -> dict[str, str]:
    """price=Price,date=SaleDate → {canonical: csv_column}"""
    out: dict[str, str] = {}
    if not spec.strip():
        return out
    for part in spec.split(","):
        if "=" not in part:
            raise ValueError(f"Bad map segment: {part}")
        key, col = part.split("=", 1)
        out[key.strip()] = col.strip()
    return out


def _cell(row: dict[str, str], mapping: dict[str, str], key: str) -> str | None:
    col = mapping.get(key)
    if not col:
        return None
    val = row.get(col)
    if val is None or str(val).strip() == "":
        return None
    return str(val).strip()


def _iso_date(raw: str) -> str:
    raw = raw.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    # already ISO-ish
    date.fromisoformat(raw[:10])
    return raw[:10]


def convert_row(
    row: dict[str, str],
    mapping: dict[str, str],
    *,
    source_system: str,
    licence: str,
    retrieved_at: str,
    index: int,
) -> dict:
    price_raw = _cell(row, mapping, "price")
    date_raw = _cell(row, mapping, "date")
    if not price_raw or not date_raw:
        raise ValueError("price and date are required")

    tid = _cell(row, mapping, "id") or f"{source_system}-{index:06d}"
    lat = _cell(row, mapping, "lat")
    lng = _cell(row, mapping, "lng")
    floor = _cell(row, mapping, "floor_area")
    plot = _cell(row, mapping, "plot_area")

    return {
        "transaction_id": tid,
        "price_gbp": int(float(price_raw.replace("£", "").replace(",", ""))),
        "transfer_date": _iso_date(date_raw),
        "lat": float(lat) if lat is not None else None,
        "lng": float(lng) if lng is not None else None,
        "postcode": _cell(row, mapping, "postcode"),
        "property_type": _cell(row, mapping, "property_type"),
        "new_build": None,
        "floor_area_sqm": float(floor) if floor is not None else None,
        "plot_area_sqm": float(plot) if plot is not None else None,
        "tenure": _cell(row, mapping, "tenure"),
        "council_code": _cell(row, mapping, "council_code"),
        "provenance": {
            "source_system": source_system,
            "licence": licence,
            "retrieved_at": retrieved_at,
            "source_record_id": tid,
            "notes": "Converted via etl.convert_sales_csv",
        },
        "raw": dict(row),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CSV → AGR sales JSONL")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source", default="ros", help="source_system tag")
    parser.add_argument("--licence", default="ROS-research")
    parser.add_argument("--retrieved-at", default=date.today().isoformat())
    parser.add_argument(
        "--map",
        default="price=price,date=date,postcode=postcode,lat=lat,lng=lng",
        help="canonical=CsvColumn pairs",
    )
    args = parser.parse_args(argv)

    mapping = _parse_map(args.map)
    if "price" not in mapping or "date" not in mapping:
        print("ERROR: --map must include price=... and date=...", file=sys.stderr)
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with args.input.open(encoding="utf-8-sig", newline="") as fin, args.output.open(
        "w", encoding="utf-8"
    ) as fout:
        reader = csv.DictReader(fin)
        for i, row in enumerate(reader, start=1):
            try:
                payload = convert_row(
                    row,
                    mapping,
                    source_system=args.source,
                    licence=args.licence,
                    retrieved_at=args.retrieved_at,
                    index=i,
                )
            except Exception as exc:
                print(f"skip row {i}: {exc}", file=sys.stderr)
                continue
            fout.write(json.dumps(payload, ensure_ascii=False) + "\n")
            n += 1

    print(json.dumps({"written": n, "output": str(args.output.resolve())}, indent=2))
    return 0 if n else 1


if __name__ == "__main__":
    raise SystemExit(main())
