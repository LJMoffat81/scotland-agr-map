"""Load and query sales transactions from JSONL / JSON fixtures or licensed files."""

from __future__ import annotations

import json
from pathlib import Path

from datasources.sales_schema import SalesTransaction

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = REPO_ROOT / "data" / "fixtures" / "sales" / "ward18_synthetic.jsonl"
LICENSED_DIR = REPO_ROOT / "data" / "licensed"


class SalesStore:
    """In-memory sales store. Production will load from licensed parquet/JSONL."""

    def __init__(self, transactions: list[SalesTransaction] | None = None):
        self._rows = list(transactions or [])

    @classmethod
    def from_jsonl(cls, path: Path, *, allow_synthetic: bool = True) -> SalesStore:
        if not path.exists():
            raise FileNotFoundError(path)
        rows: list[SalesTransaction] = []
        with path.open(encoding="utf-8") as handle:
            for line_no, line in enumerate(handle, start=1):
                line = line.strip()
                if not line:
                    continue
                payload = json.loads(line)
                tx = SalesTransaction.from_dict(payload)
                errors = tx.validate()
                if errors:
                    raise ValueError(f"{path.name}:{line_no}: {'; '.join(errors)}")
                if tx.provenance.is_synthetic() and not allow_synthetic:
                    continue
                rows.append(tx)
        return cls(rows)

    @classmethod
    def load_default_fixture(cls) -> SalesStore:
        return cls.from_jsonl(DEFAULT_FIXTURE, allow_synthetic=True)

    @classmethod
    def try_load_licensed(cls, filename: str) -> SalesStore | None:
        path = LICENSED_DIR / filename
        if not path.exists():
            return None
        return cls.from_jsonl(path, allow_synthetic=False)

    def __len__(self) -> int:
        return len(self._rows)

    def all(self) -> list[SalesTransaction]:
        return list(self._rows)

    def production_eligible(self) -> list[SalesTransaction]:
        return [tx for tx in self._rows if tx.provenance.is_production_eligible()]

    def filter_bbox(
        self,
        south: float,
        west: float,
        north: float,
        east: float,
    ) -> list[SalesTransaction]:
        out: list[SalesTransaction] = []
        for tx in self._rows:
            if tx.lat is None or tx.lng is None:
                continue
            if south <= tx.lat <= north and west <= tx.lng <= east:
                out.append(tx)
        return out

    def nearest(
        self,
        lat: float,
        lng: float,
        *,
        limit: int = 20,
        max_km: float = 5.0,
    ) -> list[tuple[float, SalesTransaction]]:
        import math

        def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
            r = 6371.0
            p1, p2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlmb = math.radians(lng2 - lng1)
            a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
            return 2 * r * math.asin(math.sqrt(a))

        scored: list[tuple[float, SalesTransaction]] = []
        for tx in self._rows:
            if tx.lat is None or tx.lng is None:
                continue
            d = haversine_km(lat, lng, tx.lat, tx.lng)
            if d <= max_km:
                scored.append((d, tx))
        scored.sort(key=lambda item: item[0])
        return scored[:limit]

    def summary(self) -> dict:
        eligible = self.production_eligible()
        prices = [tx.price_gbp for tx in self._rows]
        return {
            "count": len(self._rows),
            "production_eligible_count": len(eligible),
            "synthetic_count": len(self._rows) - len(eligible),
            "price_min_gbp": min(prices) if prices else None,
            "price_max_gbp": max(prices) if prices else None,
            "price_mean_gbp": round(sum(prices) / len(prices), 2) if prices else None,
        }
