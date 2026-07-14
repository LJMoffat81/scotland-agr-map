"""Council choropleth layer — thin wrapper over multi-metric builder."""

from __future__ import annotations

from typing import Any

from layers.council_metrics import (
    build_council_metrics_geojson,
    clear_metrics_cache,
)


def build_councils_agr_geojson(scenario: str = "full_agr") -> dict[str, Any]:
    """
    Backward-compatible AGR layer.
    Full metrics live in meta.metrics; paint by annual_ground_rent_plot_gbp.
    """
    geo = build_council_metrics_geojson(scenario)
    # Preserve legacy meta keys used by older clients
    plot_prop = "annual_ground_rent_plot_gbp"
    plots = [
        f["properties"].get(plot_prop)
        for f in geo["features"]
        if f["properties"].get(plot_prop) is not None
    ]
    geo["meta"] = {
        **geo.get("meta", {}),
        "layer": "councils_agr",
        "metric": plot_prop,
        "metric_label": "Notional plot AGR £/year",
        "agr_min_gbp": min(plots) if plots else None,
        "agr_max_gbp": max(plots) if plots else None,
    }
    return geo


def clear_council_layer_cache() -> None:
    clear_metrics_cache()
