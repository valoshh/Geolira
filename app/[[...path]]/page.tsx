import Atlas from "@/components/Atlas";
import countries from "@/data/countries.json";
import search from "@/data/search.json";
import type { Country, SearchEntry } from "@/types/geography";
import type { Metadata } from "next";
import { pageMetadata, territoryDescription } from "@/lib/seo";
export const dynamicParams = false;
export function generateStaticParams() {
  return [
    { path: [] },
    { path: ["learn"] },
    { path: ["compare"] },
    { path: ["city", "united-states", "delaware", "wilmington"] },
    { path: ["city", "united-states", "delaware", "dover"] },
    ...countries.map((c) => ({ path: ["country", c.slug] })),
    ...search
      .filter((s) => {
        const length = s.href.split("/").filter(Boolean).length;
        return length === 3 || length === 4;
      })
      .map((s) => ({ path: s.href.split("/").filter(Boolean) })),
  ];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
  const segments = (await params).path ?? [];
  const country = countries.find((item) => item.slug === segments[1]) as
    Country | undefined;
  if (!country) {
    if (segments[0] === "learn")
      return pageMetadata(
        "Apprendre la géographie — Atlas",
        "Révisez les territoires et capitales avec le mode apprentissage de l’Atlas.",
        "/learn/",
      );
    if (segments[0] === "compare")
      return pageMetadata(
        "Comparer des territoires — Atlas",
        "Comparez les données géographiques de deux subdivisions.",
        "/compare/",
      );
    return pageMetadata(
      "Atlas — Explorer le monde",
      "Un atlas géographique interactif pour explorer le monde.",
    );
  }
  const path = `/${segments.join("/")}/`;
  const entry = search.find((item) => item.href === path);
  const description = entry
    ? `Découvrez ${entry.name}, ${entry.context.toLowerCase()}, dans l’Atlas géographique.`
    : territoryDescription(country);
  return pageMetadata(
    `${entry?.name ?? country.names.fr} — Atlas géographique`,
    description,
    path,
  );
}

export default function Page() {
  return (
    <Atlas
      countries={countries as Country[]}
      searchIndex={search as SearchEntry[]}
    />
  );
}
