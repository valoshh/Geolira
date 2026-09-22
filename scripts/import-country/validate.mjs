import { validateGeometry } from "./geometry.mjs";
import { comparableName } from "./slug.mjs";

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateImport({ iso3, countries, data, geojson, search }) {
  const errors = [];
  const warnings = [];
  if (!/^[A-Z]{3}$/.test(iso3)) errors.push(`ISO3 invalide: ${iso3}`);
  if (!countries.some((country) => country.id === iso3))
    errors.push(`Pays ${iso3} absent du catalogue mondial.`);

  const divisionIds = new Set(data.divisions.map((division) => division.id));
  const cityIds = new Set(data.cities.map((city) => city.id));
  const riverIds = new Set(data.rivers.map((river) => river.id));
  for (const id of duplicates(data.divisions.map((division) => division.id)))
    errors.push(`ID de subdivision dupliqué: ${id}`);
  for (const slug of duplicates(
    data.divisions.map((division) => division.slug),
  ))
    errors.push(`Slug de subdivision dupliqué: ${slug}`);
  for (const name of duplicates(
    data.divisions.map((division) => comparableName(division.names.fr)),
  ))
    errors.push(`Subdivision dupliquée par son nom: ${name}`);
  for (const id of duplicates(data.cities.map((city) => city.id)))
    errors.push(`ID de ville dupliqué: ${id}`);
  for (const href of duplicates(search.map((entry) => entry.href)))
    errors.push(`URL dupliquée dans la recherche: ${href}`);
  for (const slug of duplicates(countries.map((country) => country.slug)))
    errors.push(`Slug de pays dupliqué: ${slug}`);

  for (const division of data.divisions) {
    if (division.countryId !== iso3)
      errors.push(
        `${division.id}: countryId incohérent (${division.countryId})`,
      );
    if (division.population != null && division.population < 0)
      errors.push(`${division.id}: population négative`);
    if (division.areaKm2 != null && division.areaKm2 <= 0)
      errors.push(`${division.id}: superficie invalide`);
    if (!division.capital)
      warnings.push(`${division.names.fr}: capitale absente`);
    if (!division.population)
      warnings.push(`${division.names.fr}: population absente`);
    if (!division.areaKm2)
      warnings.push(`${division.names.fr}: superficie absente`);
    if (!(division.sources ?? []).length)
      errors.push(`${division.id}: aucune source`);
    for (const neighbor of division.neighborIds ?? []) {
      if (neighbor === division.id)
        errors.push(`${division.id}: relation de voisinage vers soi-même`);
      if (!divisionIds.has(neighbor))
        errors.push(`${division.id}: voisin ${neighbor} inconnu`);
    }
    for (const city of division.cityIds ?? [])
      if (!cityIds.has(city))
        errors.push(`${division.id}: ville ${city} inconnue`);
    for (const river of division.riverIds ?? [])
      if (!riverIds.has(river))
        errors.push(`${division.id}: cours d’eau ${river} inconnu`);
    const capitalCities = data.cities.filter(
      (city) =>
        division.cityIds?.includes(city.id) &&
        city.roles?.includes("regional-capital"),
    );
    if (division.capital && !capitalCities.length)
      warnings.push(
        `${division.names.fr}: capitale renseignée mais non reliée à une ville géolocalisée`,
      );
  }

  for (const city of data.cities) {
    if (
      !Number.isFinite(city.latitude) ||
      city.latitude < -90 ||
      city.latitude > 90
    )
      errors.push(`${city.id}: latitude invalide (${city.latitude})`);
    if (
      !Number.isFinite(city.longitude) ||
      city.longitude < -180 ||
      city.longitude > 180
    )
      errors.push(`${city.id}: longitude invalide (${city.longitude})`);
    if (city.population != null && city.population < 0)
      errors.push(`${city.id}: population négative`);
    if (!divisionIds.has(city.divisionId))
      errors.push(`${city.id}: division ${city.divisionId} inconnue`);
  }
  for (const river of data.rivers)
    for (const divisionId of river.divisionIds ?? [])
      if (!divisionIds.has(divisionId))
        errors.push(`${river.id}: division ${divisionId} inconnue`);

  const geometryIds = new Set();
  for (const feature of geojson.features) {
    const id = feature.properties?.id;
    if (geometryIds.has(id)) errors.push(`Géométrie dupliquée: ${id}`);
    geometryIds.add(id);
    if (!divisionIds.has(id))
      errors.push(`Géométrie liée à un ID inconnu: ${id}`);
    for (const detail of validateGeometry(feature.geometry))
      errors.push(`${id}: géométrie invalide (${detail})`);
  }
  for (const division of data.divisions)
    if (!geometryIds.has(division.geometryId))
      errors.push(`${division.id}: géométrie ${division.geometryId} absente`);

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}
