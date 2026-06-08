from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from agr.engine import breakdown_to_dict, calculate_square_agr
from agr.config import load_config
from spatial.grid import snap_to_w3w_grid

app = FastAPI(
    title="Scotland AGR Map API",
    description="Annual Ground Rent estimates for What3Words 3x3m squares in Scotland",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "scotland-agr-map-api"}


@app.get("/config")
def get_config() -> dict:
    return load_config()


@app.get("/square")
def get_square(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    words: str | None = Query(default=None, description="What3Words address e.g. filled.count.soap"),
) -> dict:
    if words:
        raise HTTPException(
            status_code=501,
            detail="W3W API not configured yet. Apply for nonprofit access and set W3W_API_KEY.",
        )

    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Provide lat and lng, or words once W3W is configured.")

    if lat < 54.5 or lat > 61.0 or lng < -8.5 or lng > -0.5:
        raise HTTPException(status_code=400, detail="Coordinates appear to be outside Scotland.")

    square = snap_to_w3w_grid(lat, lng)
    breakdown = calculate_square_agr(square)

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