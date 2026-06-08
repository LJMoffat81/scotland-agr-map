from __future__ import annotations

from dataclasses import asdict, dataclass

from agr.config import load_config
from spatial.grid import GridSquare


@dataclass
class AgrBreakdown:
    annual_ground_rent_gbp: float
    site_rental_per_sqm_gbp: float
    site_capital_per_sqm_gbp: float
    despeculated_site_capital_per_sqm_gbp: float
    site_share_used: float
    yield_rate: float
    capture_rate: float
    confidence: str
    method: str
    disclaimer: str
    notes: list[str]


def _zone_base_site_capital_per_sqm(lat: float, lng: float) -> tuple[float, str]:
    """Phase 0 placeholder until ROS / HPI ETL is wired in Phase 1."""
    if lat > 55.9 and lng > -3.5:
        return 2500.0, "urban_placeholder_edinburgh_zone"
    if lat > 55.5:
        return 1200.0, "urban_placeholder_central_belt"
    if lat > 57.0:
        return 150.0, "rural_placeholder_highlands"
    return 400.0, "rural_placeholder"


def calculate_square_agr(square: GridSquare) -> AgrBreakdown:
    config = load_config()
    valuation = config["valuation"]
    despec = config["despeculation"]
    per_square = config["per_square"]
    site_share_cfg = config["site_share"]

    base_capital_per_sqm, zone = _zone_base_site_capital_per_sqm(square.lat, square.lng)

    if zone.startswith("rural"):
        discount = despec["farmland_market_to_productive"]
        confidence = "low"
        method = "land_use_category_placeholder"
    else:
        discount = despec["urban_speculation_discount"]
        confidence = "medium"
        method = "zone_mass_appraisal_placeholder"

    despeculated_capital = base_capital_per_sqm * discount
    yield_rate = valuation["yield_rate"]
    site_rental_per_sqm = despeculated_capital * yield_rate
    capture_rate = per_square["agr_capture_rate"]
    annual_rent = site_rental_per_sqm * per_square["area_sqm"] * capture_rate

    site_share = (
        site_share_cfg["residential_slrg"]
        if site_share_cfg["use_slrg_for_display"]
        else site_share_cfg["residential_wightman"]
    )

    return AgrBreakdown(
        annual_ground_rent_gbp=round(annual_rent, 2),
        site_rental_per_sqm_gbp=round(site_rental_per_sqm, 2),
        site_capital_per_sqm_gbp=round(base_capital_per_sqm, 2),
        despeculated_site_capital_per_sqm_gbp=round(despeculated_capital, 2),
        site_share_used=site_share,
        yield_rate=yield_rate,
        capture_rate=capture_rate,
        confidence=confidence,
        method=method,
        disclaimer=config["disclaimer"],
        notes=[
            "Phase 0 placeholder valuation — ROS/HPI ETL arrives in Phase 1.",
            "Pickard de-speculation discount applied to remove speculative land price inflation.",
            "Sandilands: charges are on economic rental value, not market speculation.",
        ],
    )


def breakdown_to_dict(breakdown: AgrBreakdown) -> dict:
    return asdict(breakdown)