import type { MetadataRoute } from "next";
import countries from "@/data/countries.json";
import search from "@/data/search.json";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries = [
    { url: `${siteUrl}/`, priority: 1 },
    { url: `${siteUrl}/learn/`, priority: 0.6 },
    { url: `${siteUrl}/compare/`, priority: 0.6 },
    ...countries.map((country) => ({
      url: `${siteUrl}/country/${country.slug}/`,
      priority: country.pilot ? 0.8 : 0.4,
    })),
    ...search.map((entry) => ({ url: `${siteUrl}${entry.href}`, priority: entry.enriched ? 0.7 : 0.5 })),
  ];
  return entries.map((entry) => ({
    ...entry,
    lastModified: new Date("2026-09-18"),
    changeFrequency: "monthly" as const,
  }));
}
