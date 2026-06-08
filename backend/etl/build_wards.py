"""Extract Glasgow Ward 18 (East Centre) boundary for validation case study."""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

import httpx
import shapefile
import yaml
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCES_PATH = REPO_ROOT / "data" / "config" / "sources.yaml"
CACHE_DIR = REPO_ROOT / "data" / "cache"
OUTPUT_PATH = REPO_ROOT / "data" / "processed" / "glasgow_ward_18.geojson"


def _download_wards_zip(client: httpx.Client, url: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = CACHE_DIR / "scotland_wards.zip"
    extract_dir = CACHE_DIR / "scotland_wards"
    response = client.get(url, timeout=120.0)
    response.raise_for_status()
    zip_path.write_bytes(response.content)
    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(extract_dir)
    return extract_dir


def build_glasgow_ward_18() -> dict:
    with SOURCES_PATH.open(encoding="utf-8") as handle:
        sources = yaml.safe_load(handle)
    ward_cfg = sources["boundaries"]["glasgow_ward_18"]

    with httpx.Client() as client:
        extract_dir = _download_wards_zip(client, ward_cfg["source_url"])

    shp_path = next(extract_dir.glob("*.shp"))
    reader = shapefile.Reader(str(shp_path).replace(".shp", ""), encoding="latin-1")
    transformer = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    project = lambda x, y, z=None: transformer.transform(x, y)

    target_record = None
    target_shape = None
    for record, shp in zip(reader.iterRecords(), reader.iterShapes()):
        if (
            record["Council"] == ward_cfg["council_name"]
            and record["Ward_No"] == ward_cfg["ward_number"]
        ):
            target_record = record
            target_shape = shp
            break

    if target_record is None or target_shape is None:
        raise RuntimeError("Glasgow Ward 18 not found in boundaries.scot shapefile")

    parts = []
    points = target_shape.points
    parts_idx = list(target_shape.parts) + [len(points)]
    for start, end in zip(parts_idx, parts_idx[1:]):
        ring = [(pt[0], pt[1]) for pt in points[start:end]]
        parts.append(ring)

    geom = shape({"type": "Polygon", "coordinates": parts})
    geom_wgs84 = transform(project, geom)

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "ward_number": target_record["Ward_No"],
                    "ward_name": target_record["Name"],
                    "ward_code": target_record["ONS_2010"],
                    "council": target_record["Council"],
                    "review": target_record["Review"],
                    "validation_label": ward_cfg["validation_label"],
                },
                "geometry": mapping(geom_wgs84),
            }
        ],
    }


def main() -> None:
    geojson = build_glasgow_ward_18()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(geojson), encoding="utf-8")
    print(f"Wrote Glasgow Ward 18 ({geojson['features'][0]['properties']['ward_name']}) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()