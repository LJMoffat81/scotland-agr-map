from layers.councils_layer import build_councils_agr_geojson
from layers.grid_layer import build_w3w_agr_grid, estimate_cell_count


def test_councils_agr_layer():
    geo = build_councils_agr_geojson("full_agr")
    assert geo["type"] == "FeatureCollection"
    assert len(geo["features"]) >= 20
    props = geo["features"][0]["properties"]
    assert "annual_ground_rent_plot_gbp" in props
    assert props["annual_ground_rent_plot_gbp"] >= 0
    assert geo["meta"]["layer"] == "councils_agr"


def test_w3w_grid_edinburgh_bbox():
    # Small bbox around Edinburgh centre
    geo = build_w3w_agr_grid(
        55.950, -3.195, 55.956, -3.185, scenario="full_agr", max_cells=80
    )
    assert geo["type"] == "FeatureCollection"
    assert 1 <= len(geo["features"]) <= 80
    f0 = geo["features"][0]
    assert f0["geometry"]["type"] == "Polygon"
    assert f0["properties"]["area_sqm"] == 9.0
    assert f0["properties"]["annual_ground_rent_gbp"] > 0
    assert geo["meta"]["cell_count"] == len(geo["features"])


def test_estimate_cell_count_positive():
    n = estimate_cell_count(55.95, -3.20, 55.96, -3.18)
    assert n > 10
