import { BookOpen, ExternalLink } from "lucide-react";
import { formatNumber } from "@/lib/geography";
import type { Territory } from "@/types/geography";

export function SectionLabel({
  number,
  title,
  note,
}: {
  number: string;
  title: string;
  note?: string;
}) {
  return (
    <header className="section-label">
      <span>{number}</span>
      <h2>{title}</h2>
      {note && <p>{note}</p>}
    </header>
  );
}

function Fact({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value?: string | number;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className={`key-fact ${accent ? "key-fact-accent" : ""}`}>
      <dt>{label}</dt>
      <dd
        className={value == null ? "missing" : ""}
        aria-label={value == null ? "Information non disponible" : undefined}
      >
        {value == null
          ? "—"
          : typeof value === "number"
            ? formatNumber(value)
            : value}
        {value != null && unit && <small>{unit}</small>}
      </dd>
    </div>
  );
}

export function KeyFacts({
  territory,
  divisionCount,
}: {
  territory: Territory;
  divisionCount?: number;
}) {
  const density =
    territory.population && territory.areaKm2
      ? territory.population / territory.areaKm2
      : undefined;
  return (
    <dl
      className={`key-facts ${divisionCount == null ? "key-facts-compact" : ""}`}
    >
      <Fact label="Capitale" value={territory.capital} accent />
      <Fact label="Population" value={territory.population} />
      <Fact label="Superficie" value={territory.areaKm2} unit="km²" />
      <Fact label="Densité" value={density} unit="hab./km²" />
      {divisionCount != null && (
        <Fact label="Subdivisions" value={divisionCount} />
      )}
    </dl>
  );
}

export function Sources({ territory }: { territory: Territory }) {
  return (
    <div className="editorial-sources">
      <div className="sources-intro">
        <BookOpen size={18} strokeWidth={1.4} />
        <p>
          Données documentées et millésimées. Les frontières sont généralisées
          pour l’exploration et ne constituent pas une référence juridique.
        </p>
      </div>
      <div className="source-list">
        {territory.sources.map((source, index) => (
          <div className="source-row" key={`${source.provider}-${index}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.provider}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <strong>{source.provider}</strong>
              )}
              <small>
                {[source.license, source.year && `Millésime ${source.year}`]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </div>
            {source.retrievedAt && (
              <time dateTime={source.retrievedAt}>
                {new Intl.DateTimeFormat("fr-FR", {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                }).format(new Date(source.retrievedAt))}
              </time>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
