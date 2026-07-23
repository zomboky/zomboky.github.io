# Styles rétro — palettes, polices, motifs, effets

Aide-mémoire par ère. **Toujours privilégier le style brief d'une URL réelle** ; ces presets ne
servent que quand il n'y a pas d'inspiration précise ou pour compléter.

## Web 1.0 / GeoCities (dominante de l'atelier)
- **Couleurs** : fonds saturés ou motif répété ; texte noir ou vif ; liens `#0000EE` / visités
  `#551A8B`. Combos typiques : noir + néon, blanc + accents primaires, pastels.
- **Polices** : Times New Roman, Arial, Comic Sans MS, Courier New. Titres en `<font>` colorés,
  parfois images-titres (GIF).
- **Layout** : tables imbriquées, centré, largeur ~760px ("800×600"), colonnes fixes.
- **Motifs de fond** : tuile répétée (étoiles, nuages, damier, paillettes) via `background-repeat`.
- **Signatures** : `<marquee>`, texte clignotant, compteur de visiteurs, boutons 88×31, webring,
  guestbook, "under construction", "best viewed in…".

## oldweb Neocities / webcore (le corpus)
- Reprend Web 1.0 mais plus soigné : layouts **bureau OS à fenêtres**, **scènes-décor cliquables**,
  lecteurs de musique custom, toggle CRT, curseurs custom, cadres décoratifs pixel.
- Palettes personnelles fortes (pastel doux, gothique terreux, néon spatial…).

## Windows 95/98
- **Couleurs** : gris `#C0C0C0`, barre de titre dégradé `#000080`→`#1084d0`, texte `#000`.
- **Bordures biseautées** : clair en haut/gauche (`#FFFFFF`/`#DFDFDF`), foncé en bas/droite
  (`#808080`/`#000`). Police : "MS Sans Serif"/Tahoma.
- Fenêtres avec barre de titre + boutons `_ □ X`, boutons 3D.

## Vaporwave / 80s
- **Couleurs** : rose `#ff71ce`, cyan `#01cdfe`, violet `#b967ff`, dégradés coucher de soleil.
- Grille néon en perspective, colonnes grecques, texte espacé `Ａ Ｅ Ｓ Ｔ Ｈ`, glow.

## Terminal / DOS
- Fond noir, texte vert `#33ff33` ou ambre `#ffb000`, monospace, curseur clignotant, ASCII art.
- Effet CRT : scanlines + léger flou + vignette.

## Effets CSS rétro utiles
- **Bordure biseautée** : `border-style: outset/inset` ou box-shadow multiples.
- **Scanlines CRT** : `repeating-linear-gradient` semi-transparent en overlay + `mix-blend-mode`.
- **Clignotement** : `@keyframes blink { 50% { opacity: 0 } }`.
- **Motif répété** : `background: url(tile.gif) repeat;`.
- **Pixel-perfect** : `image-rendering: pixelated;` sur les images/GIFs agrandis.
- **Curseur custom** : `cursor: url(cursor.cur), auto;`.
