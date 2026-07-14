from layers.council_metrics import METRIC_DEFS, build_council_metrics_geojson, layer_catalog
from layers.councils_layer import build_councils_agr_geojson


def test_council_metrics_has_all_paint_properties():
    geo = build_council_metrics_geojson("full_agr")
    assert geo["type"] == "FeatureCollection"
    assert len(geo["features"]) >= 20
    props = geo["features"][0]["properties"]
    for mid, defn in METRIC_DEFS.items():
        assert defn["property"] in props or props.get(defn["property"]) is None
        assert mid in geo["meta"]["metrics"]


def test_value_metrics_positive_for_edinburgh_area():
    geo = build_council_metrics_geojson("full_agr")
    edi = next(
        (f for f in geo["features"] if "Edinburgh" in (f["properties"].get("name") or "")),
        None,
    )
    assert edi is not None
    p = edi["properties"]
    assert p["average_price_gbp"] and p["average_price_gbp"] > 100_000
    assert p["annual_ground_rent_plot_gbp"] and p["annual_ground_rent_plot_gbp"] > 0
    assert p["site_rental_per_sqm_gbp"] and p["site_rental_per_sqm_gbp"] > 0
    assert p["agr_as_pct_of_price"] and p["agr_as_pct_of_price"] > 0
    assert p.get("simd_pct_20most_deprived") is not None
    assert p.get("population_density_per_km2") and p["population_density_per_km2"] > 0


def test_legacy_councils_agr_compat():
    geo = build_councils_agr_geojson("full_agr")
    assert geo["meta"]["layer"] == "councils_agr"
    assert "agr_min_gbp" in geo["meta"]


def test_layer_catalog():
    cat = layer_catalog()
    assert len(cat["choropleth_metrics"]) >= 6
    assert any(o["id"] == "boundaries" for o in cat["overlays"])
    assert cat["data_policy"]["portal_scraping"] is False
