import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  density,
  normalize,
  searchTerritories,
  validateCountryData,
} from "../lib/geography";
import { createCapitalQuestion } from "../lib/quiz";
import countries from "../data/countries.json";
import index from "../data/search.json";
import type { CountryData, SearchEntry } from "../types/geography";
test("search matches accents, English aliases and administrative context", () => {
  for (const [query, id] of [
    ["Bavaria", "Q980"],
    ["California", "Q99"],
    ["Hokkaido", "Q1037393"],
    ["Provence Alpes Cote d Azur", "Q15104"],
    ["Delaware", "Q1393"],
  ]) {
    assert.equal(searchTerritories(index as SearchEntry[], query)[0]?.id, id);
  }
  assert.equal(normalize("Île-de-France"), "ile de france");
});
test("all pilot divisions have unique routes, geometries, capitals and populations", () => {
  for (const [iso, count] of Object.entries({
    FRA: 18,
    USA: 51,
    DEU: 16,
    JPN: 47,
    BRA: 27,
  })) {
    const data = JSON.parse(
      fs.readFileSync(`public/data/${iso}.json`, "utf8"),
    ) as CountryData;
    const geo = JSON.parse(fs.readFileSync(`public/geo/${iso}.json`, "utf8"));
    assert.equal(data.divisions.length, count);
    assert.equal(geo.features.length, count);
    assert.equal(new Set(data.divisions.map((d) => d.slug)).size, count);
    for (const d of data.divisions) {
      assert.ok(d.capital, `${d.names.fr}: missing capital`);
      assert.ok(d.population, `${d.names.fr}: missing population`);
      assert.ok(
        geo.features.some(
          (f: { properties: { id: string } }) => f.properties.id === d.id,
        ),
      );
      for (const n of d.neighborIds ?? [])
        assert.ok(data.divisions.some((x) => x.id === n));
      for (const c of d.cityIds ?? [])
        assert.ok(data.cities.some((x) => x.id === c));
      assert.ok(d.sources.length > 0);
    }
  }
});
test("Delaware neighbors resolve and deep link is exact", () => {
  const us = JSON.parse(
    fs.readFileSync("public/data/USA.json", "utf8"),
  ) as CountryData;
  assert.deepEqual(
    [...us.divisions.find((d) => d.id === "Q1393")!.neighborIds!].sort(),
    ["Q1391", "Q1400", "Q1408"].sort(),
  );
  assert.equal(
    index.find((s) => s.id === "Q15104")?.href,
    "/country/france/provence-alpes-cote-d-azur/",
  );
  assert.ok(countries.some((c) => c.slug === "united-states"));
});
test("every search route is unique", () => {
  assert.equal(new Set(index.map((s) => s.href)).size, index.length);
});
test("format and quiz helpers use source data", () => {
  assert.equal(Math.round(density(100, 4)!), 25);
  const us = JSON.parse(
    fs.readFileSync("public/data/USA.json", "utf8"),
  ) as CountryData;
  const question = createCapitalQuestion(us.divisions, 1);
  assert.equal(question?.choices?.length, 4);
  assert.ok(question?.correctAnswer);
  assert.deepEqual(validateCountryData(us), []);
});
