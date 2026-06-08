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
  scenarios: Record<ScenarioId, ScenarioCharge>;
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
              {agr.council_name} ({agr.council_code})
            </td>
          </tr>
          {agr.average_price_gbp && (
            <tr>
              <th>HPI avg price</th>
              <td>{formatGbp(agr.average_price_gbp)}</td>
            </tr>
          )}
          <tr>
            <th>Site capital</th>
            <td>{formatGbp(agr.site_capital_per_sqm_gbp)}/sqm</td>
          </tr>
          <tr>
            <th>De-speculated site</th>
            <td>
              {formatGbp(agr.despeculated_site_capital_per_sqm_gbp)}/sqm (
              {formatGbp(agr.despeculated_site_value_gbp)} total)
            </td>
          </tr>
          <tr>
            <th>Site share</th>
            <td>{(agr.site_share_used * 100).toFixed(0)}%</td>
          </tr>
          <tr>
            <th>Yield rate</th>
            <td>{(agr.yield_rate * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <th>Economic rent</th>
            <td>{formatGbp(agr.economic_annual_rent_gbp)}/year (full AGR)</td>
          </tr>
          <tr>
            <th>Method</th>
            <td>
              {agr.method} · {agr.confidence} confidence
            </td>
          </tr>
        </tbody>
      </table>

      <details className="notes-details">
        <summary>Calculation notes</summary>
        <ul>
          {agr.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>

      <p className="meta">{agr.disclaimer}</p>
    </>
  );
}