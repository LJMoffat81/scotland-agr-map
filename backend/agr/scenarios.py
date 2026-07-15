from __future__ import annotations

from dataclasses import dataclass

from agr.config import load_config
from agr.fiscal import basket_total_gbp

VALID_SCENARIOS = (
    "full_agr",
    "replace_income_tax",
    "revenue_neutral",
    "replace_full_basket",
)


@dataclass(frozen=True)
class ScenarioCharge:
    id: str
    label: str
    annual_charge_gbp: float
    description: str
    effective_rate: float | None = None


def _economic_annual_rent(
    site_rental_per_sqm: float,
    area_sqm: float,
    capture_rate: float,
) -> float:
    return site_rental_per_sqm * area_sqm * capture_rate


def compute_scenarios(
    *,
    site_rental_per_sqm: float,
    despeculated_site_capital_per_sqm: float,
    area_sqm: float,
    capture_rate: float,
    config: dict | None = None,
) -> tuple[float, dict[str, ScenarioCharge]]:
    """Return full economic rent and per-scenario annual charges for one square."""
    config = config or load_config()
    scenarios_cfg = config["scenarios"]
    macro = config["macro"]

    economic_rent = _economic_annual_rent(site_rental_per_sqm, area_sqm, capture_rate)
    despeculated_site_value = despeculated_site_capital_per_sqm * area_sqm

    full_cfg = scenarios_cfg["full_agr"]
    full_charge = economic_rent * full_cfg["capture_rate"]

    income_tax_target = macro["scotland_income_tax_replacement_gbp"]
    estimated_total_rent = macro["estimated_scotland_annual_rent_gbp"]
    income_tax_rate = income_tax_target / estimated_total_rent
    income_tax_charge = economic_rent * income_tax_rate

    revenue_cfg = scenarios_cfg["revenue_neutral"]
    revenue_rate = revenue_cfg["rate_per_pound"]
    revenue_charge = despeculated_site_value * revenue_rate

    basket = basket_total_gbp(config)
    full_basket_rate = basket / estimated_total_rent if estimated_total_rent else 0.0
    full_basket_charge = economic_rent * full_basket_rate
    full_basket_cfg = scenarios_cfg.get("replace_full_basket") or {}
    full_basket_label = full_basket_cfg.get(
        "label", "Replace all listed taxes (neutral)"
    )

    charges = {
        "full_agr": ScenarioCharge(
            id="full_agr",
            label=full_cfg["label"],
            annual_charge_gbp=round(full_charge, 2),
            description=(
                "Full annual economic ground rent for this place (valuer residual). "
                "National full collection exceeds today’s tax basket — surplus for services "
                "or citizen dividend. High-rent locations contribute most."
            ),
            effective_rate=full_cfg["capture_rate"],
        ),
        "replace_income_tax": ScenarioCharge(
            id="replace_income_tax",
            label=scenarios_cfg["replace_income_tax"]["label"],
            annual_charge_gbp=round(income_tax_charge, 2),
            description=(
                f"Scales map economic rent so Scotland raises "
                f"£{income_tax_target / 1e9:.1f}bn if the national pool is "
                f"£{estimated_total_rent / 1e9:.0f}bn (Sandilands). "
                "Uses the national pool ratio, not a sum of map cells."
            ),
            effective_rate=round(income_tax_rate, 4),
        ),
        "revenue_neutral": ScenarioCharge(
            id="revenue_neutral",
            label=revenue_cfg["label"],
            annual_charge_gbp=round(revenue_charge, 2),
            description=(
                f"Charge {revenue_rate * 100:.2f}% of this place’s economic site capital "
                "(Wightman-style CT + NDR replacement on residual capital)."
            ),
            effective_rate=revenue_rate,
        ),
        "replace_full_basket": ScenarioCharge(
            id="replace_full_basket",
            label=full_basket_label,
            annual_charge_gbp=round(full_basket_charge, 2),
            description=(
                f"Scales map economic rent so national collection matches the fiscal basket "
                f"(£{basket / 1e9:.1f}bn: income tax + Council Tax + NDR). "
                "Revenue-neutral on listed taxes; high-rent places still pay most."
            ),
            effective_rate=round(full_basket_rate, 4),
        ),
    }
    return round(economic_rent, 2), charges


def scenario_to_dict(charge: ScenarioCharge) -> dict:
    return {
        "id": charge.id,
        "label": charge.label,
        "annual_charge_gbp": charge.annual_charge_gbp,
        "description": charge.description,
        "effective_rate": charge.effective_rate,
    }


def resolve_active_scenario(scenario: str | None) -> str:
    if scenario is None:
        return "full_agr"
    if scenario not in VALID_SCENARIOS:
        raise ValueError(
            f"Unknown scenario '{scenario}'. Choose: {', '.join(VALID_SCENARIOS)}"
        )
    return scenario
