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
    # Ogilvie / Paine equal-share illustration (framing; same economic rent)
    equal_share_enabled: bool
    equal_share_rent_per_person_gbp: float | None
    square_as_fraction_of_equal_claim: float | None
    scotland_population: int | None
    # Integrity / product labels
    estimate_kind: str
    estimate_label: str
    site_share_source: str
    national_rent_pool_gbp: float
    integrity_caveats: list[str]


def _equal_share_fields(economic_rent: float, config: dict) -> tuple[bool, float | None, float | None, int | None]:
    equal_cfg = config.get("equal_share") or {}
    if not equal_cfg.get("enabled", False):
        return False, None, None, None

    population = int(equal_cfg.get("scotland_population") or 0)
    rent_pool = float(config["macro"]["estimated_scotland_annual_rent_gbp"])
    if population <= 0 or rent_pool <= 0:
        return True, None, None, population or None

    per_person = rent_pool / population
    fraction = economic_rent / per_person if per_person > 0 else None
    return True, round(per_person, 2), (round(fraction, 6) if fraction is not None else None), population


def calculate_square_agr(square: GridSquare, scenario: str | None = None) -> AgrBreakdown:
    config = load_config()
    valuation = config["valuation"]
    despec = config["despeculation"]
    per_square = config["per_square"]
    site_share_cfg = config["site_share"]
    integrity = config.get("integrity") or {}
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

    use_slrg_share = bool(site_share_cfg["use_slrg_for_display"])
    site_share = (
        site_share_cfg["residential_slrg"]
        if use_slrg_share
        else site_share_cfg["residential_wightman"]
    )
    site_share_source = "slrg_60pct" if use_slrg_share else "wightman_49pct"

    eq_enabled, eq_per_person, eq_fraction, eq_pop = _equal_share_fields(economic_rent, config)
    rent_pool = float(config["macro"]["estimated_scotland_annual_rent_gbp"])
    estimate_kind = integrity.get("estimate_kind", "map_residual_research")
    estimate_label = integrity.get("estimate_label", "Map residual AGR (research)")
    integrity_caveats = list(integrity.get("caveats") or [])

    notes = [
        *val_notes,
        f"Estimate type: {estimate_label} — not an official valuation or rates bill.",
        f"Council resolved via {council.lookup_method} polygon lookup.",
        (
            f"Site share {site_share:.0%} from "
            f"{'SLRG display default (60%)' if use_slrg_share else 'Wightman research share (49%)'}; "
            "true residual is ideally price − building DRC, not only price × share."
        ),
        (
            "HABU note: residual uses residential HPI / land-use benchmarks; market prices still embed "
            "credit conditions and some hope value. Pickard discounts are static policy knobs."
        ),
        (
            f"Macro vs map: Sandilands national rent pool is £{rent_pool / 1e9:.0f}bn "
            "(used for equal-share and income-tax scaling). Square £ figures are independent residual "
            "estimates and are not calibrated so that all squares sum to that pool."
        ),
        "Smith: charge is on ground-rent (location), not buildings or labour.",
        "Ricardo: higher AGR reflects larger locational surplus at this site (council-level gradient).",
        "Ogilvie: equal natural right in land; improvements remain private.",
        "Gaffney (ATCOR): conventional taxes ultimately load onto land rent at productive locations.",
        "Harrison: land-price cycles inflate capital values; Pickard discount removes speculative premium.",
        "Stiglitz: public goods and amenity capitalise into land values (community-created rent).",
        "Macfarlane: housing costs are largely land/location costs, not bricks and mortar.",
        "Pickard de-speculation discount applied to remove speculative land price inflation.",
        "Sandilands: macro rent pool and tax-shift scenarios; map residual is the place-based estimate.",
    ]
    if eq_enabled and eq_per_person is not None and eq_fraction is not None:
        notes.append(
            f"Ogilvie/Paine equal-share (uses national pool, not sum of map squares): "
            f"one Scot’s equal annual claim ≈ £{eq_per_person:,.0f}; "
            f"this square’s map economic rent is {eq_fraction * 100:.4f}% of that claim."
        )
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
        equal_share_enabled=eq_enabled,
        equal_share_rent_per_person_gbp=eq_per_person,
        square_as_fraction_of_equal_claim=eq_fraction,
        scotland_population=eq_pop,
        estimate_kind=estimate_kind,
        estimate_label=estimate_label,
        site_share_source=site_share_source,
        national_rent_pool_gbp=rent_pool,
        integrity_caveats=integrity_caveats,
    )


def breakdown_to_dict(breakdown: AgrBreakdown) -> dict:
    return asdict(breakdown)
