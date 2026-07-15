from agr.fiscal import (
    basket_total_gbp,
    fiscal_summary,
    national_collection_for_scenario,
    place_fiscal,
    remote_credit_for_council,
)
from agr.scenarios import VALID_SCENARIOS, compute_scenarios, resolve_active_scenario


def test_basket_total_positive():
    total = basket_total_gbp()
    assert total > 15_000_000_000  # income tax + CT + NDR research basket


def test_full_agr_surplus_over_basket():
    summary = fiscal_summary("full_agr")
    assert summary["enabled"] is True
    assert summary["surplus_gbp"] > 0
    assert summary["revenue_neutral_or_better"] is True


def test_replace_full_basket_roughly_neutral():
    summary = fiscal_summary("replace_full_basket")
    assert abs(summary["surplus_gbp"]) < 1_000_000  # rounding
    assert summary["revenue_neutral_or_better"] is True


def test_place_edinburgh_net_contributor():
    # High plot rent (above equal-share ~£16k) → contributor under full AGR
    place = place_fiscal(
        gross_plot_gbp=25000,
        council_code="S12000036",
        scenario="full_agr",
    )
    assert place["role"] == "net_contributor"
    assert place["net_gbp"] > 0
    assert place["remote_credit_gbp"] == 0


def test_place_island_can_be_net_receiver():
    # Low gross + equal dividend + remote credit
    place = place_fiscal(
        gross_plot_gbp=400,
        council_code="S12000013",
        scenario="full_agr",
    )
    assert place["remote_credit_gbp"] == 500
    assert place["net_gbp"] < 0
    assert place["role"] == "net_receiver"


def test_remote_credit_toggle_off():
    assert remote_credit_for_council("S12000013", credit_enabled=False) == 0


def test_replace_full_basket_scenario_exists():
    assert "replace_full_basket" in VALID_SCENARIOS
    resolve_active_scenario("replace_full_basket")
    economic, charges = compute_scenarios(
        site_rental_per_sqm=20.0,
        despeculated_site_capital_per_sqm=400.0,
        area_sqm=9.0,
        capture_rate=1.0,
    )
    assert economic > 0
    assert "replace_full_basket" in charges
    assert charges["replace_full_basket"].annual_charge_gbp < charges["full_agr"].annual_charge_gbp


def test_national_collection_methods():
    coll, rate, _ = national_collection_for_scenario("replace_income_tax")
    assert coll == 11_500_000_000
    assert 0 < rate < 1
