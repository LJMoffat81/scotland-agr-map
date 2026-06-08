from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import httpx
import yaml
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCES_PATH = REPO_ROOT / "data" / "config" / "sources.yaml"


@dataclass(frozen=True)
class CadastralParcel:
    inspire_id: str
    label: str
    national_reference: str
    area_sqm: float
    county: str | None


@lru_cache(maxsize=1)
def _parcel_cfg() -> dict:
    with SOURCES_PATH.open(encoding="utf-8") as handle:
        sources = yaml.safe_load(handle)
    return sources["parcels"]


def _compute_area_sqm(geometry: dict) -> float:
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:27700", always_xy=True)
    project = lambda x, y, z=None: transformer.transform(x, y)
    projected = transform(project, shape(geometry))
    return round(float(projected.area), 2)


def lookup_parcel(lat: float, lng: float) -> CadastralParcel | None:
    """Query ROS INSPIRE cadastral parcels via free WMS GetFeatureInfo."""
    cfg = _parcel_cfg()
    delta = cfg["query_delta_degrees"]
    bbox = f"{lat - delta},{lng - delta},{lat + delta},{lng + delta}"

    params = {
        "SERVICE": "WMS",
        "VERSION": "1.3.0",
        "REQUEST": "GetFeatureInfo",
        "QUERY_LAYERS": cfg["wms_layer"],
        "LAYERS": cfg["wms_layer"],
        "INFO_FORMAT": "application/json",
        "I": "50",
        "J": "50",
        "WIDTH": "101",
        "HEIGHT": "101",
        "CRS": "EPSG:4326",
        "BBOX": bbox,
    }

    try:
        with httpx.Client(timeout=cfg.get("timeout_seconds", 10.0)) as client:
            response = client.get(cfg["wms_url"], params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError:
        return None

    features = payload.get("features") or []
    if not features:
        return None

    feature = features[0]
    props = feature.get("properties") or {}
    geometry = feature.get("geometry")
    if not geometry:
        return None

    return CadastralParcel(
        inspire_id=str(props.get("inspireid") or feature.get("id") or ""),
        label=str(props.get("label") or ""),
        national_reference=str(props.get("nationalcadastralreference") or ""),
        area_sqm=_compute_area_sqm(geometry),
        county=props.get("county"),
    )