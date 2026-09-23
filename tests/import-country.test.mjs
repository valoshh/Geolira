import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  allocateStableSlugs,
  slugify,
} from "../scripts/import-country/slug.mjs";
import {
  COVERAGE_WEIGHTS,
  calculateCoverage,
  coverageStatus,
  createReport,
} from "../scripts/import-country/report.mjs";
import { COUNTRY_OVERRIDES } from "../scripts/import-country/config.mjs";
import {
  entityLabel,
  selectIsoMappings,
} from "../scripts/import-country/fetch-wikidata.mjs";
import {
  summarizeManifest,
  validateManifest,
} from "../scripts/import-country/status.mjs";
import { validateImport } from "../scripts/import-country/validate.mjs";
import {
  summarizeWarnings,
  warning,
} from "../scripts/import-country/warnings.mjs";
import {
  manifestEntry,
  updateSearch,
} from "../scripts/import-country/write-output.mjs";

const DETAILED_COUNTRIES = [
  "FRA",
  "USA",
  "DEU",
  "JPN",
  "BRA",
  "ITA",
  "ESP",
  "CAN",
  "AUS",
  "IND",
];

const division = (overrides = {}) => ({
  id: "Q1",
  slug: "region-test",
  countryId: "TST",
  names: { fr: "Région test" },
  administrativeLevel: 1,
  administrativeType: "Région",
  geometryId: "Q1",
  bounds: [0, 0, 1, 1],
  sources: [{ provider: "Test" }],
  neighborIds: [],
  cityIds: ["C1", "C2"],
  riverIds: ["R1"],
  capital: "Testville",
  population: 10,
  areaKm2: 2,
  highestPoint: { name: "Mont Test" },
  ...overrides,
});

const polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};

test("country importer normalizes stable URL slugs", () => {
  assert.equal(slugify("Vallée d’Aoste"), "vallee-d-aoste");
  assert.equal(
    slugify("Trentino-Alto Adige/Südtirol"),
    "trentino-alto-adige-sudtirol",
  );
});

test("slug collisions are resolved deterministically without changing published slugs", () => {
  const makeItems = () => [
    { id: "Q3", slug: "same-name", names: { fr: "Même nom" } },
    { id: "Q1", slug: "same-name", names: { fr: "Même nom" } },
    { id: "Q2", slug: "old-name", names: { fr: "Nom modifié" } },
  ];
  const stable = new Map([["Q2", "published-slug"]]);
  const first = allocateStableSlugs(makeItems(), stable);
  const second = allocateStableSlugs(makeItems().reverse(), stable);
  const identity = (items) =>
    Object.fromEntries(items.map((item) => [item.id, item.slug]));
  assert.deepEqual(identity(first), identity(second));
  assert.deepEqual(identity(first), {
    Q1: "same-name",
    Q2: "published-slug",
    Q3: "same-name-q3",
  });
});

test("search updates preserve entry positions and are idempotent", () => {
  const country = { id: "TST", slug: "test", names: { fr: "Test" } };
  const data = {
    divisions: [
      {
        id: "Q1",
        slug: "region-test",
        names: { fr: "Région test", en: "Test region" },
        administrativeType: "Région",
      },
    ],
    cities: [],
  };
  const search = [
    { id: "AAA", countryId: "AAA", href: "/country/a/" },
    {
      id: "Q1",
      countryId: "TST",
      href: "/country/test/region-test/",
      name: "Ancien nom",
    },
    { id: "BBB", countryId: "BBB", href: "/country/b/" },
  ];
  const first = updateSearch(search, country, data);
  const second = updateSearch(first, country, data);
  assert.deepEqual(second, first);
  assert.deepEqual(first.map((entry) => entry.id), ["AAA", "Q1", "BBB"]);
  assert.equal(first[1].name, "Région test");
});

test("Wikidata ISO collisions choose the same ID regardless of response order", () => {
  const bindings = [
    {
      iso: { value: "XX-1" },
      item: { value: "https://www.wikidata.org/entity/Q20" },
    },
    {
      iso: { value: "XX-1" },
      item: { value: "https://www.wikidata.org/entity/Q3" },
    },
  ];
  const forward = selectIsoMappings(bindings);
  const reverse = selectIsoMappings([...bindings].reverse());
  assert.equal(forward.map.get("XX-1"), "Q3");
  assert.deepEqual(forward.warnings, reverse.warnings);
});

test("generic Wikidata labels do not use an Italy-specific fallback", () => {
  const entity = { labels: { it: { value: "Nome italiano" } } };
  assert.equal(entityLabel(entity), undefined);
});

test("coverage and manifest status are calculated from fields", () => {
  const data = { divisions: [division()], cities: [], rivers: [] };
  const geojson = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { id: "Q1" }, geometry: polygon },
    ],
  };
  assert.deepEqual(calculateCoverage(data, geojson), {
    total: 1,
    counts: {
      geometry: 1,
      capital: 1,
      population: 1,
      area: 1,
      mainCities: 1,
      neighbors: 1,
      highestPoint: 1,
      hydrography: 1,
    },
    coverage: 1,
  });
  assert.equal(coverageStatus(data, geojson), "complete");
  assert.equal(
    Object.values(COVERAGE_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    8,
  );
  assert.equal(
    coverageStatus(
      { ...data, divisions: [division({ capital: undefined })] },
      geojson,
    ),
    "partial",
    "a core field blocks complete status even above the score threshold",
  );
  assert.deepEqual(manifestEntry(undefined, undefined), {
    status: "missing",
    adm1Count: 0,
    coverage: 0,
  });
});

test("validation detects duplicates and invalid relations", () => {
  const data = {
    divisions: [
      division({ neighborIds: ["Q2"] }),
      division({ id: "Q2", neighborIds: ["UNKNOWN"] }),
    ],
    cities: [
      { id: "C1", divisionId: "Q1", latitude: 95, longitude: 0 },
      { id: "C2", divisionId: "Q1", latitude: 1, longitude: 2 },
    ],
    rivers: [{ id: "R1", divisionIds: ["Q1"] }],
  };
  const geojson = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { id: "Q1" }, geometry: polygon },
      { type: "Feature", properties: { id: "Q2" }, geometry: polygon },
    ],
  };
  const result = validateImport({
    iso3: "TST",
    countries: [{ id: "TST", slug: "test" }],
    data,
    geojson,
    search: [
      { href: "/country/test/region-test/" },
      { href: "/country/test/region-test/" },
    ],
  });
  assert.ok(
    result.errors.some((error) =>
      error.includes("Slug de subdivision dupliqué"),
    ),
  );
  assert.ok(
    result.errors.some((error) => error.includes("voisin UNKNOWN inconnu")),
  );
  assert.ok(
    result.errors.some((error) => error.includes("voisinage non réciproque")),
  );
  assert.ok(result.errors.some((error) => error.includes("latitude invalide")));
  assert.ok(result.errors.some((error) => error.includes("URL dupliquée")));
});

test("legacy pilot IDs and public slugs remain stable", () => {
  const expected = {
    FRA: "c48256191caebb5565223eb5117b299514d2bda9e253237d260c7494825496a0",
    USA: "37abbdfe08a9b2c40a8860d6d390a361739ef33578ca0a43fccd92b7fa6efd0e",
    DEU: "5e55ef2c5a16878617f5cdbd39c68cf25da07bf6dbb5b0244559ae2425a5f65a",
    JPN: "157750815c8363967ea041d66a319946dbe7e65697a3e0b4f10a6f01c7561ed1",
    BRA: "b97059f0387394a9f0ea1659765d533eacfdab74bb77735b6b205b3c01b849f4",
    ITA: "6c9159a606023e34be028fa8325e750f883ce59a9c38b4201a71f9fa3d4e833b",
    ESP: "37085681ecfeafd21aac7e396400cd5adb5ebf57167c422d5f0b4d51a6974fe1",
    CAN: "57c87f2bc173782e45dba863b7c4264a2b91da2a4a8bd69ca3ee2fc3f02e9dff",
    AUS: "94a335dd1b7c95433fa3c271432729a0aa8ec2c5c348234073d1fbe194963cd1",
    IND: "136129b84319c4c17bd56a44d47a1e163e4ea869725597c04cd509d9e6d567e4",
  };
  for (const [iso3, digest] of Object.entries(expected)) {
    const data = JSON.parse(
      fs.readFileSync(`public/data/${iso3}.json`, "utf8"),
    );
    const identity = data.divisions
      .map((item) => `${item.id}:${item.slug}`)
      .sort()
      .join("|");
    assert.equal(createHash("sha256").update(identity).digest("hex"), digest);
  }
});

test("all production outputs contain valid, sourced ADM1 subdivisions", () => {
  const countries = JSON.parse(fs.readFileSync("data/countries.json", "utf8"));
  const search = JSON.parse(fs.readFileSync("data/search.json", "utf8"));
  for (const iso3 of DETAILED_COUNTRIES) {
    const data = JSON.parse(
      fs.readFileSync(`public/data/${iso3}.json`, "utf8"),
    );
    const geojson = JSON.parse(
      fs.readFileSync(`public/geo/${iso3}.json`, "utf8"),
    );
    const result = validateImport({ iso3, countries, data, geojson, search });
    assert.deepEqual(result.errors, [], `${iso3} must pass validation`);
    assert.equal(
      data.divisions.length,
      geojson.features.length,
      `${iso3} data and geometry counts must match`,
    );
    assert.ok(
      data.divisions.every((item) =>
        item.sources.every(
          (source) => source.provider && source.url && source.retrievedAt,
        ),
      ),
      `${iso3} divisions must retain source provenance`,
    );
  }
});

test("manifest is coherent with the ten detailed countries", () => {
  const countries = JSON.parse(fs.readFileSync("data/countries.json", "utf8"));
  const manifest = JSON.parse(
    fs.readFileSync("data/country-manifest.json", "utf8"),
  );
  assert.deepEqual(validateManifest(manifest, countries), []);
  const summary = summarizeManifest(manifest, countries);
  assert.equal(summary.detailedCount, DETAILED_COUNTRIES.length);
  assert.equal(
    summary.counts.missing,
    summary.countryCount - DETAILED_COUNTRIES.length,
  );
});

test("warnings expose stable codes and categories", () => {
  const warnings = [
    warning("WARN_MISSING_CAPITAL", "Région test: capitale absente"),
    warning("WARN_EXTERNAL_NEIGHBOR", "Q2 ignoré"),
    warning("WARN_MISSING_CAPITAL", "Autre région: capitale absente"),
  ];
  assert.deepEqual(summarizeWarnings(warnings), [
    {
      code: "WARN_EXTERNAL_NEIGHBOR",
      category: "external-relation",
      count: 1,
    },
    {
      code: "WARN_MISSING_CAPITAL",
      category: "missing-data",
      count: 2,
    },
  ]);
});

test("reports are deterministic for identical normalized inputs", () => {
  const data = { divisions: [division()], cities: [], rivers: [] };
  const geojson = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { id: "Q1" }, geometry: polygon },
    ],
  };
  const input = {
    iso3: "TST",
    country: {
      names: { fr: "Test" },
      sources: [{ retrievedAt: "2026-01-02T03:04:05.000Z" }],
    },
    data,
    geojson,
    warnings: [],
    errors: [],
  };
  assert.deepEqual(createReport(input), createReport(input));
  assert.equal(createReport(input).generatedAt, "2026-01-02T03:04:05.000Z");
});

test("country overrides produce the expected administrative geometry", () => {
  const spain = JSON.parse(fs.readFileSync("public/data/ESP.json", "utf8"));
  const australia = JSON.parse(fs.readFileSync("public/geo/AUS.json", "utf8"));
  const canada = JSON.parse(fs.readFileSync("public/data/CAN.json", "utf8"));
  const indiaReport = JSON.parse(
    fs.readFileSync("data/reports/IND.json", "utf8"),
  );
  const italyReport = JSON.parse(
    fs.readFileSync("data/reports/ITA.json", "utf8"),
  );
  const italyGeometry = JSON.parse(
    fs.readFileSync("public/geo/ITA.json", "utf8"),
  );
  assert.equal(italyGeometry.features.length, 20);
  assert.ok(
    italyReport.warnings.some((item) =>
      item.startsWith("[WARN_BOUNDARY_COUNT_MISMATCH]"),
    ),
  );
  assert.equal(COUNTRY_OVERRIDES.ESP.boundaryGrouping, "region-code-and-name");
  assert.equal(spain.divisions.length, 19);
  assert.deepEqual(
    spain.divisions
      .filter((division) => ["Ceuta", "Melilla"].includes(division.names.fr))
      .map((division) => division.administrativeType)
      .sort(),
    ["Ville autonome", "Ville autonome"],
  );
  assert.deepEqual(COUNTRY_OVERRIDES.AUS.boundaryMerges, {
    "AU-NSW": "Q3224",
    Q46650: "Q34366",
  });
  assert.equal(australia.features.length, 9);
  assert.equal(
    new Set(australia.features.map((feature) => feature.properties.id)).size,
    9,
  );
  assert.equal(canada.divisions.length, 13);
  assert.equal(
    indiaReport.warningSummary.find(
      (item) => item.code === "WARN_SOURCE_FALLBACK",
    )?.count,
    2,
  );
});
