# Workflow "fidélité" — reproduire fidèlement un site d'inspiration

Le cœur du skill. But : à partir d'une ou plusieurs URLs, produire un site qui **ressemble
vraiment** à la référence, pas une interprétation générique.

## Étape 1 — Scrape

### Avec Firecrawl (préféré, capture + code)
Si le MCP `firecrawl` est configuré (`claude mcp list` le montre), utiliser ses outils pour récupérer :
- **Capture(s) d'écran** du rendu réel (desktop, et si pertinent le haut de page + pleine page).
- **HTML** rendu + **feuilles CSS liées** (URLs des `.css`).
- **Contenu** propre (markdown) pour comprendre la structure et les textes.
- La **liste des assets** (images/GIFs) référencés (`<img src>`, `background:url()`, favicons, curseurs).

Config si absent :
```
claude mcp add firecrawl -e FIRECRAWL_API_KEY=<clé> -- npx -y firecrawl-mcp
```
(clé gratuite sur firecrawl.dev/app/api-keys).

### Sans Firecrawl (repli)
Utiliser `WebFetch` sur l'URL (et sur les `.css` liés) pour lire le code source. Limite : pas de
capture du rendu → demander éventuellement une capture à l'utilisateur pour valider les couleurs.

## Étape 2 — Style brief

Produire un document structuré (à montrer à l'utilisateur pour validation) :

- **Palette** : couleurs exactes en hex (extraites du CSS ou échantillonnées sur la capture) —
  fond, texte, liens, accents, bordures.
- **Typographies** : familles (souvent web-safe : Times, Arial, Verdana, Courier, Comic Sans),
  tailles, casse, `text-shadow`/effets.
- **Layout** : structure réelle — tables, colonnes flottantes, grille, **bureau OS à fenêtres**,
  **scène-décor par images positionnées**, centré 800×600, etc.
- **Fonds & motifs** : couleur unie, image répétée (`repeat`), dégradé, motif animé.
- **Éléments signatures** : marquee, compteur, boutons/webring 88×31, "under construction",
  guestbook, lecteur de musique, curseur custom, toggle CRT, sparkles…
- **Assets repérés** : liste des GIFs/images clés (avec leur rôle) à récupérer ou recréer.
- **Ton** : mignon / gothique / spatial / lo-fi / vaporwave…

## Étape 3 — Validation

Montrer le style brief (idéalement à côté de la capture) et confirmer avec l'utilisateur avant de
construire. Ajuster selon ses retours.

## Étape 4 — Assets

Récupérer les assets (voir `asset-sources.md`) et les ranger dans `assets/<nom-du-site>/`.
Ordre de préférence pour la fidélité :
1. **Assets originaux** du site d'inspiration (s'il est en ligne) — dans le respect de la note éthique.
2. **GifCities / Wayback** pour des GIFs d'époque équivalents.
3. **Générés** (SVG/CSS/pixel-art) quand rien ne convient.

## Étape 5 — Build

- Copier `sites/_template/` → `sites/<nom-du-site>/`.
- Composer avec les composants (`components.md`) réglés sur le style brief.
- Placer les assets dans `public/` du site (ou les importer), pointer les composants dessus.

## Étape 6 — Preview & itération

- `cd sites/<nom> && npm install && npm run dev`.
- Comparer **côte à côte** avec le rendu original (capture Firecrawl ou navigateur / skill `run`).
- Ajuster couleurs, espacements, polices, assets jusqu'à la ressemblance visée.
