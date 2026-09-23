import fs from "node:fs/promises";
import path from "node:path";
import { coverageStatus, calculateCoverage, formatReport } from "./report.mjs";
import { slugify } from "./slug.mjs";

async function writeJson(file, value, { pretty = false } = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await fs.writeFile(
    temporary,
    `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`,
  );
  await fs.rename(temporary, file);
}

export function updateCountries(countries, country) {
  return countries
    .map((item) => (item.id === country.id ? country : item))
    .sort((left, right) => left.names.fr.localeCompare(right.names.fr, "fr"));
}

export function updateSearch(search, country, data) {
  const divisions = new Map(
    data.divisions.map((division) => [division.id, division]),
  );
  const additions = data.divisions.map((division) => ({
    id: division.id,
    name: division.names.fr,
    aliases: [division.names.en, division.names.local, division.id].filter(
      Boolean,
    ),
    context: `${division.administrativeType} · ${country.names.fr}`,
    href: `/country/${country.slug}/${division.slug}/`,
    countryId: country.id,
    enriched: division.enriched,
    kind: "division",
  }));
  for (const city of data.cities) {
    const division = divisions.get(city.divisionId);
    if (!division) continue;
    additions.push({
      id: city.id,
      name: city.name,
      aliases: [city.names?.en, city.names?.local].filter(Boolean),
      context: `Ville · ${division.names.fr}, ${country.names.fr}`,
      href: `/city/${country.slug}/${division.slug}/${city.slug ?? slugify(city.name)}/`,
      countryId: country.id,
      enriched: true,
      kind: "city",
    });
  }

  // Replace existing detail entries in place. Appending every refreshed country
  // made the index depend on import order even when the source data was unchanged.
  const additionsByHref = new Map(
    additions.map((entry) => [entry.href, entry]),
  );
  const written = new Set();
  const result = [];
  for (const entry of search) {
    const isCountryEntry =
      entry.href.split("/").filter(Boolean).length === 2;
    if (entry.countryId !== country.id || isCountryEntry) {
      result.push(entry);
      continue;
    }
    const replacement = additionsByHref.get(entry.href);
    if (replacement && !written.has(entry.href)) {
      result.push(replacement);
      written.add(entry.href);
    }
  }
  for (const addition of additions) {
    if (!written.has(addition.href)) result.push(addition);
  }
  return result;
}

async function readOptionalJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

export async function generateManifest(countries, candidate) {
  const manifest = {};
  for (const country of countries) {
    const data =
      country.id === candidate?.iso3
        ? candidate.data
        : await readOptionalJson(`public/data/${country.id}.json`);
    const geojson =
      country.id === candidate?.iso3
        ? candidate.geojson
        : await readOptionalJson(`public/geo/${country.id}.json`);
    manifest[country.id] = manifestEntry(data, geojson);
  }
  return manifest;
}

export function manifestEntry(data, geojson) {
  if (!data?.divisions?.length && !geojson?.features?.length)
    return { status: "missing", adm1Count: 0, coverage: 0 };
  const coverage = data?.divisions?.length
    ? calculateCoverage(data, geojson)
    : { coverage: 0 };
  return {
    status: coverageStatus(data, geojson),
    adm1Count: data?.divisions?.length ?? geojson.features.length,
    coverage: coverage.coverage,
  };
}

export async function writeOutput({
  iso3,
  countries,
  search,
  data,
  geojson,
  report,
}) {
  const manifest = await generateManifest(countries, { iso3, data, geojson });
  await Promise.all([
    writeJson(`public/data/${iso3}.json`, data),
    writeJson(`public/geo/${iso3}.json`, geojson),
    writeJson("data/countries.json", countries),
    writeJson("data/search.json", search, { pretty: true }),
    writeJson("data/country-manifest.json", manifest, { pretty: true }),
    writeJson(`data/reports/${iso3}.json`, report, { pretty: true }),
    fs.writeFile(`data/reports/${iso3}.txt`, formatReport(report)),
  ]);
  return manifest;
}
