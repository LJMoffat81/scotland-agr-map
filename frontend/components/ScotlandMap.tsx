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
  };
  agr: AgrResult;
  what3words?: string;
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
  }, []);

  const fetchSquare = async (nextLat: number, nextLng: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/square?lat=${nextLat}&lng=${nextLng}&scenario=${scenario}`,
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
  };

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
    });

    map.on("click", (event) => {
      void fetchSquare(event.lngLat.lat, event.lngLat.lng);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Scotland AGR Map</h1>
          <p>Annual Ground Rent for every 3×3 m square</p>
        </div>

        <div className="panel">
          <h2>Map layers</h2>
          <label className="checkbox-row">
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
        </div>

        <div className="panel">
          <h2>What3Words</h2>
          <div className="field">
            <label htmlFor="words">///words.here.now</label>
            <input
              id="words"
              value={words}
              onChange={(event) => setWords(event.target.value)}
            />
          </div>
          <button
            className="primary"
            disabled={loading}
            onClick={() => void fetchWords(words)}
          >
            {loading ? "Resolving…" : "Search W3W"}
          </button>
          <p className="meta" style={{ marginTop: "0.75rem" }}>
            Requires W3W_API_KEY on the backend (SLRG nonprofit application).
          </p>
        </div>

        <div className="panel">
          <h2>Search postcode</h2>
          <div className="field">
            <label htmlFor="postcode">Postcode</label>
            <input
              id="postcode"
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
            />
          </div>
          <button
            className="primary"
            disabled={loading}
            onClick={() => void fetchPostcode(postcode)}
          >
            {loading ? "Looking up…" : "Search postcode"}
          </button>
        </div>

        <div className="panel">
          <h2>Search coordinates</h2>
          <div className="field">
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
        </div>

        <div className="panel">
          <h2>AGR result</h2>
          {error && <p className="meta">{error}</p>}
          {!error && !result && (
            <p className="meta">Click the map or search to begin.</p>
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
            />
          )}
        </div>

        <div className="footer-links">
          <a href="https://www.slrg.scot" target="_blank" rel="noreferrer">
            SLRG Home
          </a>
          {" · "}
          <a href="/methodology">Methodology</a>
          {signoffStatus && (
            <>
              {" · "}
              <span className={`signoff-badge signoff-${signoffStatus}`}>
                Economist: {signoffStatus}
              </span>
            </>
          )}
        </div>
      </aside>

      <div className="map-wrap">
        <div id="map" ref={mapContainer} />
      </div>
    </div>
  );
}