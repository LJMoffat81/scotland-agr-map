from __future__ import annotations

import os
from dataclasses import dataclass

import httpx


class W3WNotConfiguredError(RuntimeError):
    pass


@dataclass(frozen=True)
class W3WCoordinates:
    words: str
    lat: float
    lng: float
    country: str | None


def _api_key() -> str:
    key = os.getenv("W3W_API_KEY", "").strip()
    if not key:
        raise W3WNotConfiguredError(
            "W3W_API_KEY not set. Apply for SLRG nonprofit access at what3words.com."
        )
    return key


def is_configured() -> bool:
    return bool(os.getenv("W3W_API_KEY", "").strip())


def normalise_words(words: str) -> str:
    normalised = ".".join(
        part.strip().lower() for part in words.replace("/", ".").split(".") if part.strip()
    )
    if normalised.count(".") != 2:
        raise ValueError("What3Words address must contain exactly three words.")
    return normalised


def words_to_coordinates(words: str) -> W3WCoordinates:
    """Resolve a What3Words address via the official API."""
    normalised = normalise_words(words)
    api_key = _api_key()
    url = "https://api.what3words.com/v3/convert-to-coordinates"
    params = {"words": normalised, "key": api_key}

    with httpx.Client(timeout=10.0) as client:
        response = client.get(url, params=params)
        if response.status_code == 401:
            raise W3WNotConfiguredError("Invalid W3W_API_KEY.")
        response.raise_for_status()
        payload = response.json()

    if payload.get("error"):
        raise ValueError(payload["error"].get("message", "Invalid What3Words address."))

    coords = payload["coordinates"]
    return W3WCoordinates(
        words=payload.get("words", normalised),
        lat=float(coords["lat"]),
        lng=float(coords["lng"]),
        country=payload.get("country"),
    )


def coordinates_to_words(lat: float, lng: float) -> W3WCoordinates:
    """Reverse-geocode coordinates to a What3Words address (requires API key)."""
    api_key = _api_key()
    url = "https://api.what3words.com/v3/convert-to-3wa"
    params = {
        "coordinates": f"{lat},{lng}",
        "key": api_key,
        "language": "en",
    }

    with httpx.Client(timeout=10.0) as client:
        response = client.get(url, params=params)
        if response.status_code == 401:
            raise W3WNotConfiguredError("Invalid W3W_API_KEY.")
        response.raise_for_status()
        payload = response.json()

    if payload.get("error"):
        raise ValueError(payload["error"].get("message", "Could not resolve What3Words address."))

    coords = payload.get("coordinates") or {}
    return W3WCoordinates(
        words=str(payload.get("words", "")),
        lat=float(coords.get("lat", lat)),
        lng=float(coords.get("lng", lng)),
        country=payload.get("country"),
    )


def try_coordinates_to_words(lat: float, lng: float) -> str | None:
    """Best-effort reverse geocode; returns None if key missing or request fails."""
    if not is_configured():
        return None
    try:
        return coordinates_to_words(lat, lng).words
    except Exception:
        return None
