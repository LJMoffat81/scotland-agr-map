from agr.config import load_config
from agr.engine import calculate_square_agr
from agr.overrides import merge_config_overrides
from spatial.grid import snap_to_w3w_grid


def setup_function():
    load_config.cache_clear()


def test_higher_yield_raises_full_agr():
    square = snap_to_w3w_grid(55.9533, -3.1883)
    base = calculate_square_agr(square, scenario="full_agr")
    high = calculate_square_agr(
        square,
        scenario="full_agr",
        config=merge_config_overrides(load_config(), yield_rate=0.06),
    )
    assert high.annual_ground_rent_gbp > base.annual_ground_rent_gbp
    assert high.sensitivity_overrides.get("yield_rate") == 0.06


def test_urban_pickard_1_raises_rent():
    square = snap_to_w3w_grid(55.9533, -3.1883)
    base = calculate_square_agr(square, scenario="full_agr")
    full_market = calculate_square_agr(
        square,
        scenario="full_agr",
        config=merge_config_overrides(load_config(), urban_speculation_discount=1.0),
    )
    assert full_market.annual_ground_rent_gbp > base.annual_ground_rent_gbp


def test_invalid_yield_rejected():
    import pytest

    with pytest.raises(ValueError):
        merge_config_overrides(load_config(), yield_rate=0.5)
