"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type SquareResponse = {
  square: {
    lat: number;
    lng: number;
    area_sqm: number;
    polygon: GeoJSON.Polygon;
  };
  agr: {
    annual_ground_rent_gbp: number;
    site_rental_per_sqm_gbp: number;
    confidence: string;
    method: string;
    disclaimer: string;
    notes: string[];
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const emptyCollection: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export default function ScotlandMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [lat, setLat] = useState("55.9533");
  const [lng, setLng] = useState("-3.1883");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SquareResponse | null>(null);

  const fetchSquare = async (nextLat: number, nextLng: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/square?lat=${nextLat}&lng=${nextLng}`,
      );
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Failed to fetch AGR estimate");
      }
      const payload = (await response.json()) as SquareResponse;
      setResult(payload);
      setLat(payload.square.lat.toFixed(6));
      setLng(payload.square.lng.toFixed(6));

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

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
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [-4.2, 56.49],
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("selected-square", {
        type: "geojson",
        data: emptyCollection,
      });

      map.addLayer({
        id: "selected-square-fill",
        type: "fill",
        source: "selected-square",
        paint: {
          "fill-color": "#c8102e",
          "fill-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "selected-square-outline",
        type: "line",
        source: "selected-square",
        paint: {
          "line-color": "#c8102e",
          "line-width": 2,
        },
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Scotland AGR Map</h1>
          <p>Annual Ground Rent for every 3×3 m square</p>
        </div>

        <div className="panel">
          <h2>Search coordinates</h2>
          <div className="field">
            <label htmlFor="lat">Latitude</label>
            <input
              id="lat"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="lng">Longitude</label>
            <input
              id="lng"
              value={lng}
              onChange={(event) => setLng(event.target.value)}
            />
          </div>
          <button
            className="primary"
            disabled={loading}
            onClick={() => void fetchSquare(Number(lat), Number(lng))}
          >
            {loading ? "Calculating…" : "Estimate AGR"}
          </button>
          <p className="meta" style={{ marginTop: "0.75rem" }}>
            What3Words search arrives once nonprofit API access is approved.
          </p>
        </div>

        <div className="panel">
          <h2>AGR result</h2>
          {error && <p className="meta">{error}</p>}
          {!error && !result && (
            <p className="meta">Click the map or search coordinates to begin.</p>
          )}
          {result && (
            <>
              <p className="meta">
                Square centroid: {result.square.lat.toFixed(6)},{" "}
                {result.square.lng.toFixed(6)} ({result.square.area_sqm} sqm)
              </p>
              <div className="agr-value">
                £{result.agr.annual_ground_rent_gbp.toFixed(2)}
                <span style={{ fontSize: "1rem", color: "var(--slrg-text)" }}>
                  /year
                </span>
              </div>
              <p className="meta">
                Site rental: £{result.agr.site_rental_per_sqm_gbp.toFixed(2)}
                /sqm · Confidence: {result.agr.confidence}
              </p>
              <p className="meta">{result.agr.disclaimer}</p>
            </>
          )}
        </div>

        <div className="footer-links">
          <a href="https://www.slrg.scot" target="_blank" rel="noreferrer">
            SLRG Home
          </a>
          {" · "}
          <a href="/methodology">Methodology</a>
        </div>
      </aside>

      <div className="map-wrap">
        <div id="map" ref={mapContainer} />
      </div>
    </div>
  );
}