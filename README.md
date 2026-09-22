# Atlas — Explorer le monde

Atlas géographique interactif en français, construit avec **Next.js 16, React 19, TypeScript, Tailwind CSS 4 et MapLibre GL JS 6**. Aucun compte, clé API, service de tuiles ou carte bancaire requis.

## Démarrer

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. Les données préparées sont incluses dans le dépôt. L’import n’est pas nécessaire au démarrage.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Le projet utilise Node.js 22 pour garantir la compatibilité des outils Next.js et
des dépendances natives. L’export de production est écrit dans `out/`.
Les routes profondes sont générées avec un `index.html` dans chaque répertoire ;
elles peuvent donc être servies directement par un hébergeur statique.

## Déployer sur Vercel

Vercel est la cible recommandée pour cette version : aucun serveur ni backend
n’est nécessaire. Le fichier `vercel.json` configure `.next-build` comme
répertoire de sortie et applique le cache longue durée aux assets immuables.

1. Importer le dépôt dans Vercel.
2. Conserver `npm run build` comme commande de build.
3. Vérifier que **Output Directory** vaut `out` (et non `.next-build`).
4. Définir `NEXT_PUBLIC_SITE_URL` avec l’URL publique, par exemple
   `https://atlas.example`.
5. Déployer, puis vérifier `/`, une route pays profonde, `/sitemap.xml` et
   `/robots.txt`.

La même commande `npm run build` peut être publiée sur Cloudflare Pages ou
Netlify en indiquant `out` comme répertoire de sortie. Le fichier
`vercel.json` n’est pas requis sur ces plateformes ; leurs règles de cache
peuvent reprendre les headers documentés dans ce fichier.

Le build génère un site statique dans `out/`, avec une page HTML pour chaque territoire. Servir ce dossier avec un serveur prenant en charge les répertoires `index.html`. `npm run dev` est le mode de développement ; `next start` n’est pas compatible avec l’export statique.

## Parcours

- Carte mondiale : survol, sélection, zoom et déplacement.
- Pays pilotes : France (18 régions, outre-mer compris), États-Unis (50 États et Washington D.C.), Allemagne (16 Länder), Japon (47 préfectures), Brésil (26 États et district fédéral).
- Fiches essentielles pour les 159 subdivisions ; 16 fiches enrichies.
- Recherche avec noms français et anglais, accents facultatifs et navigation au clavier.
- Fil d’Ariane, voisins cliquables, retour au monde, lien partageable et historique du navigateur.
- Mobile : carte en haut, fiche défilante en dessous. Panneau repliable.
- Mode apprentissage local avec exercices de localisation et de capitales (`/learn`).
- Comparateur partageable de deux subdivisions (`/compare`).
- Premières fiches de villes, par exemple `/city/united-states/delaware/wilmington`.

Exemples : `/country/united-states/delaware/`, `/country/germany/bavaria/`, `/country/france/provence-alpes-cote-d-azur/`.

## Architecture

- `app/[[...path]]/page.tsx` : routes statiques générées à partir du catalogue.
- `components/Atlas.tsx` : navigation et panneau encyclopédique.
- `components/Map.tsx` : client MapLibre chargé dynamiquement.
- `components/Search.tsx` : autocomplétion accessible.
- `types/geography.ts` : modèles de pays, subdivisions, villes, hydrographie et sources.
- `data/countries.json` : catalogue mondial sans géométrie.
- `data/search.json` : index léger de recherche.
- `public/geo/world.json` : fond mondial ; `public/geo/{ISO3}.json` : frontières séparées par pays.
- `public/data/{ISO3}.json` : fiches chargées à la sélection du pays.
- `lib/geography.ts` : recherche normalisée, URLs et cache partagé avec éviction des erreurs.
- `lib/quiz.ts` : génération déterministe de questions depuis les données géographiques.
- `scripts/import-data.mjs` : import reproductible avec cache et requêtes groupées.
- `app/sitemap.ts` et `app/robots.ts` : référencement des routes publiques.
- `vercel.json` : sortie statique et headers de cache/sécurité.

Ajouter un pays pilote consiste à fournir son fichier de géométrie, ses fiches et ses entrées dans les catalogues. Les composants ne contiennent pas de faits géographiques chiffrés.

Les villes suivent le modèle `City` et peuvent porter plusieurs rôles (`regional-capital`,
`largest-city`, etc.). Une relation transversale future peut être représentée par
`GeographicRelation` sans imposer de migration des fiches existantes. Toute nouvelle donnée
chiffrée doit conserver son année et une source ; les valeurs absentes restent absentes.

## Sources et limites

- **Natural Earth** : pays au 1:50 millions, subdivisions au 1:10 millions et catalogue des villes ; domaine public. https://www.naturalearthdata.com/
- **IGN via geoBoundaries** : 13 régions métropolitaines, millésime 2022, licence Etalab Open License 2.0. Les 5 régions d’outre-mer viennent des géométries Natural Earth. https://www.geoboundaries.org/api/current/gbOpen/FRA/ADM1/
- **Wikidata** : capitales, populations datées, superficies, voisins, relief, coordonnées des villes et hydrographie ; CC0. Les sources sont consultables dans chaque fiche. https://www.wikidata.org/

La géométrie est généralisée pour un atlas pédagogique, pas pour une utilisation cadastrale. Natural Earth représente principalement les frontières de fait ; celles-ci ne constituent pas une prise de position juridique. Certains microterritoires ne sont perceptibles qu’au zoom ou via la recherche.

La vue initiale des États-Unis privilégie les États contigus et celle de la France la métropole ; l’Alaska, Hawaï et les régions ultramarines restent accessibles dans la liste et la recherche.

Les données démographiques sont des instantanés sourcés, pas des estimations en temps réel. Les chiffres de différents territoires peuvent avoir des millésimes différents. Une donnée manquante est explicitement signalée. Berlin étant une ville-État, une seule ville figure dans sa fiche.

Pour rafraîchir les données :

```bash
npm run data:import
```

Le cache local `.data-cache/` évite les téléchargements répétés. Le supprimer sélectivement pour rafraîchir une source. Vérifier les tests et examiner les changements de données avant publication.

## Vérification avant publication

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

La CI GitHub Actions exécute ces mêmes contrôles sur les pull requests et sur
la branche `main`. Après un déploiement, tester une page pays, une fiche de
subdivision, une page de ville, une URL inconnue et un rafraîchissement direct
d’une route profonde. Le domaine public est utilisé pour les URLs canoniques,
Open Graph, le sitemap et les robots via `NEXT_PUBLIC_SITE_URL`.

## Performance et résilience

La carte et MapLibre sont chargés côté client. Les géométries ne sont pas incluses dans le JavaScript React. Les subdivisions et les fiches ne se chargent qu’à la sélection d’un pays, puis sont mises en cache. Aucune police, tuile ou ressource externe n’est requise pour utiliser l’atlas. Les erreurs de données et l’indisponibilité WebGL laissent la navigation textuelle accessible.
