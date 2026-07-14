"""Optional research overrides for sensitivity exploration (not signed-off defaults)."""

from __future__ import annotations

import copy
from typing import Any


def merge_config_overrides(
    base: dict,
    *,
    yield_rate: float | None = None,
    urban_speculation_discount: float | None = None,
    farmland_market_to_productive: float | None = None,
) -> dict:
    """Deep-copy config and apply validated sensitivity overrides."""
    config = copy.deepcopy(base)
    applied: dict[str, Any] = {}

    if yield_rate is not None:
        if not 0.02 <= yield_rate <= 0.12:
            raise ValueError("yield_rate must be between 0.02 and 0.12")
        config.setdefault("valuer_roll", {})["yield_rate"] = yield_rate
        config.setdefault("valuation", {})["yield_rate"] = yield_rate
        applied["yield_rate"] = yield_rate

    if urban_speculation_discount is not None:
        if not 0.3 <= urban_speculation_discount <= 1.0:
            raise ValueError("urban_speculation_discount must be between 0.3 and 1.0")
        config.setdefault("despeculation", {})["urban_speculation_discount"] = (
            urban_speculation_discount
        )
        applied["urban_speculation_discount"] = urban_speculation_discount

    if farmland_market_to_productive is not None:
        if not 0.1 <= farmland_market_to_productive <= 1.0:
            raise ValueError("farmland_market_to_productive must be between 0.1 and 1.0")
        config.setdefault("despeculation", {})["farmland_market_to_productive"] = (
            farmland_market_to_productive
        )
        applied["farmland_market_to_productive"] = farmland_market_to_productive

    config["_sensitivity_overrides"] = applied
    return config
