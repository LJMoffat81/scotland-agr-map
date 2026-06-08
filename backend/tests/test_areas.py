from agr.areas import lookup_council


def test_edinburgh_coords_map_to_edinburgh():
    council = lookup_council(55.9533, -3.1883)
    assert council.code == "S12000036"
    assert council.name == "City of Edinburgh"
    assert council.average_price_gbp > 200_000


def test_highland_coords_map_to_highland():
    council = lookup_council(57.5, -4.2)
    assert council.code == "S12000017"
    assert council.rural is True