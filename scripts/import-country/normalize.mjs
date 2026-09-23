import {
  claimValue,
  currentClaims,
  entityIds,
  entityLabel,
} from "./fetch-wikidata.mjs";
import {
  geometryBounds,
  inferGeometryNeighbors,
  roundGeometry,
} from "./geometry.mjs";
import {
  allocateStableSlugs,
  comparableName,
  slugify,
} from "./slug.mjs";
import { warning } from "./warnings.mjs";

function quantity(entity, property) {
  const value = claimValue(entity, property);
  if (!value?.amount) return undefined;
  return { amount: Number(value.amount), unit: value.unit };
}

function areaKm2(entity) {
  const area = quantity(entity, "P2046");
  if (!area || !Number.isFinite(area.amount)) return undefined;
  if (area.unit.endsWith("/Q712226")) return area.amount;
  if (area.unit.endsWith("/Q25343")) return area.amount / 1e6;
  if (area.unit.endsWith("/Q35852")) return area.amount * 2.589988;
  return undefined;
}

function population(entity) {
  const claim = currentClaims(entity, "P1082")[0];
  const amount = Number(claim?.mainsnak.datavalue?.value?.amount);
  if (!Number.isFinite(amount)) return {};
  const time = claim.qualifiers?.P585?.[0]?.datavalue?.value?.time;
  const year = time ? Number(time.slice(1, 5)) : undefined;
  return {
    population: amount,
    populationYear: year ? String(year) : undefined,
    populationValue: { amount, year },
  };
}

function elevationMeters(entity) {
  const elevation = quantity(entity, "P2044");
  if (!elevation) return undefined;
  if (elevation.unit.endsWith("/Q11573")) return elevation.amount;
  return undefined;
}

function wikidataSource(id, retrievedAt) {
  return {
    provider: "Wikidata",
    url: `https://www.wikidata.org/wiki/${id}`,
    retrievedAt,
    license: "CC0",
  };
}

function facts(id, entities, retrievedAt) {
  const entity = entities[id];
  if (!entity) return { sources: [] };
  const capitalIds = entityIds(entity, "P36");
  const peakId = entityIds(entity, "P610")[0];
  const peak = entities[peakId];
  const ranges = [...entityIds(entity, "P4552"), ...entityIds(peak, "P4552")];
  return {
    capital:
      capitalIds
        .map((item) => entityLabel(entities[item]))
        .filter(Boolean)
        .join(" / ") || undefined,
    capitalIds,
    ...population(entity),
    populationSourceId: id,
    areaKm2: areaKm2(entity),
    highestPoint:
      peakId && entityLabel(peak)
        ? {
            name: entityLabel(peak),
            elevationMeters: elevationMeters(peak),
          }
        : undefined,
    mountainRange:
      ranges
        .map((item) => entityLabel(entities[item]))
        .filter(Boolean)
        .join(", ") || undefined,
    sources: [wikidataSource(id, retrievedAt)],
  };
}

function withFallbackFacts(primary, fallback) {
  if (!fallback) return primary;
  return {
    capital: primary.capital ?? fallback.capital,
    capitalIds: primary.capitalIds?.length
      ? primary.capitalIds
      : fallback.capitalIds,
    population: primary.population ?? fallback.population,
    populationYear: primary.populationYear ?? fallback.populationYear,
    populationSourceId:
      primary.population != null
        ? primary.populationSourceId
        : fallback.populationSourceId,
    areaKm2: primary.areaKm2 ?? fallback.areaKm2,
    highestPoint: primary.highestPoint ?? fallback.highestPoint,
    mountainRange: primary.mountainRange ?? fallback.mountainRange,
    sources: dedupeSources([...primary.sources, ...fallback.sources]),
  };
}

function dedupeSources(sources) {
  return [
    ...new Map(
      sources.map((source) => [`${source.provider}:${source.url}`, source]),
    ).values(),
  ];
}

function makeCapitalCity(id, entity, iso3, divisionId, retrievedAt) {
  const coordinate = claimValue(entity, "P625");
  if (!coordinate) return undefined;
  const cityPopulation = population(entity);
  const name = entityLabel(entity);
  if (!name) return undefined;
  return {
    id,
    name,
    slug: slugify(entityLabel(entity, "en") ?? name),
    names: {
      fr: entityLabel(entity, "fr"),
      en: entityLabel(entity, "en"),
    },
    countryId: iso3,
    divisionId,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    population: cityPopulation.population,
    populationYear: cityPopulation.populationYear,
    roles: ["regional-capital", "major-city"],
    sources: [wikidataSource(id, retrievedAt)],
  };
}

export function normalizeCountry({
  iso3,
  existingCountry,
  existingData,
  boundaries,
  administrativeType,
  boundarySource,
  wikidata,
  cityData,
  hydrography,
  worldFeatures,
}) {
  const retrievedAt = wikidata.retrievedAt;
  const warnings = [];
  const entities = wikidata.entities;
  const qidToInternalId = new Map();
  const internalIdBySource = new Map();
  const existingById = new Map(
    (existingData?.divisions ?? []).map((division) => [division.id, division]),
  );
  const existingByName = new Map(
    (existingData?.divisions ?? []).map((division) => [
      comparableName(division.names.en ?? division.names.fr),
      division,
    ]),
  );
  const stableSlugs = new Map();

  for (const boundary of boundaries) {
    const qid = wikidata.qidBySourceId.get(boundary.sourceId);
    const previous =
      existingById.get(qid ?? boundary.sourceId) ??
      existingByName.get(comparableName(boundary.name));
    const internalId = previous?.id ?? qid ?? boundary.sourceId;
    internalIdBySource.set(boundary.sourceId, internalId);
    if (qid) qidToInternalId.set(qid, internalId);
    else
      warnings.push(
        warning(
          "WARN_MISSING_WIKIDATA_ID",
          `${boundary.name}: aucun identifiant Wikidata relié au code ${boundary.isoCode ?? boundary.sourceId}.`,
        ),
      );
    if (previous?.slug) stableSlugs.set(internalId, previous.slug);
    if (previous?.id && qid && previous.id !== qid)
      warnings.push(
        warning(
          "WARN_ID_STABILITY_OVERRIDE",
          `${boundary.name}: l’ID public ${previous.id} est conservé malgré le nouveau lien Wikidata ${qid}.`,
        ),
      );
  }

  const geometryNeighbors = inferGeometryNeighbors(boundaries);
  const allCities = new Map(
    cityData.cities.map((city) => [city.id, { ...city }]),
  );
  const divisions = boundaries.map((boundary) => {
    const qid = wikidata.qidBySourceId.get(boundary.sourceId);
    const id = internalIdBySource.get(boundary.sourceId);
    const entity = entities[qid];
    const primaryFacts = qid
      ? facts(qid, entities, retrievedAt)
      : { sources: [] };
    const fallbackQid = wikidata.fallbackQidBySourceId.get(boundary.sourceId);
    if (fallbackQid)
      warnings.push(
        warning(
          "WARN_SOURCE_FALLBACK",
          `${boundary.name}: ${fallbackQid} complète les faits absents de ${qid}.`,
        ),
      );
    const sourcedFacts = withFallbackFacts(
      primaryFacts,
      fallbackQid ? facts(fallbackQid, entities, retrievedAt) : undefined,
    );
    const previous =
      existingById.get(id) ?? existingByName.get(comparableName(boundary.name));
    const names = {
      fr: entityLabel(entity, "fr") ?? boundary.names.fr ?? boundary.name,
      en: entityLabel(entity, "en") ?? boundary.names.en ?? boundary.name,
      local: boundary.names.local ?? boundary.name,
    };
    let cityIds = [
      ...(cityData.cityIdsByBoundary.get(boundary.sourceId) ?? []),
    ];
    let capitalName = sourcedFacts.capital;
    for (const cityId of cityIds) {
      const city = allCities.get(cityId);
      if (city) city.divisionId = id;
    }
    for (const capitalId of sourcedFacts.capitalIds ?? []) {
      let capital = allCities.get(capitalId);
      if (!capital) {
        const wikidataCapital = makeCapitalCity(
          capitalId,
          entities[capitalId],
          iso3,
          id,
          retrievedAt,
        );
        capital = wikidataCapital
          ? cityIds
              .map((cityId) => allCities.get(cityId))
              .find((city) => city?.slug === wikidataCapital.slug)
          : undefined;
        if (capital) {
          capitalName = capital.name;
          capital.sources = dedupeSources([
            ...(capital.sources ?? []),
            ...wikidataCapital.sources,
          ]);
        } else if (wikidataCapital) {
          capital = wikidataCapital;
          allCities.set(capitalId, capital);
        }
      }
      if (capital) {
        capital.divisionId = id;
        capital.roles = [
          ...new Set([...(capital.roles ?? []), "regional-capital"]),
        ];
        cityIds = [
          capital.id,
          ...cityIds.filter((item) => item !== capital.id),
        ].slice(0, 3);
      } else {
        warnings.push(
          warning(
            "WARN_CAPITAL_COORDINATES",
            `${names.fr}: capitale ${capitalId} sans coordonnées exploitables.`,
          ),
        );
      }
    }

    const wikidataNeighbors = qid ? entityIds(entity, "P47") : [];
    const unknownWikidataNeighbors = wikidataNeighbors.filter(
      (neighbor) => !qidToInternalId.has(neighbor),
    );
    if (unknownWikidataNeighbors.length)
      warnings.push(
        warning(
          "WARN_EXTERNAL_NEIGHBOR",
          `${names.fr}: voisins Wikidata hors ADM1 importé ignorés (${unknownWikidataNeighbors.join(", ")}).`,
        ),
      );
    const neighborIds = new Set(
      [...(geometryNeighbors.get(boundary.sourceId) ?? [])].map((sourceId) =>
        internalIdBySource.get(sourceId),
      ),
    );
    for (const neighbor of wikidataNeighbors) {
      const mapped = qidToInternalId.get(neighbor);
      if (mapped && mapped !== id) neighborIds.add(mapped);
    }

    const riverIds =
      hydrography.riverIdsByBoundary.get(boundary.sourceId) ?? [];
    return {
      id,
      slug: previous?.slug ?? slugify(names.en ?? names.fr),
      countryId: iso3,
      names,
      administrativeLevel: 1,
      administrativeType: boundary.administrativeType ?? administrativeType,
      capital: capitalName,
      population: sourcedFacts.population,
      populationYear: sourcedFacts.populationYear,
      populationValue: sourcedFacts.population
        ? {
            value: sourcedFacts.population,
            year: Number(sourcedFacts.populationYear) || undefined,
            source: wikidataSource(
              sourcedFacts.populationSourceId,
              retrievedAt,
            ),
          }
        : undefined,
      areaKm2: sourcedFacts.areaKm2,
      highestPoint: sourcedFacts.highestPoint,
      mountainRange: sourcedFacts.mountainRange,
      geometryId: id,
      bounds: geometryBounds(boundary.geometry),
      cityIds,
      riverIds,
      neighborIds: [...neighborIds].filter(Boolean).sort(),
      enriched:
        cityIds.length >= 2 ||
        riverIds.length > 0 ||
        Boolean(sourcedFacts.highestPoint),
      sources: dedupeSources([boundarySource, ...sourcedFacts.sources]),
    };
  });
  const generatedSlugs = new Map(
    divisions.map((division) => [division.id, division.slug]),
  );
  allocateStableSlugs(divisions, stableSlugs);
  for (const division of divisions) {
    if (
      !stableSlugs.has(division.id) &&
      division.slug !== generatedSlugs.get(division.id)
    )
      warnings.push(
        warning(
          "WARN_SLUG_COLLISION",
          `${division.names.fr}: collision du slug ${generatedSlugs.get(division.id)} résolue en ${division.slug}.`,
        ),
      );
  }

  const validCityIds = new Set(
    divisions.flatMap((division) => division.cityIds),
  );
  const cities = [...allCities.values()]
    .filter((city) => validCityIds.has(city.id))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
  const idBySource = internalIdBySource;
  const rivers = hydrography.rivers
    .map((river) => ({
      ...river,
      divisionIds: river.divisionIds.map((sourceId) =>
        idBySource.get(sourceId),
      ),
    }))
    .filter((river) => river.divisionIds.every(Boolean));

  const countryQid = wikidata.countryQid;
  const countryFacts = facts(countryQid, entities, retrievedAt);
  const countryQidToIso = new Map(
    worldFeatures.map((feature) => [
      feature.properties.WIKIDATAID,
      feature.properties.ADM0_A3,
    ]),
  );
  const country = {
    ...existingCountry,
    pilot: true,
    administrativeType,
    divisionCount: divisions.length,
    capital: countryFacts.capital ?? existingCountry.capital,
    population: countryFacts.population ?? existingCountry.population,
    populationYear:
      countryFacts.populationYear ?? existingCountry.populationYear,
    populationValue: countryFacts.population
      ? {
          value: countryFacts.population,
          year: Number(countryFacts.populationYear) || undefined,
          source: wikidataSource(countryQid, retrievedAt),
        }
      : existingCountry.populationValue,
    areaKm2: countryFacts.areaKm2 ?? existingCountry.areaKm2,
    highestPoint: countryFacts.highestPoint ?? existingCountry.highestPoint,
    mountainRange: countryFacts.mountainRange ?? existingCountry.mountainRange,
    neighborIds: entityIds(entities[countryQid], "P47")
      .map((qid) => countryQidToIso.get(qid))
      .filter(Boolean),
    sources: dedupeSources([
      ...(existingCountry.sources ?? []),
      ...countryFacts.sources,
    ]),
  };

  const geojson = {
    type: "FeatureCollection",
    features: boundaries.map((boundary) => {
      const id = internalIdBySource.get(boundary.sourceId);
      const division = divisions.find((item) => item.id === id);
      return {
        type: "Feature",
        properties: { id, name: division.names.fr },
        geometry: roundGeometry(boundary.geometry),
      };
    }),
  };

  return {
    country,
    data: {
      divisions: divisions.sort((left, right) =>
        left.names.fr.localeCompare(right.names.fr, "fr"),
      ),
      cities,
      rivers,
    },
    geojson,
    warnings,
  };
}
