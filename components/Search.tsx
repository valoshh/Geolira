"use client";
import { useId, useRef, useState } from "react";
import { Search as SearchIcon, ArrowUpRight, MapPin, X } from "lucide-react";
import { searchTerritories } from "@/lib/geography";
import type { SearchEntry } from "@/types/geography";
export default function Search({
  entries,
  onNavigate,
}: {
  entries: SearchEntry[];
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const results = searchTerritories(entries, query);
  function choose(entry: SearchEntry) {
    onNavigate(entry.href);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  }
  return (
    <div
      className="search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <SearchIcon size={19} />
      <input
        ref={input}
        role="combobox"
        aria-label="Rechercher un pays, une région ou une ville"
        aria-expanded={open && !!query}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={
          open && results[active] ? `${id}-${active}` : undefined
        }
        placeholder="Rechercher un pays, une région ou une ville…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
            setOpen(true);
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && open && results[active])
            choose(results[active]);
        }}
      />
      {query ? (
        <button
          aria-label="Effacer la recherche"
          onClick={() => {
            setQuery("");
            input.current?.focus();
          }}
        >
          <X size={16} />
        </button>
      ) : (
        <span className="search-hint">Pays · régions · villes</span>
      )}
      {open && query && (
        <div
          className="search-results"
          role="listbox"
          id={id}
          aria-label="Résultats de recherche"
        >
          {results.length ? (
            results.map((r, i) => (
              <button
                key={r.id}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "active" : ""}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
              >
                <MapPin size={17} />
                <span>
                  <strong>{r.name}</strong>
                  <small>
                    {r.kind === "city" ? "Ville · " : ""}
                    {r.context}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))
          ) : (
            <p>Aucun territoire pour « {query} ».</p>
          )}
        </div>
      )}
    </div>
  );
}
