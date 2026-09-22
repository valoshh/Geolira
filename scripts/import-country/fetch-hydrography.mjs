import { fetchJson } from "./cache.mjs";
import { SOURCES } from "./config.mjs";
import { geometryBounds, pointInGeometry } from "./geometry.mjs";
import { slugify } from "./slug.mjs";

function intersectsRegion(line, geometry) {
  const bounds = geometryBounds(geometry);
  const lines =
    line.type === "LineString" ? [line.coordinates] : line.coordinates;
  return lines.some((coordinates) =>
    coordinates.some(
      (point) =>
        point[0] >= bounds[0] &&
        point[0] <= bounds[2] &&
        point[1] >= bounds[1] &&
        point[1] <= bounds[3] &&
        pointInGeometry(point, geometry),
    ),
  );
}

export async function fetchHydrography(boundaries, options = {}) {
  const data = await fetchJson(SOURCES.rivers, "rivers.json", options);
  const rivers = [];
  const riverIdsByBoundary = new Map();
  for (const boundary of boundaries) {
    const selected = data.features
      .filter((feature) => feature.properties.name)
      .filter((feature) =>
        intersectsRegion(feature.geometry, boundary.geometry),
      )
      .sort(
        (left, right) =>
          Number(left.properties.scalerank ?? 99) -
          Number(right.properties.scalerank ?? 99),
      )
      .map((feature) => feature.properties.name)
      .filter((name, index, names) => names.indexOf(name) === index)
      .slice(0, 4);
    const ids = selected.map((name) => `ne-${slugify(name)}`);
    selected.forEach((name, index) => {
      rivers.push({ id: ids[index], name, divisionIds: [boundary.sourceId] });
    });
    riverIdsByBoundary.set(boundary.sourceId, ids);
  }
  const unique = new Map();
  for (const river of rivers) {
    const stored = unique.get(river.id) ?? { ...river, divisionIds: [] };
    stored.divisionIds.push(...river.divisionIds);
    stored.divisionIds = [...new Set(stored.divisionIds)];
    unique.set(river.id, stored);
  }
  return { rivers: [...unique.values()], riverIdsByBoundary };
}
