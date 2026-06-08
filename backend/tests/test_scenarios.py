import pytest

from agr.engine import calculate_square_agr
from agr.scenarios import compute_scenarios, resolve_active_scenario
from spatial.grid import snap_to_w3w_grid


def test_resolve_active_scenario_defaults_to_full_agr():
    assert resolve_active_scenario(None) == "full_agr"


def test_resolve_active_scenario_rejects_unknown():
    with pytest.raises(ValueError, match="Unknown scenario"):
        resolve_active_scenario("abolish_all_tax")


def test_edinburgh_scenarios_ordering():
    square = snap_to_w3w_grid(55.9533, -3.1883)
    breakdown = calculate_square_agr(square)

    full = breakdown.scenarios["full_agr"]["annual_charge_gbp"]
    income_tax = breakdown.scenarios["replace_income_tax"]["annual_charge_gbp"]
    revenue = breakdown.scenarios["revenue_neutral"]["annual_charge_gbp"]

    assert full == breakdown.economic_annual_rent_gbp
    assert income_tax < full
    assert revenue < full
    assert all(charge > 0 for charge in (full, income_tax, revenue))


def test_scenario_param_changes_active_charge():
    square = snap_to_w3w_grid(55.9533, -3.1883)
    full = calculate_square_agr(square, scenario="full_agr")
    neutral = calculate_square_agr(square, scenario="revenue_neutral")

    assert full.annual_ground_rent_gbp == full.scenarios["full_agr"]["annual_charge_gbp"]
    assert neutral.annual_ground_rent_gbp == neutral.scenarios["revenue_neutral"]["annual_charge_gbp"]
    assert neutral.annual_ground_rent_gbp != full.annual_ground_rent_gbp


def test_compute_scenarios_returns_three_policies():
    _, charges = compute_scenarios(
        site_rental_per_sqm=50.0,
        despeculated_site_capital_per_sqm=1000.0,
        area_sqm=9.0,
        capture_rate=1.0,
    )
    assert set(charges) == {"full_agr", "replace_income_tax", "revenue_neutral"}