import { fetchJson } from "./cache.mjs";
import { SOURCES } from "./config.mjs";
import { pointInGeometry } from "./geometry.mjs";
import { slugify } from "./slug.mjs";

export async function fetchCities(iso3, boundaries, options = {}) {
  const places = await fetchJson(SOURCES.cities, "cities.json", options);
  const candidates = places.features.filter(
    (feature) => feature.properties.ADM0_A3 === iso3,
  );
  const retrievedAt = new Date().toISOString();
  const cities = [];
  const cityIdsByBoundary = new Map();

  for (const boundary of boundaries) {
    const selected = candidates
      .filter((feature) =>
        pointInGeometry(
          [feature.properties.LONGITUDE, feature.properties.LATITUDE],
          boundary.geometry,
        ),
      )
      .sort(
        (left, right) =>
          Number(right.properties.POP_MAX ?? 0) -
          Number(left.properties.POP_MAX ?? 0),
      )
      .slice(0, 3);
    const ids = [];
    for (const feature of selected) {
      const properties = feature.properties;
      const id =
        properties.WIKIDATAID ??
        `ne-${properties.NE_ID ?? slugify(properties.NAME)}`;
      ids.push(id);
      cities.push({
        id,
        name: properties.NAME_FR ?? properties.NAMEPAR ?? properties.NAME,
        slug: slugify(properties.NAMEPAR ?? properties.NAME),
        names: {
          en: properties.NAME_EN ?? properties.NAME,
          local: properties.NAMEPAR ?? properties.NAME,
        },
        countryId: iso3,
        divisionId: boundary.sourceId,
        population:
          Number(properties.POP_MAX) >= 0
            ? Number(properties.POP_MAX)
            : undefined,
        populationYear: properties.POP_YEAR
          ? String(properties.POP_YEAR)
          : undefined,
        latitude: Number(properties.LATITUDE),
        longitude: Number(properties.LONGITUDE),
        roles: ["major-city"],
        sources: [
          {
            provider: "Natural Earth",
            url: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/",
            retrievedAt,
            license: "Public domain",
          },
        ],
      });
    }
    cityIdsByBoundary.set(boundary.sourceId, ids);
  }

  return {
    cities: [...new Map(cities.map((city) => [city.id, city])).values()],
    cityIdsByBoundary,
  };
}
