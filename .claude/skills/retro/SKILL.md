---
name: retro
description: Créer des sites web au style rétro (Web 1.0 / GeoCities / oldweb-Neocities) ou relooker des pages existantes en rétro, en s'inspirant fidèlement d'URLs de référence, avec sourcing de GIFs/images d'époque. Utiliser dès qu'on parle de style rétro, vaporwave, Web 1.0, GeoCities, Neocities, pixel-art, CRT, ou de reproduire l'esthétique d'un site fourni.
---

# Skill `/retro`

Atelier de création/relooking de sites web rétro avec **fidélité maximale** aux URLs d'inspiration.

## Modes

| Commande | Action |
|----------|--------|
| `/retro creer <idée> [url…]` | Nouveau site rétro. Si des URLs sont données → workflow fidélité. |
| `/retro retro-fy <url \| chemin>` | Relooker une page/site existant en rétro. |
| `/retro inspire <url>` | Analyser une URL → produire un **style brief** seul (pas de build). |
| `/retro assets <recherche>` | Chercher/télécharger des GIFs/images d'époque et les ranger. |

Sans argument clair, demander à l'utilisateur : créer, relooker, inspirer ou chercher des assets ?

## Références (lire selon le besoin)

- `references/fidelity-workflow.md` — **le process central** (scrape → style brief → assets → build).
- `references/styles.md` — palettes, polices, motifs, effets par ère (Web1.0, Win95, vaporwave, DOS).
- `references/asset-sources.md` — où trouver GIFs/images/boutons + licences.
- `references/components.md` — catalogue des composants Astro rétro du template.
- `references/corpus.md` — les sites d'inspiration de référence.

## Procédure générale

### Mode `inspire` / phase d'analyse de `creer` et `retro-fy`
1. Scraper la/les URL(s) — voir `fidelity-workflow.md` (Firecrawl si dispo, sinon WebFetch).
2. Produire un **style brief** structuré (palette hex, typographies, layout, motifs, éléments
   signatures, assets repérés, ton). Le montrer à l'utilisateur pour validation avant de builder.

### Mode `creer`
3. Copier `sites/_template/` → `sites/<nom-du-site>/`.
4. Sourcer et télécharger les assets nécessaires dans `assets/<nom-du-site>/` (voir `asset-sources.md`).
5. Assembler avec les composants du template (voir `components.md`), en collant au style brief.
6. `npm install` puis `npm run dev` ; prévisualiser et comparer côte à côte au rendu original ;
   itérer jusqu'à la ressemblance visée.

### Mode `retro-fy`
3. Récupérer la page cible (HTML/CSS actuels).
4. Choisir une ère/style rétro cohérent avec le contenu (ou celui demandé), voir `styles.md`.
5. Réappliquer structure + CSS rétro + composants + assets, en préservant le contenu utile.
6. Prévisualiser et itérer.

### Mode `assets`
- Chercher sur les sources de `asset-sources.md` (GifCities en tête), télécharger dans
  `assets/_shared/` (réutilisable) ou `assets/<site>/` (spécifique), et lister ce qui a été récupéré.

## Règles

- **Fidélité d'abord** : partir du site réel, jamais d'un thème générique plaqué.
- **Éthique** : reproduire l'esthétique/les techniques, ne pas cloner l'identité ni le contenu perso
  d'un site précis ; repartir d'assets d'époque/libres/générés.
- Ne jamais committer la clé Firecrawl (elle vit dans la config MCP / `.env`, pas dans le repo).
- Un site = un dossier sous `sites/` ; ses assets sous `assets/<même-nom>/`.
