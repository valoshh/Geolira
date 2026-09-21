"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  ExternalLink,
  Globe2,
  Layers3,
  MapPin,
  Mountain,
  PanelRightClose,
  PanelRightOpen,
  Waves,
} from "lucide-react";
import Search from "./Search";
import Learn from "./Learn";
import Compare from "./Compare";
import City from "./City";
import { flag, formatNumber, loadJson, normalize, territoryHref } from "@/lib/geography";
import type {
  AdministrativeDivision,
  Country,
  CountryData,
  SearchEntry,
  Territory,
} from "@/types/geography";
const AtlasMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="map-shell map-placeholder">
      <span className="spinner" />
      Préparation de l’atlas…
    </div>
  ),
});
const EMPTY_CITIES: CountryData["cities"] = [];
function Metric({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value?: string | number;
  unit?: string;
  detail?: string;
}) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd className={value == null ? "missing" : ""}>
        {typeof value === "number"
          ? formatNumber(value)
          : (value ?? "Donnée non disponible")}
        {value != null && unit && <span> {unit}</span>}
      </dd>
      {detail && <small>{detail}</small>}
    </div>
  );
}
function Sources({ territory }: { territory: Territory }) {
  return (
    <details className="sources">
      <summary>
        <BookOpen size={15} />
        Sources et méthode
        <ChevronRight size={14} />
      </summary>
      <div>
        {territory.sources.map((s, i) => (
          <p key={i}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.provider}
              <ExternalLink size={12} />
            </a>
            <span>
              {s.license}
              {s.year ? ` · Millésime ${s.year}` : ""}
              {s.retrievedAt ? ` · Consulté le ${s.retrievedAt}` : ""}
            </span>
          </p>
        ))}
        <p>
          Les populations correspondent au millésime indiqué. La densité est
          calculée à partir de la population et de la superficie disponibles.
          Les frontières sont généralisées pour l’exploration ; elles ne
          constituent pas une référence juridique.
        </p>
      </div>
    </details>
  );
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
  const country = countries.find((c) => c.slug === segments[1]);
  const [loaded, setLoaded] = useState<{
    id: string;
    data: CountryData;
  } | null>(null);
  const [dataError, setDataError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"overview" | "divisions">("overview");
  const [copied, setCopied] = useState(false);
  const [directory, setDirectory] = useState(false);
  const data = loaded?.id === country?.id ? loaded?.data : undefined;
  const division = data?.divisions.find((d) => d.slug === segments[2]);
  const territory = division ?? country;
  const pending = country?.pilot && !data && !dataError;
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
  const navigate = useCallback(
    (href: string) => {
      router.push(href, { scroll: false });
      setCollapsed(false);
      setTab("overview");
      setDirectory(false);
      if (window.innerWidth <= 700)
        window.scrollTo({ top: 0, behavior: "instant" });
    },
    [router],
  );
  const select = useCallback(
    (id: string, kind: "country" | "division") => {
      if (kind === "country") {
        const c = countries.find((c) => c.id === id);
        if (c) navigate(territoryHref(c));
      } else {
        const d = data?.divisions.find((d) => d.id === id);
        if (d && country) navigate(territoryHref(country, d));
      }
    },
    [countries, country, data, navigate],
  );
  const cities = useMemo(
    () =>
      division
        ? (data?.cities.filter((c) => division.cityIds?.includes(c.id)) ??
          EMPTY_CITIES)
        : EMPTY_CITIES,
    [data, division],
  );
  const neighbors = division
    ? data?.divisions.filter((d) => division.neighborIds?.includes(d.id))
    : countries.filter((c) => country?.neighborIds?.includes(c.id));
  const rivers = data?.rivers.filter((r) => division?.riverIds?.includes(r.id));
  const pilots = countries.filter((c) => c.pilot);
  const richCount = searchIndex.filter((s) => s.enriched).length;
  if (segments[0] === "compare") return <Compare />;
  if (segments[0] === "learn") {
    const usa = countries.find((item) => item.id === "USA");
    return usa ? <Learn country={usa} /> : null;
  }
  if (segments[0] === "city" && country && data && segments[3]) {
    const city = data.cities.find((item) => normalize(item.name) === normalize(segments[3].replaceAll("-", " ")));
    const cityDivision = city ? data.divisions.find((item) => item.cityIds?.includes(city.id)) : undefined;
    return city ? <City city={city} country={country} data={data} division={cityDivision} /> : null;
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
    <main className="atlas">
      <header className="topbar">
        <Link
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          aria-label="Atlas, retour au monde"
        >
          <span className="brand-mark">
            <Globe2 size={27} strokeWidth={1.25} />
          </span>
          <span>
            atlas<span className="brand-period">.</span>
          </span>
          <span className="brand-sub">LE MONDE À EXPLORER</span>
        </Link>
        <Search entries={searchIndex} onNavigate={navigate} />
        <div className="header-end">
          <span className="edition">ÉDITION EXPLORATOIRE</span>
          <button
            className="icon-button"
            aria-label="Revenir au monde"
            onClick={() => navigate("/")}
          >
            <Globe2 size={21} />
          </button>
        </div>
      </header>
      <div className="toolbar">
        <nav aria-label="Fil d’Ariane">
          <button onClick={() => navigate("/")}>
            <Globe2 size={15} />
            Monde
          </button>
          {country && (
            <>
              <ChevronRight size={14} />
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
              <ChevronRight size={14} />
              <span aria-current="page">{division.names.fr}</span>
            </>
          )}
        </nav>
        <div className="toolbar-right">
          <span>
            <Layers3 size={15} />
            Carte politique
          </span>
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={
              collapsed ? "Afficher le panneau" : "Replier le panneau"
            }
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelRightOpen size={19} />
            ) : (
              <PanelRightClose size={19} />
            )}
          </button>
        </div>
      </div>
      <div className={`workspace ${collapsed ? "panel-collapsed" : ""}`}>
        <AtlasMap
          countries={countries}
          country={country}
          division={division}
          cities={cities}
          onSelect={select}
          onWorld={() => navigate("/")}
          resizeKey={collapsed}
        />
        {!collapsed && (
          <aside
            key={pathname}
            className="info-panel"
            aria-label="Fiche géographique"
          >
            <div className="mobile-handle" />
            {!country ? (
              <>
                <div className="intro">
                  <div className="eyebrow">
                    <span />
                    L’ATLAS GÉOGRAPHIQUE
                  </div>
                  <h1>
                    Le monde,
                    <br />
                    <em>à portée de carte.</em>
                  </h1>
                  <p>
                    Des pays aux régions, explorez les territoires et découvrez
                    ce qui les rend singuliers.
                  </p>
                  <div className="world-stats">
                    <div>
                      <strong>{countries.length}</strong>
                      <span>pays & territoires</span>
                    </div>
                    <div>
                      <strong>{pilots.length}</strong>
                      <span>pays à explorer</span>
                    </div>
                    <div>
                      <strong>{searchIndex.length - countries.length}</strong>
                      <span>subdivisions</span>
                    </div>
                  </div>
                </div>
                <section className="pilot-section">
                  <div className="section-title">
                    <h2>Commencer l’exploration</h2>
                    <span>01 — 05</span>
                  </div>
                  <p className="section-description">
                    Cinq pays, toutes leurs régions.
                  </p>
                  <div className="pilot-list">
                    {pilots.map((c, i) => (
                      <button
                        className="pilot-card"
                        key={c.id}
                        onClick={() => navigate(territoryHref(c))}
                      >
                        <span className="pilot-number">0{i + 1}</span>
                        <span className="country-flag">{flag(c.iso2)}</span>
                        <span className="pilot-text">
                          <strong>{c.names.fr}</strong>
                          <small>
                            {c.id === "USA"
                              ? "50 États + Washington D.C."
                              : c.id === "BRA"
                                ? "26 États + district fédéral"
                                : `${c.divisionCount} ${c.id === "FRA" ? "régions" : c.id === "DEU" ? "Länder" : "préfectures"}`}
                          </small>
                        </span>
                        <ArrowUpRight size={19} />
                      </button>
                    ))}
                  </div>
                </section>
                <div className="discovery">
                  <Compass size={26} strokeWidth={1.2} />
                  <div>
                    <strong>Suivez votre curiosité</strong>
                    <p>
                      Cliquez sur un territoire ou recherchez une région.{" "}
                      {richCount} fiches enrichies vous attendent.
                    </p>
                  </div>
                </div>
                <button
                  className="directory-button"
                  onClick={() => setDirectory((v) => !v)}
                  aria-expanded={directory}
                >
                  Tous les pays & territoires <ArrowDown size={16} />
                </button>
                {directory && (
                  <div className="directory">
                    {countries.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => navigate(territoryHref(c))}
                      >
                        {flag(c.iso2)} {c.names.fr}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                )}
                <div className="panel-foot">
                  Une autre façon de connaître le monde.
                </div>
              </>
            ) : (
              <>
                <div className="territory-heading">
                  <button
                    className="back-button"
                    onClick={() =>
                      navigate(division ? territoryHref(country) : "/")
                    }
                  >
                    <ArrowLeft size={14} />
                    {division ? country.names.fr : "Carte du monde"}
                  </button>
                  <div className="territory-meta">
                    <span>{flag(country.iso2)}</span>
                    {division
                      ? `${country.names.fr} · ${division.administrativeType}`
                      : country.continent}
                  </div>
                  <h1>
                    {segments[2] && !division && pending
                      ? "Chargement…"
                      : territory?.names.fr}
                  </h1>
                  <div className="territory-under">
                    <span className="territory-badge">
                      <MapPin size={12} />
                      {division ? division.administrativeType : "Pays"}
                    </span>
                    <button onClick={share} className="share">
                      {copied ? (
                        <>
                          <Check size={13} />
                          Lien copié
                        </>
                      ) : (
                        <>
                          Partager
                          <ArrowUpRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {pending && (
                  <div className="inline-state" role="status">
                    <span className="spinner" />
                    Chargement des subdivisions…
                  </div>
                )}
                {dataError && (
                  <div className="inline-state error" role="alert">
                    Les fiches n’ont pas pu être chargées.
                    <button
                      onClick={() => {
                        setDataError(false);
                        setRetry((n) => n + 1);
                      }}
                    >
                      Réessayer
                    </button>
                  </div>
                )}
                {!division && country.pilot && (
                  <div
                    className="tabs"
                    role="tablist"
                    aria-label="Informations du pays"
                  >
                    <button
                      role="tab"
                      aria-selected={tab === "overview"}
                      onClick={() => setTab("overview")}
                    >
                      Vue d’ensemble
                    </button>
                    <button
                      role="tab"
                      aria-selected={tab === "divisions"}
                      onClick={() => setTab("divisions")}
                    >
                      Subdivisions <span>{country.divisionCount}</span>
                    </button>
                  </div>
                )}
                {tab === "overview" && (
                  <>
                    <dl className="metrics">
                      <Metric
                        label={division ? "Capitale / chef-lieu" : "Capitale"}
                        value={territory?.capital}
                      />
                      <Metric
                        label="Population"
                        value={territory?.population}
                        detail={
                          territory?.populationYear
                            ? `Données ${territory.populationYear}`
                            : undefined
                        }
                      />
                      <Metric
                        label="Superficie"
                        value={territory?.areaKm2}
                        unit="km²"
                      />
                      <Metric
                        label="Densité"
                        value={
                          territory?.population && territory.areaKm2
                            ? territory.population / territory.areaKm2
                            : undefined
                        }
                        unit="hab./km²"
                      />
                    </dl>
                    {division?.description && (
                      <p className="territory-description">
                        {division.description}
                      </p>
                    )}
                    {!country.pilot && (
                      <div className="availability">
                        <BookOpen size={21} />
                        <h2>Un territoire à découvrir</h2>
                        <p>
                          Les données détaillées et les subdivisions de ce pays
                          ne sont pas encore disponibles dans cette édition.
                        </p>
                        <button onClick={() => navigate("/")}>
                          Explorer les pays pilotes
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    )}
                    {division && !division.enriched && (
                      <div className="small-note">
                        Fiche essentielle · Les caractéristiques géographiques
                        seront enrichies progressivement.
                      </div>
                    )}
                    {division?.enriched && (
                      <section className="detail-section">
                        <div className="section-title">
                          <h2>
                            <MapPin size={16} />
                            Villes principales
                          </h2>
                          <span>
                            {cities.length.toString().padStart(2, "0")}
                          </span>
                        </div>
                        {cities.length ? (
                          cities.map((c, i) => (
                            <div key={c.id} className="city-row">
                              <span className="city-index">{i + 1}</span>
                              <strong>{c.name}</strong>
                              <span>
                                {c.population
                                  ? `${formatNumber(c.population)} hab.${c.populationYear ? " · " + c.populationYear : ""}`
                                  : "Population non disponible"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="muted">Donnée non disponible</p>
                        )}
                        {division.id === "Q64" && (
                          <p className="muted">
                            Berlin constitue l’ensemble de la ville-État.
                          </p>
                        )}
                      </section>
                    )}
                    {(territory?.highestPoint || division?.enriched) && (
                      <section className="detail-section">
                        <div className="section-title">
                          <h2>
                            <Mountain size={17} />
                            Relief
                          </h2>
                        </div>
                        {territory?.mountainRange && (
                          <p className="relief-range">
                            {territory.mountainRange}
                          </p>
                        )}
                        <div className="peak">
                          <span>Point culminant</span>
                          <strong>
                            {territory?.highestPoint?.name ??
                              "Donnée non disponible"}
                          </strong>
                          {territory?.highestPoint?.elevationMeters != null && (
                            <div>
                              {formatNumber(
                                territory.highestPoint.elevationMeters,
                              )}
                              <span> m d’altitude</span>
                            </div>
                          )}
                        </div>
                      </section>
                    )}
                    {division?.enriched && (
                      <section className="detail-section">
                        <div className="section-title">
                          <h2>
                            <Waves size={17} />
                            Hydrographie
                          </h2>
                        </div>
                        <div className="water-list">
                          {rivers?.length ? (
                            rivers.map((r) => <span key={r.id}>{r.name}</span>)
                          ) : (
                            <p className="muted">Donnée non disponible</p>
                          )}
                        </div>
                      </section>
                    )}
                    {!!neighbors?.length && (
                      <section className="detail-section">
                        <div className="section-title">
                          <h2>Territoires voisins</h2>
                        </div>
                        <div className="neighbor-list">
                          {neighbors.map((n) => (
                            <button
                              key={n.id}
                              onClick={() =>
                                navigate(
                                  "countryId" in n
                                    ? territoryHref(
                                        country,
                                        n as AdministrativeDivision,
                                      )
                                    : territoryHref(n as Country),
                                )
                              }
                            >
                              {n.names.fr}
                              <ArrowUpRight size={14} />
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
                {!division && data && (
                  <section className="detail-section subdivision-section">
                    <div className="section-title">
                      <h2>Explorer les subdivisions</h2>
                      <span>{data.divisions.length}</span>
                    </div>
                    <p className="section-description">
                      Sélectionnez un territoire sur la carte ou dans la liste.
                    </p>
                    <div className="division-list">
                      {data.divisions.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => navigate(territoryHref(country, d))}
                        >
                          <span>
                            <strong>{d.names.fr}</strong>
                            <small>{d.capital ?? d.administrativeType}</small>
                          </span>
                          {d.enriched && (
                            <span className="rich-label">Fiche enrichie</span>
                          )}
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {territory && <Sources territory={territory} />}
              </>
            )}
          </aside>
        )}
        {collapsed && (
          <button className="reopen-panel" onClick={() => setCollapsed(false)}>
            <PanelRightOpen size={18} />
            Afficher la fiche
          </button>
        )}
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          Atlas ouvert · Édition 01
        </span>
        <span>Natural Earth · geoBoundaries · Wikidata</span>
        <span>Explorer. Comprendre. Relier.</span>
      </footer>
    </main>
  );
}
