"""Build simplified Scottish council boundary GeoJSON for point-in-polygon lookup.

Run from backend:
    python -m etl.build_boundaries
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import yaml
from shapely.geometry import mapping, shape

from etl.code_mapping import BOUNDARY_TO_HPI, BOUNDARY_NAME_TO_HPI_NAME, HPI_TO_BOUNDARY

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCES_PATH = REPO_ROOT / "data" / "config" / "sources.yaml"
CACHE_DIR = REPO_ROOT / "data" / "cache"
OUTPUT_PATH = REPO_ROOT / "data" / "processed" / "scotland_councils.geojson"


def _download_uk_lad(client: httpx.Client, url: str) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "uk_lad.json"
    response = client.get(url, timeout=120.0)
    response.raise_for_status()
    payload = response.json()
    cache_path.write_text(json.dumps(payload), encoding="utf-8")
    return payload


def build_boundaries() -> dict:
    with SOURCES_PATH.open(encoding="utf-8") as handle:
        sources = yaml.safe_load(handle)
    cfg = sources["boundaries"]["councils"]
    simplify_tolerance = cfg["simplify_tolerance_degrees"]

    with httpx.Client() as client:
        payload = _download_uk_lad(client, cfg["source_url"])

    features: list[dict] = []
    for feature in payload["features"]:
        boundary_code = feature["properties"]["LAD13CD"]
        if boundary_code not in BOUNDARY_TO_HPI:
            continue

        hpi_code = BOUNDARY_TO_HPI[boundary_code]
        boundary_name = feature["properties"]["LAD13NM"]
        hpi_name = BOUNDARY_NAME_TO_HPI_NAME.get(boundary_name, boundary_name)

        geometry = shape(feature["geometry"]).simplify(
            simplify_tolerance, preserve_topology=True
        )

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "hpi_code": hpi_code,
                    "boundary_code": boundary_code,
                    "name": hpi_name,
                },
                "geometry": mapping(geometry),
            }
        )

    features.sort(key=lambda item: item["properties"]["name"])
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    geojson = build_boundaries()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(geojson), encoding="utf-8")
    print(f"Wrote {len(geojson['features'])} council boundaries to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()