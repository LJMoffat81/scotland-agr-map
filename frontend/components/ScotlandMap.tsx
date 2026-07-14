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
  const [showWard18, setShowWard18] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SquareResponse | null>(null);
  const [signoffStatus, setSignoffStatus] = useState<string | null>(null);

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
          `${API_URL}/square?lat=${nextLat}&lng=${nextLng}&scenario=${sc}`,
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
    [applyResult, scenario],
  );

  const fetchPostcode = async (rawPostcode: string) => {
    setLoading(true);
    setError(null);
    try {
      const encoded = encodeURIComponent(rawPostcode.trim());
      const response = await fetch(
        `${API_URL}/postcode/${encoded}?scenario=${scenario}`,
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
        `${API_URL}/square?words=${encoded}&scenario=${scenario}`,
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

  const goWard18 = () => {
    setShowWard18(true);
    // East Centre, Glasgow approximate centroid
    void fetchSquare(55.857, -4.198);
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
            <details>
              <summary style={{ fontWeight: 600, cursor: "pointer", color: "var(--slrg-navy)" }}>
                Map layers
              </summary>
              <label className="checkbox-row" style={{ marginTop: "0.65rem" }}>
                <input
                  type="checkbox"
                  checked={showCouncils}
                  onChange={(e) => setShowCouncils(e.target.checked)}
                />
                Council boundaries
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showWard18}
                  onChange={(e) => setShowWard18(e.target.checked)}
                />
                Glasgow Ward 18 (East Centre)
              </label>
            </details>
          </div>

          <div className="panel">
            <h2>Result</h2>
            {error && <p className="meta">{error}</p>}
            {!error && !result && (
              <p className="idle-hint">
                Click the map or use Explore above. You&apos;ll get a plain £/year estimate
                and optional detail on how it was calculated.
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
