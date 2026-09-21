import type { Metadata } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/seo";
export const metadata: Metadata = {
  title: "Atlas — Explorer le monde",
  description:
    "Un atlas géographique interactif. Explorez les pays, leurs régions et les paysages qui les façonnent.",
  metadataBase: new URL(siteUrl),
  applicationName: "Atlas géographique",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName: "Atlas géographique",
    title: "Atlas — Explorer le monde",
    description:
      "Un atlas géographique interactif pour explorer les pays, régions et villes du monde.",
  },
  twitter: {
    card: "summary",
    title: "Atlas — Explorer le monde",
    description:
      "Un atlas géographique interactif pour explorer les pays, régions et villes du monde.",
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
