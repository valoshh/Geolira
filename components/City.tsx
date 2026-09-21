"use client";
import Link from "next/link";
import type { City as CityData, Country, CountryData, AdministrativeDivision } from "@/types/geography";
import { formatPopulation, formatNumber } from "@/lib/geography";

export default function City({ city, country, data, division }: { city: CityData; country: Country; data: CountryData; division?: AdministrativeDivision }) {
  return <main className="city-page"><p className="eyebrow">VILLE</p><h1>{city.names?.fr ?? city.name}</h1><p className="city-context"><Link href={`/country/${country.slug}/`}>{country.names.fr}</Link>{division && <> · <Link href={`/country/${country.slug}/${division.slug}/`}>{division.names.fr}</Link></>}</p><dl className="metrics city-metrics"><div className="metric"><dt>Population</dt><dd>{formatPopulation(city.populationValue ?? city.population)}</dd></div><div className="metric"><dt>Coordonnées</dt><dd>{city.latitude.toFixed(4)}°, {city.longitude.toFixed(4)}°</dd></div><div className="metric"><dt>Rôle</dt><dd>{city.roles?.join(", ") ?? (division?.capital === city.name ? "Capitale régionale" : "Ville principale")}</dd></div></dl><div className="city-map" style={{ background: "linear-gradient(135deg, #dceaf0, #eef3e8)" }}><span>Carte centrée sur {city.name}</span><small>{formatNumber(Math.abs(city.latitude))}° · {formatNumber(Math.abs(city.longitude))}°</small></div><Link className="primary-action" href={`/country/${country.slug}/${division?.slug ?? ""}/`}>Retour à la fiche territoriale</Link></main>;
}
