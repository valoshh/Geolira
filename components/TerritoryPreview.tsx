"use client";

import { useEffect, useMemo } from "react";
import { ArrowUpRight, MapPin, Mountain, Waves, X } from "lucide-react";
import { flag, formatNumber } from "@/lib/geography";
import type {
  AdministrativeDivision,
  Country,
  CountryData,
  Territory,
} from "@/types/geography";

function value(value?: number, unit?: string) {
  if (value == null) return "—";
  return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
}

export default function TerritoryPreview({
  country,
  division,
  countries,
  data,
  loading,
  onClose,
  onOpenFull,
  onSelect,
}: {
  country: Country;
  division?: AdministrativeDivision;
  countries: Country[];
  data?: CountryData;
  loading: boolean;
  onClose: () => void;
  onOpenFull: () => void;
  onSelect: (country: Country, division?: AdministrativeDivision) => void;
}) {
  const territory: Territory = division ?? country;
  const density =
    territory.population && territory.areaKm2
      ? territory.population / territory.areaKm2
      : undefined;
  const cities = useMemo(() => {
    const divisionCities = division?.cityIds
      ? data?.cities.filter((city) => division.cityIds?.includes(city.id))
      : data?.cities;
    return [...(divisionCities ?? [])]
      .sort(
        (a, b) =>
          (b.populationValue?.value ?? b.population ?? 0) -
          (a.populationValue?.value ?? a.population ?? 0),
      )
      .slice(0, 3);
  }, [data, division]);
  const rivers = division?.riverIds
    ? data?.rivers.filter((river) => division.riverIds?.includes(river.id))
    : data?.rivers;
  const neighbors = division
    ? data?.divisions.filter((item) => division.neighborIds?.includes(item.id))
    : countries.filter((item) => country.neighborIds?.includes(item.id));

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <aside
      className="territory-preview"
      role="dialog"
      aria-modal="false"
      aria-labelledby="territory-preview-title"
    >
      <div className="preview-head">
        <span className="preview-flag" role="img" aria-label={country.names.fr}>
          {flag(country.iso2)}
        </span>
        <div>
          <p>
            {country.iso3} · {division?.administrativeType ?? "Pays"}
          </p>
          <h2 id="territory-preview-title">{territory.names.fr}</h2>
        </div>
        <button onClick={onClose} aria-label="Fermer la fiche condensée">
          <X size={18} />
        </button>
      </div>

      <dl className="preview-facts">
        <div>
          <dt>Capitale</dt>
          <dd>{territory.capital ?? "—"}</dd>
        </div>
        <div>
          <dt>Population</dt>
          <dd>{value(territory.population)}</dd>
        </div>
        <div>
          <dt>Superficie</dt>
          <dd>{value(territory.areaKm2, "km²")}</dd>
        </div>
        <div>
          <dt>Densité</dt>
          <dd>{value(density, "hab./km²")}</dd>
        </div>
      </dl>

      <div className="preview-document">
        <section>
          <p className="preview-label">
            <MapPin size={12} /> Villes principales
          </p>
          {cities.length ? (
            <ol>
              {cities.map((city) => (
                <li key={city.id}>{city.names?.fr ?? city.name}</li>
              ))}
            </ol>
          ) : (
            <p className="preview-missing">{loading ? "Chargement…" : "—"}</p>
          )}
        </section>
        <section>
          <p className="preview-label">
            <Mountain size={12} /> Relief
          </p>
          <strong>{territory.highestPoint?.name ?? "—"}</strong>
          {territory.highestPoint?.elevationMeters != null && (
            <small>{value(territory.highestPoint.elevationMeters, "m")}</small>
          )}
        </section>
        <section>
          <p className="preview-label">
            <Waves size={12} /> Hydrographie
          </p>
          <strong>
            {rivers
              ?.slice(0, 3)
              .map((river) => river.name)
              .join(" · ") || "—"}
          </strong>
        </section>
      </div>

      {!!neighbors?.length && (
        <div className="preview-neighbors">
          <span>Territoires voisins</span>
          <div>
            {neighbors.slice(0, 5).map((neighbor) => (
              <button
                key={neighbor.id}
                onClick={() =>
                  onSelect(
                    "countryId" in neighbor ? country : (neighbor as Country),
                    "countryId" in neighbor
                      ? (neighbor as AdministrativeDivision)
                      : undefined,
                  )
                }
              >
                {neighbor.names.fr}
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="preview-full" onClick={onOpenFull}>
        Voir la fiche complète <ArrowUpRight size={15} />
      </button>
    </aside>
  );
}
