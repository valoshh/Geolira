"use client";
import { useEffect, useMemo, useState } from "react";
import type { AdministrativeDivision, CountryData } from "@/types/geography";
import { formatArea, formatDensity, formatElevation, formatPopulation, loadJson } from "@/lib/geography";

export default function Compare() {
  const [data, setData] = useState<CountryData>();
  const [leftId, setLeftId] = useState("Q1393");
  const [rightId, setRightId] = useState("Q1387");
  useEffect(() => { loadJson<CountryData>("/data/USA.json").then(setData); }, []);
  const divisions = useMemo(() => data?.divisions ?? [], [data]);
  const left = useMemo(() => divisions.find((d) => d.id === leftId), [divisions, leftId]);
  const right = useMemo(() => divisions.find((d) => d.id === rightId), [divisions, rightId]);
  const rows: [string, (d: AdministrativeDivision) => string][] = [
    ["Capitale", (d) => d.capital ?? "Donnée non disponible"],
    ["Population", (d) => formatPopulation(d.population)],
    ["Superficie", (d) => formatArea(d.areaKm2)],
    ["Densité", (d) => formatDensity(d.population, d.areaKm2)],
    ["Point culminant", (d) => d.highestPoint?.name ?? "Donnée non disponible"],
    ["Altitude", (d) => formatElevation(d.highestPoint?.elevationMeters)],
    ["Voisins", (d) => String(d.neighborIds?.length ?? 0)],
  ];
  return <main className="compare-page"><p className="eyebrow">COMPARATEUR</p><h1>Comparer deux subdivisions</h1><div className="compare-selects"><select value={leftId} onChange={(e) => setLeftId(e.target.value)}>{divisions.map((d) => <option key={d.id} value={d.id}>{d.names.fr}</option>)}</select><span>VS</span><select value={rightId} onChange={(e) => setRightId(e.target.value)}>{divisions.map((d) => <option key={d.id} value={d.id}>{d.names.fr}</option>)}</select></div>{left && right && <div className="comparison"><h2>{left.names.fr} <span>VS</span> {right.names.fr}</h2>{rows.map(([label, value]) => <div className="comparison-row" key={label}><span>{label}</span><strong>{value(left)}</strong><strong>{value(right)}</strong></div>)}</div>}</main>;
}
