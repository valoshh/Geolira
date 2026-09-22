export type SourceInfo = {
  provider: string;
  url?: string;
  retrievedAt?: string;
  year?: string;
  license?: string;
};
export type Names = { fr: string; en?: string; local?: string };
export type PopulationValue = {
  value: number;
  year?: number;
  date?: string;
  source?: SourceInfo;
};
export type CityRole =
  "national-capital" | "regional-capital" | "largest-city" | "major-city";
export type City = {
  id: string;
  name: string;
  slug?: string;
  names?: Partial<Names>;
  countryId?: string;
  divisionId?: string;
  population?: number;
  populationYear?: string;
  populationValue?: PopulationValue;
  sources?: SourceInfo[];
  latitude: number;
  longitude: number;
  roles?: CityRole[];
};
export type River = { id: string; name: string; divisionIds?: string[] };
export type Territory = {
  id: string;
  slug: string;
  names: Names;
  capital?: string;
  population?: number;
  populationYear?: string;
  populationValue?: PopulationValue;
  areaKm2?: number;
  highestPoint?: { name: string; elevationMeters?: number };
  mountainRange?: string;
  neighborIds?: string[];
  geometryId: string;
  labelPoint?: [number, number];
  sources: SourceInfo[];
  bounds: [number, number, number, number];
  cityIds?: string[];
  riverIds?: string[];
  lakes?: string[];
  description?: string;
  facts?: string[];
};
export type Country = Territory & {
  iso2: string;
  iso3: string;
  continent: string;
  pilot?: boolean;
  administrativeType?: string;
  divisionCount?: number;
};
export type AdministrativeDivision = Territory & {
  countryId: string;
  administrativeLevel: 1;
  administrativeType: string;
  enriched?: boolean;
};
export type CountryData = {
  divisions: AdministrativeDivision[];
  cities: City[];
  rivers: River[];
};
export type SearchEntry = {
  id: string;
  name: string;
  aliases: string[];
  context: string;
  href: string;
  countryId: string;
  enriched?: boolean;
  kind?: "country" | "division" | "city";
};
export type GeographicRelation = {
  fromId: string;
  type:
    | "part-of"
    | "capital-of"
    | "largest-city-of"
    | "borders"
    | "crosses"
    | "located-in"
    | "highest-point-of"
    | "flows-through";
  toId: string;
};
export type QuizQuestion = {
  id: string;
  type: "locate-division" | "division-capital";
  prompt: string;
  targetEntityId: string;
  choices?: string[];
  correctAnswer: string;
};
