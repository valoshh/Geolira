export const WARNING_DEFINITIONS = {
  WARN_BOUNDARY_COUNT_MISMATCH: "source-ambiguity",
  WARN_SOURCE_UNAVAILABLE: "potential-anomaly",
  WARN_MISSING_WIKIDATA_ID: "source-ambiguity",
  WARN_WIKIDATA_ID_COLLISION: "source-ambiguity",
  WARN_ID_STABILITY_OVERRIDE: "source-ambiguity",
  WARN_SLUG_COLLISION: "potential-anomaly",
  WARN_SOURCE_FALLBACK: "source-ambiguity",
  WARN_EXTERNAL_NEIGHBOR: "external-relation",
  WARN_CAPITAL_COORDINATES: "missing-data",
  WARN_MISSING_CAPITAL: "missing-data",
  WARN_MISSING_POPULATION: "missing-data",
  WARN_MISSING_AREA: "missing-data",
  WARN_UNLINKED_CAPITAL: "potential-anomaly",
  WARN_LOW_CITY_COVERAGE: "missing-data",
  WARN_LOW_RELIEF_COVERAGE: "missing-data",
  WARN_LOW_HYDROGRAPHY_COVERAGE: "missing-data",
};

export function warning(code, message) {
  if (!WARNING_DEFINITIONS[code])
    throw new Error(`Code warning inconnu: ${code}`);
  return `[${code}] ${message}`;
}

export function warningCode(message) {
  return /^\[([^\]]+)]/.exec(message)?.[1] ?? "WARN_UNCLASSIFIED";
}

export function summarizeWarnings(warnings) {
  const counts = new Map();
  for (const message of warnings) {
    const code = warningCode(message);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts]
    .map(([code, count]) => ({
      code,
      category: WARNING_DEFINITIONS[code] ?? "potential-anomaly",
      count,
    }))
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.code.localeCompare(right.code),
    );
}
