"use client";

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
  site_share_used: number;
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
};

type Props = {
  agr: AgrResult;
  areaSqm: number;
  scenario: ScenarioId;
  onScenarioChange: (scenario: ScenarioId) => void;
  postcode?: string;
  lat: number;
  lng: number;
};

const SCENARIO_ORDER: ScenarioId[] = [
  "full_agr",
  "replace_income_tax",
  "revenue_neutral",
];

function formatGbp(value: number) {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatGbpBn(value: number) {
  return `£${(value / 1_000_000_000).toFixed(0)}bn`;
}

function siteShareSourceLabel(source?: string) {
  if (source === "wightman_49pct") return "Wightman research (49%)";
  if (source === "slrg_60pct") return "SLRG display default (60%)";
  return source ?? "config";
}

export default function AgrBreakdown({
  agr,
  areaSqm,
  scenario,
  onScenarioChange,
  postcode,
  lat,
  lng,
}: Props) {
  const active = agr.scenarios[scenario];

  return (
    <>
      <p className="integrity-banner" role="note">
        {agr.estimate_label ?? "Map residual AGR (research)"} — not an official tax
        bill. Square figures use residual maths; the national rent pool is a separate
        Sandilands macro concept.
      </p>

      <div className="scenario-tabs" role="tablist" aria-label="AGR policy scenario">
        {SCENARIO_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={scenario === id}
            className={scenario === id ? "scenario-tab active" : "scenario-tab"}
            onClick={() => onScenarioChange(id)}
          >
            {agr.scenarios[id].label}
          </button>
        ))}
      </div>

      <p className="meta" style={{ marginTop: "0.75rem" }}>
        {active.description}
      </p>

      <div className="agr-value">
        {formatGbp(active.annual_charge_gbp)}
        <span className="agr-unit">/year</span>
      </div>
      <p className="meta" style={{ marginTop: "0.25rem" }}>
        Scenario charge for this {areaSqm} sqm square
      </p>

      <table className="breakdown-table">
        <tbody>
          <tr>
            <th>Location</th>
            <td>
              {postcode && <>{postcode} · </>}
              {lat.toFixed(6)}, {lng.toFixed(6)} ({areaSqm} sqm)
            </td>
          </tr>
          <tr>
            <th>Council</th>
            <td>
              {agr.council_name} ({agr.council_code}) · {agr.lookup_method}
            </td>
          </tr>
          {agr.ward_name && (
            <tr>
              <th>Ward</th>
              <td>{agr.ward_name}</td>
            </tr>
          )}
          {agr.parcel_id && (
            <tr>
              <th>Cadastral parcel</th>
              <td>
                {agr.parcel_id}
                {agr.parcel_area_sqm
                  ? ` (${agr.parcel_area_sqm.toLocaleString("en-GB")} sqm)`
                  : ""}
              </td>
            </tr>
          )}
          {agr.average_price_gbp && (
            <tr>
              <th>HPI avg price</th>
              <td>
                {formatGbp(agr.average_price_gbp)} (council residential average)
              </td>
            </tr>
          )}
          <tr>
            <th>Site capital (map)</th>
            <td>{formatGbp(agr.site_capital_per_sqm_gbp)}/sqm residual proxy</td>
          </tr>
          <tr>
            <th>De-speculated site</th>
            <td>
              {formatGbp(agr.despeculated_site_capital_per_sqm_gbp)}/sqm (
              {formatGbp(agr.despeculated_site_value_gbp)} on {areaSqm} sqm) — Pickard
            </td>
          </tr>
          <tr>
            <th>Site share</th>
            <td>
              {(agr.site_share_used * 100).toFixed(0)}% ·{" "}
              {siteShareSourceLabel(agr.site_share_source)}
            </td>
          </tr>
          <tr>
            <th>Yield rate</th>
            <td>
              {(agr.yield_rate * 100).toFixed(1)}% (capital → annual rent)
            </td>
          </tr>
          <tr>
            <th>Map economic rent</th>
            <td>
              {formatGbp(agr.economic_annual_rent_gbp)}/year (full AGR on residual)
            </td>
          </tr>
          {agr.national_rent_pool_gbp != null && (
            <tr>
              <th>National rent pool</th>
              <td>
                {formatGbpBn(agr.national_rent_pool_gbp)}/year (Sandilands macro —
                not the sum of map squares)
              </td>
            </tr>
          )}
          {agr.equal_share_enabled &&
            agr.equal_share_rent_per_person_gbp != null &&
            agr.square_as_fraction_of_equal_claim != null && (
              <tr>
                <th>Equal share (Ogilvie / Paine)</th>
                <td>
                  One Scot ≈ {formatGbp(agr.equal_share_rent_per_person_gbp)}
                  /year from the <em>national pool</em>
                  {agr.scotland_population
                    ? ` (${agr.scotland_population.toLocaleString("en-GB")} people)`
                    : ""}
                  ; this square&apos;s <em>map</em> economic rent is{" "}
                  {(agr.square_as_fraction_of_equal_claim * 100).toFixed(4)}% of that
                  claim
                </td>
              </tr>
            )}
          <tr>
            <th>Method</th>
            <td>
              {agr.method} · {agr.confidence} confidence
              {agr.estimate_kind ? ` · ${agr.estimate_kind}` : ""}
            </td>
          </tr>
        </tbody>
      </table>

      <details className="notes-details">
        <summary>Calculation notes &amp; lineage</summary>
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

      <p className="meta">{agr.disclaimer}</p>
    </>
  );
}
