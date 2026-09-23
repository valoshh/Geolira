import fs from "node:fs/promises";
import { manifestEntry } from "./write-output.mjs";

const STATUSES = ["missing", "geometry-only", "basic", "partial", "complete"];

export function summarizeManifest(manifest, countries) {
  const entries = Object.entries(manifest);
  const detailed = entries.filter(([, entry]) => entry.status !== "missing");
  const counts = Object.fromEntries(
    STATUSES.map((status) => [
      status,
      entries.filter(([, entry]) => entry.status === status).length,
    ]),
  );
  const averageCoverage = detailed.length
    ? detailed.reduce((sum, [, entry]) => sum + entry.coverage, 0) /
      detailed.length
    : 0;
  const ranked = detailed
    .map(([iso3, entry]) => ({ iso3, ...entry }))
    .sort(
      (left, right) =>
        right.coverage - left.coverage || left.iso3.localeCompare(right.iso3),
    );
  const names = new Map(
    countries.map((country) => [country.id, country.names.fr]),
  );
  const missing = entries
    .filter(([, entry]) => entry.status === "missing")
    .map(([iso3]) => ({ iso3, name: names.get(iso3) ?? iso3 }));
  return {
    countryCount: entries.length,
    detailedCount: detailed.length,
    counts,
    averageCoverage: Math.round(averageCoverage * 1000) / 1000,
    highest: ranked.slice(0, 5),
    lowest: [...ranked].reverse().slice(0, 5),
    missing,
  };
}

export function validateManifest(manifest, countries) {
  const errors = [];
  const countryIds = new Set(countries.map((country) => country.id));
  for (const country of countries)
    if (!manifest[country.id])
      errors.push(`${country.id}: entrée manifeste absente`);
  for (const [iso3, entry] of Object.entries(manifest)) {
    if (!countryIds.has(iso3))
      errors.push(`${iso3}: pays inconnu dans le manifeste`);
    if (!STATUSES.includes(entry.status))
      errors.push(`${iso3}: statut invalide (${entry.status})`);
    if (
      !Number.isFinite(entry.coverage) ||
      entry.coverage < 0 ||
      entry.coverage > 1
    )
      errors.push(`${iso3}: couverture invalide (${entry.coverage})`);
    if (!Number.isInteger(entry.adm1Count) || entry.adm1Count < 0)
      errors.push(`${iso3}: nombre ADM1 invalide (${entry.adm1Count})`);
    if (
      entry.status === "missing" &&
      (entry.adm1Count !== 0 || entry.coverage !== 0)
    )
      errors.push(`${iso3}: statut missing incohérent`);
  }
  return errors;
}

export function formatStatus(summary) {
  const formatRank = (entries) =>
    entries.length
      ? entries
          .map((entry) => `${entry.iso3} ${entry.coverage.toFixed(3)}`)
          .join("\n")
      : "None";
  const missingLines = [];
  for (let index = 0; index < summary.missing.length; index += 12) {
    missingLines.push(
      summary.missing
        .slice(index, index + 12)
        .map((country) => country.iso3)
        .join(", "),
    );
  }
  return [
    `Countries with detailed ADM1 data: ${summary.detailedCount}`,
    "",
    `Complete: ${summary.counts.complete}`,
    `Partial: ${summary.counts.partial}`,
    `Basic: ${summary.counts.basic}`,
    `Geometry-only: ${summary.counts["geometry-only"]}`,
    "",
    `Average coverage: ${summary.averageCoverage.toFixed(3)}`,
    "",
    "Highest:",
    formatRank(summary.highest),
    "",
    "Lowest:",
    formatRank(summary.lowest),
    "",
    `Missing (${summary.counts.missing}):`,
    ...missingLines,
    "",
  ].join("\n");
}

export async function status() {
  const [manifest, countries] = await Promise.all([
    fs.readFile("data/country-manifest.json", "utf8").then(JSON.parse),
    fs.readFile("data/countries.json", "utf8").then(JSON.parse),
  ]);
  const errors = validateManifest(manifest, countries);
  for (const [iso3, entry] of Object.entries(manifest)) {
    if (entry.status === "missing") continue;
    try {
      const [data, geojson] = await Promise.all([
        fs.readFile(`public/data/${iso3}.json`, "utf8").then(JSON.parse),
        fs.readFile(`public/geo/${iso3}.json`, "utf8").then(JSON.parse),
      ]);
      if (data.divisions.length !== entry.adm1Count)
        errors.push(`${iso3}: manifeste/data en désaccord`);
      if (geojson.features.length !== entry.adm1Count)
        errors.push(`${iso3}: manifeste/géométrie en désaccord`);
      const calculated = manifestEntry(data, geojson);
      if (
        calculated.status !== entry.status ||
        calculated.coverage !== entry.coverage ||
        calculated.adm1Count !== entry.adm1Count
      )
        errors.push(`${iso3}: statut ou couverture du manifeste obsolète`);
    } catch {
      errors.push(`${iso3}: fichiers publics détaillés absents`);
    }
  }
  if (errors.length)
    throw new Error(`Manifeste invalide:\n- ${errors.join("\n- ")}`);
  const summary = summarizeManifest(manifest, countries);
  console.log(formatStatus(summary));
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  status().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
