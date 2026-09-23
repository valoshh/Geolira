import { cacheRetrievedAt, fetchJson } from "./cache.mjs";
import { COUNTRY_OVERRIDES, SOURCES } from "./config.mjs";
import { mergePolygonGeometries, roundGeometry } from "./geometry.mjs";
import { warning } from "./warnings.mjs";

function groupFeatures(features, override) {
  const mode = override.boundaryGrouping;
  if (!["region-code", "region-code-and-name"].includes(mode))
    return features.map((feature) => ({
      sourceId:
        feature.properties.wikidataid ??
        feature.properties.iso_3166_2 ??
        feature.properties.adm1_code,
      isoCode: feature.properties.iso_3166_2,
      wikidataFactFallback:
        override.wikidataFactFallbacks?.[feature.properties.iso_3166_2],
      name:
        feature.properties.name_local ??
        feature.properties.name_en ??
        feature.properties.name,
      names: {
        fr: feature.properties.name_fr,
        en: feature.properties.name_en,
        local: feature.properties.name_local ?? feature.properties.name,
      },
      administrativeType:
        override.administrativeTypeOverrides?.[feature.properties.name] ??
        override.administrativeTypeTranslations?.[feature.properties.type_en] ??
        feature.properties.type_en,
      geometry: roundGeometry(feature.geometry),
    }));

  const groups = new Map();
  for (const feature of features) {
    const regionCode = feature.properties.region_cod;
    const name = feature.properties.region;
    if (!regionCode || !name)
      throw new Error(
        "Natural Earth ne fournit pas region_cod/region pour toutes les unités.",
      );
    const groupKey =
      mode === "region-code-and-name" ? `${regionCode}:${name}` : regionCode;
    const group = groups.get(groupKey) ?? {
      code:
        override.regionCodeOverrides?.[groupKey] ??
        override.regionCodeOverrides?.[regionCode] ??
        regionCode.replace(".", "-"),
      name,
      features: [],
    };
    group.features.push(feature);
    groups.set(groupKey, group);
  }
  return [...groups.values()].map((group) => ({
    sourceId: group.code,
    isoCode: group.code,
    name: group.name,
    names: { local: group.name },
    administrativeType:
      override.administrativeTypeOverrides?.[group.name] ??
      override.administrativeType ??
      "Region",
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
  const boundaries = groupFeatures(rawFeatures, override);
  for (const [sourceId, targetId] of Object.entries(
    override.boundaryMerges ?? {},
  )) {
    const sourceIndex = boundaries.findIndex(
      (boundary) => boundary.sourceId === sourceId,
    );
    const target = boundaries.find(
      (boundary) => boundary.sourceId === targetId,
    );
    if (sourceIndex < 0 || !target)
      throw new Error(
        `${iso3}: fusion de frontière impossible (${sourceId} → ${targetId}).`,
      );
    target.geometry = roundGeometry(
      mergePolygonGeometries([
        target.geometry,
        boundaries[sourceIndex].geometry,
      ]),
    );
    boundaries.splice(sourceIndex, 1);
  }
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
        warning(
          "WARN_BOUNDARY_COUNT_MISMATCH",
          `geoBoundaries annonce ${advertised} ADM1, contre ${boundaries.length} unités cohérentes issues de Natural Earth; cette géométrie candidate a été écartée.`,
        ),
      );
    }
  } catch (error) {
    warnings.push(
      warning(
        "WARN_SOURCE_UNAVAILABLE",
        `Métadonnées geoBoundaries indisponibles: ${error instanceof Error ? error.message : String(error)}`,
      ),
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
      retrievedAt: await cacheRetrievedAt("adm1.json"),
      license: "Public domain",
    },
    warnings,
  };
}
