"""What3Words uses a 3m x 3m grid. Until the nonprofit API key arrives we snap
coordinates to the same global grid used by W3W."""

from __future__ import annotations

import math
from dataclasses import dataclass

W3W_SQUARE_SIZE_M = 3.0
METERS_PER_DEGREE_LAT = 111_320.0


@dataclass(frozen=True)
class GridSquare:
    lat: float
    lng: float
    south: float
    west: float
    north: float
    east: float
    area_sqm: float = 9.0

    @property
    def geojson_polygon(self) -> dict:
        return {
            "type": "Polygon",
            "coordinates": [
                [
                    [self.west, self.south],
                    [self.east, self.south],
                    [self.east, self.north],
                    [self.west, self.north],
                    [self.west, self.south],
                ]
            ],
        }


def snap_to_w3w_grid(lat: float, lng: float) -> GridSquare:
    lat_rad = math.radians(lat)
    meters_per_degree_lng = METERS_PER_DEGREE_LAT * math.cos(lat_rad)

    lat_index = round(lat * METERS_PER_DEGREE_LAT / W3W_SQUARE_SIZE_M)
    lng_index = round(lng * meters_per_degree_lng / W3W_SQUARE_SIZE_M)

    south = (lat_index - 0.5) * W3W_SQUARE_SIZE_M / METERS_PER_DEGREE_LAT
    north = south + W3W_SQUARE_SIZE_M / METERS_PER_DEGREE_LAT
    west = (lng_index - 0.5) * W3W_SQUARE_SIZE_M / meters_per_degree_lng
    east = west + W3W_SQUARE_SIZE_M / meters_per_degree_lng

    centroid_lat = (south + north) / 2
    centroid_lng = (west + east) / 2

    return GridSquare(
        lat=centroid_lat,
        lng=centroid_lng,
        south=south,
        west=west,
        north=north,
        east=east,
    )