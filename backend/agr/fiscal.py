"""
Fiscal tool helpers — national tax basket vs AGR collection, place-level net position.

National numbers use Sandilands macro rent pool × scenario rate.
Place numbers use map residual plot AGR (not calibrated to sum to the pool).
"""

from __future__ import annotations

from typing import Any

from agr.config import load_config


def basket_lines(config: dict | None = None) -> list[dict[str, Any]]:
    config = config or load_config()
    fiscal = config.get("fiscal") or {}
    basket = fiscal.get("basket") or {}
    return list(basket.get("lines") or [])


def basket_total_gbp(config: dict | None = None) -> float:
    return float(sum(float(line.get("annual_gbp") or 0) for line in basket_lines(config)))


def national_collection_for_scenario(
    scenario: str,
    config: dict | None = None,
) -> tuple[float, float, str]:
    """
    Return (collection_gbp, effective_rate_on_pool, method_note).

    effective_rate_on_pool is the share of the national rent pool collected.
    """
    config = config or load_config()
    macro = config["macro"]
    pool = float(macro["estimated_scotland_annual_rent_gbp"])
    scenarios_cfg = config["scenarios"]

    if scenario == "full_agr":
        rate = float(scenarios_cfg["full_agr"].get("capture_rate", 1.0))
        return pool * rate, rate, "Full economic rent of national pool (Sandilands macro)"

    if scenario == "replace_income_tax":
        target = float(macro["scotland_income_tax_replacement_gbp"])
        rate = target / pool if pool else 0.0
        return target, rate, "Scaled to replace Scotland income tax only"

    if scenario == "replace_full_basket":
        target = basket_total_gbp(config)
        rate = target / pool if pool else 0.0
        return target, rate, "Scaled to replace fiscal basket (income tax + CT + NDR)"

    if scenario == "revenue_neutral":
        # Capital-rate scenario: not a pure pool share — report CT+NDR portion of basket
        lines = {line["id"]: float(line["annual_gbp"]) for line in basket_lines(config)}
        target = lines.get("council_tax", 0) + lines.get("ndr", 0)
        rate = target / pool if pool else 0.0
        return (
            target,
            rate,
            "CT+NDR replacement (Wightman capital rate on sites; national total from basket lines)",
        )

    # Fallback: full pool
    return pool, 1.0, "Default full pool"


def dividend_per_person_gbp(
    scenario: str,
    config: dict | None = None,
    *,
    dividend_enabled: bool | None = None,
) -> tuple[float, str]:
    """Equal-share dividend £/person/year under fiscal.dividend.mode."""
    config = config or load_config()
    fiscal = config.get("fiscal") or {}
    div = fiscal.get("dividend") or {}
    enabled = div.get("enabled", True) if dividend_enabled is None else dividend_enabled
    if not enabled:
        return 0.0, "none"

    mode = str(div.get("mode") or "equal_share_of_pool")
    equal = config.get("equal_share") or {}
    pop = int(equal.get("scotland_population") or 0)
    if pop <= 0:
        return 0.0, mode

    pool = float(config["macro"]["estimated_scotland_annual_rent_gbp"])
    collection, _, _ = national_collection_for_scenario(scenario, config)
    basket = basket_total_gbp(config)

    if mode == "none":
        return 0.0, mode
    if mode == "equal_share_of_surplus":
        surplus = max(0.0, collection - basket)
        return round(surplus / pop, 2), mode
    # equal_share_of_pool (default)
    return round(pool / pop, 2), mode


def remote_credit_for_council(
    council_code: str | None,
    config: dict | None = None,
    *,
    credit_enabled: bool | None = None,
) -> float:
    config = config or load_config()
    fiscal = config.get("fiscal") or {}
    remote = fiscal.get("remote_credit") or {}
    enabled = remote.get("enabled", False) if credit_enabled is None else credit_enabled
    if not enabled or not council_code:
        return 0.0
    codes = {str(c) for c in (remote.get("councils") or [])}
    if str(council_code) not in codes:
        return 0.0
    return float(remote.get("credit_gbp_per_person_year") or 0.0)


def place_fiscal(
    *,
    gross_plot_gbp: float,
    council_code: str | None,
    scenario: str,
    config: dict | None = None,
    dividend_enabled: bool | None = None,
    remote_credit_enabled: bool | None = None,
) -> dict[str, Any]:
    """
    Place-level fiscal position for a typical plot / one-person comparison.

    net = gross − dividend − remote_credit  (negative => net receiver)
    """
    config = config or load_config()
    dividend, div_mode = dividend_per_person_gbp(
        scenario, config, dividend_enabled=dividend_enabled
    )
    credit = remote_credit_for_council(
        council_code, config, credit_enabled=remote_credit_enabled
    )
    net = round(float(gross_plot_gbp) - dividend - credit, 2)
    role = "net_receiver" if net < 0 else ("net_neutral" if abs(net) < 1 else "net_contributor")
    return {
        "gross_plot_gbp": round(float(gross_plot_gbp), 2),
        "dividend_gbp": dividend,
        "dividend_mode": div_mode,
        "remote_credit_gbp": round(credit, 2),
        "net_gbp": net,
        "role": role,
        "comparison_unit": "typical_plot_vs_one_person_dividend",
        "note": (
            "Gross is map residual plot AGR under the scenario. "
            "Dividend and remote credit are policy knobs on the national pool story. "
            "High land-rent places fund the state; low-rent / remote can be net receivers."
        ),
    }


def fiscal_summary(
    scenario: str = "replace_full_basket",
    config: dict | None = None,
    *,
    dividend_enabled: bool | None = None,
    remote_credit_enabled: bool | None = None,
) -> dict[str, Any]:
    config = config or load_config()
    fiscal = config.get("fiscal") or {}
    if not fiscal.get("enabled", True):
        return {"enabled": False}

    basket = basket_total_gbp(config)
    lines = basket_lines(config)
    collection, rate, method = national_collection_for_scenario(scenario, config)
    surplus = round(collection - basket, 2)
    dividend, div_mode = dividend_per_person_gbp(
        scenario, config, dividend_enabled=dividend_enabled
    )
    equal = config.get("equal_share") or {}
    pop = int(equal.get("scotland_population") or 0)
    remote = fiscal.get("remote_credit") or {}
    credit_on = remote.get("enabled", False) if remote_credit_enabled is None else remote_credit_enabled

    return {
        "enabled": True,
        "scenario": scenario,
        "basket": {
            "lines": lines,
            "total_gbp": basket,
            "note": (fiscal.get("basket") or {}).get("note"),
        },
        "collection": {
            "annual_gbp": round(collection, 2),
            "effective_rate_on_national_pool": round(rate, 6),
            "method": method,
            "national_rent_pool_gbp": float(
                config["macro"]["estimated_scotland_annual_rent_gbp"]
            ),
        },
        "surplus_gbp": surplus,
        "revenue_neutral_or_better": surplus >= -1.0,  # allow rounding
        "dividend": {
            "enabled": dividend > 0 or div_mode != "none",
            "mode": div_mode,
            "per_person_gbp": dividend,
            "scotland_population": pop,
        },
        "remote_credit": {
            "enabled": bool(credit_on),
            "credit_gbp_per_person_year": float(remote.get("credit_gbp_per_person_year") or 0)
            if credit_on
            else 0.0,
            "councils": list(remote.get("councils") or []) if credit_on else [],
            "notes": remote.get("notes"),
        },
        "integrity": list((fiscal.get("integrity") or [])),
        "purpose": fiscal.get("purpose"),
    }
