"""Batch-assess coordinates into a mini AGR roll (CSV/JSONL).

Examples:
  python -m etl.batch_assess --lat 55.9533 --lng -3.1883 --out ../data/processed/roll_edinburgh.jsonl
  python -m etl.batch_assess --ward18 --samples 12 --out ../data/processed/roll_ward18.csv --format csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from agr.batch import assess_points, batch_meta, write_csv, write_jsonl
from agr.service import ValuationService


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Batch AGR assessment (mini-roll)")
    parser.add_argument("--lat", type=float, action="append", default=[])
    parser.add_argument("--lng", type=float, action="append", default=[])
    parser.add_argument("--ward18", action="store_true", help="Sample Glasgow Ward 18")
    parser.add_argument("--samples", type=int, default=12)
    parser.add_argument("--scenario", default="full_agr")
    parser.add_argument("--include-sales", action="store_true")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--format", choices=("jsonl", "csv"), default=None)
    parser.add_argument("--meta-out", type=Path, default=None)
    args = parser.parse_args(argv)

    points: list[tuple[float, float]] = []
    if args.ward18:
        from validation.glasgow_ward_18 import _sample_points_in_ward

        points.extend(_sample_points_in_ward(args.samples))
    if args.lat or args.lng:
        if len(args.lat) != len(args.lng):
            print("ERROR: --lat and --lng counts must match", file=sys.stderr)
            return 2
        points.extend(zip(args.lat, args.lng))

    if not points:
        print("ERROR: provide --ward18 and/or --lat/--lng pairs", file=sys.stderr)
        return 2

    fmt = args.format
    if fmt is None:
        fmt = "csv" if args.out.suffix.lower() == ".csv" else "jsonl"

    service = ValuationService.default()
    rows = assess_points(
        points,
        scenario=args.scenario,
        service=service,
        include_sales=args.include_sales,
    )
    if fmt == "csv":
        write_csv(rows, args.out)
    else:
        write_jsonl(rows, args.out)

    meta = batch_meta(rows, scenario=args.scenario)
    meta["output"] = str(args.out.resolve())
    print(json.dumps(meta, indent=2))
    if args.meta_out:
        args.meta_out.parent.mkdir(parents=True, exist_ok=True)
        args.meta_out.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
