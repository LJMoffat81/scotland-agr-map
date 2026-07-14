"use client";

import { useState } from "react";

export type ScenarioId = "full_agr" | "replace_income_tax" | "revenue_neutral";

export type ScenarioCharge = {
  id: ScenarioId;
  label: string;
  annual_charge_gbp: number;
  description: string;
  effective_rate: number | null;
};

export type AgrResult = {
  annual_ground_rent_gbp: number;
  economic_annual_rent_gbp: number;
  active_scenario: ScenarioId;
  site_rental_per_sqm_gbp: number;
  site_capital_per_sqm_gbp: number;
  despeculated_site_capital_per_sqm_gbp: number;
  despeculated_site_value_gbp: number;
  site_share_used: number | null;
  yield_rate: number;
  capture_rate: number;
  confidence: string;
  method: string;
  disclaimer: string;
  notes: string[];
  council_name: string;
  council_code: string;
  average_price_gbp: number | null;
  lookup_method: string;
  parcel_id: string | null;
  parcel_area_sqm: number | null;
  ward_name: string | null;
  scenarios: Record<ScenarioId, ScenarioCharge>;
  equal_share_enabled?: boolean;
  equal_share_rent_per_person_gbp?: number | null;
  square_as_fraction_of_equal_claim?: number | null;
  scotland_population?: number | null;
  estimate_kind?: string;
  estimate_label?: string;
  site_share_source?: string;
  national_rent_pool_gbp?: number;
  integrity_caveats?: string[];
  habu?: string;
  hope_value_excluded?: boolean;
  market_value_gbp?: number | null;
  rebuild_cost_new_gbp?: number | null;
  drc_improvements_gbp?: number | null;
  site_capital_market_per_sqm_gbp?: number;
  roll_annual_rent_notional_plot_gbp?: number;
  roll_annual_rent_parcel_gbp?: number | null;
  notional_plot_sqm?: number;
  pickard_factor?: number;
  pickard_label?: string;
  sensitivity_overrides?: Record<string, number>;
};

export type SalesContext = {
  available?: boolean;
  count?: number;
  disclaimer?: string;
  comp_report?: {
    production_ready?: boolean;
    sample_count?: number;
    synthetic_count?: number;
    median_price_gbp?: number | null;
    median_implied_site_share?: number | null;
    median_site_capital_per_sqm_gbp?: number | null;
    median_annual_rent_per_sqm_gbp?: number | null;
    disclaimer?: string;
    method?: string;
  } | null;
  nearest?: Array<{
    distance_km: number;
    price_gbp: number;
    transfer_date: string;
    postcode?: string | null;
    production_eligible?: boolean;
  }>;
};

type Props = {
  agr: AgrResult;
  areaSqm: number;
  scenario: ScenarioId;
  onScenarioChange: (scenario: ScenarioId) => void;
  postcode?: string;
  lat: number;
  lng: number;
  what3words?: string | null;
  w3wConfigured?: boolean;
  salesContext?: SalesContext | null;
};

type DetailTab = "summary" | "calculate" | "about";

const SCENARIO_ORDER: ScenarioId[] = [
  "full_agr",
  "replace_income_tax",
  "revenue_neutral",
];

/** Short public-facing labels (full labels remain in API). */
const SCENARIO_SHORT: Record<ScenarioId, string> = {
  full_agr: "Full ground rent",
  replace_income_tax: "Replace income tax",
  revenue_neutral: "Replace CT + rates",
};

const SCENARIO_PLAIN: Record<ScenarioId, string> = {
  full_agr:
    "Charge the full estimated annual rent of the land alone — the community-created surplus.",
  replace_income_tax:
    "Scale that rent so Scotland could replace income tax from the national rent pool (Sandilands).",
  revenue_neutral:
    "A lower rate on land capital, sized to replace council tax and business rates (Wightman-style).",
};

function formatGbp(value: number, digits = 2) {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatGbpBn(value: number) {
  return `£${(value / 1_000_000_000).toFixed(0)}bn`;
}

function plainWhy(agr: AgrResult): string {
  if (agr.method === "residual_drc") {
    return "This estimate separates the value of the land from the buildings (valuer residual), then charges the economic rent of the site — not wages, and not bricks and mortar.";
  }
  return "This estimate uses productive land value for rural land, then charges the economic rent of the site — not wages, and not buildings.";
}

export default function AgrBreakdown({
  agr,
  areaSqm,
  scenario,
  onScenarioChange,
  postcode,
  lat,
  lng,
  what3words,
  w3wConfigured,
  salesContext,
}: Props) {
  const [tab, setTab] = useState<DetailTab>("summary");
  const active = agr.scenarios[scenario];
  const isResidual = agr.method === "residual_drc";

  // Household-relevant headline when we have a notional plot; scale scenario rate to plot
  const plotFull = agr.roll_annual_rent_notional_plot_gbp;
  const cellFull = agr.economic_annual_rent_gbp;
  const scale =
    cellFull > 0 ? active.annual_charge_gbp / cellFull : 1;
  const headline =
    plotFull != null && plotFull > 0
      ? plotFull * scale
      : active.annual_charge_gbp;
  const headlineIsPlot = plotFull != null && plotFull > 0;

  const locationLine = [
    postcode,
    agr.council_name,
    agr.ward_name ? `Ward: ${agr.ward_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const w3wDisplay = what3words
    ? `///${what3words.replace(/^\/+/, "")}`
    : null;

  return (
    <div className="clarity-result">
      <p className="pitch">
        Scotland&apos;s land has an annual rental value the community creates. Here is an
        estimate of that <strong>Annual Ground Rent</strong> for this place — measured on a{" "}
        <strong>What3Words 3×3 m cell</strong>.
      </p>

      <p className="location-line">
        {locationLine || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
      </p>

      {w3wDisplay ? (
        <p className="w3w-address" title="What3Words address for this 3×3 m cell">
          {w3wDisplay}
        </p>
      ) : (
        <p className="w3w-address muted" title="W3W-aligned grid cell">
          3×3 m W3W-aligned cell
          {!w3wConfigured
            ? " (///words when W3W_API_KEY is set)"
            : " (///words unavailable for this point)"}
        </p>
      )}

      <div className="agr-value" aria-live="polite">
        {formatGbp(headline, headline >= 100 ? 0 : 2)}
        <span className="agr-unit">/year</span>
      </div>
      <p className="headline-caption">
        {headlineIsPlot
          ? `Typical plot-scale estimate (~${agr.notional_plot_sqm?.toLocaleString("en-GB")} m²) under “${SCENARIO_SHORT[scenario]}”`
          : `For this ${areaSqm} m² W3W cell under “${SCENARIO_SHORT[scenario]}”`}
      </p>
      <p className="w3w-cell-line">
        This map cell: {formatGbp(active.annual_charge_gbp)}/year on {areaSqm} m² (one
        What3Words square)
      </p>

      <p className="plain-why">{SCENARIO_PLAIN[scenario]}</p>
      <p className="plain-why secondary">{plainWhy(agr)}</p>

      <div className="scenario-tabs" role="tablist" aria-label="Policy design">
        {SCENARIO_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={scenario === id}
            className={scenario === id ? "scenario-tab active" : "scenario-tab"}
            onClick={() => onScenarioChange(id)}
          >
            {SCENARIO_SHORT[id]}
          </button>
        ))}
      </div>

      <div className="detail-tabs" role="tablist" aria-label="Result details">
        {(
          [
            ["summary", "Summary"],
            ["calculate", "How calculated"],
            ["about", "About AGR"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "detail-tab active" : "detail-tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="detail-panel">
          <ul className="summary-list">
            <li>
              <strong>Council:</strong> {agr.council_name}
            </li>
            <li>
              <strong>What3Words cell:</strong>{" "}
              {w3wDisplay ?? "3×3 m grid (aligned with W3W)"} · {areaSqm} m² ·{" "}
              {formatGbp(active.annual_charge_gbp)}/year this scenario
            </li>
            {agr.parcel_id && (
              <li>
                <strong>Parcel:</strong> {agr.parcel_id}
                {agr.parcel_area_sqm
                  ? ` (${agr.parcel_area_sqm.toLocaleString("en-GB")} m²)`
                  : ""}
              </li>
            )}
            {agr.roll_annual_rent_parcel_gbp != null && (
              <li>
                <strong>Parcel roll line:</strong>{" "}
                {formatGbp(agr.roll_annual_rent_parcel_gbp * scale)}/year (this scenario)
              </li>
            )}
            <li>
              <strong>Confidence:</strong> {agr.confidence} · {agr.method}
            </li>
          </ul>
          {agr.sensitivity_overrides &&
            Object.keys(agr.sensitivity_overrides).length > 0 && (
              <p className="meta tight sensitivity-note">
                Research overrides active:{" "}
                {Object.entries(agr.sensitivity_overrides)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </p>
            )}
          <p className="meta tight">
            Research estimate for education — not an official tax bill. National rent-pool
            figures (Sandilands) are separate from this map residual.
          </p>
          <p className="meta tight">
            <a href="/methodology">Full methodology &amp; sources</a>
          </p>
        </div>
      )}

      {tab === "calculate" && (
        <div className="detail-panel">
          <ol className="calc-steps">
            <li>
              <strong>HABU</strong> — {agr.habu ?? "existing use"}
              {agr.hope_value_excluded ? " (hope value excluded from basis)" : ""}
            </li>
            {isResidual && agr.market_value_gbp != null && (
              <li>
                <strong>Market value</strong> — {formatGbp(agr.market_value_gbp)} (typical
                dwelling, council HPI)
              </li>
            )}
            {isResidual && agr.drc_improvements_gbp != null && (
              <li>
                <strong>Buildings (DRC)</strong> — {formatGbp(agr.drc_improvements_gbp)}{" "}
                depreciated rebuild, stripped from MV
              </li>
            )}
            <li>
              <strong>Site capital (market residual)</strong> —{" "}
              {formatGbp(agr.site_capital_market_per_sqm_gbp ?? agr.site_capital_per_sqm_gbp)}
              /m²
              {agr.site_share_used != null
                ? ` (${(agr.site_share_used * 100).toFixed(0)}% of MV)`
                : ""}
            </li>
            <li>
              <strong>Economic site capital (Pickard)</strong> —{" "}
              {formatGbp(agr.despeculated_site_capital_per_sqm_gbp)}/m²
              {agr.pickard_factor != null
                ? ` × ${(agr.pickard_factor * 100).toFixed(0)}%`
                : ""}
            </li>
            <li>
              <strong>Annual rent</strong> — {formatGbp(agr.site_rental_per_sqm_gbp)}
              /m² at {(agr.yield_rate * 100).toFixed(0)}% yield
            </li>
            <li>
              <strong>This scenario</strong> — {active.label}:{" "}
              {formatGbp(active.annual_charge_gbp)}/year on {areaSqm} m² cell
            </li>
          </ol>
          {agr.national_rent_pool_gbp != null && (
            <p className="meta">
              National rent pool (Sandilands macro): {formatGbpBn(agr.national_rent_pool_gbp)}
              /year — used for income-tax scaling and equal-share only, not the sum of map
              cells.
            </p>
          )}
          <details className="notes-details">
            <summary>Technical notes</summary>
            <ul>
              {agr.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
          {agr.integrity_caveats && agr.integrity_caveats.length > 0 && (
            <details className="notes-details">
              <summary>Integrity caveats</summary>
              <ul>
                {agr.integrity_caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </details>
          )}

          {salesContext?.available && salesContext.comp_report && (
            <details className="notes-details" open>
              <summary>Sales comparable cross-check (research)</summary>
              <p className="meta">
                {salesContext.comp_report.disclaimer || salesContext.disclaimer}
              </p>
              <ul className="summary-list">
                <li>
                  <strong>Samples:</strong> {salesContext.comp_report.sample_count} within
                  search radius
                  {salesContext.comp_report.synthetic_count
                    ? ` (${salesContext.comp_report.synthetic_count} synthetic)`
                    : ""}
                </li>
                {salesContext.comp_report.median_price_gbp != null && (
                  <li>
                    <strong>Median sale price:</strong>{" "}
                    {formatGbp(salesContext.comp_report.median_price_gbp, 0)}
                  </li>
                )}
                {salesContext.comp_report.median_implied_site_share != null && (
                  <li>
                    <strong>Median implied land share (MV−DRC):</strong>{" "}
                    {(salesContext.comp_report.median_implied_site_share * 100).toFixed(0)}%
                  </li>
                )}
                {salesContext.comp_report.median_site_capital_per_sqm_gbp != null && (
                  <li>
                    <strong>Median site capital:</strong>{" "}
                    {formatGbp(salesContext.comp_report.median_site_capital_per_sqm_gbp)}
                    /m² (comps)
                  </li>
                )}
                <li>
                  <strong>Production-ready:</strong>{" "}
                  {salesContext.comp_report.production_ready
                    ? "Yes (licensed sales only)"
                    : "No — fixture or mixed data; primary residual unchanged"}
                </li>
              </ul>
            </details>
          )}
        </div>
      )}

      {tab === "about" && (
        <div className="detail-panel">
          <p>
            <strong>Annual Ground Rent (AGR)</strong> is a charge on the rental value of
            land alone. Buildings and work stay untaxed. SLRG prefers “AGR” to “land value
            tax” to stress recovery of community-created rent.
          </p>
          <ul className="summary-list">
            <li>
              <strong>Wightman</strong> — residual site value (land after buildings)
            </li>
            <li>
              <strong>Pickard</strong> — economic rent after speculative premium
            </li>
            <li>
              <strong>Sandilands</strong> — Scotland rent pool and tax-shift designs
            </li>
          </ul>
          <p className="meta">
            Classical and modern land-rent thinkers (Smith, George, Unitism, and others)
            are documented on the methodology page — not required to read the map.
          </p>
          {agr.equal_share_enabled &&
            agr.equal_share_rent_per_person_gbp != null &&
            agr.square_as_fraction_of_equal_claim != null && (
              <p className="meta">
                Equal-share framing: one Scot ≈{" "}
                {formatGbp(agr.equal_share_rent_per_person_gbp, 0)}/year from the national
                pool; this cell&apos;s full economic rent is{" "}
                {(agr.square_as_fraction_of_equal_claim * 100).toFixed(4)}% of that claim
                (could fund services or a citizen dividend).
              </p>
            )}
          <p className="meta tight">
            <a href="/methodology">Read the full methodology</a>
            {" · "}
            <a href="https://www.slrg.scot" target="_blank" rel="noreferrer">
              SLRG
            </a>
          </p>
        </div>
      )}

      <p className="meta disclaimer-line">{agr.disclaimer}</p>
    </div>
  );
}
