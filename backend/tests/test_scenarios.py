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


def test_equal_share_fields_present_and_coherent():
    from agr.config import load_config

    load_config.cache_clear()
    square = snap_to_w3w_grid(55.9533, -3.1883)
    breakdown = calculate_square_agr(square)
    config = load_config()

    assert breakdown.equal_share_enabled is True
    assert breakdown.equal_share_rent_per_person_gbp is not None
    assert breakdown.square_as_fraction_of_equal_claim is not None
    assert breakdown.scotland_population == config["equal_share"]["scotland_population"]

    expected_per_person = (
        config["macro"]["estimated_scotland_annual_rent_gbp"]
        / config["equal_share"]["scotland_population"]
    )
    assert abs(breakdown.equal_share_rent_per_person_gbp - expected_per_person) < 0.02
    assert breakdown.square_as_fraction_of_equal_claim == pytest.approx(
        breakdown.economic_annual_rent_gbp / expected_per_person,
        rel=1e-4,
    )
    assert any("Ogilvie" in note or "equal-share" in note.lower() for note in breakdown.notes)


def test_lineage_config_has_core_and_satellite():
    from agr.config import load_config

    # Clear cached config so integrity/lineage edits are visible in-process.
    load_config.cache_clear()
    config = load_config()
    core_ids = {entry["id"] for entry in config["lineage"]["core"]}
    assert {
        "smith",
        "ricardo",
        "ogilvie",
        "george",
        "gaffney",
        "harrison",
        "stiglitz",
        "macfarlane",
        "sandilands",
        "wightman",
        "pickard",
    }.issubset(core_ids)
    assert config["macro"]["atcor"] is True
    assert config["macro"]["ebcor"] is True
    assert config["integrity"]["estimate_kind"] == "valuer_residual_roll"
    assert config["valuer_roll"]["method"] == "residual_drc"
    assert len(config["integrity"]["caveats"]) >= 4


def test_integrity_fields_on_breakdown():
    from agr.config import load_config

    load_config.cache_clear()
    square = snap_to_w3w_grid(55.9533, -3.1883)
    breakdown = calculate_square_agr(square)

    assert breakdown.estimate_kind == "valuer_residual_roll"
    assert "valuer" in breakdown.estimate_label.lower() or "residual" in breakdown.estimate_label.lower()
    assert breakdown.national_rent_pool_gbp == 90_000_000_000
    assert len(breakdown.integrity_caveats) >= 4
    assert breakdown.method == "residual_drc"
    assert breakdown.drc_improvements_gbp is not None
    assert any("macro" in note.lower() or "pool" in note.lower() for note in breakdown.notes)