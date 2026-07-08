---
name: retro-web-style
description: Add neocities/geocities-style retro web elements (marquee, blinking text, beveled pixel buttons, LCD visitor counter, tiled backgrounds, framed boxes) to a page of this site. Use when the user asks to make a page "rétro", "façon neocities/geocities", "vieux web", or wants widgets like un bandeau "under construction", un compteur de visiteurs, des boutons pixel, un cadre bordé.
---

# Style "vieux web" / neocities

Le look de référence a été défini à partir de sites neocities donnés par
l'utilisateur (à revisiter si le style dérive) :

- https://galactic-circus.neocities.org/
- https://fairygore.neocities.org/
- https://lostlove.neocities.org/
- https://mindgoneby.neocities.org/
- https://mustymixtape.neocities.org/
- https://spacesandwich.neocities.org/
- https://sunnysvideo.neocities.org/

Pour les assets (gifs, textures, doodles, images rétro) :
- https://www.cameronsworld.net/ (archive/collection impressionnante de gifs et images du vieux web, librement consultable)

Ce qu'on en retient : fond texturé/tuilé (souvent un gif), police
monospace ou pixel, curseur personnalisé, bandeau "under construction"
avec texte clignotant + marquee défilant, boutons façon vieux bouton
Windows 3D (biseauté clair/foncé), petits cadres à bordure double
(couleur claire + contour noir), compteur de visiteurs façon écran LCD
(fond noir, texte vert néon). On ne cherche pas à copier ces sites au
pixel près, juste l'esprit — le site a sa propre identité (thème
espace/ours/bière).

## Patterns déjà implémentés dans ce repo

Tout est dans `docs/styles/welcome.css` (utilisé par `docs/index.html`).
**Réutiliser ces classes plutôt qu'en réinventer** — copier/coller le CSS
dans le `<head>` de la nouvelle page, ou factoriser dans un fichier
partagé si le style doit s'appliquer à 3+ pages.

| Classe / id | Effet | Snippet HTML minimal |
|---|---|---|
| `.retro-button` | Bouton biseauté gris façon Windows 3D, avec effet "pressé" au clic | `<a class="retro-button" href="...">🚀 Label</a>` |
| `.blink` | Texte clignotant (1s) | `<span class="blink">⚠ TEXTE ⚠</span>` |
| `#under-construction` + `#blurtext` + `<marquee>` | Bandeau "under construction" avec texte qui défile | voir `docs/index.html` lignes 24-33 |
| `.frame` | Petit cadre centré, bordure double (clair + contour noir), fond texturé | `<div class="frame"><p>...</p></div>` |
| `.main-frame` | Grand cadre de fond, texture tuilée | usage ponctuel, voir `docs/index.html` |
| `.visitor-counter` + `.visitor-counter-digits` | Compteur LCD vert sur fond noir | voir `docs/index.html` lignes 56-59, alimenté par `docs/scripts/visitor-counter.js` |
| `body { cursor: url(...) }`, `background-image` tuilé, `font-family: monospace` | Ambiance générale de la page | déjà sur `<body>` dans `welcome.css` |

Assets réutilisables sous `docs/assets/` : `cursors/real_hand_cursor.cur`
(curseur), `gif/space_wallpaper_hd.gif` (fond tuilé), `textures/*`
(textures de mur pour cadres), `gif/*` divers (ambiance).

## Checklist pour appliquer le style à une nouvelle page

1. Lier `styles/welcome.css` (ou extraire les règles nécessaires si la
   page a déjà sa propre feuille de style, pour éviter les collisions).
2. Reprendre `font-family: monospace`, le curseur personnalisé, et un
   fond tuilé cohérent avec le thème de la page.
3. Ajouter au moins un élément "signature" du style : bandeau blink +
   marquee, cadre `.frame`, ou boutons `.retro-button` — pas besoin de
   tout mettre partout, choisir ce qui a du sens pour le contenu.
4. Garder la cohérence visuelle avec `index.html` (mêmes couleurs :
   gris `#c0c0c0`/`#808080` pour les boutons, vert `#0f0` sur noir pour
   le LCD, jaune `#ff0` pour le blink).
5. Vérifier dans le navigateur que rien ne casse la lisibilité (contraste
   texte/fond) ni la mise en page responsive existante.

## Garde-fous

- Ne pas dupliquer tout `welcome.css` dans chaque page si un simple lien
  `<link>` suffit — dupliquer seulement si la page a des besoins
  vraiment différents.
- Ne pas ajouter d'éléments qui nuisent à l'accessibilité (clignotement
  trop rapide, contraste illisible) — le style doit rester ludique, pas
  gênant.
- `docs/test.html` sert de bac à sable pour s'entraîner sur ce style
  avant de toucher aux vraies pages du site.
