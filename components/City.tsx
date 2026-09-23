"use client";

import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import type {
  AdministrativeDivision,
  City as CityData,
  Country,
} from "@/types/geography";
import { formatPopulation } from "@/lib/geography";

export default function City({
  city,
  country,
  division,
}: {
  city: CityData;
  country: Country;
  division?: AdministrativeDivision;
}) {
  const territoryHref = division
    ? `/country/${country.slug}/${division.slug}/`
    : `/country/${country.slug}/`;
  return (
    <main className="city-page">
      <nav className="city-nav" aria-label="Navigation">
        <Link href="/">GEOLIRA</Link>
        <span>/</span>
        <Link href={`/country/${country.slug}/`}>{country.names.fr}</Link>
        {division && (
          <>
            <span>/</span>
            <Link href={territoryHref}>{division.names.fr}</Link>
          </>
        )}
      </nav>
      <header className="city-hero">
        <p className="overline">INDEX DES VILLES · {country.iso3}</p>
        <h1>{city.names?.fr ?? city.name}</h1>
        <p>
          {division?.names.fr ?? country.names.fr} · {country.names.fr}
        </p>
      </header>
      <dl className="city-facts">
        <div>
          <dt>Population</dt>
          <dd>{formatPopulation(city.populationValue ?? city.population)}</dd>
        </div>
        <div>
          <dt>Coordonnées</dt>
          <dd>
            {city.latitude.toFixed(4)}° / {city.longitude.toFixed(4)}°
          </dd>
        </div>
        <div>
          <dt>Statut</dt>
          <dd>
            {city.roles?.includes("regional-capital")
              ? "Capitale régionale"
              : "Ville principale"}
          </dd>
        </div>
      </dl>
      <section className="city-location">
        <MapPin size={24} strokeWidth={1.3} />
        <span>REPÈRE GÉOGRAPHIQUE</span>
        <strong>{city.name}</strong>
        <small>
          {Math.abs(city.latitude).toFixed(2)}° {city.latitude >= 0 ? "N" : "S"}
          {" · "}
          {Math.abs(city.longitude).toFixed(2)}°{" "}
          {city.longitude >= 0 ? "E" : "O"}
        </small>
      </section>
      <Link className="city-back" href={territoryHref}>
        <ArrowLeft size={14} /> Retour à la fiche territoriale
      </Link>
    </main>
  );
}
