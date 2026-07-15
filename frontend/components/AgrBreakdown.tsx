"use client";

export type ScenarioId =
  | "full_agr"
  | "replace_income_tax"
  | "revenue_neutral"
  | "replace_full_basket";

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

export type PlaceFiscal = {
  gross_plot_gbp: number;
  dividend_gbp: number;
  dividend_mode?: string;
  remote_credit_gbp: number;
  net_gbp: number;
  role: "net_contributor" | "net_receiver" | "net_neutral" | string;
  note?: string;
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
  parcelLabel?: string | null;
  parcelAreaSqm?: number | null;
  fiscal?: PlaceFiscal | null;
  onDownloadReport?: (format: "markdown" | "json") => void;
  reportDownloading?: boolean;
};

const SCENARIO_ORDER: ScenarioId[] = [
  "replace_full_basket",
  "full_agr",
  "replace_income_tax",
  "revenue_neutral",
];

const SCENARIO_SHORT: Record<ScenarioId, string> = {
  replace_full_basket: "Replace all taxes",
  full_agr: "Full rent + surplus",
  replace_income_tax: "Income tax only",
  revenue_neutral: "CT + rates",
};

function formatGbp(value: number, digits = 2) {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
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
  what3words,
  parcelLabel,
  parcelAreaSqm,
  fiscal,
  onDownloadReport,
  reportDownloading,
}: Props) {
  const active = agr.scenarios[scenario] ?? agr.scenarios.full_agr;
  const plotFull = agr.roll_annual_rent_notional_plot_gbp;
  const cellFull = agr.economic_annual_rent_gbp;
  const scale = cellFull > 0 ? active.annual_charge_gbp / cellFull : 1;
  const parcelFull =
    parcelAreaSqm != null && parcelAreaSqm > 0
      ? agr.site_rental_per_sqm_gbp * parcelAreaSqm * scale
      : agr.roll_annual_rent_parcel_gbp != null
        ? agr.roll_annual_rent_parcel_gbp * scale
        : null;
  const headline =
    fiscal?.gross_plot_gbp != null && fiscal.gross_plot_gbp > 0
      ? fiscal.gross_plot_gbp
      : parcelFull != null && parcelFull > 0
        ? parcelFull
        : plotFull != null && plotFull > 0
          ? plotFull * scale
          : active.annual_charge_gbp;
  const headlineIsParcel = parcelFull != null && parcelFull > 0 && !fiscal;
  const headlineIsPlot =
    !headlineIsParcel && plotFull != null && plotFull > 0 && !fiscal;

  const place = [postcode, agr.council_name].filter(Boolean).join(" · ");
  const w3wDisplay = what3words
    ? `///${what3words.replace(/^\/+/, "")}`
    : null;

  const netRole = fiscal?.role;
  const netClass =
    netRole === "net_receiver"
      ? "fiscal-net receiver"
      : netRole === "net_contributor"
        ? "fiscal-net contributor"
        : "fiscal-net";

  return (
    <div className="clarity-result">
      <p className="location-line">
        {place || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
      </p>

      {w3wDisplay && <p className="w3w-address">{w3wDisplay}</p>}

      <div className="agr-value" aria-live="polite">
        {formatGbp(headline, headline >= 100 ? 0 : 2)}
        <span className="agr-unit">/year gross</span>
      </div>

      <p className="headline-caption">
        {fiscal
          ? "Land rent liability (site only — not buildings or wages)"
          : headlineIsParcel
            ? `Property parcel${parcelLabel ? ` ${parcelLabel}` : ""}${
                parcelAreaSqm
                  ? ` · ${Math.round(parcelAreaSqm).toLocaleString("en-GB")} m²`
                  : ""
              }`
            : headlineIsPlot
              ? `Typical plot (~${agr.notional_plot_sqm?.toLocaleString("en-GB")} m²)`
              : `This ${areaSqm} m² cell · ${formatGbp(active.annual_charge_gbp)}/yr`}
      </p>

      {fiscal && (
        <div className="fiscal-place">
          <div className="fiscal-row">
            <span>Gross land rent</span>
            <strong>{formatGbp(fiscal.gross_plot_gbp, 0)}</strong>
          </div>
          <div className="fiscal-row">
            <span>Equal dividend (1 person)</span>
            <strong>−{formatGbp(fiscal.dividend_gbp, 0)}</strong>
          </div>
          {fiscal.remote_credit_gbp > 0 && (
            <div className="fiscal-row">
              <span>Remote / island credit</span>
              <strong>−{formatGbp(fiscal.remote_credit_gbp, 0)}</strong>
            </div>
          )}
          <div className={`fiscal-row net ${netClass}`}>
            <span>Net {fiscal.net_gbp < 0 ? "receipt" : "contribution"}</span>
            <strong>
              {fiscal.net_gbp < 0 ? "" : "+"}
              {formatGbp(fiscal.net_gbp, 0)}
            </strong>
          </div>
          <p className="fiscal-role-tag">
            {fiscal.role === "net_receiver"
              ? "Net receiver — low rent / remote support"
              : fiscal.role === "net_contributor"
                ? "Net contributor — higher land rent funds the state"
                : "Roughly neutral"}
          </p>
        </div>
      )}

      <div className="scenario-pills" role="tablist" aria-label="Tax replacement scenario">
        {SCENARIO_ORDER.map((id) => {
          if (!agr.scenarios[id]) return null;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={scenario === id}
              className={scenario === id ? "scenario-pill active" : "scenario-pill"}
              onClick={() => onScenarioChange(id)}
            >
              {SCENARIO_SHORT[id]}
            </button>
          );
        })}
      </div>

      <p className="result-links">
        <a href="/methodology">How this is calculated</a>
        {onDownloadReport && (
          <>
            {" · "}
            <button
              type="button"
              className="linkish"
              disabled={reportDownloading}
              onClick={() => onDownloadReport("markdown")}
            >
              {reportDownloading ? "Preparing…" : "MSP brief"}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
