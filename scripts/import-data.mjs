/** Reproducible import. Network is needed only here, never while exploring the atlas. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const cache = ".data-cache";
await fs.mkdir(cache, { recursive: true });
await fs.mkdir("public/data", { recursive: true });
let previousCountries = [];
let previousSearch = [];
try {
  previousCountries = JSON.parse(await fs.readFile("data/countries.json", "utf8"));
  previousSearch = JSON.parse(await fs.readFile("data/search.json", "utf8"));
} catch {}
const date = new Date().toISOString().slice(0, 10);
async function json(url, filename) {
  const file = path.join(cache, filename);
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {}
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(90000),
        headers: {
          "User-Agent":
            "AtlasEducationalPrototype/1.0 (local open data importer)",
        },
      });
      if (r.status === 429) {
        const delay = Math.max(
          60000,
          Number(r.headers.get("retry-after") || 60) * 1000,
        );
        console.log("Wikidata rate limit; waiting", delay / 1000, "seconds");
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      if (!r.ok) throw Error(`${r.status} ${url}`);
      const data = await r.json();
      await fs.writeFile(file, JSON.stringify(data));
      return data;
    } catch (e) {
      if (i === 5) throw e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
}
const base =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const world = await json(
  base + "ne_50m_admin_0_countries.geojson",
  "world.json",
);
const adm = await json(
  base + "ne_10m_admin_1_states_provinces.geojson",
  "adm1.json",
);
const riverGeometry = await json(
  base + "ne_10m_rivers_lake_centerlines.geojson",
  "rivers.json",
);
const places = await json(
  base + "ne_10m_populated_places.geojson",
  "cities.json",
);
const france = await json(
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/FRA/ADM1/geoBoundaries-FRA-ADM1_simplified.geojson",
  "france.json",
);
// Natural Earth links Hokkaido to the island; use the administrative prefecture entity.
for (const f of adm.features)
  if (f.properties.wikidataid === "Q35581")
    f.properties.wikidataid = "Q1037393";
const sourceNE = {
  provider: "Natural Earth",
  url: "https://www.naturalearthdata.com/downloads/",
  retrievedAt: date,
  license: "Public domain",
};
const sourceFR = {
  provider: "IGN · geoBoundaries",
  url: "https://www.geoboundaries.org/api/current/gbOpen/FRA/ADM1/",
  retrievedAt: date,
  year: "2022",
  license: "Etalab Open License 2.0",
};
const idsFR = [
  "Q13917",
  "Q13947",
  "Q18578267",
  "Q18677875",
  "Q18677767",
  "Q18677983",
  "Q16994",
  "Q12130",
  "Q18678082",
  "Q18678265",
  "Q18338206",
  "Q15104",
  "Q14112",
];
const pilots = {
  FRA: {
    slug: "france",
    qid: "Q142",
    type: "Région",
    bounds: [-5.3, 41.3, 9.7, 51.2],
  },
  USA: {
    slug: "united-states",
    qid: "Q30",
    type: "État",
    bounds: [-125, 24, -66, 50],
  },
  DEU: { slug: "germany", qid: "Q183", type: "Land" },
  JPN: { slug: "japan", qid: "Q17", type: "Préfecture" },
  BRA: { slug: "brazil", qid: "Q155", type: "État" },
};
const features = {};
for (const iso of Object.keys(pilots)) {
  features[iso] =
    iso === "FRA"
      ? [
          ...france.features.map((f, i) => ({
            ...f,
            properties: {
              ...f.properties,
              name: f.properties.shapeName,
              name_fr: f.properties.shapeName,
              name_en: f.properties.shapeName,
              wikidataid: idsFR[i],
            },
          })),
          ...adm.features.filter(
            (f) =>
              f.properties.adm0_a3 === "FRA" &&
              f.properties.type_en === "Overseas department",
          ),
        ]
      : adm.features.filter((f) => f.properties.adm0_a3 === iso);
}
// Editorial city selections, identified by stable Wikidata IDs; all values come from source entities.
const rich = {
  Q13917: ["Q90", "Q621", "Q172455"],
  Q15104: ["Q23482", "Q33959", "Q44160"],
  Q18338206: ["Q456", "Q1289", "Q42168"],
  Q99: ["Q65", "Q16553", "Q62"],
  Q1439: ["Q16555", "Q16557", "Q16559"],
  Q1393: ["Q174224", "Q33518", "Q506586"],
  Q1384: ["Q60", "Q40435", "Q24861"],
  Q980: ["Q1726", "Q2090", "Q2749"],
  Q64: ["Q64"],
  Q1198: ["Q365", "Q1718", "Q1295"],
  Q1490: ["Q208863", "Q269634", "Q210628"],
  Q1037393: ["Q37951", "Q200740", "Q26418"],
  Q122723: ["Q35765", "Q193428", "Q243863"],
  Q175: ["Q174", "Q171617", "Q81882"],
  Q41428: ["Q8678", "Q178725", "Q189043"],
  Q40040: ["Q40236", "Q926713", "Q1750426"],
};
const entities = {};
async function importEntities(ids) {
  const missing = [];
  for (const id of ids) {
    try {
      const data = JSON.parse(
        await fs.readFile(path.join(cache, id + ".json"), "utf8"),
      );
      entities[id] = data.entities[id];
    } catch {
      missing.push(id);
    }
  }
  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40);
    const data = await json(
      "https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels%7Cclaims&languages=fr%7Cen&format=json&ids=" +
        batch.join("%7C"),
      "batch-" +
        createHash("sha256")
          .update(batch.join("-"))
          .digest("hex")
          .slice(0, 20) +
        ".json",
    );
    for (const id of batch) {
      entities[id] = data.entities[id];
      await fs.writeFile(
        path.join(cache, id + ".json"),
        JSON.stringify({ entities: { [id]: data.entities[id] } }),
      );
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const wanted = [
  ...new Set([
    ...Object.values(pilots).map((p) => p.qid),
    ...Object.values(features)
      .flat()
      .map((f) => f.properties.wikidataid),
    ...Object.values(rich).flat(),
  ]),
];
console.log(`Importing ${wanted.length} entities…`);
await importEntities(wanted);
const claims = (id, p) => {
  const list = (entities[id]?.claims?.[p] ?? []).filter(
    (c) =>
      c.rank !== "deprecated" &&
      c.mainsnak.snaktype === "value" &&
      !c.qualifiers?.P582,
  );
  const preferred = list.filter((c) => c.rank === "preferred");
  return (preferred.length ? preferred : list).sort((a, b) =>
    (b.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? "").localeCompare(
      a.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? "",
    ),
  );
};
const value = (id, p) => claims(id, p)[0]?.mainsnak.datavalue?.value;
const refs = (id, p) =>
  claims(id, p)
    .map((c) => c.mainsnak.datavalue?.value?.id)
    .filter(Boolean);
const label = (id) =>
  entities[id]?.labels?.fr?.value ?? entities[id]?.labels?.en?.value;
const related = [
  ...new Set(
    wanted.flatMap((id) =>
      ["P36", "P610", "P206", "P4552"].flatMap((p) => refs(id, p)),
    ),
  ),
].filter((id) => !entities[id]);
console.log(`Importing ${related.length} related places…`);
await importEntities(related);
const mountainIds = [
  ...new Set(
    Object.keys(rich).flatMap((id) =>
      refs(id, "P610").flatMap((peak) => refs(peak, "P4552")),
    ),
  ),
].filter((id) => !entities[id]);
await importEntities(mountainIds);
function inRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function inside(p, g) {
  const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polygons.some(
    (rings) => inRing(p, rings[0]) && !rings.slice(1).some((r) => inRing(p, r)),
  );
}
function regionalRivers(g) {
  const b = bounds(g);
  return riverGeometry.features
    .filter((f) => f.properties.name)
    .filter((f) => {
      const points =
        f.geometry.type === "LineString"
          ? f.geometry.coordinates
          : f.geometry.coordinates.flat();
      return points.some(
        (p) =>
          p[0] >= b[0] &&
          p[0] <= b[2] &&
          p[1] >= b[1] &&
          p[1] <= b[3] &&
          inside(p, g),
      );
    })
    .sort((a, b) => a.properties.scalerank - b.properties.scalerank)
    .map((f) => f.properties.name)
    .filter((n, i, a) => a.indexOf(n) === i)
    .slice(0, 4);
}
const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const area = (id) => {
  const v = value(id, "P2046");
  if (!v) return;
  const n = Number(v.amount);
  if (v.unit.endsWith("/Q712226")) return n;
  if (v.unit.endsWith("/Q25343")) return n / 1e6;
  if (v.unit.endsWith("/Q35852")) return n * 2.589988;
  return undefined;
};
function facts(id) {
  const pop = value(id, "P1082");
  const peak = refs(id, "P610")[0];
  const elevation = value(peak, "P2044");
  return {
    capital:
      refs(id, "P36").map(label).filter(Boolean).join(" / ") ||
      (["Q64", "Q1055", "Q61"].includes(id) ? label(id) : undefined),
    population: pop ? Number(pop.amount) : undefined,
    populationYear: claims(
      id,
      "P1082",
    )[0]?.qualifiers?.P585?.[0]?.datavalue?.value?.time?.slice(1, 5),
    areaKm2: area(id),
    highestPoint:
      peak && label(peak)
        ? {
            name: label(peak),
            elevationMeters: elevation?.unit?.endsWith("/Q11573")
              ? Number(elevation.amount)
              : undefined,
          }
        : undefined,
    mountainRange:
      [...refs(id, "P4552"), ...refs(peak, "P4552")]
        .map(label)
        .filter(Boolean)
        .join(", ") || undefined,
    sources: [
      {
        provider: "Wikidata",
        url: `https://www.wikidata.org/wiki/${id}`,
        retrievedAt: date,
        license: "CC0",
      },
    ],
  };
}
function bounds(g) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  function walk(c) {
    if (typeof c[0] === "number") {
      b = [
        Math.min(b[0], c[0]),
        Math.min(b[1], c[1]),
        Math.max(b[2], c[0]),
        Math.max(b[3], c[1]),
      ];
    } else c.forEach(walk);
  }
  walk(g.coordinates);
  if (b[2] - b[0] > 180) {
    let xs = [];
    function longitude(c) {
      if (typeof c[0] === "number") xs.push(c[0] < 0 ? c[0] + 360 : c[0]);
      else c.forEach(longitude);
    }
    longitude(g.coordinates);
    const left = Math.min(...xs),
      right = Math.max(...xs);
    if (right - left < b[2] - b[0]) {
      b[0] = left > 180 ? left - 360 : left;
      b[2] = right > 180 && left > 180 ? right - 360 : right;
    }
  }
  return b;
}
function geometry(g) {
  function round(c) {
    return typeof c[0] === "number"
      ? c.map((n) => Math.round(n * 1e4) / 1e4)
      : c.map(round);
  }
  return { type: g.type, coordinates: round(g.coordinates) };
}
const continent = {
  "North America": "Amérique du Nord",
  "South America": "Amérique du Sud",
  Europe: "Europe",
  Asia: "Asie",
  Africa: "Afrique",
  Oceania: "Océanie",
  Antarctica: "Antarctique",
  "Seven seas (open ocean)": "Océanie",
};
const countries = world.features
  .map((f) => {
    const p = f.properties;
    const id = p.ADM0_A3;
    const pilot = pilots[id];
    const cap = places.features.find(
      (x) => x.properties.ADM0_A3 === id && x.properties.ADM0CAP === 1,
    );
    return {
      id,
      slug: pilot?.slug ?? slug(p.NAME_EN || p.ADMIN),
      names: { fr: p.NAME_FR || p.NAME, en: p.NAME_EN },
      iso2: p.ISO_A2_EH,
      iso3: id,
      continent: continent[p.CONTINENT] ?? p.CONTINENT,
      population: p.POP_EST > 0 ? p.POP_EST : undefined,
      populationYear: String(p.POP_YEAR),
      capital: cap?.properties.NAME_FR ?? cap?.properties.NAME,
      geometryId: id,
      labelPoint: [p.LABEL_X, p.LABEL_Y],
      bounds: pilot?.bounds ?? bounds(f.geometry),
      ...(pilot
        ? {
            ...facts(pilot.qid),
            pilot: true,
            administrativeType: pilot.type,
            divisionCount: features[id].length,
          }
        : {}),
      sources: [sourceNE, ...(pilot ? facts(pilot.qid).sources : [])],
    };
  })
  .map((country) => {
    const previous = previousCountries.find(
      (item) => item.id === country.id && item.pilot && !pilots[item.id],
    );
    return previous ?? country;
  })
  .sort((a, b) => a.names.fr.localeCompare(b.names.fr, "fr"));
const preservedCountryIds = new Set(
  countries
    .filter((country) => country.pilot && !pilots[country.id])
    .map((country) => country.id),
);
const countryQ = new Map(
  world.features.map((f) => [f.properties.WIKIDATAID, f.properties.ADM0_A3]),
);
for (const c of countries)
  if (pilots[c.id])
    c.neighborIds = refs(pilots[c.id].qid, "P47")
      .map((id) => countryQ.get(id))
      .filter(Boolean);
const worldGeo = {
  type: "FeatureCollection",
  features: world.features.map((f) => ({
    type: "Feature",
    properties: {
      id: f.properties.ADM0_A3,
      name: f.properties.NAME_FR || f.properties.NAME,
      color: f.properties.MAPCOLOR9 % 4,
    },
    geometry: geometry(f.geometry),
  })),
};
const search = countries.map((c) => ({
  id: c.id,
  name: c.names.fr,
  aliases: [c.names.en, c.iso2, c.iso3].filter(Boolean),
  context: `Pays · ${c.continent}`,
  href: `/country/${c.slug}/`,
  countryId: c.id,
}));
for (const [iso, ff] of Object.entries(features)) {
  const country = countries.find((c) => c.id === iso);
  const valid = new Set(ff.map((f) => f.properties.wikidataid));
  const cities = [];
  const rivers = [];
  const divisions = ff
    .map((f) => {
      const p = f.properties,
        id = p.wikidataid;
      let en = p.name_en ?? p.name;
      const slugOverrides = {
        Q61: "district-of-columbia",
        Q1490: "tokyo",
        Q1037393: "hokkaido",
        Q122723: "osaka",
        Q980: "bavaria",
        Q1198: "north-rhine-westphalia",
      };
      const cityIds = (rich[id] ?? []).filter((q) => {
        const coord = value(q, "P625");
        if (!coord) return false;
        cities.push({
          id: q,
          name: label(q),
          latitude: coord.latitude,
          longitude: coord.longitude,
          population: value(q, "P1082")
            ? Number(value(q, "P1082").amount)
            : undefined,
          populationYear: claims(
            q,
            "P1082",
          )[0]?.qualifiers?.P585?.[0]?.datavalue?.value?.time?.slice(1, 5),
          sources: [
            {
              provider: "Wikidata",
              url: `https://www.wikidata.org/wiki/${q}`,
              retrievedAt: date,
              license: "CC0",
            },
          ],
        });
        return true;
      });
      const naturalRivers = rich[id]
        ? regionalRivers(f.geometry).map((name) => {
            const q = "ne-" + slug(name);
            rivers.push({ id: q, name, divisionIds: [id] });
            return q;
          })
        : [];
      const riverIds = [
        ...naturalRivers,
        ...[
          ...new Set([
            ...(rich[id] ?? []).flatMap((city) =>
              refs(city, "P206").slice(0, 3),
            ),
            ...refs(id, "P206"),
          ]),
        ]
          .filter((q) => label(q))
          .slice(0, 8)
          .map((q) => {
            rivers.push({ id: q, name: label(q), divisionIds: [id] });
            return q;
          }),
      ];
      return {
        id,
        slug: slugOverrides[id] ?? slug(iso === "FRA" ? p.name : en),
        countryId: iso,
        names: {
          fr:
            id === "Q61"
              ? "Washington D.C."
              : (p.name_fr ?? label(id) ?? p.name),
          en,
          local: p.name,
        },
        administrativeLevel: 1,
        administrativeType:
          p.type_en === "Federal District"
            ? "District fédéral"
            : pilots[iso].type,
        ...facts(id),
        geometryId: id,
        bounds: bounds(f.geometry),
        cityIds,
        riverIds,
        neighborIds: refs(id, "P47").filter((q) => valid.has(q) && q !== id),
        enriched: !!rich[id],
        sources: [
          iso === "FRA" && p.shapeISO ? sourceFR : sourceNE,
          ...facts(id).sources,
        ],
      };
    })
    .sort((a, b) => a.names.fr.localeCompare(b.names.fr, "fr"));
  // Berlin is both a city and a Land; other cities would be outside the selected territory.
  const berlin = divisions.find((d) => d.id === "Q64");
  if (berlin)
    berlin.description =
      "Berlin est une ville-État : la ville constitue à elle seule le Land. Les villes voisines appartiennent au Brandebourg.";
  for (const d of divisions)
    search.push({
      id: d.id,
      name: d.names.fr,
      aliases: [d.names.en, d.names.local].filter(Boolean),
      context: `${d.administrativeType} · ${country.names.fr}`,
      href: `/country/${country.slug}/${d.slug}/`,
      countryId: iso,
      enriched: d.enriched,
    });
  await fs.writeFile(
    `public/data/${iso}.json`,
    JSON.stringify({
      divisions,
      cities: [...new Map(cities.map((c) => [c.id, c])).values()],
      rivers: [...new Map(rivers.map((r) => [r.id, r])).values()],
    }),
  );
  await fs.writeFile(
    `public/geo/${iso}.json`,
    JSON.stringify({
      type: "FeatureCollection",
      features: ff.map((f) => ({
        type: "Feature",
        properties: {
          id: f.properties.wikidataid,
          name: divisions.find((d) => d.id === f.properties.wikidataid).names
            .fr,
        },
        geometry: geometry(f.geometry),
      })),
    }),
  );
  console.log(
    iso,
    divisions.length,
    "divisions;",
    divisions.filter((d) => !d.capital).length,
    "missing capitals;",
    divisions.filter((d) => !d.population).length,
    "missing populations",
  );
}
search.push(
  ...previousSearch.filter(
    (entry) =>
      preservedCountryIds.has(entry.countryId) &&
      entry.href.split("/").filter(Boolean).length > 2,
  ),
);
await fs.writeFile("data/countries.json", JSON.stringify(countries));
await fs.writeFile("data/search.json", JSON.stringify(search));
await fs.writeFile("public/geo/world.json", JSON.stringify(worldGeo));
console.log("Import complete.");
