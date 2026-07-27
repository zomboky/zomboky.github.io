# NEW HORIZON — passation de session

**Dernière mise à jour : 27 juillet 2026.** Ce fichier est le point d'entrée unique pour
reprendre le travail. Tout ce qui suit a été validé avec l'utilisateur ; ne pas re-poser
les questions déjà tranchées.

---

## 1. Ce qu'on fait et pourquoi

Le site `docs/conquete-spatiale/` (**NEW HORIZON**, encyclopédie rétro de la conquête
spatiale, publiée sur <https://zomboky.github.io/conquete-spatiale/>) doit être :

1. **réordonné dans l'ordre chronologique** — le menu partait bien (Pionniers → Spoutnik →
   Mercury → Apollo) puis basculait en thématique pure ;
2. **complété par 9 nouvelles sections** — des pans entiers manquaient (espace applicatif,
   militaire, télescopes, propulsion, cosmodromes, droit et débris…) ;
3. **massivement enrichi** sur les pages déjà écrites, à partir de sources fiables.
   Demande textuelle de l'utilisateur : *« on doit avoir quelque chose de très solide […]
   un maximum d'informations différentes sur chaque sujet, et quand je dis un maximum
   c'est vraiment un maximum »*, en s'appuyant sur le skill **mach2**.

**Contrainte absolue : le style rétro ne change pas.** Aucune police, aucune couleur,
aucun composant nouveau. Tout existe déjà dans `docs/conquete-spatiale/style.css`.

### Décisions déjà actées par l'utilisateur (ne pas y revenir)

| Question posée | Réponse retenue |
|---|---|
| Jusqu'où pousser la réorganisation ? | **Réordonner seulement.** Les pages thématiques gardent titre, URL et contenu ; seul l'ordre change et les nouvelles pages s'insèrent à leur place chronologique. **Pas** de refonte en pages d'époque. |
| Quelles nouvelles sections ? | **Toutes** celles proposées (9 pages, listées § 4). |
| Traitement des sources | Convention existante conservée : pas de citation en ligne, un bloc `.sources` en fin de page, étoffé. |

---

## 2. État d'avancement

| Lot | Contenu | État |
|---|---|---|
| 0 | `git pull` + inventaire des 19 pages | ✅ fait |
| 1 | Menu chronologique + `.nav-pages` + `.menu-ep` + plan du site | ✅ fait (ce commit) |
| 2 | 5 nouvelles pages : `avant-espace`, `propulsion`, `animaux`, `cosmodromes`, `satellites` | ✅ fait |
| 3 | 4 nouvelles pages : `militaire`, `telescopes`, `apesanteur`, `debris-droit` | ⬜ à faire |
| 4 | Enrichissement I-II : `pionniers`, `spoutnik`, `lanceurs`, `sondes`, `mercury-gemini`, `apollo`, `lune-sovietique`, `europe` | ⬜ à faire |
| 5 | Enrichissement III-IV : `chine`, `nations`, `stations`, `navettes`, `newspace`, `artemis` | ⬜ à faire |
| 6 | Annexes : `accidents`, `hommes`, `donnees`, `chronologie`, `index` | ⬜ à faire |

**Reprendre au lot 3.**

### Fait dans le lot 2

Les 5 pages sont écrites, `nav.py` et `verif.py` passés après chacune (`OK — liens, menu,
classes et compteur coherents`, 24 pages). Toutes respectent le cahier des charges du § 6 :

```
avant-espace  821 l. | 6 fiche |  8 tech | 2 svg | 13 enc/alerte | 13 sources
propulsion    847 l. | 6 fiche |  7 tech | 3 svg |  9 enc/alerte | 12 sources
animaux       712 l. | 6 fiche |  4 tech | 2 svg |  9 enc/alerte | 11 sources
cosmodromes   644 l. | 9 fiche |  4 tech | 2 svg |  6 enc/alerte | 12 sources
satellites    731 l. | 11 fiche|  4 tech | 2 svg |  9 enc/alerte | 13 sources
```

Onze schémas SVG originaux ont été créés (canon de Verne, vaisseau BIS, carte du Δv,
étagement, cycles moteur, altitudes des vols animaux, frise des premières, couloirs de tir,
latitude/inclinaison, étages orbitaux, Molnia vs GEO). Toutes les images Wikimedia ont été
vérifiées une par une en HTTP 200 avant intégration.

**Attention — liens différés :** trois renvois vers des pages du lot 3 ont été
volontairement retirés pour garder `verif.py` vert. À rétablir en écrivant le lot 3 :

| Page | Emplacement | Lien à remettre |
|---|---|---|
| `avant-espace.html` | encadré « Un article de droit spatial… » (§ Collier's) | `debris-droit.html` |
| `animaux.html` | § 11 « Après les pionniers », 1<sup>er</sup> paragraphe | `apesanteur.html` |
| `animaux.html` | `.note` finale « Pour aller plus loin » | `apesanteur.html` |

---

## 3. Outillage — à utiliser, ne pas refaire à la main

Deux scripts Python vivent dans ce dossier (`plans/new-horizon/`, hors `docs/`, donc non
publié). Python 3.12 est installé et fonctionne.

### `nav.py` — régénérateur de navigation

```
python plans/new-horizon/nav.py
```

C'est la **source unique de vérité de l'ordre du site**. La liste `ORDRE` en tête du
fichier contient déjà les 28 pages (19 existantes + 9 à écrire), avec leur libellé de
menu et leur époque. Le script :

- réécrit le bloc `<div class="menu">` **à l'identique dans chaque page** (il est dupliqué
  en dur 19 fois — ne jamais l'éditer à la main) ;
- réécrit le bloc `<div class="nav-pages">` (précédent / suivant) selon l'ordre ;
- met à jour le nombre de pages annoncé dans le pied de page.

**Les pages listées dans `ORDRE` mais absentes du disque sont simplement ignorées.**
Donc : écrire une nouvelle page → relancer `nav.py` → elle apparaît partout. C'est tout.

### `verif.py` — contrôles d'intégrité

```
python plans/new-horizon/verif.py
```

Vérifie : liens relatifs et ancres `#id` (zéro lien mort), menu identique partout avec un
seul `actif` pointant sur la bonne page, aucune classe HTML absente de `style.css`
(garantit qu'aucun style n'a été inventé), compteur de pages du pied cohérent.
**À lancer avant chaque commit.** Sortie attendue : `OK — liens, menu, classes et
compteur coherents.`

---

## 4. L'ordre chronologique cible (28 pages)

Tri par **date de début du sujet**. Déjà encodé dans `nav.py` → `ORDRE`.
🆕 = à écrire.

**I · Avant le spatial (…→1957)**
`avant-espace` 🆕 (~160) · `pionniers` (1232) · `propulsion` 🆕 (1903) · `animaux` 🆕 (1947) · `cosmodromes` 🆕 (1955)

**II · L'ouverture de l'espace (1957→1969)**
`spoutnik` (1957) · `lanceurs` (1957) · `sondes` (1959) · `militaire` 🆕 (1959) · `satellites` 🆕 (1960) · `mercury-gemini` (1961) · `apollo` (1961) · `lune-sovietique` (1962) · `europe` (1962) · `apesanteur` 🆕 (1965) · `telescopes` 🆕 (1966) · `debris-droit` 🆕 (1967)

**III · Stations et navettes (1970→2000)**
`chine` (1970) · `nations` (1970) · `stations` (1971) · `navettes` (1972)

**IV · L'espace contemporain (2000→2026)**
`newspace` (2002) · `artemis` (2017)

**Annexes** (transverses, hors frise)
`accidents` · `hommes` · `donnees` · `chronologie`

### Contenu attendu des 9 nouvelles pages

| Fichier | Matière à couvrir |
|---|---|
| `avant-espace.html` | Lucien de Samosate, Kepler *Somnium*, Cyrano, Verne *De la Terre à la Lune* (1865), Méliès (1902), Fritz Lang *Frau im Mond* (1929) et l'invention du compte à rebours, la VfR, la BIS, la série *Collier's* (1952-54), von Braun chez Disney (1955) |
| `propulsion.html` | Équation de Tsiolkovski démontrée, Δv et étagement, poudre vs liquides, LOX/RP-1, hypergols UDMH/N₂O₄ et leur toxicité, cryogénie LH₂, cycles (générateur de gaz, combustion étagée, expander, flux intégral), Isp comparées, NERVA et RD-0410, propulsion ionique (SERT, Deep Space 1, Dawn, Hall), voile solaire (IKAROS, LightSail 2) |
| `animaux.html` | Drosophiles V-2 (1947), Albert I-VI, Laïka (1957) et la vérité tardive sur sa mort, Belka et Strelka (1960), Ham et Enos (1961), Félicette (1963), les tortues de Zond 5 (1968), les tardigrades, l'éthique |
| `cosmodromes.html` | Baïkonour, Plessetsk, Vostotchny, Canaveral/KSC (LC-39), Vandenberg, Wallops, Kourou et l'avantage équatorial, Jiuquan/Taiyuan/Xichang/Wenchang, Tanegashima/Uchinoura, Sriharikota, Alcântara, Mahia. Table latitude / azimuts autorisés / gain dû à la rotation terrestre + schéma SVG des couloirs de tir |
| `militaire.html` | Corona/Discoverer et la récupération de capsules en vol, KH-11, Zenit, MOL et Almaz (station militaire habitée et son canon), alerte précoce (MIDAS, DSP, SBIRS, Oko), écoute (Ferret, Rhyolite), IDS « guerre des étoiles » (1983), Polyus-Skif (1987), ASAT (1985, 2007, 2019, 2021), Space Force (2019) |
| `satellites.html` | SCORE (1958), Echo, Courier, TIROS-1 (1960), Transit, Telstar (1962), Syncom et l'orbite de Clarke, Intelsat, Molnia, Landsat (1972), SPOT, Meteosat, GPS/GLONASS/Galileo/Beidou, Sentinel/Copernicus, Argos, Cospas-Sarsat |
| `apesanteur.html` | Déminéralisation osseuse, atrophie musculaire, redistribution des fluides, SANS, radiations GCR/SPE, mal de l'espace. Scaphandres SK-1, Berkut, A7L, EMU, Orlan, Sokol, xEMU/AxEMU. EVA de Leonov (1965) et son scaphandre gonflé, Ed White. Vie à bord. Records : Polyakov 437 j, Kelly/Kornienko, Rubio |
| `telescopes.html` | Fenêtres atmosphériques, OAO, Uhuru, IUE, IRAS (1983), Hubble (1990), le défaut du miroir et STS-61 (1993), Compton, Chandra, XMM-Newton, Spitzer, COBE/WMAP/Planck, Kepler, Gaia, TESS, JWST (2021) et L2, Euclid |
| `debris-droit.html` | Traité de l'espace (1967), accord sauvetage (1968), Convention responsabilité (1972), immatriculation (1975), Traité sur la Lune (1979) et son échec, Accords Artemis (2020). Syndrome de Kessler (1978), Fengyun-1C (2007), Iridium 33 / Cosmos 2251 (2009), règle des 25 ans puis 5 ans (FCC 2022), catalogue du 18th SDS, congestion des mégaconstellations |

---

## 5. Le gabarit d'une page (copier `apollo.html`)

`apollo.html` est la page canonique la plus complète — s'en servir de modèle.
Structure exacte :

```
<div class="page">
  <div class="bandeau">        h1 NEW HORIZON + p.sous-titre + div.filets
  <div class="menu">           ← généré par nav.py, ne pas écrire à la main
  <div class="bandeau-defilant">  marquee, identique partout
  <div class="ariane">         Vous êtes ici : <a href="index.html">Accueil</a> › <b>Titre</b>
  <div class="contenu">
      <h2>Titre de la page</h2>
      <div class="sommaire">   ol de liens #ancre vers chaque h3
      <h3 id="ancre">1. …</h3> … 8 à 14 sections numérotées
      <div class="sources">    <b>Pour approfondir :</b> + ul
      <div class="nav-pages">  ← généré par nav.py
  </div>
  <div class="pied">           mentionne le nombre de pages ← géré par nav.py
</div>
<script src="../scripts/visitor-counter.js"></script>
```

### Composants disponibles (tous déjà dans `style.css` — n'en inventer aucun)

| Classe | Usage |
|---|---|
| `.fiche` | fiche technique crème : `<h4>` + `<dl><dt>/<dd>` |
| `.encadre` | encadré bleu : `<span class="titre">` + texte |
| `.alerte` | encadré rouge : accident, échec, controverse |
| `.tableau-wrap` > `table.tech` | tableau avec `<caption>` ; cellules `.ok` `.ko` `.part` `.num` |
| `.schema` > `<svg viewBox>` + `.legende` | schéma original sur fond noir |
| `.citation` + `.source` | citation encadrée |
| `.stat-ligne` > `.stat` > `.val` + `.lib` | compteurs CRT verts |
| `.galerie` > `figure` | grille d'images |
| `.fig-droite` / `.fig-gauche` | image flottante |
| `.badge` + `.urss .usa .eur .chn .jpn .ind .priv .autre` | pastilles nationales |
| `.chrono` > `li` > `.date`, `.prem` | liste chronologique (page chronologie) |
| `.sommaire`, `.sources`, `.note`, `.mono`, `hr.sep`, `.blink` | divers |

Palette : `--gris #c0c0c0` `--gris-fonce #808080` `--rouge #ff0000`
`--rouge-sombre #990000` `--bleu-nuit #000033` `--jaune #ffff00` `--vert-crt #00ff00`.
Polices : Arial 13 px, Arial Black (titres), Courier New (technique), Verdana (tableaux).

Images : Wikimedia Commons via
`https://commons.wikimedia.org/wiki/Special:FilePath/<Fichier>?width=360`, toujours avec
`<figcaption>` + `<span class="credit">`.

---

## 6. Objectif d'enrichissement (chiffré)

Les pages existantes font aujourd'hui **242 à 404 lignes**. Cible : **au moins le double**
(≥ 700-900 lignes). Après passage, chaque page doit compter :

- **≥ 6** `.fiche`, **≥ 3** `table.tech`, **≥ 2** `.schema` SVG originaux,
  **≥ 4** `.encadre`/`.alerte`, **≥ 8** entrées dans `.sources`.

État actuel (fiche / encadre / alerte / tech / svg) — le déficit est surtout en `.fiche`,
`.encadre` et `.schema` :

```
accidents   1/1/1/4/0     apollo      5/2/0/4/1     artemis     3/0/1/4/1
chine       1/0/0/4/1     chronologie 0/1/0/0/0     donnees     1/0/0/8/1
europe      2/1/1/3/1     hommes      1/0/0/7/0     lanceurs    0/1/0/8/1
lune-sov.   2/1/1/4/1     mercury-gem 3/0/0/3/1     nations     0/1/0/4/0
navettes    2/0/1/4/0     newspace    2/0/1/4/0     pionniers   2/2/2/2/1
sondes      1/0/0/7/1     spoutnik    3/0/2/3/1     stations    3/2/2/4/1
```

Privilégier l'information **différente** : chiffres exacts, dates précises, noms propres,
causes techniques des échecs, coûts en dollars de l'époque **et** convertis, masses,
poussées, Isp, durées, décisions politiques, controverses documentées.

### Boucle de recherche (skill `mach2`)

Le skill est désormais **versionné dans le dépôt** : `skills/mach2/` (implémentation) et
`.claude/skills/mach2/SKILL.md` (déclaration). Il fonctionne donc aussi bien en local qu'en
session cloud. Le chemin Windows `C:\Users\Zombo\.claude\skills\mach2\` mentionné dans les
versions antérieures de ce document n'est plus la référence.

Au premier usage dans un conteneur neuf :
`pip install -r skills/mach2/requirements.txt` (requests, trafilatura, beautifulsoup4, lxml,
markdownify). Toujours lancer depuis la racine du dépôt.

1. `WebSearch` sur le sujet → 8-15 URLs fiables ;
2. `python skills/mach2/mach2.py batch <urls…> --filter "<sujet précis>" --out <scratchpad>/<page>` ;
3. lire `manifest.json`, puis **seulement** les `.md` utiles ;
4. rédiger en français dans le HTML avec les classes existantes ;
5. compléter le bloc `.sources` de la page.

**Ne pas** lire les pages une par une avec WebFetch : mach2 écrit dans des fichiers et
économise énormément de contexte.

⚠️ Retour d'expérience du lot 2 : `--filter` est parfois trop agressif et réduit une page à
quelques dizaines de mots. Si le manifeste annonce un compte de mots anormalement bas,
relancer la page sans `--filter` mais avec `--max-chars 7000`.

Domaines à privilégier (`allowed_domains` de WebSearch) : `nasa.gov` (History Series
SP-4xxx, NTRS), `nssdc.gsfc.nasa.gov`, `esa.int`, `cnes.fr`, `jaxa.jp`, `isro.gov.in`,
`space.skyrocket.de`, `planet4589.org`, `astronautix.com`, `capcomespace.net`,
`russianspaceweb.com`, `airandspace.si.edu`. Wikipédia sert de pivot pour trouver les
sources primaires, **jamais** de source citée.

---

## 7. Fait dans le lot 1 (ce commit)

- `style.css` : **une seule** règle ajoutée, `.menu .menu-ep` — un intertitre d'époque en
  `display:block` qui découpe le menu en une rangée de liens par époque. Aucune couleur
  ni police nouvelle (jaune + Courier New, déjà utilisés par `.bandeau .sous-titre`).
- Les 19 pages : menu réordonné chronologiquement et découpé en 5 blocs
  (I, II, III, IV, Annexes) ; `.nav-pages` recâblé pour suivre la frise.
- `index.html` : « Le plan du site » regroupé sous 5 `<h3>` d'époque, cartes réordonnées,
  préfixes numériques retirés (ils devenaient faux à chaque insertion) et paragraphe
  d'introduction expliquant la lecture chronologique.
- `plans/new-horizon/` : `nav.py`, `verif.py` et ce document.

### Reste à faire sur `index.html` (lot 6)

- ajouter les 9 cartes des nouvelles pages dans les bonnes grilles d'époque ;
- mettre à jour les `.stat` et la frise SVG « Un siècle d'astronautique » ;
- étoffer « Sources et méthode ».

---

## 8. Points de vigilance

- **Le menu est dupliqué en dur dans chaque page.** Toujours passer par `nav.py`.
- **`docs/` est la racine publiée** par GitHub Pages. Les scripts restent dans `plans/`.
- Le pied de page annonce le nombre de pages : `nav.py` le tient à jour, ne pas y toucher.
- Le dépôt reçoit aussi des commits depuis d'autres sessions (le clone local était en
  retard de 20 fichiers au démarrage) : **`git pull` avant de commencer**.
- Convention de message de commit du dépôt :
  `Update conquete-spatiale — <description>`.
