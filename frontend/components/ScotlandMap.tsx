"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { Map, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import AgrBreakdown, { AgrResult, ScenarioId } from "./AgrBreakdown";
import { apiFetch, apiJson, pingApi } from "../lib/api";

type SquareResponse = {
  square: {
    lat: number;
    lng: number;
    area_sqm: number;
    polygon: GeoJSON.Polygon;
    grid?: string;
  };
  agr: AgrResult;
  what3words?: string | null;
  w3w_configured?: boolean;
  sales_context?: import("./AgrBreakdown").SalesContext | null;
  postcode?: {
    postcode: string;
    admin_district: string | null;
    country: string | null;
  };
};

const emptyCollection: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const PLOT_AGR_COLOR: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "annual_ground_rent_plot_gbp"], 0],
  0,
  "#ffffcc",
  500,
  "#c7e9b4",
  1500,
  "#7fcdbb",
  3000,
  "#41b6c4",
  4500,
  "#2c7fb8",
  6500,
  "#253494",
];

const CELL_AGR_COLOR: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "annual_ground_rent_gbp"], 0],
  0,
  "#fff7ec",
  40,
  "#fee8c8",
  100,
  "#fdbb84",
  180,
  "#e34a33",
  280,
  "#b30000",
];

export default function ScotlandMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [lat, setLat] = useState("55.9533");
  const [lng, setLng] = useState("-3.1883");
  const [postcode, setPostcode] = useState("EH1 1YZ");
  const [words, setWords] = useState("filled.count.soap");
  const [scenario, setScenario] = useState<ScenarioId>("full_agr");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCellGrid, setShowCellGrid] = useState(false);
  const [layerBusy, setLayerBusy] = useState(false);
  const [layerNote, setLayerNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SquareResponse | null>(null);
  const [signoffStatus, setSignoffStatus] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [yieldPct, setYieldPct] = useState(5);
  const [urbanPickardPct, setUrbanPickardPct] = useState(70);
  const [includeSales, setIncludeSales] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);

  const sensitivityQuery = useCallback(() => {
    const params = new URLSearchParams();
    const y = yieldPct / 100;
    const u = urbanPickardPct / 100;
    if (Math.abs(y - 0.05) > 1e-9) params.set("yield_rate", y.toFixed(4));
    if (Math.abs(u - 0.7) > 1e-9) params.set("urban_speculation", u.toFixed(4));
    if (includeSales) params.set("include_sales_context", "true");
    const s = params.toString();
    return s ? `&${s}` : "";
  }, [yieldPct, urbanPickardPct, includeSales]);

  const applyResult = useCallback((payload: SquareResponse) => {
    setResult(payload);
    setLat(payload.square.lat.toFixed(6));
    setLng(payload.square.lng.toFixed(6));
    setScenario(payload.agr.active_scenario);

    const map = mapRef.current;
    if (map?.getSource("selected-square")) {
      const source = map.getSource("selected-square") as GeoJSONSource;
      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: payload.square.polygon,
            properties: {},
          },
        ],
      });
      const z = map.getZoom();
      map.flyTo({
        center: [payload.square.lng, payload.square.lat],
        zoom: z < 6.5 ? 7 : Math.min(z, 12),
        essential: true,
      });
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lat", payload.square.lat.toFixed(6));
      url.searchParams.set("lng", payload.square.lng.toFixed(6));
      if (payload.what3words) {
        url.searchParams.set("words", payload.what3words);
      } else {
        url.searchParams.delete("words");
      }
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const fetchSquare = useCallback(
    async (nextLat: number, nextLng: number, nextScenario?: ScenarioId) => {
      setLoading(true);
      setError(null);
      const sc = nextScenario ?? scenario;
      try {
        const response = await apiFetch(
          `/square?lat=${nextLat}&lng=${nextLng}&scenario=${sc}${sensitivityQuery()}`,
        );
        applyResult((await response.json()) as SquareResponse);
        setApiStatus({ ok: true, message: "via same-origin proxy" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setApiStatus({ ok: false, message: err instanceof Error ? err.message : "API error" });
      } finally {
        setLoading(false);
      }
    },
    [applyResult, scenario, sensitivityQuery],
  );

  const fetchPostcode = async (rawPostcode: string) => {
    setLoading(true);
    setError(null);
    try {
      const encoded = encodeURIComponent(rawPostcode.trim());
      const response = await apiFetch(
        `/postcode/${encoded}?scenario=${scenario}${sensitivityQuery()}`,
      );
      applyResult((await response.json()) as SquareResponse);
      setApiStatus({ ok: true, message: "via same-origin proxy" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setApiStatus({ ok: false, message: err instanceof Error ? err.message : "API error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchWords = async (rawWords: string) => {
    setLoading(true);
    setError(null);
    try {
      const encoded = encodeURIComponent(rawWords.trim());
      const response = await apiFetch(
        `/square?words=${encoded}&scenario=${scenario}${sensitivityQuery()}`,
      );
      applyResult((await response.json()) as SquareResponse);
      setApiStatus({ ok: true, message: "via same-origin proxy" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setApiStatus({ ok: false, message: err instanceof Error ? err.message : "API error" });
    } finally {
      setLoading(false);
    }
  };

  // Health poll
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      void pingApi().then((s) => {
        if (!cancelled) setApiStatus(s);
      });
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    void apiJson<{ status?: string }>("/signoff")
      .then((payload) => {
        if (payload?.status) setSignoffStatus(payload.status);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [-4.2, 56.8],
      zoom: 6.2,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("council-agr", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "council-agr-fill",
        type: "fill",
        source: "council-agr",
        paint: {
          "fill-color": PLOT_AGR_COLOR,
          "fill-opacity": 0.72,
        },
      });
      map.addLayer({
        id: "council-agr-line",
        type: "line",
        source: "council-agr",
        paint: { "line-color": "#0c2c84", "line-width": 1.1, "line-opacity": 0.65 },
      });

      map.addSource("w3w-agr-grid", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "w3w-agr-fill",
        type: "fill",
        source: "w3w-agr-grid",
        layout: { visibility: "none" },
        paint: {
          "fill-color": CELL_AGR_COLOR,
          "fill-opacity": 0.7,
        },
      });
      map.addLayer({
        id: "w3w-agr-line",
        type: "line",
        source: "w3w-agr-grid",
        layout: { visibility: "none" },
        paint: { "line-color": "#7f0000", "line-width": 0.4, "line-opacity": 0.4 },
      });

      map.addSource("selected-square", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "selected-square-fill",
        type: "fill",
        source: "selected-square",
        paint: { "fill-color": "#c8102e", "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: "selected-square-outline",
        type: "line",
        source: "selected-square",
        paint: { "line-color": "#c8102e", "line-width": 2.5 },
      });

      setMapReady(true);

      const params = new URLSearchParams(window.location.search);
      const qWords = params.get("words");
      const qLat = params.get("lat");
      const qLng = params.get("lng");
      if (qWords) void fetchWords(qWords);
      else if (qLat && qLng) void fetchSquare(Number(qLat), Number(qLng));
    });

    map.on("click", (event) => {
      const hits = map.queryRenderedFeatures(event.point, {
        layers: ["w3w-agr-fill", "council-agr-fill"],
      });
      if (hits[0]?.properties?.lat != null && hits[0].layer?.id === "w3w-agr-fill") {
        void fetchSquare(Number(hits[0].properties.lat), Number(hits[0].properties.lng));
        return;
      }
      void fetchSquare(event.lngLat.lat, event.lngLat.lng);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // National heat map
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const setVis = (vis: "visible" | "none") => {
      if (!map.getLayer("council-agr-fill")) return;
      map.setLayoutProperty("council-agr-fill", "visibility", vis);
      map.setLayoutProperty("council-agr-line", "visibility", vis);
    };

    if (!showHeatmap) {
      setVis("none");
      setLayerNote(null);
      return;
    }

    let cancelled = false;
    setLayerBusy(true);
    void apiJson<
      GeoJSON.FeatureCollection & {
        meta?: { feature_count?: number; agr_min_gbp?: number; agr_max_gbp?: number };
      }
    >(`/layers/councils-agr?scenario=${scenario}`)
      .then((data) => {
        if (cancelled) return;
        const src = map.getSource("council-agr") as GeoJSONSource | undefined;
        if (!src) throw new Error("Map heat source missing — refresh the page");
        src.setData(data);
        setVis("visible");
        const n = data.meta?.feature_count ?? data.features?.length ?? 0;
        const lo = data.meta?.agr_min_gbp;
        const hi = data.meta?.agr_max_gbp;
        setLayerNote(
          lo != null && hi != null
            ? `Heat map: ${n} councils · plot AGR £${Math.round(lo).toLocaleString()}–£${Math.round(hi).toLocaleString()}/yr`
            : `Heat map: ${n} councils`,
        );
        setApiStatus({ ok: true, message: "via same-origin proxy" });
      })
      .catch((err: Error) => {
        setError(err.message);
        setApiStatus({ ok: false, message: err.message });
      })
      .finally(() => {
        if (!cancelled) setLayerBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mapReady, showHeatmap, scenario]);

  // Viewport W3W cell grid
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const setVis = (vis: "visible" | "none") => {
      if (!map.getLayer("w3w-agr-fill")) return;
      map.setLayoutProperty("w3w-agr-fill", "visibility", vis);
      map.setLayoutProperty("w3w-agr-line", "visibility", vis);
    };

    if (!showCellGrid) {
      setVis("none");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadGrid = () => {
      if (cancelled || !mapRef.current) return;
      const b = map.getBounds();
      if (!b) return;
      if (map.getZoom() < 11) {
        setVis("none");
        setLayerNote("Zoom in to 11+ to paint W3W cells with AGR.");
        return;
      }
      setLayerBusy(true);
      const path =
        `/layers/w3w-grid?south=${b.getSouth()}&west=${b.getWest()}` +
        `&north=${b.getNorth()}&east=${b.getEast()}&scenario=${scenario}&max_cells=600`;
      void apiJson<
        GeoJSON.FeatureCollection & {
          meta?: { cell_count?: number; sampled?: boolean };
        }
      >(path)
        .then((data) => {
          if (cancelled) return;
          (map.getSource("w3w-agr-grid") as GeoJSONSource)?.setData(data);
          setVis("visible");
          const n = data.meta?.cell_count ?? 0;
          setLayerNote(
            data.meta?.sampled
              ? `Cell grid: ${n} W3W squares (sampled — zoom closer for denser fill)`
              : `Cell grid: ${n} W3W squares with AGR`,
          );
        })
        .catch((err: Error) => {
          setError(err.message);
          setApiStatus({ ok: false, message: err.message });
        })
        .finally(() => {
          if (!cancelled) setLayerBusy(false);
        });
    };

    const onMove = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadGrid, 400);
    };

    loadGrid();
    map.on("moveend", onMove);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      map.off("moveend", onMove);
    };
  }, [mapReady, showCellGrid, scenario]);

  const reestimateCurrent = () => {
    if (result) void fetchSquare(result.square.lat, result.square.lng);
  };

  const downloadReport = async (format: "markdown" | "json") => {
    if (!result) return;
    setReportDownloading(true);
    setError(null);
    try {
      const path =
        `/assessment/report?lat=${result.square.lat}&lng=${result.square.lng}` +
        `&scenario=${scenario}&format=${format === "json" ? "json" : "markdown"}` +
        (includeSales ? "&include_sales_context=true" : "") +
        sensitivityQuery();
      const response = await apiFetch(path);
      const base = `scotland-agr-${result.square.lat.toFixed(5)}_${result.square.lng.toFixed(5)}`;
      if (format === "json") {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const text = await response.text();
        const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report download failed");
    } finally {
      setReportDownloading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Scotland AGR Map</h1>
          <p>
            Heat map of Annual Ground Rent across Scotland — click any place for a
            What3Words 3×3 m cell estimate.
          </p>
        </div>

        <div
          className={`api-banner ${apiStatus?.ok === false ? "api-banner-bad" : apiStatus?.ok ? "api-banner-ok" : ""}`}
        >
          {apiStatus == null
            ? "Checking API…"
            : apiStatus.ok
              ? `Connected · ${apiStatus.message}`
              : apiStatus.message}
          {apiStatus?.ok === false && (
            <button
              type="button"
              className="api-retry"
              onClick={() => void pingApi().then(setApiStatus)}
            >
              Retry
            </button>
          )}
        </div>

        <div className="sidebar-scroll">
          <div className="panel">
            <h2>Layers</h2>
            <p className="meta" style={{ marginTop: 0 }}>
              {layerBusy ? "Loading layer data…" : layerNote ?? "Turn layers on below."}
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
              />
              <strong>Scotland heat map</strong> (council plot AGR)
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={showCellGrid}
                onChange={(e) => setShowCellGrid(e.target.checked)}
              />
              <strong>W3W cell grid</strong> (zoom in to 11+)
            </label>
            <div className="layer-legend">
              <span>Lower rent</span>
              <span className="legend-bar" />
              <span>Higher rent</span>
            </div>
          </div>

          <div className="panel find-place">
            <details open>
              <summary>Find a place</summary>
              <div className="field" style={{ marginTop: "0.75rem" }}>
                <label htmlFor="postcode">Postcode</label>
                <input
                  id="postcode"
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void fetchPostcode(postcode);
                  }}
                />
              </div>
              <button
                className="primary"
                disabled={loading || apiStatus?.ok === false}
                onClick={() => void fetchPostcode(postcode)}
              >
                {loading ? "Looking up…" : "Search postcode"}
              </button>

              <div className="field" style={{ marginTop: "0.85rem" }}>
                <label htmlFor="words">What3Words</label>
                <input
                  id="words"
                  value={words}
                  onChange={(event) => setWords(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void fetchWords(words);
                  }}
                  placeholder="filled.count.soap"
                />
              </div>
              <button
                className="primary"
                disabled={loading || apiStatus?.ok === false}
                onClick={() => void fetchWords(words)}
                style={{ background: "#001a3a" }}
              >
                {loading ? "Resolving…" : "Search What3Words"}
              </button>
              <button
                type="button"
                className="scenario-tab"
                style={{ marginTop: "0.5rem" }}
                disabled={loading || apiStatus?.ok === false}
                onClick={() => {
                  mapRef.current?.flyTo({ center: [-4.2, 56.8], zoom: 6.2 });
                  void fetchSquare(55.9533, -3.1883);
                }}
              >
                Demo: Edinburgh
              </button>
            </details>
          </div>

          <div className="panel">
            <details>
              <summary style={{ fontWeight: 600, cursor: "pointer", color: "var(--slrg-navy)" }}>
                Assumptions (research)
              </summary>
              <div className="field" style={{ marginTop: "0.5rem" }}>
                <label htmlFor="yield">Yield: {yieldPct}%</label>
                <input
                  id="yield"
                  type="range"
                  min={3}
                  max={8}
                  step={0.5}
                  value={yieldPct}
                  onChange={(e) => setYieldPct(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="urban">Urban Pickard: {urbanPickardPct}%</label>
                <input
                  id="urban"
                  type="range"
                  min={40}
                  max={100}
                  step={5}
                  value={urbanPickardPct}
                  onChange={(e) => setUrbanPickardPct(Number(e.target.value))}
                />
              </div>
              <button
                className="primary"
                type="button"
                disabled={loading || !result}
                onClick={reestimateCurrent}
              >
                Re-estimate selection
              </button>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeSales}
                  onChange={(e) => setIncludeSales(e.target.checked)}
                />
                Sales cross-check (research)
              </label>
            </details>
          </div>

          <div className="panel">
            <h2>Selection</h2>
            {error && (
              <p className="meta" style={{ color: "#c8102e" }}>
                {error}
              </p>
            )}
            {!error && !result && (
              <p className="idle-hint">
                The coloured map is council-level AGR. Click anywhere for a cell estimate.
              </p>
            )}
            {result && (
              <AgrBreakdown
                agr={result.agr}
                areaSqm={result.square.area_sqm}
                scenario={scenario}
                onScenarioChange={setScenario}
                postcode={result.postcode?.postcode}
                lat={result.square.lat}
                lng={result.square.lng}
                what3words={result.what3words}
                w3wConfigured={result.w3w_configured}
                salesContext={result.sales_context}
                onDownloadReport={(fmt) => void downloadReport(fmt)}
                reportDownloading={reportDownloading}
              />
            )}
          </div>
        </div>

        <div className="footer-links">
          <a href="https://www.slrg.scot" target="_blank" rel="noreferrer">
            SLRG
          </a>
          {" · "}
          <a href="/methodology">Methodology</a>
          {signoffStatus && (
            <>
              {" · "}
              <span className={`signoff-badge signoff-${signoffStatus}`}>
                {signoffStatus}
              </span>
            </>
          )}
        </div>
      </aside>

      <div className="map-wrap">
        <div id="map" ref={mapContainer} />
        <div className="map-hint">
          {apiStatus?.ok === false
            ? "API offline — start backend on port 8000"
            : showHeatmap
              ? "Scotland AGR heat map · click a place for a W3W cell"
              : "Heat map off · enable “Scotland heat map” in Layers"}
        </div>
      </div>
    </div>
  );
}
