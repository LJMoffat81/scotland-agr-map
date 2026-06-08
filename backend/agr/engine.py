from __future__ import annotations

from dataclasses import asdict, dataclass

from agr.areas import lookup_council
from agr.config import load_config
from agr.scenarios import compute_scenarios, resolve_active_scenario, scenario_to_dict
from agr.valuation import residual_site_capital_per_sqm
from spatial.grid import GridSquare
from spatial.parcels import lookup_parcel
from spatial.polygons import lookup_glasgow_ward_18


@dataclass
class AgrBreakdown:
    annual_ground_rent_gbp: float
    economic_annual_rent_gbp: float
    active_scenario: str
    site_rental_per_sqm_gbp: float
    site_capital_per_sqm_gbp: float
    despeculated_site_capital_per_sqm_gbp: float
    despeculated_site_value_gbp: float
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
    lookup_method: str
    parcel_id: str | None
    parcel_area_sqm: float | None
    ward_name: str | None
    scenarios: dict[str, dict]


def calculate_square_agr(square: GridSquare, scenario: str | None = None) -> AgrBreakdown:
    config = load_config()
    valuation = config["valuation"]
    despec = config["despeculation"]
    per_square = config["per_square"]
    site_share_cfg = config["site_share"]
    active_scenario = resolve_active_scenario(scenario)

    council = lookup_council(square.lat, square.lng)
    parcel = lookup_parcel(square.lat, square.lng)
    ward = lookup_glasgow_ward_18(square.lat, square.lng)

    site_capital_per_sqm, method, confidence, val_notes = residual_site_capital_per_sqm(
        council, config
    )

    if parcel is not None and confidence == "medium":
        confidence = "high"
        val_notes.append(
            f"ROS INSPIRE cadastral parcel {parcel.label} ({parcel.area_sqm:,.0f} sqm) confirms land register coverage."
        )

    if council.rural:
        discount = despec["farmland_market_to_productive"]
    else:
        discount = despec["urban_speculation_discount"]

    despeculated_capital = site_capital_per_sqm * discount
    yield_rate = valuation["yield_rate"]
    site_rental_per_sqm = despeculated_capital * yield_rate
    capture_rate = per_square["agr_capture_rate"]
    area_sqm = per_square["area_sqm"]
    despeculated_site_value = despeculated_capital * area_sqm

    economic_rent, scenario_charges = compute_scenarios(
        site_rental_per_sqm=site_rental_per_sqm,
        despeculated_site_capital_per_sqm=despeculated_capital,
        area_sqm=area_sqm,
        capture_rate=capture_rate,
        config=config,
    )
    active_charge = scenario_charges[active_scenario].annual_charge_gbp

    site_share = (
        site_share_cfg["residential_slrg"]
        if site_share_cfg["use_slrg_for_display"]
        else site_share_cfg["residential_wightman"]
    )

    notes = [
        *val_notes,
        f"Council resolved via {council.lookup_method} polygon lookup.",
        "Pickard de-speculation discount applied to remove speculative land price inflation.",
        "Sandilands: charges are on economic rental value, not market speculation.",
    ]
    if ward is not None:
        notes.append(f"Location within Glasgow Ward {ward.ward_number} ({ward.ward_name}) validation area.")

    return AgrBreakdown(
        annual_ground_rent_gbp=active_charge,
        economic_annual_rent_gbp=economic_rent,
        active_scenario=active_scenario,
        site_rental_per_sqm_gbp=round(site_rental_per_sqm, 2),
        site_capital_per_sqm_gbp=round(site_capital_per_sqm, 2),
        despeculated_site_capital_per_sqm_gbp=round(despeculated_capital, 2),
        despeculated_site_value_gbp=round(despeculated_site_value, 2),
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
        lookup_method=council.lookup_method,
        parcel_id=parcel.label if parcel else None,
        parcel_area_sqm=parcel.area_sqm if parcel else None,
        ward_name=ward.ward_name if ward else None,
        scenarios={key: scenario_to_dict(value) for key, value in scenario_charges.items()},
    )


def breakdown_to_dict(breakdown: AgrBreakdown) -> dict:
    return asdict(breakdown)