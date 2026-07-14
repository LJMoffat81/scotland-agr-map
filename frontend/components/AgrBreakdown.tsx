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
  const isResidual = agr.method === "residual_drc";

  return (
    <>
      <p className="integrity-banner" role="note">
        {agr.estimate_label ?? "Valuer residual AGR roll"} — open-data approximation of
        how a valuer would assess site rent for an AGR roll (MV − DRC → economic base →
        yield). Not an official rates bill.
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
        Scenario charge for this {areaSqm} m² grid cell
      </p>

      <table className="breakdown-table">
        <tbody>
          <tr>
            <th>Location</th>
            <td>
              {postcode && <>{postcode} · </>}
              {lat.toFixed(6)}, {lng.toFixed(6)} ({areaSqm} m²)
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
                  ? ` (${agr.parcel_area_sqm.toLocaleString("en-GB")} m²)`
                  : ""}
              </td>
            </tr>
          )}
          <tr>
            <th>HABU</th>
            <td>
              {agr.habu ?? "—"}
              {agr.hope_value_excluded ? " · hope value excluded from basis" : ""}
            </td>
          </tr>
          {isResidual && agr.market_value_gbp != null && (
            <tr>
              <th>1. Market value</th>
              <td>
                {formatGbp(agr.market_value_gbp)} (typical dwelling, council HPI)
              </td>
            </tr>
          )}
          {isResidual && agr.rebuild_cost_new_gbp != null && (
            <tr>
              <th>2. Rebuild (new)</th>
              <td>{formatGbp(agr.rebuild_cost_new_gbp)}</td>
            </tr>
          )}
          {isResidual && agr.drc_improvements_gbp != null && (
            <tr>
              <th>3. DRC improvements</th>
              <td>
                {formatGbp(agr.drc_improvements_gbp)} (depreciated rebuild of buildings)
              </td>
            </tr>
          )}
          <tr>
            <th>4. Site capital (market residual)</th>
            <td>
              {formatGbp(agr.site_capital_market_per_sqm_gbp ?? agr.site_capital_per_sqm_gbp)}
              /m²
              {agr.site_share_used != null
                ? ` · implied land share ${(agr.site_share_used * 100).toFixed(0)}% of MV`
                : ""}
            </td>
          </tr>
          <tr>
            <th>5. Site capital (economic)</th>
            <td>
              {formatGbp(agr.despeculated_site_capital_per_sqm_gbp)}/m² after Pickard
              {agr.pickard_factor != null
                ? ` ×${(agr.pickard_factor * 100).toFixed(0)}% (${agr.pickard_label ?? "factor"})`
                : ""}
            </td>
          </tr>
          <tr>
            <th>6. Annual economic rent</th>
            <td>
              {formatGbp(agr.site_rental_per_sqm_gbp)}/m²/year · yield{" "}
              {(agr.yield_rate * 100).toFixed(1)}%
            </td>
          </tr>
          <tr>
            <th>Grid cell roll line</th>
            <td>
              {formatGbp(agr.economic_annual_rent_gbp)}/year on {areaSqm} m² (full AGR)
            </td>
          </tr>
          {agr.roll_annual_rent_notional_plot_gbp != null && (
            <tr>
              <th>Notional plot roll line</th>
              <td>
                {formatGbp(agr.roll_annual_rent_notional_plot_gbp)}/year on{" "}
                {agr.notional_plot_sqm?.toLocaleString("en-GB") ?? "—"} m² plot
              </td>
            </tr>
          )}
          {agr.roll_annual_rent_parcel_gbp != null && (
            <tr>
              <th>Parcel roll line</th>
              <td>
                {formatGbp(agr.roll_annual_rent_parcel_gbp)}/year on cadastral parcel
              </td>
            </tr>
          )}
          {agr.national_rent_pool_gbp != null && (
            <tr>
              <th>National rent pool</th>
              <td>
                {formatGbpBn(agr.national_rent_pool_gbp)}/year (Sandilands macro — not sum
                of roll cells)
              </td>
            </tr>
          )}
          {agr.equal_share_enabled &&
            agr.equal_share_rent_per_person_gbp != null &&
            agr.square_as_fraction_of_equal_claim != null && (
              <tr>
                <th>Equal share (Ogilvie / Paine)</th>
                <td>
                  One Scot ≈ {formatGbp(agr.equal_share_rent_per_person_gbp)}/year from
                  national pool
                  {agr.scotland_population
                    ? ` (${agr.scotland_population.toLocaleString("en-GB")} people)`
                    : ""}
                  ; this cell is{" "}
                  {(agr.square_as_fraction_of_equal_claim * 100).toFixed(4)}% of that claim
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
        <summary>Valuation notes &amp; lineage</summary>
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
