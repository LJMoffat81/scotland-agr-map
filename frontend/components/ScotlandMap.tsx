"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { Map, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import AgrBreakdown, { AgrResult, ScenarioId } from "./AgrBreakdown";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const emptyCollection: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

async function loadBoundaryLayer(
  map: Map,
  sourceId: string,
  fillId: string,
  lineId: string,
  url: string,
  fillColor: string,
) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${sourceId}`);
  }
  const data = (await response.json()) as GeoJSON.FeatureCollection;

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data });
    map.addLayer({
      id: fillId,
      type: "fill",
      source: sourceId,
      paint: { "fill-color": fillColor, "fill-opacity": 0.08 },
    });
    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      paint: { "line-color": fillColor, "line-width": 1.5, "line-opacity": 0.7 },
    });
  } else {
    (map.getSource(sourceId) as GeoJSONSource).setData(data);
  }

  map.setLayoutProperty(fillId, "visibility", "visible");
  map.setLayoutProperty(lineId, "visibility", "visible");
}

function hideBoundaryLayer(map: Map, fillId: string, lineId: string) {
  if (map.getLayer(fillId)) {
    map.setLayoutProperty(fillId, "visibility", "none");
  }
  if (map.getLayer(lineId)) {
    map.setLayoutProperty(lineId, "visibility", "none");
  }
}

export default function ScotlandMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [lat, setLat] = useState("55.9533");
  const [lng, setLng] = useState("-3.1883");
  const [postcode, setPostcode] = useState("EH1 1YZ");
  const [words, setWords] = useState("filled.count.soap");
  const [scenario, setScenario] = useState<ScenarioId>("full_agr");
  const [showCouncils, setShowCouncils] = useState(false);
  const [showCouncilAgr, setShowCouncilAgr] = useState(true);
  const [showW3wGrid, setShowW3wGrid] = useState(false);
  const [showWard18, setShowWard18] = useState(false);
  const [layerBusy, setLayerBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SquareResponse | null>(null);
  const [signoffStatus, setSignoffStatus] = useState<string | null>(null);
  // Sensitivity (research) — defaults match agr.yaml signed-off values
  const [yieldPct, setYieldPct] = useState(5);
  const [urbanPickardPct, setUrbanPickardPct] = useState(70);
  const [wardStory, setWardStory] = useState<string | null>(null);
  const [includeSales, setIncludeSales] = useState(true);
  const [reportDownloading, setReportDownloading] = useState(false);

  const sensitivityQuery = useCallback(() => {
    const params = new URLSearchParams();
    const y = yieldPct / 100;
    const u = urbanPickardPct / 100;
    // Only send when different from defaults so base case stays clean
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
      map.flyTo({ center: [payload.square.lng, payload.square.lat], zoom: 16 });
    }

    // Shareable deep link (lat/lng; W3W words when known)
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
        const response = await fetch(
          `${API_URL}/square?lat=${nextLat}&lng=${nextLng}&scenario=${sc}${sensitivityQuery()}`,
        );
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.detail ?? "Failed to fetch AGR estimate");
        }
        applyResult((await response.json()) as SquareResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
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
      const response = await fetch(
        `${API_URL}/postcode/${encoded}?scenario=${scenario}${sensitivityQuery()}`,
      );
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Failed to fetch postcode");
      }
      applyResult((await response.json()) as SquareResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchWords = async (rawWords: string) => {
    setLoading(true);
    setError(null);
    try {
      const encoded = encodeURIComponent(rawWords.trim());
      const response = await fetch(
        `${API_URL}/square?words=${encoded}&scenario=${scenario}${sensitivityQuery()}`,
      );
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Failed to fetch What3Words address");
      }
      applyResult((await response.json()) as SquareResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetch(`${API_URL}/signoff`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { status?: string } | null) => {
        if (payload?.status) {
          setSignoffStatus(payload.status);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) {
      return;
    }

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
      center: [-4.2, 56.49],
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("selected-square", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "selected-square-fill",
        type: "fill",
        source: "selected-square",
        paint: { "fill-color": "#c8102e", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "selected-square-outline",
        type: "line",
        source: "selected-square",
        paint: { "line-color": "#c8102e", "line-width": 2 },
      });

      // AGR data layers (empty until toggled / fetched)
      map.addSource("council-agr", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "council-agr-fill",
        type: "fill",
        source: "council-agr",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "annual_ground_rent_plot_gbp"], 0],
            0,
            "#f7fbff",
            2000,
            "#c6dbef",
            5000,
            "#6baed6",
            10000,
            "#2171b5",
            20000,
            "#08306b",
          ],
          "fill-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "council-agr-line",
        type: "line",
        source: "council-agr",
        layout: { visibility: "none" },
        paint: { "line-color": "#001a3a", "line-width": 0.8, "line-opacity": 0.5 },
      });

      map.addSource("w3w-agr-grid", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "w3w-agr-fill",
        type: "fill",
        source: "w3w-agr-grid",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "annual_ground_rent_gbp"], 0],
            0,
            "#fff5f0",
            50,
            "#fcbba1",
            150,
            "#fb6a4a",
            300,
            "#cb181d",
            600,
            "#67000d",
          ],
          "fill-opacity": 0.65,
        },
      });
      map.addLayer({
        id: "w3w-agr-line",
        type: "line",
        source: "w3w-agr-grid",
        layout: { visibility: "none" },
        paint: { "line-color": "#67000d", "line-width": 0.3, "line-opacity": 0.35 },
      });

      // Deep link: prefer W3W words, else lat/lng
      const params = new URLSearchParams(window.location.search);
      const qWords = params.get("words");
      const qLat = params.get("lat");
      const qLng = params.get("lng");
      if (qWords) {
        void fetchWords(qWords);
      } else if (qLat && qLng) {
        void fetchSquare(Number(qLat), Number(qLng));
      }
    });

    map.on("click", (event) => {
      // Prefer W3W grid feature hit when layer on
      const hits = map.queryRenderedFeatures(event.point, {
        layers: ["w3w-agr-fill"],
      });
      if (hits.length && hits[0].properties?.lat != null) {
        void fetchSquare(Number(hits[0].properties.lat), Number(hits[0].properties.lng));
        return;
      }
      void fetchSquare(event.lngLat.lat, event.lngLat.lng);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Intentionally mount-once for the map; fetchSquare is stable enough via scenario default
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Council outline + Ward 18 outline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const syncLayers = async () => {
      try {
        if (showCouncils) {
          await loadBoundaryLayer(
            map,
            "council-boundaries",
            "council-boundaries-fill",
            "council-boundaries-line",
            `${API_URL}/boundaries/councils`,
            "#001a3a",
          );
        } else {
          hideBoundaryLayer(map, "council-boundaries-fill", "council-boundaries-line");
        }

        if (showWard18) {
          await loadBoundaryLayer(
            map,
            "glasgow-ward-18",
            "glasgow-ward-18-fill",
            "glasgow-ward-18-line",
            `${API_URL}/boundaries/glasgow-ward-18`,
            "#f5a623",
          );
        } else {
          hideBoundaryLayer(map, "glasgow-ward-18-fill", "glasgow-ward-18-line");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load boundaries");
      }
    };

    void syncLayers();
  }, [showCouncils, showWard18]);

  // Council AGR choropleth
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const setVis = (vis: "visible" | "none") => {
      if (map.getLayer("council-agr-fill")) {
        map.setLayoutProperty("council-agr-fill", "visibility", vis);
        map.setLayoutProperty("council-agr-line", "visibility", vis);
      }
    };

    if (!showCouncilAgr) {
      setVis("none");
      return;
    }

    let cancelled = false;
    setLayerBusy(true);
    void fetch(`${API_URL}/layers/councils-agr?scenario=${scenario}`)
      .then((r) => {
        if (!r.ok) throw new Error("Council AGR layer failed");
        return r.json();
      })
      .then((data: GeoJSON.FeatureCollection) => {
        if (cancelled) return;
        const src = map.getSource("council-agr") as GeoJSONSource | undefined;
        src?.setData(data);
        setVis("visible");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        if (!cancelled) setLayerBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showCouncilAgr, scenario]);

  // Viewport W3W grid (every cell in view, capped server-side)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const setVis = (vis: "visible" | "none") => {
      if (map.getLayer("w3w-agr-fill")) {
        map.setLayoutProperty("w3w-agr-fill", "visibility", vis);
        map.setLayoutProperty("w3w-agr-line", "visibility", vis);
      }
    };

    if (!showW3wGrid) {
      setVis("none");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadGrid = () => {
      if (cancelled || !mapRef.current) return;
      const b = map.getBounds();
      if (!b) return;
      // Need reasonable zoom so cells are visible
      if (map.getZoom() < 12) {
        setVis("none");
        setError("Zoom in (zoom ≥ 12) to load the W3W AGR grid layer.");
        return;
      }
      setError(null);
      setLayerBusy(true);
      const url =
        `${API_URL}/layers/w3w-grid?south=${b.getSouth()}&west=${b.getWest()}` +
        `&north=${b.getNorth()}&east=${b.getEast()}&scenario=${scenario}&max_cells=500`;
      void fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error("W3W grid layer failed");
          return r.json();
        })
        .then((data: GeoJSON.FeatureCollection & { meta?: { cell_count?: number; sampled?: boolean } }) => {
          if (cancelled) return;
          const src = map.getSource("w3w-agr-grid") as GeoJSONSource | undefined;
          src?.setData(data);
          setVis("visible");
          if (data.meta?.sampled) {
            setWardStory(
              `W3W grid: ${data.meta.cell_count} cells in view (sampled — zoom in for denser coverage).`,
            );
          } else if (data.meta?.cell_count) {
            setWardStory(`W3W grid: ${data.meta.cell_count} cells with AGR in view.`);
          }
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => {
          if (!cancelled) setLayerBusy(false);
        });
    };

    const onMove = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadGrid, 450);
    };

    loadGrid();
    map.on("moveend", onMove);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      map.off("moveend", onMove);
    };
  }, [showW3wGrid, scenario]);

  const goWard18 = () => {
    setShowWard18(true);
    setWardStory(
      "Glasgow Ward 18 (East Centre) is the map’s featured validation area — residual AGR samples inside a known ward for SLRG-style place-based checks.",
    );
    void fetch(`${API_URL}/validation/glasgow-ward-18?samples=8`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          payload: {
            agr_mean_gbp?: number;
            agr_min_gbp?: number;
            agr_max_gbp?: number;
            samples_in_ward?: number;
            samples_tested?: number;
          } | null,
        ) => {
          if (!payload?.agr_mean_gbp) return;
          setWardStory(
            `Glasgow Ward 18 (East Centre) validation: ${payload.samples_in_ward}/${payload.samples_tested} samples in-ward · cell AGR about £${payload.agr_min_gbp?.toFixed(0)}–£${payload.agr_max_gbp?.toFixed(0)}/yr (mean £${payload.agr_mean_gbp.toFixed(0)}). Featured case study for place-based residual checks.`,
          );
        },
      )
      .catch(() => undefined);
    // East Centre, Glasgow approximate centroid
    void fetchSquare(55.857, -4.198);
  };

  const reestimateCurrent = () => {
    if (result) {
      void fetchSquare(result.square.lat, result.square.lng);
    }
  };

  const downloadReport = async (format: "markdown" | "json") => {
    if (!result) return;
    setReportDownloading(true);
    setError(null);
    try {
      const q =
        `${API_URL}/assessment/report?lat=${result.square.lat}&lng=${result.square.lng}` +
        `&scenario=${scenario}&format=${format === "json" ? "json" : "markdown"}` +
        (includeSales ? "&include_sales_context=true" : "") +
        sensitivityQuery();
      const response = await fetch(q);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail ?? "Failed to download report");
      }
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

  const downloadWard18Qa = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/validation/ward18-qa-pack?samples=10&scenario=${scenario}`,
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail ?? "Ward 18 QA pack failed");
      }
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scotland-agr-ward18-qa-pack.json";
      a.click();
      URL.revokeObjectURL(url);
      const meta = data.mini_roll?.meta;
      if (meta?.agr_mean_gbp != null) {
        setWardStory(
          `Ward 18 QA pack downloaded · mini-roll n=${meta.count} · cell AGR mean £${meta.agr_mean_gbp}/yr (research, not statutory).`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "QA pack failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Scotland AGR Map</h1>
          <p>
            Annual Ground Rent on every What3Words 3×3 m square in Scotland — research
            estimate for education, not a tax bill.
          </p>
        </div>

        <div className="sidebar-scroll">
          <div className="panel">
            <h2>Explore</h2>
            <p className="idle-hint">
              <strong>Click the map</strong> or search a postcode. Start with Edinburgh or
              Glasgow Ward 18.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.75rem" }}>
              <button
                className="primary"
                type="button"
                disabled={loading}
                onClick={() => void fetchSquare(55.9533, -3.1883)}
              >
                Demo: Edinburgh centre
              </button>
              <button
                className="primary"
                type="button"
                disabled={loading}
                style={{ background: "#001a3a" }}
                onClick={goWard18}
              >
                Featured: Glasgow Ward 18
              </button>
              <button
                type="button"
                className="scenario-tab"
                disabled={loading}
                onClick={() => void downloadWard18Qa()}
              >
                Download Ward 18 QA pack (JSON)
              </button>
            </div>
          </div>

          <div className="panel find-place">
            <details open={!result}>
              <summary>Find a place</summary>
              <p className="meta" style={{ marginTop: "0.5rem" }}>
                Every estimate snaps to a <strong>What3Words 3×3 m square</strong> — the
                original precision unit of this map.
              </p>
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
                disabled={loading}
                onClick={() => void fetchPostcode(postcode)}
              >
                {loading ? "Looking up…" : "Search postcode"}
              </button>

              <div className="field" style={{ marginTop: "0.85rem" }}>
                <label htmlFor="words">What3Words (///three.word.address)</label>
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
                disabled={loading}
                onClick={() => void fetchWords(words)}
                style={{ background: "#001a3a" }}
              >
                {loading ? "Resolving…" : "Search What3Words"}
              </button>
              <p className="meta" style={{ marginTop: "0.5rem" }}>
                Needs <code>W3W_API_KEY</code> on the backend (SLRG nonprofit application).
                Without a key, map clicks still use the W3W-aligned 3 m grid.
              </p>

              <details style={{ marginTop: "0.85rem" }}>
                <summary style={{ fontSize: "0.85rem" }}>Coordinates</summary>
                <div className="field" style={{ marginTop: "0.65rem" }}>
                  <label htmlFor="lat">Latitude</label>
                  <input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="lng">Longitude</label>
                  <input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} />
                </div>
                <button
                  className="primary"
                  disabled={loading}
                  onClick={() => void fetchSquare(Number(lat), Number(lng))}
                >
                  {loading ? "Calculating…" : "Estimate AGR"}
                </button>
              </details>
            </details>
          </div>

          <div className="panel">
            <details open>
              <summary style={{ fontWeight: 600, cursor: "pointer", color: "var(--slrg-navy)" }}>
                Map layers {layerBusy ? "(loading…)" : ""}
              </summary>
              <p className="meta" style={{ marginTop: "0.45rem" }}>
                Scotland has billions of 3×3 m W3W cells — we load AGR as layers
                (councils nationwide, dense grid in the viewport when zoomed in).
              </p>
              <label className="checkbox-row" style={{ marginTop: "0.65rem" }}>
                <input
                  type="checkbox"
                  checked={showCouncilAgr}
                  onChange={(e) => setShowCouncilAgr(e.target.checked)}
                />
                Council AGR choropleth (plot £/year)
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showW3wGrid}
                  onChange={(e) => setShowW3wGrid(e.target.checked)}
                />
                W3W cell AGR grid (zoom ≥ 12)
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showCouncils}
                  onChange={(e) => setShowCouncils(e.target.checked)}
                />
                Council outlines only
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showWard18}
                  onChange={(e) => setShowWard18(e.target.checked)}
                />
                Glasgow Ward 18 (East Centre)
              </label>
              <div className="layer-legend">
                <span>Low AGR</span>
                <span className="legend-bar" />
                <span>High AGR</span>
              </div>
            </details>
          </div>

          <div className="panel">
            <details>
              <summary style={{ fontWeight: 600, cursor: "pointer", color: "var(--slrg-navy)" }}>
                Explore assumptions (research)
              </summary>
              <p className="meta" style={{ marginTop: "0.5rem" }}>
                Signed-off defaults: yield 5%, urban Pickard 70%. Move sliders then re-estimate.
              </p>
              <div className="field">
                <label htmlFor="yield">
                  Rentalisation yield: {yieldPct}%
                </label>
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
                <label htmlFor="urban">
                  Urban economic factor (Pickard): {urbanPickardPct}%
                </label>
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
                Re-estimate with assumptions
              </button>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeSales}
                  onChange={(e) => setIncludeSales(e.target.checked)}
                />
                Include sales comparable cross-check
              </label>
              <p className="meta">
                Uses local sales store (synthetic fixtures until ROS/licensed data is
                ingested). Never scrapes property portals.
              </p>
              <button
                type="button"
                className="scenario-tab"
                style={{ marginTop: "0.45rem" }}
                onClick={() => {
                  setYieldPct(5);
                  setUrbanPickardPct(70);
                }}
              >
                Reset to defaults (5% / 70%)
              </button>
            </details>
          </div>

          {wardStory && (
            <div className="panel ward-story">
              <h2>Ward 18</h2>
              <p className="meta" style={{ margin: 0 }}>
                {wardStory}
              </p>
            </div>
          )}

          <div className="panel">
            <h2>Result</h2>
            {error && <p className="meta">{error}</p>}
            {!error && !result && (
              <p className="idle-hint">
                Click the map or use Explore above. You&apos;ll get a plain £/year estimate
                on a What3Words 3×3 m cell, with optional detail on how it was calculated.
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
        {!result && (
          <div className="map-hint">
            Click anywhere in Scotland — snaps to a What3Words 3×3 m cell
          </div>
        )}
      </div>
    </div>
  );
}
