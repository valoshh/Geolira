import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { slugify } from "../scripts/import-country/slug.mjs";
import {
  calculateCoverage,
  coverageStatus,
} from "../scripts/import-country/report.mjs";
import { validateImport } from "../scripts/import-country/validate.mjs";
import { manifestEntry } from "../scripts/import-country/write-output.mjs";

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
  assert.deepEqual(manifestEntry(undefined, undefined), {
    status: "missing",
    adm1Count: 0,
    coverage: 0,
  });
});

test("validation detects duplicates and invalid relations", () => {
  const data = {
    divisions: [division(), division({ id: "Q2", neighborIds: ["UNKNOWN"] })],
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

test("Italy production output contains 20 valid, sourced ADM1 regions", () => {
  const countries = JSON.parse(fs.readFileSync("data/countries.json", "utf8"));
  const search = JSON.parse(fs.readFileSync("data/search.json", "utf8"));
  const data = JSON.parse(fs.readFileSync("public/data/ITA.json", "utf8"));
  const geojson = JSON.parse(fs.readFileSync("public/geo/ITA.json", "utf8"));
  const result = validateImport({
    iso3: "ITA",
    countries,
    data,
    geojson,
    search,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(data.divisions.length, 20);
  assert.equal(geojson.features.length, 20);
  assert.ok(
    data.divisions.every(
      (item) =>
        item.capital &&
        item.population >= 0 &&
        item.areaKm2 > 0 &&
        item.sources.every((source) => source.provider && source.retrievedAt),
    ),
  );
});
