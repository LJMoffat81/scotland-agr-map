"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type Signoff = {
  status: string;
  signed_by: string | null;
  signed_at: string | null;
  organisation: string;
  notes: string;
};

type AgrConfig = {
  economist_signoff?: Signoff;
  macro: {
    rent_share_of_gdp: number;
    scotland_income_tax_replacement_gbp: number;
    estimated_scotland_annual_rent_gbp: number;
    growth_boost_percentage_points: number;
  };
  valuation: {
    primary_method: string;
    yield_rate: number;
    typical_dwelling_sqm: number;
  };
  site_share: {
    residential_wightman: number;
    residential_slrg: number;
    use_slrg_for_display: boolean;
  };
  despeculation: {
    farmland_market_to_productive: number;
    urban_speculation_discount: number;
  };
  per_square: {
    area_sqm: number;
  };
  scenarios: Record<string, { label: string; capture_rate?: number; rate_per_pound?: number }>;
};

function formatGbp(value: number) {
  if (value >= 1_000_000_000) {
    return `£${(value / 1_000_000_000).toFixed(1)}bn`;
  }
  return `£${value.toLocaleString("en-GB")}`;
}

export default function MethodologyContent() {
  const [config, setConfig] = useState<AgrConfig | null>(null);
  const [signoff, setSignoff] = useState<Signoff | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${API_URL}/signoff`)
      .then((response) => response.json() as Promise<Signoff>)
      .then(setSignoff)
      .catch(() => undefined);

    void fetch(`${API_URL}/config`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load configuration");
        }
        return response.json() as Promise<AgrConfig>;
      })
      .then(setConfig)
      .catch((err: Error) => setError(err.message));
  }, []);

  const siteShare = config
    ? config.site_share.use_slrg_for_display
      ? config.site_share.residential_slrg
      : config.site_share.residential_wightman
    : null;

  return (
    <main className="methodology-page">
      <h1>Methodology</h1>
      <p>
        Scotland AGR Map estimates Annual Ground Rent (AGR) for each What3Words
        3×3 metre square (9 sqm) using the SLRG methodology stack.
      </p>

      <section>
        <h2>1. Roger Sandilands (macro)</h2>
        <ul>
          <li>
            True economic rent is approximately{" "}
            {config ? `${(config.macro.rent_share_of_gdp * 100).toFixed(0)}%` : "…"} of
            GDP, not the ~£417m shown in official accounts.
          </li>
          <li>
            Replacing Scotland Income Tax could raise{" "}
            {config
              ? formatGbp(config.macro.scotland_income_tax_replacement_gbp)
              : "…"}{" "}
            and add ~
            {config
              ? `${config.macro.growth_boost_percentage_points}%`
              : "…"}{" "}
            GDP growth (zero deadweight loss on land).
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Andy Wightman (site valuation)</h2>
        <p>Per-square site value uses the residual method at council level:</p>
        <pre className="formula">
          site_capital = HPI_average_price × site_share ÷ typical_dwelling_sqm
        </pre>
        <ul>
          <li>
            Method: {config?.valuation.primary_method ?? "residual"} on UK HPI
            (Registers of Scotland / HM Land Registry, free open data).
          </li>
          <li>
            Site share: {siteShare ? `${(siteShare * 100).toFixed(0)}%` : "…"} · Yield:{" "}
            {config ? `${(config.valuation.yield_rate * 100).toFixed(1)}%` : "…"} ·
            Typical dwelling:{" "}
            {config ? `${config.valuation.typical_dwelling_sqm} sqm` : "…"}
          </li>
          <li>Rural councils fall back to HPI-adjusted land-use category values.</li>
        </ul>
      </section>

      <section>
        <h2>3. Duncan Pickard (de-speculation)</h2>
        <ul>
          <li>
            Urban discount:{" "}
            {config
              ? `${(config.despeculation.urban_speculation_discount * 100).toFixed(0)}%`
              : "…"}{" "}
            of market-implied site value.
          </li>
          <li>
            Farmland discount:{" "}
            {config
              ? `${(config.despeculation.farmland_market_to_productive * 100).toFixed(0)}%`
              : "…"}{" "}
            (productive value, not speculative market price).
          </li>
        </ul>
      </section>

      <section>
        <h2>Per-square formula</h2>
        <pre className="formula">
          {`1. Snap lat/lng to 3m grid (${config?.per_square.area_sqm ?? 9} sqm)
2. site_capital_per_sqm = residual_method(council)     [Wightman]
3. despeculated = site_capital × discount_factor         [Pickard]
4. economic_rent = despeculated × yield_rate
5. scenario_charge = policy adjustment (see below)`}
        </pre>
      </section>

      <section>
        <h2>Policy scenarios</h2>
        {error && <p className="meta">{error}</p>}
        {config && (
          <ul>
            {Object.entries(config.scenarios).map(([id, scenario]) => (
              <li key={id}>
                <strong>{scenario.label}</strong>
                {id === "full_agr" && scenario.capture_rate !== undefined && (
                  <> — capture {(scenario.capture_rate * 100).toFixed(0)}% of economic rent</>
                )}
                {id === "replace_income_tax" && (
                  <>
                    {" "}
                    — scale charges to raise{" "}
                    {formatGbp(config.macro.scotland_income_tax_replacement_gbp)} from
                    an estimated{" "}
                    {formatGbp(config.macro.estimated_scotland_annual_rent_gbp)} rent
                    pool
                  </>
                )}
                {id === "revenue_neutral" && scenario.rate_per_pound !== undefined && (
                  <>
                    {" "}
                    — {(scenario.rate_per_pound * 100).toFixed(2)}% of de-speculated site
                    value
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Phase 3 spatial accuracy</h2>
        <ul>
          <li>Council areas resolved by boundary polygon (not nearest centroid).</li>
          <li>
            ROS INSPIRE cadastral parcels queried live via free WMS when available.
          </li>
          <li>
            Glasgow Ward 18 (East Centre) validation case study — toggle on the map
            or call <code>/validation/glasgow-ward-18</code>.
          </li>
          <li>What3Words search activates once SLRG nonprofit API key is set.</li>
        </ul>
      </section>

      <section>
        <h2>Economist sign-off</h2>
        {signoff ? (
          <ul>
            <li>
              Status: <strong>{signoff.status}</strong>
              {signoff.signed_by ? ` — ${signoff.signed_by}` : ""}
              {signoff.signed_at ? ` (${signoff.signed_at})` : ""}
            </li>
            <li>{signoff.organisation}</li>
            <li>{signoff.notes}</li>
          </ul>
        ) : (
          <p className="meta">Sign-off status unavailable (API offline).</p>
        )}
        <p className="meta">
          To approve parameters, update <code>economist_signoff</code> in{" "}
          <code>data/config/agr.yaml</code> and redeploy the API.
        </p>
      </section>

      <p className="meta">
        Research estimate — not an official tax assessment.
      </p>
      <p>
        <a href="/">Back to map</a>
      </p>
    </main>
  );
}