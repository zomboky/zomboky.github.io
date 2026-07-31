# AEROPEDIA — gabarit de page (lire avant d'écrire quoi que ce soit)

AEROPEDIA est une nouvelle encyclopédie rétro consacrée à des avions d'exception,
construite dans le dossier `docs/aeropedia/`, **exactement dans le même style visuel**
que l'encyclopédie sœur `docs/conquete-spatiale/` (NEW HORIZON, consacrée à la
conquête spatiale). `docs/aeropedia/style.css` est une copie conforme de
`docs/conquete-spatiale/style.css` : mêmes classes, même palette, mêmes polices.
**N'invente aucune classe CSS.** Le tableau des classes disponibles est repris
plus bas.

Regarde **`docs/aeropedia/sr71.html`** (page sur le SR-71 Blackbird) : c'est la
page canonique déjà écrite et validée, à utiliser comme gabarit concret de
structure (bandeau, menu, sommaire, sections numérotées, fiches, sources,
nav-pages, pied). Copie sa structure au caractère près, ne change que le contenu.

## Contraintes non négociables

1. **Un maximum d'informations réelles**, obtenues par recherche web (voir
   § Recherche). Ne pas inventer de chiffres, dates ou citations.
2. **Éviter les schémas SVG** (`.schema`) : l'auteur ne les maîtrise pas bien.
   Préférer `.fiche`, `table.tech`, `.encadre` et `.galerie` pour transmettre
   l'information technique. Zéro SVG est parfaitement acceptable.
3. **Images** : uniquement depuis Wikimedia Commons, au format
   `https://commons.wikimedia.org/wiki/Special:FilePath/<Nom_du_fichier>?width=360`
   (largeur 340 pour `.fig-gauche`/`.fig-droite`, 360 pour `.galerie`).
   **Vérifier chaque URL en HTTP 200 avant de l'utiliser** :
   ```
   curl -s -o /dev/null -w "%{http_code}" -L "https://commons.wikimedia.org/wiki/Special:FilePath/<fichier>?width=360"
   ```
   Espacer les requêtes (`sleep 2` à 3 entre chaque) : Wikimedia répond 429 si on
   enchaîne trop vite. Ne jamais insérer une image non vérifiée. Toujours une
   `<figcaption>` + `<span class="credit">` (source/licence).
4. Toute image doit avoir son "effet rétro" gratuitement : ne pas ajouter de
   filtre CSS, `image-rendering: pixelated` est hérité du `<body>` et suffit.
5. **Liens croisés façon Wikipédia** : quand le texte mentionne un avion qui a
   sa propre page AEROPEDIA (voir tableau des 15 pages plus bas), ou un lien
   pertinent vers NEW HORIZON (`../conquete-spatiale/xxx.html`) si le sujet
   recoupe l'astronautique (ex. X-15 → programme spatial), insérer un lien
   `<a href="...">`. Ne jamais linker vers une page qui n'existe pas encore.
6. Convention de sources : pas de note de bas de page, un bloc `.sources` en
   fin de page avec 5 à 8 références (ouvrages, fact sheets officielles, sites
   spécialisés). Wikipédia peut servir de point de départ pour la recherche
   mais **ne doit jamais être citée** comme source dans `.sources`.
7. Longueur cible : comparable à `sr71.html` (~260-320 lignes de contenu réel,
   8 à 11 sections `<h3>` numérotées, 2 à 4 `.fiche`, 1 à 2 `table.tech`,
   2 à 4 `.encadre`/`.alerte`, 4 à 8 images).

## Recherche (skill mach2)

1. `WebSearch` (outil Claude) pour trouver 6-10 URLs fiables : sites officiels
   de musées (National Museum of the USAF `nationalmuseum.af.mil` — souvent
   bloqué au scraping, dans ce cas se contenter du résumé WebSearch), NASA
   (nasa.gov, ntrs.nasa.gov), constructeurs (Lockheed Martin, Boeing, Rockwell
   historique), Smithsonian (airandspace.si.edu), CIA (cia.gov/stories pour les
   programmes classifiés type A-12/U-2), globalsecurity.org, sr-71.org / habu
   sites spécialisés pour le Blackbird, key.aero, aviation-history, pour le
   Tu-160 des sources comme airforce-technology.com ou ausairpower.net.
   Wikipédia = pivot pour trouver des pistes, jamais une source citée.
2. `python skills/mach2/mach2.py batch <url1> <url2> ... --out <dossier>`
   (lancer depuis la racine du dépôt). Si `--filter` réduit trop le texte,
   relancer sans filtre avec `--max-chars 7000`.
3. Lire `manifest.json` puis uniquement les `.md` utiles.
4. Rédiger en français, dans le registre encyclopédique déjà utilisé par
   `sr71.html` : phrases factuelles, chiffres précis, pas de tournures
   promotionnelles.

## Bloc `<div class="menu">` — identique sur les 15 pages + index

Copier tel quel, en ne changeant QUE le `class="actif"` (à mettre sur le lien
de la page courante, nulle part ailleurs) :

```html
<div class="menu">
  <a href="index.html">Accueil</a>
  <span class="menu-ep">I &middot; Pionniers du mur du son (1952→1956)</span>
  <a href="victor.html">Handley Page Victor</a>
  <a href="leduc.html">Leduc 02</a>
  <a href="pr9.html">Canberra PR.9</a>
  <a href="u2.html">U-2</a>
  <a href="x2.html">Bell X-2</a>
  <a href="f100d.html">F-100D</a>
  <span class="menu-ep">II &middot; L'ère hypersonique (1959→1964)</span>
  <a href="x15.html">X-15</a>
  <a href="wb57.html">WB-57</a>
  <a href="xb70.html">XB-70 Valkyrie</a>
  <a href="sr71.html">SR-71 Blackbird</a>
  <span class="menu-ep">III &middot; Guerre froide tardive et furtivité (1981→1996)</span>
  <a href="tu160.html">Tu-160</a>
  <a href="tacit-blue.html">Tacit Blue</a>
  <a href="b1b.html">B-1B Lancer</a>
  <a href="x31.html">X-31</a>
  <a href="yf118g.html">YF-118G</a>
</div>
```

## Bandeau, bandeau-défilant, pied — identiques sur toutes les pages

```html
<div class="bandeau">
  <h1>AERO<span class="rouge">PEDIA</span></h1>
  <p class="sous-titre">L'encyclopédie des avions d'exception &middot; 1952 &rarr; 1996 &middot; vitesse, altitude, discrétion</p>
  <div class="filets"></div>
</div>
```
(dans le `<div class="menu">` ci-dessus, puis :)
```html
<div class="bandeau-defilant">
  <marquee behavior="scroll" direction="left" scrollamount="4">
    ★ BIENVENUE À BORD D'AEROPEDIA ★ Le SR-71 détient depuis le 28 juillet 1976 le record du monde de vitesse pour un avion à réaction habité : Mach 3,32, soit 3 529,6 km/h ★ Plus de 4 000 missiles sol-air ont été tirés sur des Blackbird, sans jamais en abattre un seul ★ Le 6 mars 1990, le dernier vol d'un SR-71 a battu quatre records de vitesse transcontinentale en livrant l'avion au Smithsonian ★ Bonne visite !
  </marquee>
</div>
```
Pied de page (bas de `<div class="page">`, après `</div><!-- /contenu -->`) :
```html
<div class="pied">
  AEROPEDIA — encyclopédie rétro des avions d'exception<br>
  <span class="maj">Dernière mise à jour : juillet 2026</span> — 15 pages, 100 % rétro<br>
  Images : USAF / NASA / Lockheed Martin / domaine public via Wikimedia Commons<br>
  <a href="../index.html">Accueil du site</a> · <a href="index.html">Sommaire</a>
</div>
```
Adapter la ligne "Images :" à la nationalité réelle des sources utilisées sur
la page (ex. "RAF / Handley Page" pour le Victor, "VVS / Tupolev" pour le
Tu-160).

`<head>` : copier le squelette de `sr71.html` (meta charset/viewport, favicon
`../assets/icons/ours.png` en chemin relatif `https://raw.githubusercontent.com/zomboky/zomboky.github.io/master/docs/assets/icons/ours.png`,
`<link rel="stylesheet" href="style.css">`), en changeant `<title>` et la
meta description.

## Ordre chronologique des 15 pages (table de référence, pour les liens précédent/suivant)

| # | Fichier | Libellé menu | Précédent (`nav-pages` gauche) | Suivant (`nav-pages` droite) |
|---|---|---|---|---|
| 1 | `victor.html` | Handley Page Victor | `../index.html` « Retour à BearServeBeer | `leduc.html` Leduc 02 |
| 2 | `leduc.html` | Leduc 02 | `victor.html` Handley Page Victor | `pr9.html` Canberra PR.9 |
| 3 | `pr9.html` | Canberra PR.9 | `leduc.html` Leduc 02 | `u2.html` U-2 |
| 4 | `u2.html` | U-2 | `pr9.html` Canberra PR.9 | `x2.html` Bell X-2 |
| 5 | `x2.html` | Bell X-2 | `u2.html` U-2 | `f100d.html` F-100D |
| 6 | `f100d.html` | F-100D | `x2.html` Bell X-2 | `x15.html` X-15 |
| 7 | `x15.html` | X-15 | `f100d.html` F-100D | `wb57.html` WB-57 |
| 8 | `wb57.html` | WB-57 | `x15.html` X-15 | `xb70.html` XB-70 Valkyrie |
| 9 | `xb70.html` | XB-70 Valkyrie | `wb57.html` WB-57 | `sr71.html` SR-71 Blackbird |
| 10 | `sr71.html` | SR-71 Blackbird | *(déjà écrit)* | *(déjà écrit)* |
| 11 | `tu160.html` | Tu-160 | `sr71.html` SR-71 Blackbird | `tacit-blue.html` Tacit Blue |
| 12 | `tacit-blue.html` | Tacit Blue | `tu160.html` Tu-160 | `b1b.html` B-1B Lancer |
| 13 | `b1b.html` | B-1B Lancer | `tacit-blue.html` Tacit Blue | `x31.html` X-31 |
| 14 | `x31.html` | X-31 | `b1b.html` B-1B Lancer | `yf118g.html` YF-118G |
| 15 | `yf118g.html` | YF-118G | `x31.html` X-31 | `index.html` Retour au sommaire » |

Format du bloc (copier `sr71.html`, adapter les deux liens) :
```html
<div class="nav-pages">
  <a href="PRECEDENT.html">&laquo; Libellé précédent</a>
  <a href="SUIVANT.html">Libellé suivant &raquo;</a>
</div>
```

Fil d'ariane : `<div class="ariane">Vous êtes ici : <a href="index.html">Accueil</a> &rsaquo; <b>Libellé de la page</b></div>`

## Notes de contenu spécifiques par avion (désignations à clarifier dans le texte)

- **Leduc 02** : correspond à la famille Leduc 0.21/0.22, avions expérimentaux
  français à statoréacteur largués depuis un porteur. Le 0.21 vole le 7 août
  1953 (largué, incapable de décoller seul) ; le 0.22 est le premier à décoller
  de façon autonome (26 décembre 1956, Jean Sarrail) grâce à un réacteur Atar
  d'appoint. Le second exemplaire du 0.22 (parfois désigné « 02 »), construit
  à 80 %, n'a jamais volé : sa construction est arrêtée le 20 octobre 1957 au
  profit du Mirage III. Clarifier cette distinction dans la page plutôt que de
  choisir arbitrairement.
- **Tacit Blue** : le Northrop Tacit Blue a reçu la désignation de couverture
  **YF-117D** (et non « F-117D ») pour se fondre dans la série F-117 pendant
  son développement classifié ; à ne pas confondre avec le chasseur furtif
  F-117A Nighthawk, un programme distinct. Le préciser explicitement dans la
  page (titre suggéré : « Northrop Tacit Blue (YF-117D) »).
- **YF-118G** : désignation réelle du démonstrateur Boeing/McDonnell Douglas
  "Bird of Prey" (1996-1999, révélé en 2002), mais qui n'a jamais fait partie
  de la série officielle des avions X — un usage de couverture, comme pour
  Tacit Blue.
- **WB-57** : dérivé américain du bombardier britannique English Electric
  Canberra, construit sous licence par Martin puis modifié par General
  Dynamics (RB-57F, 1963) ; distinct de la page `pr9.html` qui couvre la
  version de reconnaissance photo britannique **Canberra PR.9** de la RAF.
  Prévoir un lien croisé entre les deux pages en clarifiant leur parenté.
- **F-100D** : variante de série la plus nombreuse du North American F-100
  Super Sabre, premier chasseur opérationnel à dépasser Mach 1 en vol
  horizontal en service régulier.

## Classes CSS disponibles (aucune autre à inventer)

`.fiche` (h4+dl technique), `.encadre` (bleu), `.alerte` (rouge, accident/
controverse), `.tableau-wrap` > `table.tech` (cellules `.ok`/`.ko`/`.part`/
`.num`), `.citation`+`.source`, `.stat-ligne` > `.stat` > `.val`+`.lib`,
`.galerie` > `figure`, `.fig-droite`/`.fig-gauche`, `.badge` +
`.urss`/`.usa`/`.eur`/`.chn`/`.jpn`/`.ind`/`.priv`/`.autre`, `.sommaire`,
`.sources`, `.note`, `.mono`, `hr.sep`, `.blink`. `.schema` existe mais À
ÉVITER (voir contrainte n°2).

## Après écriture

Ne pas lancer `nav.py`/`verif.py` soi-même si toutes les pages ne sont pas
encore écrites : le menu perdrait les liens vers les pages absentes. Ces
scripts seront lancés une seule fois, à la fin, quand les 15 pages existeront.
Écrire directement le bon menu (recopié ci-dessus) et les bons liens
précédent/suivant (table ci-dessus) : le résultat doit déjà être correct sans
passer par le script.
