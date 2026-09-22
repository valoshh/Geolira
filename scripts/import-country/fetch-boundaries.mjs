import { fetchJson } from "./cache.mjs";
import { COUNTRY_OVERRIDES, SOURCES } from "./config.mjs";
import { mergePolygonGeometries, roundGeometry } from "./geometry.mjs";

function groupFeatures(features, mode) {
  if (mode !== "region-code")
    return features.map((feature) => ({
      sourceId:
        feature.properties.wikidataid ??
        feature.properties.iso_3166_2 ??
        feature.properties.adm1_code,
      isoCode: feature.properties.iso_3166_2,
      name:
        feature.properties.name_local ??
        feature.properties.name_en ??
        feature.properties.name,
      names: {
        fr: feature.properties.name_fr,
        en: feature.properties.name_en,
        local: feature.properties.name_local ?? feature.properties.name,
      },
      administrativeType: feature.properties.type_en,
      geometry: roundGeometry(feature.geometry),
    }));

  const groups = new Map();
  for (const feature of features) {
    const code = feature.properties.region_cod;
    const name = feature.properties.region;
    if (!code || !name)
      throw new Error(
        "Natural Earth ne fournit pas region_cod/region pour toutes les unités.",
      );
    const group = groups.get(code) ?? { code, name, features: [] };
    group.features.push(feature);
    groups.set(code, group);
  }
  return [...groups.values()].map((group) => ({
    sourceId: group.code,
    isoCode: group.code,
    name: group.name,
    names: { local: group.name },
    administrativeType: "Region",
    geometry: roundGeometry(
      mergePolygonGeometries(group.features.map((feature) => feature.geometry)),
    ),
  }));
}

export async function fetchBoundaries(iso3, options = {}) {
  const [world, adm1] = await Promise.all([
    fetchJson(SOURCES.world, "world.json", options),
    fetchJson(SOURCES.adm1, "adm1.json", options),
  ]);
  const countryFeature = world.features.find(
    (feature) => feature.properties.ADM0_A3 === iso3,
  );
  if (!countryFeature)
    throw new Error(`Code ISO3 inconnu dans Natural Earth: ${iso3}`);

  const rawFeatures = adm1.features.filter(
    (feature) => feature.properties.adm0_a3 === iso3,
  );
  if (!rawFeatures.length)
    throw new Error(`Aucune subdivision Natural Earth trouvée pour ${iso3}.`);

  const override = COUNTRY_OVERRIDES[iso3] ?? {};
  const boundaries = groupFeatures(rawFeatures, override.boundaryGrouping);
  const warnings = [];

  try {
    const metadata = await fetchJson(
      SOURCES.geoBoundaries(iso3),
      `geoboundaries-${iso3}-ADM1-meta.json`,
      options,
    );
    const advertised = Number(metadata.admUnitCount);
    if (Number.isFinite(advertised) && advertised !== boundaries.length) {
      warnings.push(
        `geoBoundaries annonce ${advertised} ADM1, contre ${boundaries.length} unités cohérentes issues de Natural Earth; cette géométrie candidate a été écartée.`,
      );
    }
  } catch (error) {
    warnings.push(
      `Métadonnées geoBoundaries indisponibles: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    boundaries,
    countryFeature,
    worldFeatures: world.features,
    administrativeType:
      override.administrativeType ??
      boundaries[0].administrativeType ??
      "Subdivision administrative",
    source: {
      provider: "Natural Earth",
      url: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/",
      retrievedAt: new Date().toISOString(),
      license: "Public domain",
    },
    warnings,
  };
}
