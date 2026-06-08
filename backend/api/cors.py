from __future__ import annotations

import os


def cors_settings() -> tuple[list[str], str | None]:
    """Resolve allowed browser origins for production (Vercel + local dev)."""
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]

    if not origins:
        origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    regex = os.getenv("ALLOW_ORIGIN_REGEX")
    if regex is None and os.getenv("ALLOW_VERCEL_PREVIEWS", "true").lower() == "true":
        regex = r"https://.*\.vercel\.app"

    return origins, regex or None