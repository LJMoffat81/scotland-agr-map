"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { Map, GeoJSONSource, ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import AgrBreakdown, { AgrResult, ScenarioId } from "./AgrBreakdown";
import { apiFetch, apiJson, pingApi } from "../lib/api";

type ParcelFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  {
    label?: string;
    area_sqm?: number;
    inspire_id?: string;
    national_reference?: string;
  }
>;

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
  parcel?: ParcelFeature | null;
  postcode?: {
    postcode: string;
    admin_district: string | null;
    country: string | null;
  };
};

type MetricId =
  | "agr_plot"
  | "rent_per_sqm"
  | "house_price"
  | "agr_price_pct"
  | "land_share"
  | "site_capital"
  | "simd"
  | "pop_density";

type MetricDef = {
  id: MetricId;
  property: string;
  label: string;
  group: "value" | "context";
  stops: [number, string][];
};

const emptyCollection: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Colour ramps tuned to each metric’s typical Scotland range. */
const METRICS: MetricDef[] = [
  {
    id: "agr_plot",
    property: "annual_ground_rent_plot_gbp",
    label: "AGR (plot)",
    group: "value",
    stops: [
      [0, "#ffffcc"],
      [500, "#c7e9b4"],
      [1500, "#7fcdbb"],
      [3000, "#41b6c4"],
      [4500, "#2c7fb8"],
      [6500, "#253494"],
    ],
  },
  {
    id: "rent_per_sqm",
    property: "site_rental_per_sqm_gbp",
    label: "Land rent £/m²",
    group: "value",
    stops: [
      [0, "#f7fcf5"],
      [5, "#c7e9c0"],
      [12, "#74c476"],
      [20, "#31a354"],
      [30, "#006d2c"],
    ],
  },
  {
    id: "house_price",
    property: "average_price_gbp",
    label: "House prices",
    group: "value",
    stops: [
      [100000, "#fff5f0"],
      [140000, "#fcbba1"],
      [180000, "#fc9272"],
      [220000, "#ef3b2c"],
      [280000, "#a50f15"],
    ],
  },
  {
    id: "agr_price_pct",
    property: "agr_as_pct_of_price",
    label: "AGR % of price",
    group: "value",
    stops: [
      [0.5, "#f7fbff"],
      [1.5, "#c6dbef"],
      [2.5, "#6baed6"],
      [3.5, "#2171b5"],
      [5, "#08306b"],
    ],
  },
  {
    id: "land_share",
    property: "site_share_pct",
    label: "Land share %",
    group: "value",
    stops: [
      [30, "#f7fcfd"],
      [45, "#ccece6"],
      [55, "#66c2a4"],
      [65, "#238b45"],
      [75, "#00441b"],
    ],
  },
  {
    id: "site_capital",
    property: "site_capital_per_sqm_gbp",
    label: "Site capital £/m²",
    group: "value",
    stops: [
      [50, "#fcfbfd"],
      [150, "#dadaeb"],
      [300, "#9e9ac8"],
      [450, "#6a51a3"],
      [600, "#3f007d"],
    ],
  },
  {
    id: "simd",
    property: "simd_pct_20most_deprived",
    label: "Deprivation (SIMD)",
    group: "context",
    stops: [
      [0, "#ffffd4"],
      [8, "#fed98e"],
      [16, "#fe9929"],
      [28, "#d95f0e"],
      [40, "#993404"],
    ],
  },
  {
    id: "pop_density",
    property: "population_density_per_km2",
    label: "Pop. density",
    group: "context",
    stops: [
      [10, "#f7fcf0"],
      [100, "#ccebc5"],
      [500, "#7bccc4"],
      [1500, "#2b8cbe"],
      [3000, "#084081"],
    ],
  },
];

const CELL_AGR_COLOR: ExpressionSpecification = [
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

function paintForMetric(metric: MetricDef): ExpressionSpecification {
  const stops = metric.stops.flatMap(([v, c]) => [v, c]);
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", metric.property], 0],
    ...stops,
  ] as ExpressionSpecification;
}

function looksLikePostcode(q: string): boolean {
  const t = q.trim().replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/i.test(t) || /^[A-Z]{1,2}\d/i.test(t);
}

export default function ScotlandMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [query, setQuery] = useState("");
  const [scenario, setScenario] = useState<ScenarioId>("full_agr");
  const [choropleth, setChoropleth] = useState<MetricId | "off">("agr_plot");
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showCellGrid, setShowCellGrid] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [layerBusy, setLayerBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SquareResponse | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [metricNote, setMetricNote] = useState<string | null>(null);

  const applyResult = useCallback((payload: SquareResponse) => {
    setResult(payload);
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
    }

    if (map?.getSource("selected-parcel")) {
      const parcelSrc = map.getSource("selected-parcel") as GeoJSONSource;
      if (payload.parcel?.geometry) {
        parcelSrc.setData({
          type: "FeatureCollection",
          features: [payload.parcel],
        });
      } else {
        parcelSrc.setData(emptyCollection);
      }
    }

    if (map) {
      const z = map.getZoom();
      const targetZoom = payload.parcel
        ? Math.max(z < 6.5 ? 15 : z, 15)
        : z < 6.5
          ? 7
          : Math.min(z, 12);
      map.flyTo({
        center: [payload.square.lng, payload.square.lat],
        zoom: Math.min(targetZoom, 18),
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
          `/square?lat=${nextLat}&lng=${nextLng}&scenario=${sc}`,
        );
        applyResult((await response.json()) as SquareResponse);
        setApiOk(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setApiOk(false);
      } finally {
        setLoading(false);
      }
    },
    [applyResult, scenario],
  );

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const isWords = /^[a-z]+\.[a-z]+\.[a-z]+$/i.test(q.replace(/^\/+/, ""));
      if (isWords) {
        const encoded = encodeURIComponent(q.replace(/^\/+/, ""));
        const response = await apiFetch(
          `/square?words=${encoded}&scenario=${scenario}`,
        );
        applyResult((await response.json()) as SquareResponse);
      } else if (looksLikePostcode(q) || q.length >= 5) {
        const encoded = encodeURIComponent(q);
        const response = await apiFetch(
          `/postcode/${encoded}?scenario=${scenario}`,
        );
        applyResult((await response.json()) as SquareResponse);
      } else {
        setError("Enter a postcode (e.g. EH1 1YZ) or What3Words (word.word.word)");
        setLoading(false);
        return;
      }
      setApiOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setApiOk(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      void pingApi().then((s) => {
        if (!cancelled) setApiOk(s.ok);
      });
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }],
      },
      center: [-4.2, 56.8],
      zoom: 6.2,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("council-metrics", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "council-fill",
        type: "fill",
        source: "council-metrics",
        paint: {
          "fill-color": paintForMetric(METRICS[0]),
          "fill-opacity": 0.72,
        },
      });
      map.addLayer({
        id: "council-line",
        type: "line",
        source: "council-metrics",
        paint: { "line-color": "#0c2c84", "line-width": 1.0, "line-opacity": 0.55 },
      });
      // Method outline: rural councils dashed emphasis
      map.addLayer({
        id: "council-method",
        type: "line",
        source: "council-metrics",
        filter: ["==", ["get", "rural"], true],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#7a3e00",
          "line-width": 2.2,
          "line-dasharray": [2, 1.5],
          "line-opacity": 0.9,
        },
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

      map.addSource("parcels-wms", {
        type: "raster",
        tiles: ["/api/parcels/tiles/{z}/{x}/{y}"],
        tileSize: 256,
        minzoom: 14,
        maxzoom: 19,
        scheme: "xyz",
        attribution: "© Registers of Scotland (INSPIRE cadastral parcels)",
      });
      map.addLayer({
        id: "parcels-wms",
        type: "raster",
        source: "parcels-wms",
        minzoom: 14,
        paint: { "raster-opacity": 0.9, "raster-fade-duration": 0 },
        layout: { visibility: "visible" },
      });

      map.addSource("selected-parcel", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "selected-parcel-fill",
        type: "fill",
        source: "selected-parcel",
        paint: { "fill-color": "#001a3a", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "selected-parcel-outline",
        type: "line",
        source: "selected-parcel",
        paint: { "line-color": "#001a3a", "line-width": 2.25, "line-opacity": 0.95 },
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
      if (qWords) {
        setQuery(qWords);
        void (async () => {
          try {
            const encoded = encodeURIComponent(qWords);
            const response = await apiFetch(
              `/square?words=${encoded}&scenario=full_agr`,
            );
            applyResult((await response.json()) as SquareResponse);
            setApiOk(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Lookup failed");
          }
        })();
      } else if (qLat && qLng) {
        void fetchSquare(Number(qLat), Number(qLng));
      }
    });

    map.on("click", (event) => {
      const hits = map.queryRenderedFeatures(event.point, {
        layers: ["w3w-agr-fill", "council-fill"],
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

  // Load multi-metric council data once per scenario
  const metricsMetaRef = useRef<
    Record<string, { label?: string; unit?: string; min?: number; max?: number }> | null
  >(null);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    setLayerBusy(true);
    void apiJson<
      GeoJSON.FeatureCollection & {
        meta?: {
          metrics?: Record<
            string,
            { label?: string; unit?: string; min?: number; max?: number }
          >;
        };
      }
    >(`/layers/councils?scenario=${scenario}`)
      .then((data) => {
        if (cancelled) return;
        const src = map.getSource("council-metrics") as GeoJSONSource | undefined;
        if (!src) throw new Error("Map source missing — refresh the page");
        src.setData(data);
        metricsMetaRef.current = data.meta?.metrics ?? null;
        setApiOk(true);
        // Trigger paint via choropleth effect
        setMetricNote((prev) => prev ?? "Councils loaded");
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLayerBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mapReady, scenario]);

  // Paint / visibility when metric selection changes
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map?.getLayer("council-fill")) return;

    if (choropleth === "off") {
      map.setLayoutProperty("council-fill", "visibility", "none");
      map.setLayoutProperty("council-line", "visibility", "none");
      setMetricNote(null);
      return;
    }

    map.setLayoutProperty("council-fill", "visibility", "visible");
    map.setLayoutProperty("council-line", "visibility", "visible");
    const def = METRICS.find((m) => m.id === choropleth) ?? METRICS[0];
    map.setPaintProperty("council-fill", "fill-color", paintForMetric(def));

    const meta = metricsMetaRef.current?.[choropleth];
    if (meta?.min != null && meta?.max != null) {
      setMetricNote(
        `${meta.label ?? def.label}: ${formatRange(meta.min, meta.max, meta.unit ?? "")}`,
      );
    } else {
      setMetricNote(def.label);
    }
  }, [mapReady, choropleth, layerBusy]);

  // W3W cell grid
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
    let inFlight = false;

    const loadGrid = () => {
      if (cancelled || !mapRef.current || inFlight) return;
      const b = map.getBounds();
      if (!b) return;
      if (map.getZoom() < 12) {
        setVis("none");
        return;
      }
      inFlight = true;
      setLayerBusy(true);
      const path =
        `/layers/w3w-grid?south=${b.getSouth()}&west=${b.getWest()}` +
        `&north=${b.getNorth()}&east=${b.getEast()}&scenario=${scenario}&max_cells=200`;
      void apiJson<GeoJSON.FeatureCollection>(path)
        .then((data) => {
          if (cancelled) return;
          (map.getSource("w3w-agr-grid") as GeoJSONSource)?.setData(data);
          setVis("visible");
        })
        .catch(() => {
          if (!cancelled) setVis("none");
        })
        .finally(() => {
          inFlight = false;
          if (!cancelled) setLayerBusy(false);
        });
    };

    const onMove = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadGrid, 700);
    };

    loadGrid();
    map.on("moveend", onMove);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      map.off("moveend", onMove);
    };
  }, [mapReady, showCellGrid, scenario]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map?.getLayer("parcels-wms")) return;
    map.setLayoutProperty(
      "parcels-wms",
      "visibility",
      showBoundaries ? "visible" : "none",
    );
  }, [mapReady, showBoundaries]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map?.getLayer("council-method")) return;
    map.setLayoutProperty(
      "council-method",
      "visibility",
      showMethod && choropleth !== "off" ? "visible" : "none",
    );
  }, [mapReady, showMethod, choropleth]);

  const downloadReport = async (format: "markdown" | "json") => {
    if (!result) return;
    setReportDownloading(true);
    setError(null);
    try {
      const path =
        `/assessment/report?lat=${result.square.lat}&lng=${result.square.lng}` +
        `&scenario=${scenario}&format=${format === "json" ? "json" : "markdown"}`;
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

  const valueMetrics = METRICS.filter((m) => m.group === "value");
  const contextMetrics = METRICS.filter((m) => m.group === "context");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="brand brand-compact">
          <div className="brand-row">
            <h1>Scotland AGR</h1>
            <nav className="brand-nav">
              <a href="/methodology">About</a>
              <a href="https://www.slrg.scot" target="_blank" rel="noreferrer">
                SLRG
              </a>
            </nav>
          </div>
        </header>

        {apiOk === false && (
          <div className="api-banner api-banner-bad">
            <span>API offline — start backend on port 8000</span>
            <button
              type="button"
              className="api-retry"
              onClick={() => void pingApi().then((s) => setApiOk(s.ok))}
            >
              Retry
            </button>
          </div>
        )}

        <div className="sidebar-scroll">
          <div className="search-block">
            <label className="sr-only" htmlFor="place-query">
              Postcode or What3Words
            </label>
            <div className="search-row">
              <input
                id="place-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder="Postcode or word.word.word"
                disabled={loading || apiOk === false}
              />
              <button
                type="button"
                className="primary"
                disabled={loading || apiOk === false || !query.trim()}
                onClick={() => void runSearch()}
              >
                {loading ? "…" : "Go"}
              </button>
            </div>

            <div className="layer-panel">
              <label className="layer-select-label" htmlFor="choropleth">
                Colour map by
              </label>
              <select
                id="choropleth"
                className="layer-select"
                value={choropleth}
                onChange={(e) =>
                  setChoropleth(e.target.value as MetricId | "off")
                }
              >
                <optgroup label="Value">
                  {valueMetrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Context">
                  {contextMetrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
                <option value="off">Off</option>
              </select>
              {metricNote && choropleth !== "off" && (
                <p className="layer-meta">
                  {layerBusy ? "Loading…" : metricNote}
                </p>
              )}

              <div className="layer-chips">
                <button
                  type="button"
                  className={showBoundaries ? "chip active" : "chip"}
                  onClick={() => setShowBoundaries((v) => !v)}
                  title="ROS cadastral parcel outlines (zoom 14+)"
                >
                  Boundaries
                </button>
                <button
                  type="button"
                  className={showCellGrid ? "chip active" : "chip"}
                  onClick={() => setShowCellGrid((v) => !v)}
                  title="W3W cells with AGR (zoom 12+)"
                >
                  Cell grid
                </button>
                <button
                  type="button"
                  className={showMethod ? "chip active" : "chip"}
                  onClick={() => setShowMethod((v) => !v)}
                  title="Outline rural productive-method councils"
                >
                  Rural method
                </button>
              </div>
            </div>
          </div>

          <div className="result-block">
            {error && <p className="error-line">{error}</p>}
            {!error && !result && (
              <p className="idle-hint">
                Click the map to estimate Annual Ground Rent. Switch layers to
                compare prices, land intensity, and deprivation.
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
                parcelLabel={result.parcel?.properties?.label ?? result.agr.parcel_id}
                parcelAreaSqm={
                  result.parcel?.properties?.area_sqm ?? result.agr.parcel_area_sqm
                }
                onDownloadReport={(fmt) => void downloadReport(fmt)}
                reportDownloading={reportDownloading}
              />
            )}
          </div>
        </div>
      </aside>

      <div className="map-wrap">
        <div id="map" ref={mapContainer} />
        {!result && apiOk !== false && (
          <div className="map-hint">Click any place for an estimate</div>
        )}
      </div>
    </div>
  );
}

function formatRange(min: number, max: number, unit: string): string {
  const fmt = (n: number) => {
    if (unit.includes("%")) return `${n.toFixed(1)}%`;
    if (unit.startsWith("£") && n >= 1000) {
      return `£${Math.round(n).toLocaleString("en-GB")}`;
    }
    if (unit.startsWith("£")) return `£${n.toFixed(n >= 10 ? 0 : 2)}`;
    if (n >= 100) return Math.round(n).toLocaleString("en-GB");
    return n.toFixed(1);
  };
  const u = unit.includes("%") || unit.startsWith("£") ? "" : ` ${unit}`;
  return `${fmt(min)}–${fmt(max)}${u}`;
}
