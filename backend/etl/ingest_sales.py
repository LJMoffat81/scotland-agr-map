"""Validate and summarise a sales JSONL file (licensed or fixture).

Usage:
    cd backend
    python -m etl.ingest_sales --path ../data/fixtures/sales/ward18_synthetic.jsonl
    python -m etl.ingest_sales --path ../data/licensed/ros_extract.jsonl --require-production
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from datasources.sales_store import SalesStore


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest/validate sales JSONL for AGR")
    parser.add_argument("--path", type=Path, required=True)
    parser.add_argument(
        "--require-production",
        action="store_true",
        help="Fail if any row is synthetic or non-production-eligible",
    )
    parser.add_argument(
        "--summary-out",
        type=Path,
        default=None,
        help="Optional path to write summary JSON",
    )
    args = parser.parse_args(argv)

    allow_synthetic = not args.require_production
    store = SalesStore.from_jsonl(args.path, allow_synthetic=allow_synthetic)
    summary = store.summary()
    summary["path"] = str(args.path.resolve())

    if args.require_production and summary["synthetic_count"]:
        print("ERROR: synthetic rows present but --require-production set", file=sys.stderr)
        return 2

    print(json.dumps(summary, indent=2))
    if args.summary_out:
        args.summary_out.parent.mkdir(parents=True, exist_ok=True)
        args.summary_out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
