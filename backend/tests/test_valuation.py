from agr.areas import lookup_council
from agr.engine import calculate_square_agr
from agr.valuation import residual_site_capital_per_sqm
from spatial.grid import snap_to_w3w_grid


def test_edinburgh_residual_above_rural():
    edinburgh = lookup_council(55.9533, -3.1883)
    highland = lookup_council(57.5, -4.2)

    ed_capital, _, _, _ = residual_site_capital_per_sqm(edinburgh)
    hi_capital, _, _, _ = residual_site_capital_per_sqm(highland)

    assert ed_capital > hi_capital * 10


def test_edinburgh_agr_is_positive_and_reasonable():
    square = snap_to_w3w_grid(55.9533, -3.1883)
    breakdown = calculate_square_agr(square)

    assert breakdown.annual_ground_rent_gbp > 100
    assert breakdown.annual_ground_rent_gbp < 5000
    assert breakdown.method == "residual"
    assert breakdown.council_code == "S12000036"