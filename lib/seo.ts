import type { Metadata } from "next";
import type {
  Names,
  SearchEntry,
} from "@/types/geography";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "http://localhost:3000";

export function pageMetadata(
  title: string,
  description: string,
  path = "/",
): Metadata {
  const canonical = `${siteUrl}${path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      url: canonical,
      siteName: "Atlas géographique",
      title,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}

export function territoryDescription(
  territory: { names: Names },
  country?: { names: Names },
) {
  const prefix = country ? `${territory.names.fr}, ${country.names.fr}` : territory.names.fr;
  return `Découvrez la capitale, les principales villes, la population, le relief, les cours d’eau et les territoires voisins de ${prefix}.`;
}

export function searchEntryMetadata(entry: SearchEntry) {
  return pageMetadata(
    `${entry.name} — Atlas géographique`,
    `Explorez la fiche géographique de ${entry.name} dans l’Atlas géographique.`,
    entry.href,
  );
}
