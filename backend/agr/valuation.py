from __future__ import annotations

from agr.areas import CouncilArea
from agr.config import load_config

HPI_BASE_INDEX = 100.0


def _site_share(config: dict) -> float:
    site_share_cfg = config["site_share"]
    if site_share_cfg["use_slrg_for_display"]:
        return site_share_cfg["residential_slrg"]
    return site_share_cfg["residential_wightman"]


def _hpi_adjustment_factor(config: dict) -> float:
    """Scale 2009 land-use benchmarks to current prices using Scotland HPI."""
    from agr.areas import COUNCILS_PATH
    import json

    if not COUNCILS_PATH.exists():
        return 2.5

    with COUNCILS_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    current_index = payload.get("scotland_hpi_index")
    if not current_index:
        return 2.5
    return current_index / HPI_BASE_INDEX


def residual_site_capital_per_sqm(
    council: CouncilArea,
    config: dict | None = None,
) -> tuple[float, str, str, list[str]]:
    """Wightman residual at council level: site_share × average price / floor area."""
    config = config or load_config()
    valuation = config["valuation"]
    notes: list[str] = []

    if council.rural:
        hpi_factor = _hpi_adjustment_factor(config)
        agriculture_ha = config["land_use_values_gbp_per_ha_2009"]["agriculture"]
        site_capital = (agriculture_ha / 10_000) * hpi_factor
        method = "land_use_category"
        confidence = "medium" if council.distance_km < 25 else "low"
        notes.append(
            f"Rural fallback: Wightman land-use category (agriculture, HPI-adjusted ×{hpi_factor:.2f})."
        )
        notes.append(f"Council: {council.name} ({council.code}).")
        return site_capital, method, confidence, notes

    site_share = _site_share(config)
    dwelling_sqm = valuation.get("typical_dwelling_sqm", 85)
    market_per_sqm = council.average_price_gbp / dwelling_sqm
    site_capital = market_per_sqm * site_share

    method = valuation["primary_method"]
    confidence = "high" if council.distance_km < 8 else "medium"
    notes.append(
        f"Residual: £{council.average_price_gbp:,} avg price × {site_share:.0%} site share "
        f"÷ {dwelling_sqm:.0f} sqm dwelling."
    )
    notes.append(f"Council: {council.name} ({council.code}), HPI period latest ETL.")
    if council.lookup_method == "centroid_fallback" and council.distance_km > 0:
        notes.append(
            f"Boundary miss — fell back to nearest centroid ({council.distance_km} km away)."
        )

    return site_capital, method, confidence, notes