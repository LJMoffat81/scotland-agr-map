"""Professional valuation service facade.

Single entry for API and batch jobs. Keeps residual engine as default method;
sales store is available for future comparable / OpenAVMKit paths.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from agr.config import load_config
from agr.engine import AgrBreakdown, calculate_square_agr
from agr.overrides import merge_config_overrides
from datasources.sales_store import SalesStore
from spatial.grid import GridSquare, snap_to_w3w_grid


class ValuationService:
    """Orchestrates place → assessment → optional sales context."""

    def __init__(
        self,
        *,
        config: dict | None = None,
        sales: SalesStore | None = None,
    ):
        self.config = config if config is not None else load_config()
        self.sales = sales

    @classmethod
    def default(cls) -> ValuationService:
        sales = None
        try:
            sales = SalesStore.load_default_fixture()
        except FileNotFoundError:
            sales = SalesStore()
        return cls(sales=sales)

    def with_sensitivity(
        self,
        *,
        yield_rate: float | None = None,
        urban_speculation_discount: float | None = None,
        farmland_market_to_productive: float | None = None,
    ) -> ValuationService:
        cfg = merge_config_overrides(
            self.config,
            yield_rate=yield_rate,
            urban_speculation_discount=urban_speculation_discount,
            farmland_market_to_productive=farmland_market_to_productive,
        )
        return ValuationService(config=cfg, sales=self.sales)

    def assess_point(
        self,
        lat: float,
        lng: float,
        *,
        scenario: str | None = "full_agr",
    ) -> AgrBreakdown:
        square = snap_to_w3w_grid(lat, lng)
        return self.assess_square(square, scenario=scenario)

    def assess_square(
        self,
        square: GridSquare,
        *,
        scenario: str | None = "full_agr",
    ) -> AgrBreakdown:
        return calculate_square_agr(square, scenario=scenario, config=self.config)

    def sales_context(self, lat: float, lng: float, *, limit: int = 10) -> dict[str, Any]:
        """Nearby sales for professional review (fixtures or licensed)."""
        if self.sales is None or len(self.sales) == 0:
            return {
                "available": False,
                "reason": "No sales store loaded. Ingest ROS/licensed data or fixtures.",
                "count": 0,
                "nearest": [],
            }
        nearest = self.sales.nearest(lat, lng, limit=limit)
        return {
            "available": True,
            "count": len(nearest),
            "store_summary": self.sales.summary(),
            "nearest": [
                {
                    "distance_km": round(dist, 3),
                    "price_gbp": tx.price_gbp,
                    "transfer_date": tx.transfer_date,
                    "postcode": tx.postcode,
                    "property_type": tx.property_type,
                    "provenance": tx.provenance.to_dict(),
                    "production_eligible": tx.provenance.is_production_eligible(),
                }
                for dist, tx in nearest
            ],
        }

    def assess_with_context(
        self,
        lat: float,
        lng: float,
        *,
        scenario: str | None = "full_agr",
        include_sales: bool = True,
    ) -> dict[str, Any]:
        breakdown = self.assess_point(lat, lng, scenario=scenario)
        payload = {
            "method_family": "valuer_residual_roll",
            "agr": asdict(breakdown),
        }
        if include_sales:
            payload["sales_context"] = self.sales_context(lat, lng)
        return payload
