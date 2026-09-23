"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Globe2,
  Mountain,
  Share2,
  Waves,
} from "lucide-react";
import Search from "./Search";
import Learn from "./Learn";
import Compare from "./Compare";
import City from "./City";
import { KeyFacts, SectionLabel, Sources } from "./Editorial";
import {
  flag,
  formatNumber,
  loadJson,
  normalize,
  territoryHref,
} from "@/lib/geography";
import type {
  AdministrativeDivision,
  Country,
  CountryData,
  SearchEntry,
} from "@/types/geography";

const AtlasMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="map-shell map-placeholder">
      <span className="spinner" />
      Préparation de la carte…
    </div>
  ),
});

const EMPTY_CITIES: CountryData["cities"] = [];

function coordinates(bounds?: [number, number, number, number]) {
  if (!bounds) return undefined;
  const longitude = (bounds[0] + bounds[2]) / 2;
  const latitude = (bounds[1] + bounds[3]) / 2;
  const coordinate = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
  return `${coordinate(latitude, "N", "S")} / ${coordinate(longitude, "E", "O")}`;
}

export default function Atlas({
  countries,
  searchIndex,
}: {
  countries: Country[];
  searchIndex: SearchEntry[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const country = countries.find((item) => item.slug === segments[1]);
  const [loaded, setLoaded] = useState<{
    id: string;
    data: CountryData;
  } | null>(null);
  const [dataError, setDataError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [directory, setDirectory] = useState(false);
  const data = loaded?.id === country?.id ? loaded.data : undefined;
  const division = data?.divisions.find((item) => item.slug === segments[2]);
  const territory = division ?? country;
  const pending = Boolean(country?.pilot && !data && !dataError);

  useEffect(() => {
    let cancelled = false;
    if (!country?.pilot) return;
    setDataError(false);
    loadJson<CountryData>(`/data/${country.id}.json`)
      .then((value) => {
        if (!cancelled) setLoaded({ id: country.id, data: value });
      })
      .catch(() => {
        if (!cancelled) setDataError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [country?.id, country?.pilot, retry]);

  function navigate(href: string) {
    router.push(href);
    setDirectory(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function select(id: string, kind: "country" | "division") {
    if (kind === "country") {
      const selected = countries.find((item) => item.id === id);
      if (selected) navigate(territoryHref(selected));
      return;
    }
    const selected = data?.divisions.find((item) => item.id === id);
    if (selected && country) navigate(territoryHref(country, selected));
  }

  const cities = useMemo(
    () =>
      division
        ? (data?.cities.filter((city) => division.cityIds?.includes(city.id)) ??
          EMPTY_CITIES)
        : EMPTY_CITIES,
    [data, division],
  );
  const neighbors = division
    ? data?.divisions.filter((item) => division.neighborIds?.includes(item.id))
    : countries.filter((item) => country?.neighborIds?.includes(item.id));
  const rivers = division
    ? data?.rivers.filter((river) => division.riverIds?.includes(river.id))
    : data?.rivers.slice(0, 12);
  const pilots = countries.filter((item) => item.pilot);

  if (segments[0] === "compare") return <Compare />;
  if (segments[0] === "learn") {
    const usa = countries.find((item) => item.id === "USA");
    return usa ? <Learn country={usa} /> : null;
  }
  if (segments[0] === "city" && country && data && segments[3]) {
    const city = data.cities.find(
      (item) =>
        item.slug === segments[3] ||
        normalize(item.name) === normalize(segments[3].replaceAll("-", " ")),
    );
    const cityDivision = city
      ? data.divisions.find((item) => item.cityIds?.includes(city.id))
      : undefined;
    return city ? (
      <City city={city} country={country} division={cityDivision} />
    ) : null;
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className={`atlas ${country ? "territory-atlas" : "world-atlas"}`}>
      <header className="topbar">
        <Link
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
          aria-label="Geolira, retour au monde"
        >
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span className="brand-name">GEOLIRA</span>
          <span className="brand-sub">ATLAS DU MONDE</span>
        </Link>
        <Search entries={searchIndex} onNavigate={navigate} />
        <div className="header-end">
          <span className="edition">ÉDITION 03.3</span>
          <button
            className="world-button"
            aria-label="Revenir au monde"
            onClick={() => navigate("/")}
          >
            <Globe2 size={17} />
            Monde
          </button>
        </div>
      </header>

      <div className="toolbar">
        <nav aria-label="Fil d’Ariane">
          <button onClick={() => navigate("/")}>Monde</button>
          {country && (
            <>
              <span>/</span>
              <span className="continent-crumb">{country.continent}</span>
              <span>/</span>
              <button
                onClick={() => navigate(territoryHref(country))}
                aria-current={!division ? "page" : undefined}
              >
                {country.names.fr}
              </button>
            </>
          )}
          {division && (
            <>
              <span>/</span>
              <span aria-current="page">{division.names.fr}</span>
            </>
          )}
        </nav>
        <span className="toolbar-index">INDEX GÉOGRAPHIQUE · 2026</span>
      </div>

      {!country ? (
        <section className="world-stage" aria-label="Explorer le monde">
          <AtlasMap
            countries={countries}
            cities={EMPTY_CITIES}
            onSelect={select}
            onWorld={() => navigate("/")}
            resizeKey={false}
          />
          <aside className="world-index">
            <div className="world-intro">
              <p className="overline">CARTE 01 · MONDE</p>
              <h1>
                Le monde,
                <br />
                territoire par territoire.
              </h1>
              <p>
                Parcourez la carte ou consultez l’index pour ouvrir une fiche
                géographique.
              </p>
            </div>
            <div className="world-counts" aria-label="Contenu disponible">
              <span>
                <strong>{countries.length}</strong> pays et territoires
              </span>
              <span>
                <strong>{pilots.length}</strong> atlas détaillés
              </span>
              <span>
                <strong>{searchIndex.length - countries.length}</strong> entrées
              </span>
            </div>
            <div className="pilot-index">
              <SectionLabel number="01" title="Atlas détaillés" />
              {pilots.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => navigate(territoryHref(item))}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.names.fr}</strong>
                  <small>{item.divisionCount} subdivisions</small>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
            <button
              className="directory-button"
              onClick={() => setDirectory((value) => !value)}
              aria-expanded={directory}
            >
              Index des {countries.length} territoires <ArrowDown size={15} />
            </button>
            {directory && (
              <div className="directory">
                {countries.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(territoryHref(item))}
                  >
                    <span>{flag(item.iso2)}</span>
                    {item.names.fr}
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
            )}
          </aside>
        </section>
      ) : (
        <article className="territory-page">
          <header className="territory-hero">
            <div className="territory-kicker">
              <button
                onClick={() =>
                  navigate(division ? territoryHref(country) : "/")
                }
              >
                <ArrowLeft size={14} />
                {division ? `Retour à ${country.names.fr}` : "Retour au monde"}
              </button>
              <span>
                {country.iso3} · {division?.administrativeType ?? "Pays"}
              </span>
            </div>
            <div className="territory-title-row">
              <div>
                <p className="overline">
                  {division
                    ? `${country.names.fr} · ${division.administrativeType}`
                    : `${country.continent} · ${country.administrativeType ?? "Territoire"}`}
                </p>
                <h1>
                  {segments[2] && !division && pending
                    ? "Chargement…"
                    : territory?.names.fr}
                </h1>
                {territory?.names.local &&
                  normalize(territory.names.local) !==
                    normalize(territory.names.fr) && (
                    <p className="local-name">{territory.names.local}</p>
                  )}
              </div>
              <div className="territory-reference">
                <span>{coordinates(territory?.bounds)}</span>
                <button onClick={share}>
                  {copied ? <Check size={14} /> : <Share2 size={14} />}
                  {copied ? "Lien copié" : "Partager"}
                </button>
              </div>
            </div>
          </header>

          {pending && (
            <div className="inline-state" role="status">
              <span className="spinner" /> Chargement des données territoriales…
            </div>
          )}
          {dataError && (
            <div className="inline-state error" role="alert">
              Les données détaillées n’ont pas pu être chargées.
              <button onClick={() => setRetry((value) => value + 1)}>
                Réessayer
              </button>
            </div>
          )}

          {territory && (
            <KeyFacts
              territory={territory}
              divisionCount={!division ? country.divisionCount : undefined}
            />
          )}

          <section className="editorial-section map-section">
            <SectionLabel
              number="01"
              title={division ? "Carte régionale" : "Carte du territoire"}
              note="Explorer, zoomer, sélectionner"
            />
            <div className="territory-map-frame">
              <AtlasMap
                countries={countries}
                country={country}
                division={division}
                cities={cities}
                onSelect={select}
                onWorld={() => navigate("/")}
                resizeKey={Boolean(division)}
              />
            </div>
          </section>

          {!country.pilot && (
            <section className="availability editorial-section">
              <SectionLabel number="02" title="Édition en préparation" />
              <p>
                Les subdivisions et données détaillées de ce territoire ne sont
                pas encore disponibles. Sa position et ses données essentielles
                restent consultables.
              </p>
            </section>
          )}

          {!division && data && (
            <section className="editorial-section subdivisions-section">
              <SectionLabel
                number="02"
                title="Subdivisions"
                note={`${data.divisions.length} territoires administratifs`}
              />
              <div className="division-table">
                <div className="division-table-head" aria-hidden="true">
                  <span>Territoire</span>
                  <span>Capitale</span>
                  <span>Population</span>
                  <span>Superficie</span>
                  <span />
                </div>
                {data.divisions.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(territoryHref(country, item))}
                  >
                    <span className="division-name">
                      <small>{String(index + 1).padStart(2, "0")}</small>
                      <strong>{item.names.fr}</strong>
                    </span>
                    <span>{item.capital ?? "—"}</span>
                    <span>
                      {item.population ? formatNumber(item.population) : "—"}
                    </span>
                    <span>
                      {item.areaKm2 ? `${formatNumber(item.areaKm2)} km²` : "—"}
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </section>
          )}

          {division && (
            <section className="editorial-section cities-section">
              <SectionLabel
                number="02"
                title="Villes"
                note={`${cities.length} villes principales`}
              />
              <div className="editorial-city-list">
                {cities.length ? (
                  cities.map((city, index) => (
                    <div key={city.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{city.name}</strong>
                      <small>
                        {city.roles?.includes("regional-capital")
                          ? "Capitale régionale"
                          : "Ville principale"}
                      </small>
                      <p>
                        {city.population
                          ? `${formatNumber(city.population)} hab.`
                          : "Population non disponible"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="empty-data">Donnée non disponible</p>
                )}
              </div>
            </section>
          )}

          {country.pilot && (
            <section className="editorial-section geography-section">
              <SectionLabel
                number="03"
                title="Géographie"
                note="Relief et hydrographie"
              />
              <div className="geography-grid">
                <div className="geography-block relief-block">
                  <Mountain size={20} strokeWidth={1.35} />
                  <p className="overline">RELIEF</p>
                  <h3>
                    {territory?.highestPoint?.name ?? "Donnée non disponible"}
                  </h3>
                  {territory?.highestPoint?.elevationMeters != null && (
                    <strong>
                      {formatNumber(territory.highestPoint.elevationMeters)}
                      <small> m</small>
                    </strong>
                  )}
                  {territory?.mountainRange && <p>{territory.mountainRange}</p>}
                </div>
                <div className="geography-block water-block">
                  <Waves size={20} strokeWidth={1.35} />
                  <p className="overline">HYDROGRAPHIE</p>
                  {rivers?.length ? (
                    <ul>
                      {rivers.map((river) => (
                        <li key={river.id}>{river.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-data">Donnée non disponible</p>
                  )}
                  {!!territory?.lakes?.length && (
                    <p className="lake-note">
                      Lacs · {territory.lakes.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {!!neighbors?.length && (
            <section className="editorial-section neighbors-section">
              <SectionLabel
                number="04"
                title="Territoires voisins"
                note="Poursuivre l’exploration"
              />
              <div className="editorial-neighbors">
                {neighbors.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      navigate(
                        "countryId" in item
                          ? territoryHref(
                              country,
                              item as AdministrativeDivision,
                            )
                          : territoryHref(item as Country),
                      )
                    }
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.names.fr}</strong>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            </section>
          )}

          {territory && (
            <section className="editorial-section sources-section">
              <SectionLabel
                number="05"
                title="Sources"
                note="Provenance et méthode"
              />
              <Sources territory={territory} />
            </section>
          )}
        </article>
      )}

      <footer className="statusbar">
        <span>
          <i /> GEOLIRA · ÉDITION 03.3
        </span>
        <span>Natural Earth · geoBoundaries · Wikidata</span>
        <span>ATLAS DU MONDE</span>
      </footer>
    </main>
  );
}
