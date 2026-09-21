import type {
  Country,
  AdministrativeDivision,
  PopulationValue,
  SearchEntry,
} from "@/types/geography";
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const formatNumber = (value?: number) =>
  value == null
    ? "Donnée non disponible"
    : new Intl.NumberFormat("fr-FR").format(Math.round(value));
export const formatPopulation = (population?: number | PopulationValue) => {
  if (population == null) return "Donnée non disponible";
  const value = typeof population === "number" ? population : population.value;
  const year = typeof population === "number" ? undefined : population.year;
  return `${formatNumber(value)} habitants${year ? ` (${year})` : ""}`;
};
export const formatArea = (value?: number) =>
  value == null ? "Donnée non disponible" : `${formatNumber(value)} km²`;
export const formatDensity = (population?: number, area?: number) =>
  population != null && area
    ? `${formatNumber(population / area)} hab./km²`
    : "Donnée non disponible";
export const formatElevation = (value?: number) =>
  value == null ? "Donnée non disponible" : `${formatNumber(value)} m`;
export function density(population?: number, area?: number) {
  return population != null && area ? population / area : undefined;
}
export function validateCountryData(data: {
  divisions: AdministrativeDivision[];
  cities: { id: string; latitude: number; longitude: number }[];
}) {
  const ids = new Set(data.divisions.map((division) => division.id));
  const cityIds = new Set(data.cities.map((city) => city.id));
  const errors: string[] = [];
  for (const division of data.divisions) {
    if (division.population != null && division.population < 0)
      errors.push(`${division.id}: population négative`);
    if (division.areaKm2 != null && division.areaKm2 <= 0)
      errors.push(`${division.id}: superficie invalide`);
    for (const neighbor of division.neighborIds ?? [])
      if (!ids.has(neighbor)) errors.push(`${division.id}: voisin ${neighbor} inconnu`);
    for (const city of division.cityIds ?? [])
      if (!cityIds.has(city)) errors.push(`${division.id}: ville ${city} inconnue`);
  }
  for (const city of data.cities) {
    if (city.latitude < -90 || city.latitude > 90)
      errors.push(`${city.id}: latitude invalide`);
    if (city.longitude < -180 || city.longitude > 180)
      errors.push(`${city.id}: longitude invalide`);
  }
  return errors;
}
export const territoryHref = (
  country: Country,
  division?: AdministrativeDivision,
) => `/country/${country.slug}${division ? `/${division.slug}` : ""}/`;
export function searchTerritories(entries: SearchEntry[], query: string) {
  const q = normalize(query);
  if (!q) return [];
  return entries
    .map((entry) => ({
      entry,
      names: [entry.name, ...entry.aliases].map(normalize),
    }))
    .filter(({ names }) => names.some((n) => n.includes(q)))
    .sort(
      (a, b) =>
        Number(b.names.some((n) => n === q)) -
          Number(a.names.some((n) => n === q)) ||
        Number(b.names.some((n) => n.startsWith(q))) -
          Number(a.names.some((n) => n.startsWith(q))) ||
        a.entry.name.localeCompare(b.entry.name, "fr"),
    )
    .slice(0, 12)
    .map(({ entry }) => entry);
}
const cache = new Map<string, Promise<unknown>>();
export function loadJson<T>(url: string): Promise<T> {
  let promise = cache.get(url);
  if (!promise) {
    promise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Impossible de charger ${url}`);
        return r.json();
      })
      .catch((e) => {
        cache.delete(url);
        throw e;
      });
    cache.set(url, promise);
  }
  return promise as Promise<T>;
}
export function flag(iso2: string) {
  return /^[A-Z]{2}$/.test(iso2)
    ? [...iso2]
        .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
        .join("")
    : "◉";
}
