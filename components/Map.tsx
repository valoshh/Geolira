"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapInstance } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Minus, Plus, LocateFixed, Compass, RotateCcw } from "lucide-react";
import type { FeatureCollection, LineString } from "geojson";
import type { Country, AdministrativeDivision, City } from "@/types/geography";
import { loadJson } from "@/lib/geography";
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const longitudeLines = Array.from(
  { length: 17 },
  (_, index) => -160 + index * 20,
);
const latitudeLines = Array.from({ length: 7 }, (_, index) => -40 + index * 20);
const GRATICULE: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [
    ...longitudeLines.map((longitude) => ({
      type: "Feature" as const,
      properties: { major: false },
      geometry: {
        type: "LineString" as const,
        coordinates: Array.from({ length: 68 }, (_, index) => [
          longitude,
          -54 + index * 2,
        ]),
      },
    })),
    ...latitudeLines.map((latitude) => ({
      type: "Feature" as const,
      properties: { major: latitude === 0 },
      geometry: {
        type: "LineString" as const,
        coordinates: Array.from({ length: 181 }, (_, index) => [
          -180 + index * 2,
          latitude,
        ]),
      },
    })),
  ],
};
export default function AtlasMap({
  countries,
  country,
  division,
  cities,
  onSelect,
  onWorld,
  resizeKey,
  worldMode = false,
}: {
  countries: Country[];
  country?: Country;
  division?: AdministrativeDivision;
  cities: City[];
  onSelect: (id: string, kind: "country" | "division") => void;
  onWorld: () => void;
  resizeKey: boolean;
  worldMode?: boolean;
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
              paint: { "background-color": "#bdced0" },
            },
          ],
        },
      });
      instance.addControl(
        new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }),
        "bottom-right",
      );
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
        instance.addSource("graticule", {
          type: "geojson",
          data: GRATICULE,
        });
        instance.addLayer({
          id: "graticule",
          type: "line",
          source: "graticule",
          paint: {
            "line-color": "#637f83",
            "line-opacity": 0.26,
            "line-width": 0.55,
          },
        });
        instance.addLayer({
          id: "equator",
          type: "line",
          source: "graticule",
          filter: ["==", ["get", "major"], true],
          paint: {
            "line-color": "#4f7076",
            "line-opacity": 0.38,
            "line-width": 0.85,
          },
        });
        instance.addLayer({
          id: "country-shore-shadow",
          type: "line",
          source: "world",
          filter: ["!=", ["get", "id"], "ATA"],
          paint: {
            "line-color": "#526e72",
            "line-opacity": 0.42,
            "line-blur": 0.5,
            "line-width": ["interpolate", ["linear"], ["zoom"], 0, 2.4, 5, 3.2],
          },
        });
        instance.addLayer({
          id: "countries",
          type: "fill",
          source: "world",
          paint: {
            "fill-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#d7aa90",
              [
                "match",
                ["get", "color"],
                0,
                "#d8d0bc",
                1,
                "#c7c9b5",
                2,
                "#ded4bf",
                3,
                "#c4cab7",
                "#d1cab7",
              ],
            ],
            "fill-opacity": 1,
            "fill-antialias": true,
          },
        });
        instance.addLayer({
          id: "country-coast-casing",
          type: "line",
          source: "world",
          filter: ["!=", ["get", "id"], "ATA"],
          paint: {
            "line-color": "#eee8da",
            "line-opacity": 0.72,
            "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 5, 1.3],
          },
        });
        instance.addLayer({
          id: "country-lines",
          type: "line",
          source: "world",
          filter: ["!=", ["get", "id"], "ATA"],
          paint: {
            "line-color": "#65645d",
            "line-opacity": 0.82,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              0.42,
              5,
              0.82,
            ],
          },
        });
        instance.addLayer({
          id: "country-selected-fill",
          type: "fill",
          source: "world",
          filter: ["==", ["get", "id"], ""],
          paint: { "fill-color": "#b96952", "fill-opacity": 0.62 },
        });
        instance.addLayer({
          id: "country-selected",
          type: "line",
          source: "world",
          filter: ["==", ["get", "id"], ""],
          paint: { "line-color": "#77382f", "line-width": 1.9 },
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
              "#d0a183",
              "#bec5a9",
            ],
            "fill-opacity": 0.82,
          },
        });
        instance.addLayer({
          id: "division-selected",
          type: "fill",
          source: "divisions",
          filter: ["==", ["get", "id"], ""],
          paint: { "fill-color": "#b9553f", "fill-opacity": 0.74 },
        });
        instance.addLayer({
          id: "division-lines",
          type: "line",
          source: "divisions",
          paint: {
            "line-color": "#6c725f",
            "line-opacity": 0.9,
            "line-width": 0.72,
            "line-dasharray": [2.2, 1.4],
          },
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
    if (instance.getLayer("country-selected-fill"))
      instance.setFilter("country-selected-fill", [
        "==",
        ["get", "id"],
        country?.id ?? "",
      ]);
    if (instance.getLayer("country-selected"))
      instance.setFilter("country-selected", [
        "all",
        ["==", ["get", "id"], country?.id ?? ""],
        ["!=", ["get", "id"], "ATA"],
      ]);
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
      const isCapital = city.roles?.some((role) =>
        ["national-capital", "regional-capital"].includes(role),
      );
      el.className = `city-marker${isCapital ? " city-marker-capital" : ""}`;
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
      .filter((c) => c.id !== "ATA")
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .map((c) => {
        const el = document.createElement("span");
        const population = c.population ?? 0;
        const priority =
          population > 50000000
            ? "major"
            : population > 10000000
              ? "medium"
              : population > 1000000
                ? "minor"
                : "micro";
        const minZoom =
          priority === "major"
            ? 0
            : priority === "medium"
              ? 1.35
              : priority === "minor"
                ? 2.7
                : 4.2;
        el.className = `country-label country-label-${priority}`;
        el.dataset.minZoom = String(minZoom);
        el.textContent = c.names.fr;
        el.setAttribute("aria-hidden", "true");
        const b = c.bounds;
        return new maplibregl.Marker({ element: el })
          .setLngLat(c.labelPoint ?? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2])
          .addTo(instance);
      });
    const placeLabels = () => {
      const occupied: DOMRect[] = [];
      const zoom = instance.getZoom();
      for (const marker of labels) {
        const el = marker.getElement();
        if (zoom < Number(el.dataset.minZoom ?? 0)) {
          el.style.visibility = "hidden";
          continue;
        }
        const rect = el.getBoundingClientRect();
        const overlaps = occupied.some(
          (r) =>
            rect.left < r.right + 14 &&
            rect.right > r.left - 14 &&
            rect.top < r.bottom + 7 &&
            rect.bottom > r.top - 7,
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
    <div
      className={`map-shell${worldMode || !country ? " map-shell-world" : ""}`}
    >
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
      <div className={`map-legend${country ? " map-legend-detail" : ""}`}>
        <span className="legend-square" />
        {division
          ? "Région sélectionnée"
          : country
            ? "Pays sélectionné"
            : "Territoires"}
        <span className="legend-line" />
        {country ? "Limites administratives" : "Frontières nationales"}
        {!!cities.length && (
          <>
            <span className="legend-city" /> Villes principales
          </>
        )}
      </div>
      <div className="map-north">
        N<span>↑</span>
      </div>
    </div>
  );
}
