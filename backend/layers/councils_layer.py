"""Council choropleth layer — AGR at council centroid joined to boundaries."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from agr.service import ValuationService

REPO_ROOT = Path(__file__).resolve().parents[2]
BOUNDARIES = REPO_ROOT / "data" / "processed" / "scotland_councils.geojson"


@lru_cache(maxsize=4)
def build_councils_agr_geojson(scenario: str = "full_agr") -> dict[str, Any]:
    if not BOUNDARIES.exists():
        raise FileNotFoundError(f"Missing {BOUNDARIES}")

    with BOUNDARIES.open(encoding="utf-8") as handle:
        geo = json.load(handle)

    service = ValuationService.default()
    features_out: list[dict[str, Any]] = []
    rents: list[float] = []

    for feature in geo.get("features", []):
        props = dict(feature.get("properties") or {})
        raw_code = props.get("hpi_code") or props.get("boundary_code") or props.get("code")
        name = props.get("name") or props.get("NAME")

        geom = feature.get("geometry") or {}
        coords = geom.get("coordinates")
        if not coords:
            continue
        try:
            ring = coords[0][0] if geom.get("type") == "MultiPolygon" else coords[0]
            lats = [p[1] for p in ring]
            lngs = [p[0] for p in ring]
            clat = sum(lats) / len(lats)
            clng = sum(lngs) / len(lngs)
        except Exception:
            continue

        try:
            breakdown = service.assess_point(clat, clng, scenario=scenario)
        except Exception:
            continue

        cell = breakdown.annual_ground_rent_gbp
        plot = breakdown.roll_annual_rent_notional_plot_gbp
        rents.append(plot)
        features_out.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "code": breakdown.council_code or raw_code,
                    "name": breakdown.council_name or name,
                    "annual_ground_rent_cell_gbp": cell,
                    "annual_ground_rent_plot_gbp": plot,
                    "site_rental_per_sqm_gbp": breakdown.site_rental_per_sqm_gbp,
                    "method": breakdown.method,
                    "confidence": breakdown.confidence,
                    "scenario": scenario,
                    "rural": breakdown.method == "productive_land_use",
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features_out,
        "meta": {
            "layer": "councils_agr",
            "scenario": scenario,
            "feature_count": len(features_out),
            "metric": "annual_ground_rent_plot_gbp",
            "metric_label": "Notional plot AGR £/year",
            "agr_min_gbp": min(rents) if rents else None,
            "agr_max_gbp": max(rents) if rents else None,
            "note": "Council-level residual at boundary centroid — national overview layer.",
            "status": "research_estimate",
        },
    }


def clear_council_layer_cache() -> None:
    build_councils_agr_geojson.cache_clear()
