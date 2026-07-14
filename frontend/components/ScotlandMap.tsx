"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { Map, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import AgrBreakdown, { AgrResult, ScenarioId } from "./AgrBreakdown";
import { apiFetch, apiJson, getApiBaseUrl, pingApi } from "../lib/api";

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

/** Postcode-ish vs W3W-ish query. */
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
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCellGrid, setShowCellGrid] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [layerBusy, setLayerBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SquareResponse | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [reportDownloading, setReportDownloading] = useState(false);

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

    // Highlight ROS cadastral parcel when the API returns geometry
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
      // Zoom in enough to see property boundaries when we have a parcel
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
      // Three words with dots → W3W; else treat as postcode
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

  // Health: only surface failures
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

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

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

      // ROS INSPIRE property boundaries (WMS via API tile proxy)
      const apiBase = getApiBaseUrl().replace(/\/$/, "");
      map.addSource("parcels-wms", {
        type: "raster",
        tiles: [`${apiBase}/layers/parcels/tiles/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 13,
        maxzoom: 19,
        attribution: "© Registers of Scotland (INSPIRE cadastral parcels)",
      });
      map.addLayer({
        id: "parcels-wms",
        type: "raster",
        source: "parcels-wms",
        minzoom: 13,
        paint: { "raster-opacity": 0.9 },
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
      return;
    }

    let cancelled = false;
    setLayerBusy(true);
    void apiJson<GeoJSON.FeatureCollection>(
      `/layers/councils-agr?scenario=${scenario}`,
    )
      .then((data) => {
        if (cancelled) return;
        const src = map.getSource("council-agr") as GeoJSONSource | undefined;
        if (!src) throw new Error("Map heat source missing — refresh the page");
        src.setData(data);
        setVis("visible");
        setApiOk(true);
      })
      .catch((err: Error) => {
        setError(err.message);
        setApiOk(false);
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
        return;
      }
      setLayerBusy(true);
      const path =
        `/layers/w3w-grid?south=${b.getSouth()}&west=${b.getWest()}` +
        `&north=${b.getNorth()}&east=${b.getEast()}&scenario=${scenario}&max_cells=600`;
      void apiJson<GeoJSON.FeatureCollection>(path)
        .then((data) => {
          if (cancelled) return;
          (map.getSource("w3w-agr-grid") as GeoJSONSource)?.setData(data);
          setVis("visible");
        })
        .catch((err: Error) => {
          setError(err.message);
          setApiOk(false);
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

  // Property boundaries visibility
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
            <div className="layer-chips">
              <button
                type="button"
                className={showHeatmap ? "chip active" : "chip"}
                onClick={() => setShowHeatmap((v) => !v)}
                title="Council-level AGR heat map"
              >
                Heat map{layerBusy && showHeatmap ? "…" : ""}
              </button>
              <button
                type="button"
                className={showBoundaries ? "chip active" : "chip"}
                onClick={() => setShowBoundaries((v) => !v)}
                title="ROS property boundaries (zoom in to 13+)"
              >
                Boundaries
              </button>
              <button
                type="button"
                className={showCellGrid ? "chip active" : "chip"}
                onClick={() => setShowCellGrid((v) => !v)}
                title="W3W cells when zoomed in (level 11+)"
              >
                Cell grid
              </button>
            </div>
          </div>

          <div className="result-block">
            {error && <p className="error-line">{error}</p>}
            {!error && !result && (
              <p className="idle-hint">Click the map to estimate Annual Ground Rent for a place.</p>
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
