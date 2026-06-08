from __future__ import annotations

from dataclasses import asdict, dataclass

from agr.areas import lookup_council
from agr.config import load_config
from agr.valuation import residual_site_capital_per_sqm
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
    council_code: str
    council_name: str
    average_price_gbp: int | None


def calculate_square_agr(square: GridSquare) -> AgrBreakdown:
    config = load_config()
    valuation = config["valuation"]
    despec = config["despeculation"]
    per_square = config["per_square"]
    site_share_cfg = config["site_share"]

    council = lookup_council(square.lat, square.lng)
    site_capital_per_sqm, method, confidence, val_notes = residual_site_capital_per_sqm(
        council, config
    )

    if council.rural:
        discount = despec["farmland_market_to_productive"]
    else:
        discount = despec["urban_speculation_discount"]

    despeculated_capital = site_capital_per_sqm * discount
    yield_rate = valuation["yield_rate"]
    site_rental_per_sqm = despeculated_capital * yield_rate
    capture_rate = per_square["agr_capture_rate"]
    annual_rent = site_rental_per_sqm * per_square["area_sqm"] * capture_rate

    site_share = (
        site_share_cfg["residential_slrg"]
        if site_share_cfg["use_slrg_for_display"]
        else site_share_cfg["residential_wightman"]
    )

    notes = [
        *val_notes,
        "Pickard de-speculation discount applied to remove speculative land price inflation.",
        "Sandilands: charges are on economic rental value, not market speculation.",
    ]

    return AgrBreakdown(
        annual_ground_rent_gbp=round(annual_rent, 2),
        site_rental_per_sqm_gbp=round(site_rental_per_sqm, 2),
        site_capital_per_sqm_gbp=round(site_capital_per_sqm, 2),
        despeculated_site_capital_per_sqm_gbp=round(despeculated_capital, 2),
        site_share_used=site_share,
        yield_rate=yield_rate,
        capture_rate=capture_rate,
        confidence=confidence,
        method=method,
        disclaimer=config["disclaimer"],
        notes=notes,
        council_code=council.code,
        council_name=council.name,
        average_price_gbp=council.average_price_gbp if not council.rural else None,
    )


def breakdown_to_dict(breakdown: AgrBreakdown) -> dict:
    return asdict(breakdown)