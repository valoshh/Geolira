export function geometryBounds(geometry) {
  const result = [Infinity, Infinity, -Infinity, -Infinity];
  walkCoordinates(geometry.coordinates, ([longitude, latitude]) => {
    result[0] = Math.min(result[0], longitude);
    result[1] = Math.min(result[1], latitude);
    result[2] = Math.max(result[2], longitude);
    result[3] = Math.max(result[3], latitude);
  });
  return result;
}

export function walkCoordinates(coordinates, visit) {
  if (
    Array.isArray(coordinates) &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    visit(coordinates);
    return;
  }
  for (const child of coordinates ?? []) walkCoordinates(child, visit);
}

export function roundGeometry(geometry, precision = 4) {
  const factor = 10 ** precision;
  const round = (coordinates) =>
    typeof coordinates[0] === "number"
      ? coordinates.map((value) => Math.round(value * factor) / factor)
      : coordinates.map(round);
  return { type: geometry.type, coordinates: round(geometry.coordinates) };
}

export function mergePolygonGeometries(geometries) {
  for (const geometry of geometries) {
    if (!["Polygon", "MultiPolygon"].includes(geometry.type))
      throw new Error(`Type de géométrie non pris en charge: ${geometry.type}`);
  }
  const merged = polygonClipping.union(
    ...geometries.map((geometry) => geometry.coordinates),
  );
  if (!merged.length)
    throw new Error("La fusion polygonale a produit une géométrie vide.");
  return merged.length === 1
    ? { type: "Polygon", coordinates: merged[0] }
    : { type: "MultiPolygon", coordinates: merged };
}

function inRing([x, y], ring) {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function pointInGeometry(point, geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    (rings) =>
      inRing(point, rings[0]) &&
      !rings.slice(1).some((ring) => inRing(point, ring)),
  );
}

function vertexSet(geometry) {
  const vertices = new Set();
  walkCoordinates(geometry.coordinates, ([x, y]) => {
    vertices.add(`${x.toFixed(4)},${y.toFixed(4)}`);
  });
  return vertices;
}

export function inferGeometryNeighbors(boundaries) {
  const vertices = new Map(
    boundaries.map((boundary) => [
      boundary.sourceId,
      vertexSet(boundary.geometry),
    ]),
  );
  const neighbors = new Map(
    boundaries.map((boundary) => [boundary.sourceId, new Set()]),
  );
  for (let left = 0; left < boundaries.length; left += 1) {
    for (let right = left + 1; right < boundaries.length; right += 1) {
      const a = vertices.get(boundaries[left].sourceId);
      const b = vertices.get(boundaries[right].sourceId);
      const smaller = a.size < b.size ? a : b;
      const larger = smaller === a ? b : a;
      let shared = 0;
      for (const vertex of smaller) {
        if (larger.has(vertex)) shared += 1;
        if (shared >= 2) break;
      }
      if (shared >= 2) {
        neighbors
          .get(boundaries[left].sourceId)
          .add(boundaries[right].sourceId);
        neighbors
          .get(boundaries[right].sourceId)
          .add(boundaries[left].sourceId);
      }
    }
  }
  return neighbors;
}

export function validateGeometry(geometry) {
  const errors = [];
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type))
    return ["type absent ou non pris en charge"];
  walkCoordinates(geometry.coordinates, ([longitude, latitude]) => {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
      errors.push(`latitude invalide: ${latitude}`);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
      errors.push(`longitude invalide: ${longitude}`);
  });
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const rings of polygons) {
    if (!rings.length || rings[0].length < 4)
      errors.push("anneau extérieur incomplet");
    for (const ring of rings) {
      const first = ring[0];
      const last = ring.at(-1);
      if (!first || !last || first[0] !== last[0] || first[1] !== last[1])
        errors.push("anneau non fermé");
    }
  }
  return [...new Set(errors)];
}
import polygonClipping from "polygon-clipping";
