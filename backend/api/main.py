from __future__ import annotations

import json
from pathlib import Path

import httpx
import yaml
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.cors import cors_settings
from fastapi.responses import PlainTextResponse

from agr.engine import breakdown_to_dict
from agr.config import load_config
from agr.overrides import merge_config_overrides
from agr.report import API_VERSION, build_assessment_report
from agr.service import ValuationService
from spatial.grid import snap_to_w3w_grid
from spatial.w3w import (
    W3WNotConfiguredError,
    is_configured as w3w_is_configured,
    normalise_words,
    try_coordinates_to_words,
    words_to_coordinates,
)
from validation.glasgow_ward_18 import run_validation
from validation.ratio_study import ratio_study_points

app = FastAPI(
    title="Scotland AGR Map API",
    description=(
        "Professional Annual Ground Rent assessments for Scotland "
        "(What3Words 3×3 m grid, SLRG-aligned residual roll)."
    ),
    version=API_VERSION,
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


def _parse_sensitivity(
    yield_rate: float | None,
    urban_speculation: float | None,
    farmland_factor: float | None,
) -> dict:
    base = load_config()
    try:
        return merge_config_overrides(
            base,
            yield_rate=yield_rate,
            urban_speculation_discount=urban_speculation,
            farmland_market_to_productive=farmland_factor,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _square_response(
    lat: float,
    lng: float,
    scenario: str | None = None,
    *,
    words_hint: str | None = None,
    config: dict | None = None,
    include_sales_context: bool = False,
) -> dict:
    _scotland_bounds_check(lat, lng)
    square = snap_to_w3w_grid(lat, lng)
    service = ValuationService(config=config if config is not None else load_config())
    breakdown = service.assess_square(square, scenario=scenario)

    # Prefer caller-supplied words; otherwise reverse-geocode snapped cell if key present
    what3words = words_hint
    if what3words is None:
        what3words = try_coordinates_to_words(square.lat, square.lng)

    payload = {
        "square": {
            "lat": square.lat,
            "lng": square.lng,
            "area_sqm": square.area_sqm,
            "grid": "what3words_3m",
            "bounds": {
                "south": square.south,
                "west": square.west,
                "north": square.north,
                "east": square.east,
            },
            "polygon": square.geojson_polygon,
        },
        "what3words": what3words,
        "w3w_configured": w3w_is_configured(),
        "method_family": "valuer_residual_roll",
        "agr": breakdown_to_dict(breakdown),
    }
    if include_sales_context:
        # Default service loads synthetic fixture for research — never claim as ROS
        research = ValuationService.default()
        if config is not None:
            research = ValuationService(config=config, sales=research.sales)
        ctx = research.sales_context(square.lat, square.lng)
        ctx["disclaimer"] = (
            "Sales context may include synthetic fixtures for pipeline tests. "
            "Only production_eligible rows may be treated as real market evidence."
        )
        payload["sales_context"] = ctx
    return payload


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
        "version": API_VERSION,
        "w3w_configured": w3w_is_configured(),
        "economist_signoff_status": signoff.get("status", "unknown"),
        "sales_pipeline": "comps_crosscheck",
        "data_policy": "no_portal_scraping",
        "assessment_reports": True,
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


@app.get("/validation/ratio-study")
def validation_ratio_study(
    samples: int = Query(default=8, ge=3, le=24),
    scenario: str = Query(default="full_agr"),
) -> dict:
    """Residual vs sales-comp extraction ratios (Ward 18 samples when available)."""
    if not WARD_18_GEOJSON.exists():
        raise HTTPException(status_code=503, detail="Glasgow Ward 18 boundary not built yet.")
    from validation.glasgow_ward_18 import _sample_points_in_ward

    points = _sample_points_in_ward(samples)
    study = ratio_study_points(points, scenario=scenario)
    study["area"] = "glasgow_ward_18"
    study["note"] = (
        "Research structure for professional QA. Synthetic sales make production_ready=false."
    )
    return study


@app.get("/assessment/report")
def assessment_report(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    scenario: str = Query(default="full_agr"),
    include_sales_context: bool = Query(default=True),
    format: str = Query(default="json", description="json or markdown"),
    yield_rate: float | None = Query(default=None),
    urban_speculation: float | None = Query(default=None),
    farmland_factor: float | None = Query(default=None),
):
    """Downloadable professional assessment pack for one location."""
    _scotland_bounds_check(lat, lng)
    config = _parse_sensitivity(yield_rate, urban_speculation, farmland_factor)
    try:
        report = build_assessment_report(
            lat,
            lng,
            scenario=scenario,
            config=config,
            include_sales=include_sales_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if format.lower() in ("md", "markdown", "text"):
        return PlainTextResponse(
            report["markdown"],
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{report["report_id"]}.md"'
            },
        )
    return report


@app.get("/square")
def get_square(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    words: str | None = Query(default=None, description="What3Words address e.g. filled.count.soap"),
    scenario: str | None = Query(
        default="full_agr",
        description="Policy scenario: full_agr, replace_income_tax, revenue_neutral",
    ),
    yield_rate: float | None = Query(
        default=None,
        description="Sensitivity: rentalisation yield (0.02–0.12). Default from config.",
    ),
    urban_speculation: float | None = Query(
        default=None,
        description="Sensitivity: Pickard urban factor (0.3–1.0). Default 0.70.",
    ),
    farmland_factor: float | None = Query(
        default=None,
        description="Sensitivity: Pickard farmland productive factor (0.1–1.0). Default 0.20.",
    ),
    include_sales_context: bool = Query(
        default=False,
        description="Include nearby sales from fixture/licensed store (research).",
    ),
) -> dict:
    words_hint: str | None = None
    if words:
        try:
            coords = words_to_coordinates(words)
            words_hint = normalise_words(words)
            if coords.words:
                words_hint = coords.words
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

    config = _parse_sensitivity(yield_rate, urban_speculation, farmland_factor)
    try:
        return _square_response(
            lat,
            lng,
            scenario=scenario,
            words_hint=words_hint,
            config=config,
            include_sales_context=include_sales_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/sales/status")
def sales_status() -> dict:
    """Pipeline status for professional sales ingest (fixtures vs licensed)."""
    service = ValuationService.default()
    summary = service.sales.summary() if service.sales else {"count": 0}
    return {
        "pipeline": "scaffolded",
        "portal_scraping": False,
        "preferred_authority": "Registers of Scotland",
        "fixture_loaded": bool(service.sales and len(service.sales) > 0),
        "store": summary,
        "docs": [
            "docs/DATA_LICENSING.md",
            "docs/DATA_ACQUISITION.md",
            "docs/PROFESSIONAL_STANDARD.md",
        ],
    }


@app.get("/postcode/{postcode}")
def get_postcode_square(
    postcode: str,
    scenario: str | None = Query(
        default="full_agr",
        description="Policy scenario: full_agr, replace_income_tax, revenue_neutral",
    ),
    yield_rate: float | None = Query(default=None),
    urban_speculation: float | None = Query(default=None),
    farmland_factor: float | None = Query(default=None),
    include_sales_context: bool = Query(default=False),
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

    config = _parse_sensitivity(yield_rate, urban_speculation, farmland_factor)
    try:
        square_payload = _square_response(
            lat,
            lng,
            scenario=scenario,
            config=config,
            include_sales_context=include_sales_context,
        )
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