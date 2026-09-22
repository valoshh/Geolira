export const CACHE_DIR = ".data-cache";

export const SOURCES = {
  world:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
  adm1: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
  cities:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson",
  rivers:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson",
  geoBoundaries: (iso3) =>
    `https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM1/`,
  wikidataEntities:
    "https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels%7Cclaims&languages=fr%7Cen%7Cit&format=json&ids=",
  wikidataSparql: "https://query.wikidata.org/sparql?format=json&query=",
};

export const COUNTRY_OVERRIDES = {
  ITA: {
    administrativeType: "Région",
    boundaryGrouping: "region-code",
  },
};

export const USER_AGENT =
  "AtlasEducationalPrototype/3.2 (open geographic data importer)";
