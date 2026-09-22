const METRICS = [
  "geometry",
  "capital",
  "population",
  "area",
  "mainCities",
  "neighbors",
  "highestPoint",
  "hydrography",
];

export function calculateCoverage(data, geojson) {
  const geometryIds = new Set(
    geojson?.features?.map((feature) => feature.properties.id) ?? [],
  );
  const total = data.divisions.length;
  const counts = {
    geometry: data.divisions.filter((division) =>
      geometryIds.has(division.geometryId),
    ).length,
    capital: data.divisions.filter((division) => division.capital).length,
    population: data.divisions.filter((division) => division.population != null)
      .length,
    area: data.divisions.filter((division) => division.areaKm2 != null).length,
    mainCities: data.divisions.filter(
      (division) => (division.cityIds?.length ?? 0) >= 2,
    ).length,
    neighbors: data.divisions.filter((division) =>
      Array.isArray(division.neighborIds),
    ).length,
    highestPoint: data.divisions.filter((division) => division.highestPoint)
      .length,
    hydrography: data.divisions.filter(
      (division) => (division.riverIds?.length ?? 0) > 0,
    ).length,
  };
  const coverage = total
    ? METRICS.reduce((sum, metric) => sum + counts[metric] / total, 0) /
      METRICS.length
    : 0;
  return { total, counts, coverage: Math.round(coverage * 1000) / 1000 };
}

export function coverageStatus(data, geojson) {
  if (!data?.divisions?.length)
    return geojson?.features?.length ? "geometry-only" : "missing";
  const result = calculateCoverage(data, geojson);
  const coreComplete = ["geometry", "capital", "population", "area"].every(
    (metric) => result.counts[metric] === result.total,
  );
  if (coreComplete && result.coverage >= 0.9) return "complete";
  if (result.coverage >= 0.65) return "partial";
  return "basic";
}

export function createReport({
  iso3,
  country,
  data,
  geojson,
  warnings,
  errors,
}) {
  const coverage = calculateCoverage(data, geojson);
  return {
    country: country.names.fr,
    iso3,
    generatedAt: new Date().toISOString(),
    adm1Count: data.divisions.length,
    status: coverageStatus(data, geojson),
    coverage: coverage.coverage,
    coverageCounts: coverage.counts,
    errors,
    warnings,
  };
}

export function formatReport(report) {
  const labels = {
    geometry: "Geometry",
    capital: "Capital",
    population: "Population",
    area: "Area",
    mainCities: "Main cities",
    neighbors: "Neighbors",
    highestPoint: "Highest point",
    hydrography: "Hydrography",
  };
  const lines = [
    `Country: ${report.country} (${report.iso3})`,
    `ADM1 subdivisions: ${report.adm1Count}`,
    `Status: ${report.status}`,
    `Coverage score: ${report.coverage.toFixed(3)}`,
    "",
    "Coverage",
    ...Object.entries(report.coverageCounts).map(
      ([metric, value]) => `${labels[metric]}: ${value}/${report.adm1Count}`,
    ),
    "",
    `Errors: ${report.errors.length}`,
    `Warnings: ${report.warnings.length}`,
  ];
  if (report.errors.length) {
    lines.push(
      "",
      "Error details",
      ...report.errors.map((item) => `- ${item}`),
    );
  }
  if (report.warnings.length) {
    lines.push(
      "",
      "Warning details",
      ...report.warnings.map((item) => `- ${item}`),
    );
  }
  return `${lines.join("\n")}\n`;
}
