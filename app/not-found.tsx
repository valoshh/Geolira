import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <p>GEOLIRA · 404</p>
      <h1>Territoire introuvable</h1>
      <p>Cette adresse ne correspond à aucun territoire de l’atlas.</p>
      <Link href="/">Revenir à la carte du monde</Link>
    </main>
  );
}
