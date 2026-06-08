from __future__ import annotations

import httpx
import yaml
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from agr.engine import breakdown_to_dict, calculate_square_agr
from agr.config import load_config
from spatial.grid import snap_to_w3w_grid

app = FastAPI(
    title="Scotland AGR Map API",
    description="Annual Ground Rent estimates for What3Words 3x3m squares in Scotland",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SOURCES_PATH = Path(__file__).resolve().parents[2] / "data" / "config" / "sources.yaml"


def _load_postcode_api_url() -> str:
    with SOURCES_PATH.open(encoding="utf-8") as handle:
        sources = yaml.safe_load(handle)
    return sources["postcodes"]["api_url"]


def _scotland_bounds_check(lat: float, lng: float) -> None:
    if lat < 54.5 or lat > 61.0 or lng < -8.5 or lng > -0.5:
        raise HTTPException(status_code=400, detail="Coordinates appear to be outside Scotland.")


def _square_response(lat: float, lng: float, scenario: str | None = None) -> dict:
    _scotland_bounds_check(lat, lng)
    square = snap_to_w3w_grid(lat, lng)
    breakdown = calculate_square_agr(square, scenario=scenario)
    return {
        "square": {
            "lat": square.lat,
            "lng": square.lng,
            "area_sqm": square.area_sqm,
            "bounds": {
                "south": square.south,
                "west": square.west,
                "north": square.north,
                "east": square.east,
            },
            "polygon": square.geojson_polygon,
        },
        "agr": breakdown_to_dict(breakdown),
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "scotland-agr-map-api", "version": "0.3.0"}


@app.get("/config")
def get_config() -> dict:
    return load_config()


@app.get("/square")
def get_square(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    words: str | None = Query(default=None, description="What3Words address e.g. filled.count.soap"),
    scenario: str | None = Query(
        default="full_agr",
        description="Policy scenario: full_agr, replace_income_tax, revenue_neutral",
    ),
) -> dict:
    if words:
        raise HTTPException(
            status_code=501,
            detail="W3W API not configured yet. Apply for nonprofit access and set W3W_API_KEY.",
        )

    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Provide lat and lng, or words once W3W is configured.")

    try:
        return _square_response(lat, lng, scenario=scenario)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/postcode/{postcode}")
def get_postcode_square(
    postcode: str,
    scenario: str | None = Query(
        default="full_agr",
        description="Policy scenario: full_agr, replace_income_tax, revenue_neutral",
    ),
) -> dict:
    """Resolve a UK postcode via postcodes.io (free) and return AGR for that location."""
    normalised = postcode.replace(" ", "").upper()
    if len(normalised) < 5 or len(normalised) > 7:
        raise HTTPException(status_code=400, detail="Invalid postcode format.")

    api_url = _load_postcode_api_url()
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(f"{api_url}/{normalised}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Postcode lookup failed: {exc}") from exc

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Postcode not found.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Postcode service unavailable.")

    payload = response.json()
    result = payload.get("result")
    if not result:
        raise HTTPException(status_code=404, detail="Postcode not found.")

    country = (result.get("country") or "").lower()
    if country not in {"scotland", "england", "wales", "northern ireland"}:
        pass
    lat = result["latitude"]
    lng = result["longitude"]

    try:
        square_payload = _square_response(lat, lng, scenario=scenario)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException as exc:
        if exc.status_code == 400:
            raise HTTPException(
                status_code=400,
                detail="Postcode resolves outside Scotland.",
            ) from exc
        raise

    square_payload["postcode"] = {
        "postcode": result["postcode"],
        "parish": result.get("parish"),
        "admin_district": result.get("admin_district"),
        "country": result.get("country"),
    }
    return square_payload