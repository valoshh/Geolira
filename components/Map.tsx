"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapInstance } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Minus, Plus, LocateFixed, Compass, RotateCcw } from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { Country, AdministrativeDivision, City } from "@/types/geography";
import { loadJson } from "@/lib/geography";
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
export default function AtlasMap({
  countries,
  country,
  division,
  cities,
  onSelect,
  onWorld,
  resizeKey,
}: {
  countries: Country[];
  country?: Country;
  division?: AdministrativeDivision;
  cities: City[];
  onSelect: (id: string, kind: "country" | "division") => void;
  onWorld: () => void;
  resizeKey: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const callbacks = useRef({ onSelect, onWorld });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    callbacks.current = { onSelect, onWorld };
  }, [onSelect, onWorld]);
  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let instance: MapInstance;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        center: [10, 21],
        zoom: 1.45,
        minZoom: 0,
        maxZoom: 12,
        attributionControl: { compact: true },
        renderWorldCopies: false,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "ocean",
              type: "background",
              paint: { "background-color": "#cbdadd" },
            },
          ],
        },
      });
    } catch {
      setError(
        "La carte nécessite WebGL. Vous pouvez continuer à explorer avec la recherche et les listes.",
      );
      setLoading(false);
      return;
    }
    map.current = instance;
    instance.on("error", () => {
      if (!disposed) {
        setError("Une ressource cartographique n’a pas pu être chargée.");
        setLoading(false);
      }
    });
    const watchdog = setTimeout(() => {
      if (!disposed && !instance.isSourceLoaded("world")) {
        setError("Le chargement de la carte prend trop de temps. Réessayez.");
        setLoading(false);
      }
    }, 20000);
    instance.on("load", async () => {
      try {
        const world = await loadJson<FeatureCollection>("/geo/world.json");
        if (disposed) return;
        instance.addSource("world", {
          type: "geojson",
          data: world,
          promoteId: "id",
          attribution: "© Natural Earth · Domaine public",
        });
        instance.addLayer({
          id: "countries",
          type: "fill",
          source: "world",
          paint: {
            "fill-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#d6b9a6",
              [
                "match",
                ["get", "color"],
                0,
                "#d9d4c7",
                1,
                "#d2d0c2",
                2,
                "#e0dacd",
                3,
                "#cdd0c0",
                "#d7d2c6",
              ],
            ],
            "fill-opacity": 1,
          },
        });
        instance.addLayer({
          id: "country-lines",
          type: "line",
          source: "world",
          paint: { "line-color": "#77776f", "line-width": 0.65 },
        });
        instance.addLayer({
          id: "country-selected-fill",
          type: "fill",
          source: "world",
          filter: ["==", ["get", "id"], ""],
          paint: { "fill-color": "#c47a63", "fill-opacity": 0.58 },
        });
        instance.addLayer({
          id: "country-selected",
          type: "line",
          source: "world",
          filter: ["==", ["get", "id"], ""],
          paint: { "line-color": "#8c3529", "line-width": 1.8 },
        });
        instance.addSource("divisions", {
          type: "geojson",
          data: EMPTY,
          promoteId: "id",
        });
        instance.addLayer({
          id: "division-fill",
          type: "fill",
          source: "divisions",
          paint: {
            "fill-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#d4aa8d",
              "#c8ccb7",
            ],
            "fill-opacity": 0.9,
          },
        });
        instance.addLayer({
          id: "division-selected",
          type: "fill",
          source: "divisions",
          filter: ["==", ["get", "id"], ""],
          paint: { "fill-color": "#bd5038", "fill-opacity": 0.76 },
        });
        instance.addLayer({
          id: "division-lines",
          type: "line",
          source: "divisions",
          paint: { "line-color": "#6f7565", "line-width": 0.8 },
        });
        instance.addLayer({
          id: "division-selected-line",
          type: "line",
          source: "divisions",
          filter: ["==", ["get", "id"], ""],
          paint: { "line-color": "#7f2d24", "line-width": 2 },
        });
        let hovered: { source: string; id: string | number } | undefined;
        instance.on("mousemove", (e) => {
          const f = instance.queryRenderedFeatures(e.point, {
            layers: ["division-fill", "countries"],
          })[0];
          if (hovered) instance.setFeatureState(hovered, { hover: false });
          if (f && f.id !== undefined) {
            hovered = { source: f.source, id: f.id };
            instance.setFeatureState(hovered, { hover: true });
            setHover(String(f.properties.name));
            instance.getCanvas().style.cursor = "pointer";
          } else {
            hovered = undefined;
            setHover("");
            instance.getCanvas().style.cursor = "";
          }
        });
        instance.on("click", (e) => {
          const f = instance.queryRenderedFeatures(e.point, {
            layers: ["division-fill", "countries"],
          })[0];
          if (f)
            callbacks.current.onSelect(
              String(f.properties.id),
              f.source === "world" ? "country" : "division",
            );
        });
        setReady(true);
        setLoading(false);
        setError("");
      } catch {
        setError(
          "Le fond de carte est indisponible. Réessayez ou utilisez la recherche.",
        );
        setLoading(false);
      }
    });
    return () => {
      disposed = true;
      clearTimeout(watchdog);
      instance.remove();
      map.current = null;
      setReady(false);
    };
  }, [retry]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    let cancelled = false;
    const source = instance.getSource("divisions") as GeoJSONSource | undefined;
    if (!source || !instance.getLayer("country-selected")) return;
    source.setData(EMPTY);
    for (const layer of ["country-selected-fill", "country-selected"])
      if (instance.getLayer(layer))
        instance.setFilter(layer, ["==", ["get", "id"], country?.id ?? ""]);
    if (!country?.pilot) return;
    setLoading(true);
    loadJson<FeatureCollection>(`/geo/${country.id}.json`)
      .then((data) => {
        if (!cancelled) {
          if (instance.getSource("divisions")) source.setData(data);
          setError("");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Frontières régionales indisponibles. Les fiches restent accessibles.",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [country?.id, country?.pilot, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    for (const layer of ["division-selected", "division-selected-line"])
      if (instance.getLayer(layer))
        instance.setFilter(layer, ["==", ["get", "id"], division?.id ?? ""]);
    const bounds = division?.bounds ?? country?.bounds;
    if (bounds)
      instance.fitBounds(bounds, {
        padding: 65,
        maxZoom: division ? 8.5 : 5,
        duration: 900,
      });
    else
      instance.fitBounds([-180, -58, 180, 82], { padding: 20, duration: 900 });
  }, [country, division, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const markers = cities.map((city) => {
      const el = document.createElement("button");
      el.className = "city-marker";
      el.setAttribute("aria-label", city.name);
      el.textContent = city.name;
      return new maplibregl.Marker({ element: el, anchor: "left" })
        .setLngLat([city.longitude, city.latitude])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setText(city.name))
        .addTo(map.current!);
    });
    return () => markers.forEach((m) => m.remove());
  }, [cities, ready]);
  useEffect(() => {
    const timer = setTimeout(() => map.current?.resize(), 240);
    return () => clearTimeout(timer);
  }, [resizeKey]);
  // DOM labels avoid external font services and keep the base map entirely local.
  useEffect(() => {
    if (!ready || !map.current || country) return;
    const instance = map.current;
    const labels = [...countries]
      .filter((c) => c.population && c.population > 15000000 && c.id !== "ATA")
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .map((c) => {
        const el = document.createElement("span");
        el.className = "country-label";
        el.textContent = c.names.fr;
        el.setAttribute("aria-hidden", "true");
        const b = c.bounds;
        return new maplibregl.Marker({ element: el })
          .setLngLat(c.labelPoint ?? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2])
          .addTo(instance);
      });
    const placeLabels = () => {
      const occupied: DOMRect[] = [];
      for (const marker of labels) {
        const el = marker.getElement();
        const rect = el.getBoundingClientRect();
        const overlaps = occupied.some(
          (r) =>
            rect.left < r.right + 10 &&
            rect.right > r.left - 10 &&
            rect.top < r.bottom + 5 &&
            rect.bottom > r.top - 5,
        );
        el.style.visibility = overlaps ? "hidden" : "visible";
        if (!overlaps) occupied.push(rect);
      }
    };
    instance.on("move", placeLabels);
    instance.on("resize", placeLabels);
    const frame = requestAnimationFrame(placeLabels);
    return () => {
      cancelAnimationFrame(frame);
      instance.off("move", placeLabels);
      instance.off("resize", placeLabels);
      labels.forEach((m) => m.remove());
    };
  }, [ready, countries, country]);
  return (
    <div className="map-shell">
      <div
        ref={container}
        className="map-canvas"
        role="region"
        aria-label="Carte interactive du monde"
      />
      <div className="map-caption">
        <span className="map-dot" />
        {division
          ? "SUBDIVISION SÉLECTIONNÉE"
          : country
            ? "EXPLORATION DU PAYS"
            : "CARTE POLITIQUE"}
        <span className="caption-divider" />
        {country?.names.fr ?? "Le monde"}
      </div>
      <div className="map-tools">
        <button onClick={() => map.current?.zoomIn()} aria-label="Zoom avant">
          <Plus size={20} />
        </button>
        <button
          onClick={() => map.current?.zoomOut()}
          aria-label="Zoom arrière"
        >
          <Minus size={20} />
        </button>
        <span />
        <button
          onClick={() => {
            const b = division?.bounds ?? country?.bounds;
            if (b) map.current?.fitBounds(b, { padding: 65, maxZoom: 8.5 });
            else map.current?.fitBounds([-180, -58, 180, 82], { padding: 20 });
          }}
          aria-label="Recentrer la carte"
        >
          <LocateFixed size={20} />
        </button>
        <button
          onClick={() => map.current?.resetNorth()}
          aria-label="Orienter vers le nord"
        >
          <Compass size={20} />
        </button>
      </div>
      {loading && (
        <div className="map-status" role="status">
          <span className="spinner" />
          Chargement de la carte…
        </div>
      )}
      {error && (
        <div className="map-error" role="alert">
          {error}
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((n) => n + 1);
            }}
          >
            <RotateCcw size={15} /> Réessayer
          </button>
        </div>
      )}
      {hover && (
        <div className="map-tooltip">
          {hover}
          <span>Cliquer pour explorer</span>
        </div>
      )}
      <div className="map-legend">
        <span className="legend-square" />
        Frontières politiques
        <span className="legend-line" />
        Limites administratives
      </div>
      <div className="map-north">
        N<span>↑</span>
      </div>
    </div>
  );
}
