from spatial.grid import snap_to_w3w_grid


def test_snap_returns_nine_sqm_square():
    square = snap_to_w3w_grid(55.9533, -3.1883)
    assert square.area_sqm == 9.0
    assert square.south < square.lat < square.north
    assert square.west < square.lng < square.east


def test_snap_is_deterministic():
    first = snap_to_w3w_grid(56.4907, -4.2026)
    second = snap_to_w3w_grid(56.4907, -4.2026)
    assert first == second