from agr.areas import lookup_council
from spatial.polygons import lookup_council_boundary, lookup_glasgow_ward_18


def test_edinburgh_uses_boundary_polygon():
    council = lookup_council(55.9533, -3.1883)
    assert council.code == "S12000036"
    assert council.lookup_method == "boundary"
    assert council.distance_km == 0.0


def test_boundary_match_for_edinburgh():
    match = lookup_council_boundary(55.9533, -3.1883)
    assert match is not None
    assert match.hpi_code == "S12000036"


def test_glasgow_ward_18_centre_is_in_ward():
    # Approximate centre of East Centre ward
    ward = lookup_glasgow_ward_18(55.864, -4.195)
    assert ward is not None
    assert ward.ward_number == 18
    assert ward.ward_name == "East Centre"