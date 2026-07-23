# Sources d'assets (GIFs / images / boutons) + licences

Où trouver des GIFs et images d'époque, et comment les ranger.

## Sources

### GifCities — source principale
- URL : https://gifcities.org (Internet Archive).
- ~4,5M de GIFs GeoCities, recherche **sémantique**, filtrable par taille.
- Chaque GIF renvoie à sa page d'origine sur la **Wayback Machine**.
- Idéal pour : étoiles, flammes, séparateurs, "under construction", curseurs, animaux, cœurs…

### Assets originaux d'un site d'inspiration en ligne
- Si l'URL de référence est vivante (ex. sites Neocities du corpus), on peut récupérer directement
  ses GIFs/fonds/boutons/curseurs (via Firecrawl ou fetch des `src`/`url()` repérés).
- **Respecter la note éthique** : reproduire l'esthétique, ne pas cloner l'identité/contenu perso.
  Préférer des équivalents d'époque quand l'asset est très identitaire.

### Wayback Machine / archive.org
- https://web.archive.org et la collection GeoCities d'archive.org pour des assets d'époque d'origine.

### Boutons 88×31 & webrings
- Collections communautaires de boutons 88×31 (Neocities, cyber.dabamos, hosts oldweb).
- Pour un webring : générer les boutons + la nav prev/next/random.

### Génération (quand rien ne convient)
- Créer des motifs/tuiles, bordures, icônes en **SVG/CSS** ou pixel-art.
- `image-rendering: pixelated` pour un rendu net à l'agrandissement.

## Rangement

```
assets/_shared/<catégorie>/…   # réutilisable entre sites (ex. curseurs, boutons génériques)
assets/<nom-du-site>/…         # spécifique à un site
```
Puis copier/importer vers `sites/<nom>/public/` au moment du build.

## Licences

- Les GIFs GeoCities/oldweb sont des **artefacts d'époque** : OK pour usage **perso/hobby**.
- Pour un usage **commercial** : prudence — vérifier la source, préférer libres/CC0 ou générés,
  créditer si demandé.
- **Ne jamais** présenter le contenu perso identitaire d'un site précis comme le sien.
