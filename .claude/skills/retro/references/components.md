# Catalogue des composants Astro rétro

Fournis dans `sites/_template/src/components/`. Tous se règlent sur le **style brief** (couleurs via
les variables CSS `--retro-*` de `retro.css`, assets via `public/`). La page `src/pages/index.astro`
du template est une **démo vivante** de chacun.

## Layout
- **`RetroLayout.astro`** — enveloppe de page. Props : `title`, `vars` (surcharges CSS, ex.
  `{ '--retro-bg': '#000', '--retro-accent': '#0ff' }`), `bgImage` (tuile de fond), `cursor`.
  Rend aussi l'overlay CRT (piloté par `CRTToggle`).

## Texte / déco
- **`Marquee.astro`** — texte défilant (`<marquee>` natif). Props : `direction`, `behavior`, `scrollamount`.
- **`BlinkText.astro`** — texte clignotant. Prop : `color`.
- **`SparkleGif.astro`** — petit GIF/déco inline. Props : `src`, `alt`, `size`.
- **`UnderConstruction.astro`** — bandeau "en construction". Props : `src` (gif), `text`.
- **`PatternBackground.astro`** — applique une tuile/couleur au `body`. Props : `src`, `color`, `fixed`.
- **`CustomCursor.astro`** — curseur custom global. Prop : `src`.

## Navigation / liens
- **`BulletNav.astro`** — nav verticale à puces GIF. Props : `items: {label,href}[]`, `bullet`.
- **`Button88x31.astro`** — bouton bannière 88×31. Props : `href`, `src`, `alt`, `title`.
- **`WebRing.astro`** — nav d'anneau préc./aléatoire/suiv. Props : `name`, `prev`, `random`, `next`.

## Interactif (script client inclus)
- **`VisitorCounter.astro`** — compteur odomètre (localStorage, faux compteur). Props : `start`,
  `digits`, `label`. Pour un vrai compteur partagé → brancher un service externe.
- **`MusicPlayer.astro`** — mini-lecteur audio (play/pause). Props : `src` (audio dans public/),
  `title`, `loop`.
- **`CRTToggle.astro`** — bouton on/off de l'overlay CRT (scanlines). Props : `onLabel`, `offLabel`.

## Layouts spéciaux (vus dans le corpus)
- **`Desktop.astro`** + **`OSWindow.astro`** — bureau Win95/XP avec fenêtres empilables/déplaçables.
  `OSWindow` props : `title`, `width`, `x`, `y`, `draggable`, `closable`. (façon *lostlove*)
- **`SceneLayout.astro`** + **`SceneItem.astro`** — décor par images positionnées cliquables
  (positions en %, responsive). `SceneItem` props : `x`, `y`, `w`, `href`, `src`, `alt`, `title`.
  (façon *mustymixtape* / *spacesandwich*)

## Ajouter un composant
Créer `src/components/<Nom>.astro`, styliser avec les variables `--retro-*`, documenter ici, et
l'ajouter à la démo si utile. Pour de l'interactif complexe, un `<script>` dans le `.astro` suffit
généralement ; sinon activer React dans `astro.config.mjs` et utiliser une island `.tsx`.
