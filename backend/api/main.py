from __future__ import annotations

import json
from pathlib import Path

import httpx
import yaml
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.cors import cors_settings
from agr.engine import breakdown_to_dict, calculate_square_agr
from agr.config import load_config
from spatial.grid import snap_to_w3w_grid
from spatial.w3w import W3WNotConfiguredError, words_to_coordinates
from validation.glasgow_ward_18 import run_validation

app = FastAPI(
    title="Scotland AGR Map API",
    description="Annual Ground Rent estimates for What3Words 3x3m squares in Scotland",
    version="0.5.0",
)

_allowed_origins, _allowed_origin_regex = cors_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCES_PATH = REPO_ROOT / "data" / "config" / "sources.yaml"
COUNCILS_GEOJSON = REPO_ROOT / "data" / "processed" / "scotland_councils.geojson"
WARD_18_GEOJSON = REPO_ROOT / "data" / "processed" / "glasgow_ward_18.geojson"


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


def _load_geojson(path: Path) -> JSONResponse:
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Missing {path.name}. Run the Phase 3 ETL scripts in backend/etl/.",
        )
    return JSONResponse(json.loads(path.read_text(encoding="utf-8")))


@app.get("/health")
def health() -> dict:
    config = load_config()
    signoff = config.get("economist_signoff", {})
    return {
        "status": "ok",
        "service": "scotland-agr-map-api",
        "version": "0.5.0",
        "w3w_configured": bool(__import__("os").getenv("W3W_API_KEY")),
        "economist_signoff_status": signoff.get("status", "unknown"),
    }


@app.get("/signoff")
def get_signoff() -> dict:
    config = load_config()
    return config.get("economist_signoff", {"status": "unknown"})


@app.get("/config")
def get_config() -> dict:
    return load_config()


@app.get("/boundaries/councils")
def get_council_boundaries() -> JSONResponse:
    return _load_geojson(COUNCILS_GEOJSON)


@app.get("/boundaries/glasgow-ward-18")
def get_glasgow_ward_18_boundary() -> JSONResponse:
    return _load_geojson(WARD_18_GEOJSON)


@app.get("/validation/glasgow-ward-18")
def validate_glasgow_ward_18(
    samples: int = Query(default=12, ge=3, le=30),
) -> dict:
    if not WARD_18_GEOJSON.exists():
        raise HTTPException(status_code=503, detail="Glasgow Ward 18 boundary not built yet.")
    return run_validation(sample_count=samples)


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
        try:
            coords = words_to_coordinates(words)
        except W3WNotConfiguredError as exc:
            raise HTTPException(status_code=501, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        lat = coords.lat
        lng = coords.lng

    if lat is None or lng is None:
        raise HTTPException(
            status_code=400,
            detail="Provide lat and lng, or words (requires W3W_API_KEY).",
        )

    try:
        payload = _square_response(lat, lng, scenario=scenario)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if words:
        payload["what3words"] = words
    return payload


@app.get("/postcode/{postcode}")
def get_postcode_square(
    postcode: str,
    scenario: str | None = Query(
        default="full_agr",
        description="Policy scenario: full_agr, replace_income_tax, revenue_neutral",
    ),
) -> dict:
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