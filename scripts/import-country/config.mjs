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
  ESP: {
    administrativeType: "Communauté autonome",
    boundaryGrouping: "region-code-and-name",
    regionCodeOverrides: {
      "ES.NA": "ES-NC",
      "ES.MU": "ES-MC",
      "ES.PM": "ES-IB",
      "ES.LO": "ES-RI",
      "ES.CE:Ceuta": "ES-CE",
      "ES.CE:Melilla": "ES-ML",
    },
    administrativeTypeOverrides: {
      Ceuta: "Ville autonome",
      Melilla: "Ville autonome",
    },
  },
  AUS: {
    administrativeType: "État ou territoire",
    administrativeTypeTranslations: {
      State: "État",
      Territory: "Territoire",
    },
    boundaryMerges: {
      "AU-NSW": "Q3224",
      Q46650: "Q34366",
    },
  },
  IND: {
    administrativeType: "État ou territoire de l’Union",
    administrativeTypeTranslations: {
      State: "État",
      "Union Territory": "Territoire de l’Union",
    },
    administrativeTypeOverrides: {
      Gujarat: "État",
      "Himachal Pradesh": "État",
    },
    wikidataFactFallbacks: {
      "IN-CH": "Q43433",
      "IN-DL": "Q1353",
    },
  },
};

export const USER_AGENT =
  "AtlasEducationalPrototype/3.2 (open geographic data importer)";
