"""Professional assessment report — machine-readable + plain markdown."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from agr.config import load_config
from agr.engine import AgrBreakdown, breakdown_to_dict
from agr.service import ValuationService
from spatial.grid import snap_to_w3w_grid
from spatial.w3w import try_coordinates_to_words


API_VERSION = "0.7.0"


def build_assessment_report(
    lat: float,
    lng: float,
    *,
    scenario: str = "full_agr",
    config: dict | None = None,
    include_sales: bool = True,
    service: ValuationService | None = None,
) -> dict[str, Any]:
    """Full professional pack for one place (JSON-serialisable)."""
    config = config if config is not None else load_config()
    service = service or ValuationService(config=config)
    if include_sales and service.sales is None:
        service = ValuationService.default()
        if config is not load_config():
            service = ValuationService(config=config, sales=service.sales)

    square = snap_to_w3w_grid(lat, lng)
    breakdown = service.assess_square(square, scenario=scenario)
    words = try_coordinates_to_words(square.lat, square.lng)
    sales_ctx = service.sales_context(square.lat, square.lng) if include_sales else None

    issued = datetime.now(timezone.utc).isoformat()
    report_id = (
        f"AGR-{square.lat:.5f}-{square.lng:.5f}-{scenario}-"
        f"{issued[:19].replace(':', '').replace('-', '')}Z"
    )

    report = {
        "report_id": report_id,
        "issued_at_utc": issued,
        "api_version": API_VERSION,
        "standard": "docs/PROFESSIONAL_STANDARD.md",
        "product": "Scotland AGR Map — professional residual assessment",
        "disclaimer": breakdown.disclaimer,
        "status": "research_estimate",
        "not_statutory": True,
        "place": {
            "lat": square.lat,
            "lng": square.lng,
            "area_sqm": square.area_sqm,
            "grid": "what3words_3m",
            "what3words": words,
            "council_code": breakdown.council_code,
            "council_name": breakdown.council_name,
            "ward_name": breakdown.ward_name,
            "parcel_id": breakdown.parcel_id,
            "parcel_area_sqm": breakdown.parcel_area_sqm,
        },
        "policy_scenario": scenario,
        "assessment": breakdown_to_dict(breakdown),
        "roll_lines": {
            "grid_cell_annual_gbp": breakdown.annual_ground_rent_gbp,
            "notional_plot_annual_gbp": breakdown.roll_annual_rent_notional_plot_gbp,
            "parcel_annual_gbp": breakdown.roll_annual_rent_parcel_gbp,
            "notional_plot_sqm": breakdown.notional_plot_sqm,
        },
        "method": {
            "family": "valuer_residual_roll",
            "habu": breakdown.habu,
            "hope_value_excluded": breakdown.hope_value_excluded,
            "steps": [
                "Resolve place to W3W 3×3 m cell",
                "HABU = existing authorised use",
                "MV from council HPI (urban) or land-use table (rural)",
                "DRC of improvements (rebuild × stock remaining)",
                "Site capital = MV − DRC (clamped)",
                "Pickard economic factor",
                "Annual rent = economic site capital × yield",
                "Apply policy scenario",
            ],
            "sensitivity_overrides": breakdown.sensitivity_overrides,
        },
        "sales_crosscheck": sales_ctx,
        "data_policy": {
            "portal_scraping": False,
            "preferred_sales_authority": "Registers of Scotland",
        },
        "lineage_note": (
            "SLRG-aligned: Wightman residual, Pickard economic rent, Sandilands scenarios. "
            "Intellectual lineage is pedagogical; charge maths are operational."
        ),
    }
    report["markdown"] = render_report_markdown(report)
    return report


def render_report_markdown(report: dict[str, Any]) -> str:
    place = report["place"]
    agr = report["assessment"]
    roll = report["roll_lines"]
    w3w = place.get("what3words")
    w3w_line = f"///{w3w}" if w3w else "3×3 m W3W-aligned cell (words pending API key)"

    lines = [
        f"# Scotland AGR Assessment Report",
        "",
        f"**Report ID:** `{report['report_id']}`  ",
        f"**Issued (UTC):** {report['issued_at_utc']}  ",
        f"**Status:** Research estimate — **not** a statutory tax assessment  ",
        f"**API version:** {report['api_version']}",
        "",
        "## Place",
        "",
        f"- **Council:** {place.get('council_name')} ({place.get('council_code')})",
        f"- **Coordinates:** {place['lat']:.6f}, {place['lng']:.6f}",
        f"- **What3Words:** {w3w_line}",
        f"- **Grid cell:** {place['area_sqm']} m²",
    ]
    if place.get("ward_name"):
        lines.append(f"- **Ward:** {place['ward_name']}")
    if place.get("parcel_id"):
        lines.append(
            f"- **Parcel:** {place['parcel_id']}"
            + (
                f" ({place['parcel_area_sqm']:,.0f} m²)"
                if place.get("parcel_area_sqm")
                else ""
            )
        )

    lines += [
        "",
        "## Charges (selected scenario)",
        "",
        f"- **Scenario:** `{report['policy_scenario']}`",
        f"- **Grid cell AGR:** £{roll['grid_cell_annual_gbp']:,.2f} / year",
        f"- **Notional plot AGR** (~{roll['notional_plot_sqm']:.0f} m²): "
        f"£{roll['notional_plot_annual_gbp']:,.2f} / year",
    ]
    if roll.get("parcel_annual_gbp") is not None:
        lines.append(
            f"- **Parcel AGR:** £{roll['parcel_annual_gbp']:,.2f} / year"
        )

    lines += [
        "",
        "## Residual path",
        "",
        f"- **Method:** {agr.get('method')} · confidence **{agr.get('confidence')}**",
        f"- **HABU:** {agr.get('habu')}",
        f"- **Yield:** {100 * float(agr.get('yield_rate') or 0):.1f}%",
        f"- **Site capital (economic):** £{agr.get('despeculated_site_capital_per_sqm_gbp')}/m²",
        f"- **Annual rent (economic):** £{agr.get('site_rental_per_sqm_gbp')}/m²",
        "",
        "## Disclaimer",
        "",
        report["disclaimer"],
        "",
        report["lineage_note"],
        "",
    ]

    sales = report.get("sales_crosscheck") or {}
    if sales.get("available"):
        cr = sales.get("comp_report") or {}
        lines += [
            "## Sales cross-check (research)",
            "",
            f"- Samples: {cr.get('sample_count')}",
            f"- Synthetic: {cr.get('synthetic_count')}",
            f"- Production-ready: {cr.get('production_ready')}",
        ]
        if cr.get("median_price_gbp") is not None:
            lines.append(f"- Median sale price: £{cr['median_price_gbp']:,.0f}")
        if cr.get("median_implied_site_share") is not None:
            lines.append(
                f"- Median implied land share: {100 * cr['median_implied_site_share']:.0f}%"
            )
        lines += ["", sales.get("disclaimer") or cr.get("disclaimer") or "", ""]

    lines += [
        "---",
        f"*Generated by Scotland AGR Map {report['api_version']} · "
        f"{report['standard']}*",
        "",
    ]
    return "\n".join(lines)
