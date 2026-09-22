import fs from "node:fs/promises";
import { readJson, writeCachedReport } from "./cache.mjs";
import { fetchBoundaries } from "./fetch-boundaries.mjs";
import { fetchCities } from "./fetch-cities.mjs";
import { fetchHydrography } from "./fetch-hydrography.mjs";
import { fetchWikidata } from "./fetch-wikidata.mjs";
import { normalizeCountry } from "./normalize.mjs";
import { createReport, formatReport } from "./report.mjs";
import { validateImport } from "./validate.mjs";
import {
  generateManifest,
  updateCountries,
  updateSearch,
  writeOutput,
} from "./write-output.mjs";

function parseArguments(arguments_) {
  const flags = new Set(
    arguments_.filter((argument) => argument.startsWith("--")),
  );
  const values = arguments_.filter((argument) => !argument.startsWith("--"));
  if (values.length !== 1 || !/^[a-z]{3}$/i.test(values[0]))
    throw new Error(
      "Usage: npm run data:country -- ISO3 [--refresh] [--dry-run]",
    );
  const unknown = [...flags].filter(
    (flag) => !["--refresh", "--dry-run"].includes(flag),
  );
  if (unknown.length) throw new Error(`Option inconnue: ${unknown.join(", ")}`);
  return {
    iso3: values[0].toUpperCase(),
    refresh: flags.has("--refresh"),
    dryRun: flags.has("--dry-run"),
  };
}

async function readExistingData(iso3) {
  try {
    return await readJson(`public/data/${iso3}.json`);
  } catch {
    return undefined;
  }
}

export async function importCountry(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const { iso3 } = options;
  const [countries, search, existingData] = await Promise.all([
    readJson("data/countries.json"),
    readJson("data/search.json"),
    readExistingData(iso3),
  ]);
  const existingCountry = countries.find((country) => country.id === iso3);
  if (!existingCountry)
    throw new Error(`ISO3 valide mais absent du catalogue: ${iso3}`);

  console.log(`Import ${existingCountry.names.fr} (${iso3})…`);
  const boundaryResult = await fetchBoundaries(iso3, options);
  const countryQid = boundaryResult.countryFeature.properties.WIKIDATAID;
  if (!countryQid)
    throw new Error(
      `${iso3}: identifiant Wikidata du pays absent de Natural Earth.`,
    );
  const [wikidata, cityData, hydrography] = await Promise.all([
    fetchWikidata(countryQid, boundaryResult.boundaries, options),
    fetchCities(iso3, boundaryResult.boundaries, options),
    fetchHydrography(boundaryResult.boundaries, options),
  ]);
  const normalized = normalizeCountry({
    iso3,
    existingCountry,
    existingData,
    boundaries: boundaryResult.boundaries,
    administrativeType: boundaryResult.administrativeType,
    boundarySource: boundaryResult.source,
    wikidata,
    cityData,
    hydrography,
    worldFeatures: boundaryResult.worldFeatures,
  });
  const nextCountries = updateCountries(countries, normalized.country);
  const nextSearch = updateSearch(search, normalized.country, normalized.data);
  const validation = validateImport({
    iso3,
    countries: nextCountries,
    data: normalized.data,
    geojson: normalized.geojson,
    search: nextSearch,
  });
  const report = createReport({
    iso3,
    country: normalized.country,
    data: normalized.data,
    geojson: normalized.geojson,
    warnings: [
      ...boundaryResult.warnings,
      ...wikidata.warnings,
      ...normalized.warnings,
      ...validation.warnings,
    ],
    errors: validation.errors,
  });
  const readableReport = formatReport(report);
  console.log(`\n${readableReport}`);

  if (options.dryRun) {
    const jsonFile = await writeCachedReport(
      iso3,
      `${JSON.stringify(report, null, 2)}\n`,
      "json",
    );
    const textFile = await writeCachedReport(iso3, readableReport, "txt");
    await generateManifest(nextCountries, {
      iso3,
      data: normalized.data,
      geojson: normalized.geojson,
    });
    console.log(`Dry run: aucun fichier de production modifié.`);
    console.log(`Rapports temporaires: ${jsonFile}, ${textFile}`);
  } else if (!validation.errors.length) {
    await fs.mkdir("data/reports", { recursive: true });
    await writeOutput({
      iso3,
      countries: nextCountries,
      search: nextSearch,
      data: normalized.data,
      geojson: normalized.geojson,
      report,
    });
    console.log(`Fichiers ${iso3} et catalogues mis à jour.`);
  } else {
    const jsonFile = await writeCachedReport(
      iso3,
      `${JSON.stringify(report, null, 2)}\n`,
      "json",
    );
    const textFile = await writeCachedReport(iso3, readableReport, "txt");
    console.error(`Rapports d’échec: ${jsonFile}, ${textFile}`);
  }

  if (validation.errors.length) {
    process.exitCode = 1;
    throw new Error(
      `${validation.errors.length} erreur(s) de validation; aucun fichier de production n’a été écrit.`,
    );
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importCountry().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
