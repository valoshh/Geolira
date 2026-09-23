import { createHash } from "node:crypto";
import { cacheRetrievedAt, fetchJson } from "./cache.mjs";
import { SOURCES } from "./config.mjs";
import { warning } from "./warnings.mjs";

export function currentClaims(entity, property) {
  const claims = (entity?.claims?.[property] ?? []).filter(
    (claim) =>
      claim.rank !== "deprecated" &&
      claim.mainsnak.snaktype === "value" &&
      !claim.qualifiers?.P582,
  );
  const preferred = claims.filter((claim) => claim.rank === "preferred");
  return (preferred.length ? preferred : claims).sort((left, right) =>
    (right.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? "").localeCompare(
      left.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? "",
    ),
  );
}

export function claimValue(entity, property) {
  return currentClaims(entity, property)[0]?.mainsnak.datavalue?.value;
}

export function entityIds(entity, property) {
  return currentClaims(entity, property)
    .map((claim) => claim.mainsnak.datavalue?.value?.id)
    .filter(Boolean);
}

export function entityLabel(entity, language = "fr") {
  return (
    entity?.labels?.[language]?.value ??
    entity?.labels?.fr?.value ??
    entity?.labels?.en?.value
  );
}

async function fetchEntities(ids, options) {
  const entities = {};
  const retrievedAt = [];
  const unique = [...new Set(ids.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 40) {
    const batch = unique.slice(index, index + 40);
    const hash = createHash("sha256")
      .update(batch.join("-"))
      .digest("hex")
      .slice(0, 20);
    const data = await fetchJson(
      SOURCES.wikidataEntities + batch.join("%7C"),
      `wikidata-batch-${hash}.json`,
      options,
    );
    retrievedAt.push(await cacheRetrievedAt(`wikidata-batch-${hash}.json`));
    Object.assign(entities, data.entities);
  }
  return {
    entities,
    retrievedAt: retrievedAt.sort().at(-1),
  };
}

export function selectIsoMappings(bindings) {
  const candidates = new Map();
  for (const binding of bindings) {
    const code = binding.iso.value;
    const qid = binding.item.value.split("/").at(-1);
    candidates.set(code, [...new Set([...(candidates.get(code) ?? []), qid])]);
  }
  const map = new Map();
  const warnings = [];
  for (const [code, ids] of [...candidates].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    ids.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    map.set(code, ids[0]);
    if (ids.length > 1)
      warnings.push(
        warning(
          "WARN_WIKIDATA_ID_COLLISION",
          `${code}: plusieurs entités administratives Wikidata (${ids.join(", ")}); ${ids[0]} retenue.`,
        ),
      );
  }
  return { map, warnings };
}

async function mapIsoCodes(isoCodes, countryQid, options) {
  if (!isoCodes.length) return { map: new Map(), warnings: [] };
  const values = isoCodes
    .map((code) => `"${code.replaceAll('"', '\\"')}"`)
    .join(" ");
  const query = `SELECT ?item ?iso WHERE { VALUES ?iso { ${values} } ?item wdt:P17 wd:${countryQid}; wdt:P300 ?iso; wdt:P31/wdt:P279* wd:Q56061. }`;
  const hash = createHash("sha256").update(query).digest("hex").slice(0, 20);
  const result = await fetchJson(
    SOURCES.wikidataSparql + encodeURIComponent(query),
    `wikidata-iso-${hash}.json`,
    options,
  );
  return selectIsoMappings(result.results.bindings);
}

export async function fetchWikidata(countryQid, boundaries, options = {}) {
  const isoMapping = await mapIsoCodes(
    boundaries.map((boundary) => boundary.isoCode).filter(Boolean),
    countryQid,
    options,
  );
  const isoToQid = isoMapping.map;
  const regionIds = boundaries.map(
    (boundary) =>
      isoToQid.get(boundary.isoCode) ??
      (boundary.sourceId.startsWith("Q") ? boundary.sourceId : undefined),
  );
  const fallbackIds = boundaries
    .map((boundary) => boundary.wikidataFactFallback)
    .filter(Boolean);
  const primary = await fetchEntities(
    [countryQid, ...regionIds, ...fallbackIds],
    options,
  );
  const entities = primary.entities;
  const relatedIds = [countryQid, ...regionIds, ...fallbackIds].flatMap((id) =>
    ["P36", "P610", "P206", "P4552", "P47"].flatMap((property) =>
      entityIds(entities[id], property),
    ),
  );
  const related = await fetchEntities(relatedIds, options);
  Object.assign(entities, related.entities);

  return {
    entities,
    countryQid,
    qidBySourceId: new Map(
      boundaries.map((boundary, index) => [
        boundary.sourceId,
        regionIds[index],
      ]),
    ),
    fallbackQidBySourceId: new Map(
      boundaries
        .filter((boundary) => boundary.wikidataFactFallback)
        .map((boundary) => [boundary.sourceId, boundary.wikidataFactFallback]),
    ),
    warnings: isoMapping.warnings,
    retrievedAt: [primary.retrievedAt, related.retrievedAt]
      .filter(Boolean)
      .sort()
      .at(-1),
  };
}
