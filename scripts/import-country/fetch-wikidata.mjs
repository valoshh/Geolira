import { createHash } from "node:crypto";
import { fetchJson } from "./cache.mjs";
import { SOURCES } from "./config.mjs";

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
    entity?.labels?.en?.value ??
    entity?.labels?.it?.value
  );
}

async function fetchEntities(ids, options) {
  const entities = {};
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
    Object.assign(entities, data.entities);
  }
  return entities;
}

async function mapIsoCodes(isoCodes, countryQid, options) {
  if (!isoCodes.length) return new Map();
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
  const map = new Map();
  const collisions = new Map();
  for (const binding of result.results.bindings) {
    const code = binding.iso.value;
    const qid = binding.item.value.split("/").at(-1);
    if (!map.has(code)) map.set(code, qid);
    else if (map.get(code) !== qid)
      collisions.set(code, [
        ...new Set([...(collisions.get(code) ?? [map.get(code)]), qid]),
      ]);
  }
  return {
    map,
    warnings: [...collisions].map(
      ([code, ids]) =>
        `${code}: plusieurs entités administratives Wikidata (${ids.join(", ")}); ${map.get(code)} retenue.`,
    ),
  };
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
  const entities = await fetchEntities(
    [countryQid, ...regionIds, ...fallbackIds],
    options,
  );
  const relatedIds = [countryQid, ...regionIds, ...fallbackIds].flatMap((id) =>
    ["P36", "P610", "P206", "P4552", "P47"].flatMap((property) =>
      entityIds(entities[id], property),
    ),
  );
  Object.assign(entities, await fetchEntities(relatedIds, options));

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
  };
}
