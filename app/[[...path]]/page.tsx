import Atlas from "@/components/Atlas";
import countries from "@/data/countries.json";
import search from "@/data/search.json";
import type { Country, SearchEntry } from "@/types/geography";
import type { Metadata } from "next";
import { pageMetadata, territoryDescription } from "@/lib/seo";
import france from "@/public/data/FRA.json";
import unitedStates from "@/public/data/USA.json";
import germany from "@/public/data/DEU.json";
import japan from "@/public/data/JPN.json";
import brazil from "@/public/data/BRA.json";
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
const detailedData = {
  FRA: france,
  USA: unitedStates,
  DEU: germany,
  JPN: japan,
  BRA: brazil,
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
  const segments = (await params).path ?? [];
  const country = countries.find((item) => item.slug === segments[1]) as Country | undefined;
  if (!country) {
    if (segments[0] === "learn")
      return pageMetadata("Apprendre la géographie — Atlas", "Révisez les territoires et capitales avec le mode apprentissage de l’Atlas.", "/learn/");
    if (segments[0] === "compare")
      return pageMetadata("Comparer des territoires — Atlas", "Comparez les données géographiques de deux subdivisions.", "/compare/");
    return pageMetadata("Atlas — Explorer le monde", "Un atlas géographique interactif pour explorer le monde.");
  }
  const data = detailedData[country.id as keyof typeof detailedData];
  const division = data?.divisions.find((item) => item.slug === segments[2]);
  const territory = division ?? country;
  const path = `/${segments.join("/")}/`;
  return pageMetadata(
    `${territory.names.fr} — Atlas géographique`,
    territoryDescription(territory, division ? country : undefined),
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
