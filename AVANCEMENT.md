# AVANCEMENT — Portage Hibou 3D → Godot 4

> Journal d'exécution de [`PLAN_GODOT.md`](PLAN_GODOT.md).
> Mis à jour à chaque lot terminé. **Source de vérité de l'état du portage.**

**Branche :** `claude/hibou3d-godot-port-o1yuew`
**Projet Godot :** `godot/hibou3d/`
**Moteur :** Godot 4.5 stable (binaire versionné dans `godot-tool/`, voir son README)

---

## ⏩ REPRENDRE LE TRAVAIL (conteneur neuf, session coupée)

> **Ici et nulle part ailleurs** : à lire en premier pour repartir sans rien redécouvrir.
> Cette section est mise à jour à chaque étape, pas seulement en fin de lot.

### État à l'instant T

**Prochaine action :** *(voir « Tableau de bord » ci-dessous — le premier lot ⬜ ou 🟡)*
**En cours :** Lot 8 — Événements du monde (lunes, tempête, rochers, météo).
**Deux crochets sont déjà posés pour lui** : `SoloRound.moon_active` et
`SoloRound.storm_active` (aujourd'hui toujours `false`) coupent respectivement la
collecte et l'apparition des cadeaux, exactement comme `moon.state !== 'none'` et
`storm.active` en JS. Il n'y a rien à débrancher, seulement à les piloter.

### 1. Remonter l'environnement (~2 min, aucun accès réseau requis pour Godot)

```bash
./godot-tool/setup.sh                     # décompresse ./godot-tool/godot (Godot 4.5)
cd godot/hibou3d && ../../godot-tool/godot --headless --import
```

### 2. Templates d'export web — **à réinstaller à chaque conteneur** (non versionnés, ~1,3 Go à télécharger)

```bash
mkdir -p /tmp/tpl && cd /tmp/tpl
curl -sSL -o t.tpz https://github.com/godotengine/godot/releases/download/4.5-stable/Godot_v4.5-stable_export_templates.tpz
unzip -o -q t.tpz 'templates/web_nothreads_*.zip'
mkdir -p ~/.local/share/godot/export_templates/4.5.stable
cp templates/web_nothreads_*.zip ~/.local/share/godot/export_templates/4.5.stable/
rm -f t.tpz                                # 1,3 Go : à supprimer, le disque du conteneur est limité
```

Sans eux, seul l'export web échoue ; tout le reste (import, tests headless, harnais de
parité) fonctionne.

### 3. Commandes utiles

```bash
cd godot/hibou3d
../../godot-tool/godot --headless --import                                  # réimporter les assets
../../godot-tool/godot --headless --script res://tools/<script>.gd           # lancer un outil/harnais
../../godot-tool/godot --headless --export-release "Web" build/web/index.html
```

Test du build dans un vrai navigateur (Chromium + Playwright sont préinstallés,
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, binaire
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) : servir `build/web/` avec
`npx http-server -p 8099 -s --cors`, puis charger la page. **Ne pas lancer
`playwright install`.** Le rendu passe par SwiftShader : les FPS mesurés dans le
conteneur ne veulent rien dire, seule la bonne exécution compte.

### 4. Repères dans `docs/hibou-3d.html` (6 296 lignes, tout le jeu dans un `<script type="module">`)

| Système | Lignes | Porté ? |
|---|---|---|
| Constantes globales, `rnd`, `mulberry32` | 100-155 | ✅ lot 2 |
| Renderer, scène, qualité adaptative | 157-229 | ⏭ lot 12 |
| Cycle jour/nuit, ciel, lune, étoiles | 230-411 | ✅ lot 5 |
| Particules 3D (pool) | 412-566 | ⏭ lot 9 |
| Volume ellipsoïde, grille de bordure | 579-631 | ✅ ellipsoïde lot 2 ; grille lot 7 (`BoundaryGrid`, maillage de lignes — Godot n'a pas de `wireframe: true`) |
| Chargement GLB, `normalizeModel` | 634-748 | ✅ lot 1 |
| **Terrain, eau, montagnes décoratives** | 749-1138 | ✅ lot 3 (`makeMountainScenery` → lot 4) |
| Nuages instanciés | 1139-1221 | ⏭ lot 4 |
| Pleine lune / lune de sang | 1222-1302 | ⏭ lot 8 |
| Tempête + rochers | 1303-1457 | ⏭ lot 8 |
| Météo dynamique | 1458-1586 | ⏭ lot 8 |
| Forêts (3 000 arbres + colliders) | 1587-1683 | ⏭ lot 4 |
| Hameaux, feux de camp, pool de lumières | 1684-1904 | ⏭ lot 4 |
| Hibou, caméra, anti-clipping, battement | 1905-2083 | ✅ lot 1 |
| Entrées clavier/souris/tactile | 2084-2465 | ✅ lot 1 (tactile hors périmètre) |
| **Modèle de vol** | 2466-2806 | ✅ lot 2 |
| Textures emoji (canvas) | 2807-2843 | ✅ lot 7 — sans canvas : `Label3D` + Noto Emoji (Écart n°15) |
| Cadeau bonus, loot box | 2844-3001 | ✅ lot 7 (avec l'écran roulette reporté du lot 6) |
| Branches, nid, score, combo | 3002-3117 | ✅ lot 7 (conteneurs d'état lot 6) |
| Rase-mottes | 3118-3145 | ✅ lot 7 |
| Ours (IA de meute) | 3146-3388 | ✅ lot 7 (branche solo ; ours statiques de campagne → lot 10c) |
| Combat MP (canon, balles, dégâts) | 3389-4221 | ⏭ lot 10a |
| IA du bot (4 difficultés) | 4222-4686 | ⏭ lot 10b |
| Campagne (6 niveaux) | 3477-3600, 4687-4955 | ⏭ lot 10c |
| Cinématiques | 3602-3705 | ⏭ lot 10d |
| HUD + écrans (~1 000 lignes) | 4956-6010 | ✅ lots 6 et 7 (instruments, Start/Paused/Réglages/Over, roulette, boussole d'objectifs ; MP/campagne hors périmètre) |
| Boucle principale, init, reset | 6011-6296 | ✅ lot 7 pour le solo (`beginGame()` complet, carte régénérée à chaque partie) ; branches MP/campagne aux lots 10-11 |
| Multijoueur | `docs/scripts/hibou3d-multiplayer.js` | ⏭ lot 11 |

### 5. Règles de travail sur ce portage

- **Un lot = un commit** sur `claude/hibou3d-godot-port-o1yuew`, avec sa recette exécutée.
- **Aucun lot ne commence avant que le précédent soit recetté** (PLAN_GODOT.md §8).
- Ce fichier est mis à jour **dans le même commit** que le lot qu'il décrit.
- Parité d'abord : toute idée d'amélioration part au lot 13, sans exception (§11).

---

## Décisions tranchées (§12 du plan)

| # | Question | Décision | Date |
|---|---|---|---|
| 1 | Version de Godot | **4.5 stable**, figée (`godot-tool/godot.xz` + `.godot-version`) | 2026-08-04 |
| 2 | Parité stricte ou relooking | **Parité stricte**, améliorations reportées au lot 13 | 2026-08-04 |
| 3 | Cohabitation Three.js ↔ Godot en MP | **Godot seulement** | (déjà acté) |
| 4 | Mobile dans le périmètre | ❌ **Hors périmètre pour le moment.** Le lot 12 est réduit à perf/poids/itch.io desktop ; `TouchControls` et le profil `LOW_SPEC` mobile sont reportés | 2026-08-04 |
| 5 | Mobile de référence | Sans objet (voir 4) | 2026-08-04 |
| 6 | itch.io | Page **non listée** jusqu'à la fin du lot 12 | 2026-08-04 |
| 7 | Audio | Lot 13, hors périmètre | 2026-08-04 |

---

## Tableau de bord des lots

| Lot | Titre | État | Note |
|---|---|---|---|
| 0 | Socle : projet, Compatibility, export web, CI | ✅ recetté | `.wasm` 36,3 Mo brut / **8,8 Mo gzip** |
| 1 | Hibou + caméra | ✅ recetté | 11/11 vérifications, `tests/test_owl.gd` |
| 2 | Modèle de vol ⭐ | ✅ recetté | écart **0,43 %** sur 818 u ; décrochage à ±50 ms |
| 3 | Terrain analytique + eau ⭐ | ✅ recetté | parité **1e-9 u** ; **le repli hash entier n'est pas nécessaire** |
| 4 | Décor instancié | ✅ recetté | 3 000 arbres, **0 corps physique**, 10 nœuds de rendu |
| 5 | Ciel, jour/nuit, lumières | ✅ recetté | horloge murale, pas de session ; `SkySystem.compute()` pur, 7/7 |
| 6 | HUD + écrans | ✅ recetté | `GameState` (12 états), instruments de vol, Start/Paused/Réglages/Over |
| 7 | Gameplay solo | ✅ recetté | partie complète jouable ; branches/combo/nid/ours/cadeau/roulette, 45/45 + 28/28 |
| 8 | Événements du monde | ⬜ à faire | |
| 9 | Effets | ⬜ à faire | |
| 10 | Combat, IA, campagne | ⬜ à faire | |
| 11 | Multijoueur | ⬜ à faire | |
| 12 | Perf, poids, itch.io (sans mobile) | ⬜ à faire | |
| 13 | Post-parité (audio, remapping) | ⬜ hors périmètre | |

Légende : ⬜ à faire · 🟡 en cours · ✅ recetté · ⚠️ terminé avec réserve

---

## Journal

### Lot 0 — Socle ✅ (2026-08-04)

**Livré**
- `godot/hibou3d/project.godot` : `rendering_method = gl_compatibility` (desktop **et** mobile),
  `physics_ticks_per_second = 60`, `stretch_mode = canvas_items` / `aspect = expand`, 1280×720.
- `scenes/main.tscn` : cube témoin, `WorldEnvironment` (ciel + brouillard aux distances du jeu JS :
  `fog_depth_begin/end` = `ARENA_RADIUS_XZ × 0.55 / × 1.6`), `DirectionalLight3D` avec ombres
  orthogonales, `Camera3D` (fov 70, near 0.1, **far 3200** comme le jeu JS).
- `scripts/debug_overlay.gd` : FPS + API graphique + méthode de rendu, affichés à l'écran.
- `tools/gen_input_map.gd` : génère les **18 actions** d'`InputMap` (§6.4) et les écrit dans
  `project.godot` via le moteur lui-même (sérialisation des `InputEvent` non écrite à la main).
- `export_presets.cfg` : preset « Web », **mono-thread** (`thread_support = false`)
  → pas de dépendance à `SharedArrayBuffer`/COOP-COEP côté itch.io.
- `.github/workflows/godot-web.yml` : build web à chaque poussée, artefact publié,
  **poids brut + gzip reportés dans le résumé de job** (suivi lot par lot du §10.1).
- `.godot-version` à la racine : `4.5-stable`.

**Recette**
- Export web produit sans erreur avec les templates 4.5.
- Chargé dans un vrai Chromium (Playwright) : moteur démarré, cube visible, FPS affiché.
  Console : `OpenGL ES 3.0 (WebGL 2.0) - Compatibility`, `single-threaded, no GDExtension`.
  Aucune erreur JS.

**Mesure de référence du poids web (la question qui décidait de la viabilité, §11)**

| Fichier | Brut | gzip -9 |
|---|---|---|
| `index.wasm` | 36,3 Mo | **8,8 Mo** |
| `index.js` | 0,30 Mo | 0,08 Mo |
| `index.pck` (vide) | 0,02 Mo | — |

→ **Verdict : viable.** Le plancher transféré est de ~9 Mo, pas les 20–40 Mo redoutés au §10.1
(le chiffre du plan portait sur le brut). itch.io sert en gzip/brotli ; en brotli on attend
~6,5 Mo. Un template d'export recompilé (§10.1 action 3) reste possible au lot 12 mais **n'est
plus une condition de viabilité**. À comparer : le jeu Three.js transfère ~340 Ko de moteur
+ 12,4 Mo de modèles, soit un total du même ordre.

**Note de mesure :** les 6 FPS observés dans le test navigateur viennent de SwiftShader
(rendu logiciel dans le conteneur CI), pas du moteur. Aucune conclusion de perf à tirer
avant une mesure sur GPU réel.

### Lot 1 — Hibou + caméra ✅ (2026-08-04)

**Livré**
- `assets/models/owl_wings.glb` — le vrai modèle du jeu (voir écart n°1), importé par l'éditeur.
  **L'écran de chargement de 12 Mo disparaît** : plus de `GLTFLoader` à l'exécution.
- `scripts/util/model_utils.gd` — port de `normalizeModel()` (§5.2). Godot n'ayant pas
  d'équivalent de `Box3.setFromObject`, l'agrégat d'AABB est reconstruit à la main.
  La hiérarchie à trois niveaux (`Visual` → `Spin` → `Inner`) est conservée : le wrapper
  doit rester neutre pour que l'appelant puisse le tourner sans écraser la normalisation.
- `scenes/owl/owl.tscn` + `scripts/owl/owl.gd` — normalisation sur l'**envergure** (2,6 u),
  demi-tour du modèle (nez = -Z), assiette piquée de -0,25 rad, matériau plume double face
  (le `.glb` n'embarque aucune matière), gabarit de collision mesuré sur l'AABB réelle,
  `AnimationPlayer.speed_scale` piloté par la vitesse (0,25 → 3,2).
- `scripts/owl/owl_camera.gd` — offset (0, 2, 6.5), champ dynamique 70 → 84°, vue arrière,
  et l'échantillonnage anti-clipping **écrit mais désactivé** (pas encore d'arbres ni de relief).
- `scripts/flight/flight_input.gd` — commandes découplées de leur source, réutilisables
  par le bot (lot 10b) et par le harnais de parité (lot 2).
- `scripts/owl/owl_flight.gd` — ⚠️ **provisoire**, rotation seule ; remplacé au lot 2.

**Recette** — `tests/test_owl.gd`, 11/11 :
envergure normalisée à 2,600 · gabarit 2,600 × 0,845 × 1,315 · nez vers -Z ·
battement en lecture, borné à 0,25/3,2 · offset caméra · vue arrière (devant + demi-tour) ·
champ à 84,0° à pleine vitesse.
Recette visuelle dans Chromium : le hibou est rendu ailes déployées vu de l'arrière, et
un appui sur roulis gauche **incline l'horizon** — la caméra hérite bien du roulis.

**Coût web :** `.pck` 0,02 → **2,60 Mo** (le modèle du hibou). `.wasm` inchangé.

### Lot 2 — Modèle de vol ⭐ ✅ (2026-08-04)

Le lot qui décide si le portage « a le même goût ». **Recette quantitative tenue.**

**Livré**
- `scripts/flight/flight_model.gd` — port des **11 étapes** de `updateFlight()`, dans le
  même ordre (leur enchaînement fait partie du résultat) : autorité des gouvernes selon la
  vitesse air, inertie de rotation, incidence et coefficient de portance, décrochage
  aérodynamique **et** « en cloche », les quatre forces, effet de sol, vent de tempête,
  intégration semi-implicite, virage coordonné avec garde-fou anti-gimbal, bordure
  ellipsoïde progressive, plancher terrain. Toutes les constantes du §2.3 recopiées.
  Le modèle est **pur** : ni nœud, ni scène, ni serveur physique — il tient son propre
  état et se teste hors jeu.
- `scripts/util/rng.gd` — `mulberry32` porté à l'identique. Arithmétique entière 32 bits
  donc **exact par construction** sur toutes les plateformes (contrairement au hash `sin()`
  du terrain, §5.4). État tenu en non signé : `>>` sur un négatif serait un décalage
  arithmétique en GDScript et propagerait le bit de signe.
- `scripts/owl/owl_flight.gd` — réécrit : simple couche d'adaptation autour du modèle.
- `tools/flight-parity/` — le harnais, avec son `README.md`.

**Recette quantitative** (30 s à pas fixe de 1/60 s, séquence : décollage, virage serré,
chandelle, décrochage, récupération, rase-mottes)

| Mesure | Valeur | Seuil |
|---|---|---|
| Distance parcourue | JS 817,74 u / Godot 816,91 u | — |
| Écart de position final | 3,51 u = **0,43 %** | < 1 % |
| Écart de position maximal | 3,51 u = **0,43 %** | < 1 % |
| Écart de vitesse maximal | 0,54 u/s | — |
| Premier décrochage | JS 18,033 s / Godot 18,083 s → **50 ms** | ± 0,2 s |
| Pas en désaccord sur le décrochage | 5 / 1800 | — |

Reste à faire à la main : la **recette subjective** (« Rémi vole 5 minutes dans les deux
versions et valide le feeling »). Aucun harnais ne la remplace.

**Anti-dérive :** `check_drift.mjs` enregistre l'empreinte SHA-256 du corps de
`updateFlight()`. Si le jeu Three.js change, la CI échoue et réclame une reprise de la
transcription — sans quoi la recette de parité deviendrait un tampon de complaisance.

**CI :** nouveau job `flight-parity` (empreinte → trace JS → trace Godot → verdict →
recette du lot 1). Le verdict sort en code 1 : le plan interdit de passer au lot 3 avec
un modèle « presque » porté, dont dépendent l'IA du bot (lot 10b) et le multijoueur (lot 11).

### Lot 3 — Terrain analytique + eau ⭐ ✅ (2026-08-04)

Fait dans l'ordre strict imposé par le plan : **le harnais de parité d'abord**, tout le
reste ensuite.

**1. Parité du terrain — le risque §5.4 est levé**

`hashNoise` amplifie `sin()` par 43 758,5453 : un écart de quelques ULP entre deux
implémentations ne donne pas « à peu près » le même relief, il en donne un tout autre.
10 000 points échantillonnés de chaque côté :

| Mesure | Écart max |
|---|---|
| Altitude (relief de -21,5 à +489,0 u) | **1,0 × 10⁻⁹ u** |
| Masque de forêt | 3,6 × 10⁻¹² |
| Pics de montagne | 2,8 × 10⁻¹⁴ |
| Tracé et forme des rivières | **0 — exact** (mulberry32 est entier) |

→ **Le repli sur un hash entier (§5.4 point 2) n'est pas nécessaire.** `docs/hibou-3d.html`
n'a pas à être modifié. Reste à vérifier au lot 12 : natif ↔ **WebAssembly**, l'autre
divergence redoutée, qui est désormais la seule qui compte (voir `tools/terrain-parity/README.md`).

**2. Livré**
- `autoload/terrain.gd` — les dix fonctions pures : `hash_noise`, `value_noise`, `fbm`,
  `ridged`, `fill_mountain_peaks`, `fill_river_paths`, `river_carve`, `terrain_height`,
  `effective_ground_y`, `forest_density`, plus `regenerate_seed()` / `restore_canonical()`.
  **Tout en `float` scalaire** (écart n°3), et les points de rivière en `PackedFloat64Array`
  et non `PackedVector2Array` — ce dernier aurait tronqué le tracé à 32 bits.
- `scripts/world/terrain_mesh.gd` — maillage **non indexé**, couleur et normale par facette,
  diagonale `(a,b,d)/(b,c,d)` identique à celle de `PlaneGeometry`, palette et tramage repris.
- `resources/shaders/water.gdshader` — l'ondulation passe du CPU au GPU. `updateWater()`
  recalculait des milliers de sommets **par frame** puis reconstruisait les normales ;
  le shader les dérive en forme fermée. Coût CPU par frame : **zéro**.
- `scenes/world/world.tscn`, câblage du vol et de l'anti-clipping caméra sur la fonction.

**3. Performance de génération — le plan avait raison de s'en méfier**

Le plan (§9 lot 3) demandait de mesurer et de découper au-delà d'1 s. Mesuré :

| Étape | Natif | WebAssembly |
|---|---|---|
| Version initiale, d'un bloc | 2 798 ms | non mesuré (inacceptable) |
| Après optimisations, d'un bloc | 1 924 ms | — |
| **Découpée sur plusieurs frames** | 1 973 ms | **4 428 ms, sans figer l'onglet** |

Deux optimisations, toutes deux **exactes** (parité re-vérifiée à l'identique, 1,035 × 10⁻⁹) :
- **Boîte englobante par rivière.** Au-delà de la portée du chenal, `smoothstep` vaut
  exactement 1 et la contribution est exactement nulle : sauter ces points n'approxime
  rien. `river_carve` : 12,9 µs → 1,1 µs par appel.
- **Cache plat des pics** (`PackedFloat64Array` au lieu d'un `Array[Dictionary]`) : quatre
  recherches de dictionnaire par pic et par appel disparaissent.

→ `terrain_height()` : 40 µs → 26 µs. La construction reste découpée
(`rebuild_async()`, signal `build_progress`), que le lot 6 branchera sur l'écran de chargement.

**4. Recette** — `tests/test_world.gd`, 17/17 : couverture et amplitude du relief, maillage
non indexé et coloré, **maillage conforme à la fonction à 1,5 × 10⁻⁵ u près**, zone de départ
aplanie, muraille dressée, eau au bon niveau et pilotée par shader, vol et caméra branchés
sur la fonction, régénération solo puis **restauration canonique au bit près**.
Recette visuelle en navigateur : relief low-poly à facettes franches, lacs bleus dans les
creux, hibou en vol au-dessus.

**Coût web :** `.pck` 2,60 → **2,63 Mo** (le terrain est du code, pas des données).

### Lot 4 — Décor instancié ✅ (2026-08-04)

**Livré**
- `scripts/util/multi_mesh_builder.gd` — port de `makeInstancedFromModel()`. Un modèle
  importé est une hiérarchie de maillages, pas un maillage : on produit **un
  `MultiMeshInstance3D` par (maillage × surface)**, en composant la transform d'instance
  avec celle de la pièce dans le modèle.
- `scripts/world/forest.gd` — 3 000 arbres, 4 essences, masque de bruit, exclusion des
  lacs / de `TREE_LINE` / des pentes, tirage pondéré des essences. **Les court-circuits du
  JS sont reproduits** : `treeRng()` du masque de forêt n'est consommé que si la densité
  est sous le seuil, et un tirage de trop décalerait toute la forêt.
- `scripts/world/mountain_scenery.gd`, `clouds.gd` (dérive + recyclage en bord de carte,
  paliers d'opacité en groupes distincts), `village.gd` (hameaux, isolés, feux de camp).
- `scripts/main.gd` — le point unique où le monde et le hibou sont branchés l'un sur l'autre.
- Anti-clipping caméra et collision d'arbre du hibou, tous deux analytiques.

**Deux points où « penser Godot » voulait dire refuser la solution Godot**
- **Zéro corps physique** (vérifié par le test) : 3 000 `StaticBody3D` seraient
  rédhibitoires en WebAssembly. Cônes et cylindres analytiques, comme le jeu d'origine.
- **Pool de 7 `OmniLight3D`** pour ~30 feux de camp, réassignées chaque frame aux plus
  proches du joueur. En Compatibility, le nombre d'omnis affectant un objet est limité :
  une lumière par feu ferait clignoter ou disparaître l'éclairage (§10.3).

**Ajout par rapport au jeu d'origine : une grille uniforme d'accélération.** Le test
d'arbre est appelé **onze fois par frame** (dix pour l'anti-clipping caméra, une pour le
hibou). En balayant les 3 000 arbres à chaque fois, cela ferait 33 000 itérations par
frame — ce que le JS fait effectivement. Chaque arbre est inscrit dans les cellules que
son feuillage touche, donc une interrogation ne regarde qu'une cellule. Le test est
**identique**, seul le nombre de candidats change.

**Recette** — `tests/test_world.gd`, 30/30 (17 du lot 3 + 13 du lot 4) :
3 000 arbres, rendu en 10 `MultiMeshInstance3D` et non en nœuds individuels,
**zéro `CollisionObject3D` dans toute la scène**, massifs et nuages instanciés,
pool de 7 lumières, somme des instances de `MultiMesh` égale à 3 000, étendue du semis
conforme, et **chacun des 3 000 arbres détecté au cœur de son feuillage** (c'est ce qui
valide l'indexation de la grille : mal construite, elle renverrait « rien » sans que rien
d'autre ne le signale).

**Piège rencontré :** en mode headless, `MultiMesh.get_instance_transform()` et
`MultiMeshInstance3D.get_aabb()` renvoient des valeurs vides — ces données vivent dans le
serveur de rendu, qui est un bouchon. Les assertions de placement passent donc par les
colliders de la forêt, qui appartiennent au script et font de toute façon autorité.

**Coûts mesurés :** semis de la forêt 507 ms, du village 17 ms.
`.pck` 2,63 → **3,98 Mo** (les modèles de décor : 10 GLB + `cabin.obj`).

---

### Lot 5 — Ciel, jour/nuit, lumières ✅ (2026-08-04)

**La contrainte qui structure tout le lot :** « deux instances lancées à 1 minute
d'intervalle affichent la même heure du jour » interdit tout ce qui ressemble à un temps de
session (`Time.get_ticks_msec()`, un accumulateur `_process(delta)`…). Toute la logique de
phase est donc isolée dans une fonction **pure**, `SkySystem.compute(unix_time)`, qui ne lit
que `Time.get_unix_time_from_system()` — appelée deux fois au même instant, elle rend le
même résultat bit à bit, ce qui *est* la preuve de synchro multijoueur gratuite (§9 recette,
voir `tests/test_sky.gd`).

**Livré**
- `scripts/world/sky.gd` (**`SkySystem`**, pas `Sky` — nom déjà pris par la ressource
  native `Environment.sky`) : port de `updateDayNightCycle()`. `_process()` n'est qu'une
  couche fine autour de `compute()` qui pousse le résultat sur la lumière, le fog et le
  matériau du ciel — même séparation pur/nœud que `FlightModel`/`OwlFlight` au lot 2.
- `resources/shaders/sky.gdshader` (`shader_type sky;`) : dégradé nuit↔jour par élévation
  du rayon de vue (`EYEDIR.y`) + étoiles procédurales (grille de cellules hachées sur la
  sphère céleste, scintillement individuel par hachage de phase). Voir Écarts n°6 : ce n'est
  **pas** un portage direct de `makeSky()` (1 600 `THREE.Points`), Godot n'a pas d'équivalent
  à « une texture canvas plaquée derrière la scène ».
- Une seule `DirectionalLight3D` (`CelestialLight`) joue les deux rôles, comme `moonLight` —
  jamais deux lumières superposées à pleine intensité, en Compatibility l'exposition
  s'effondrerait.
- Soleil et lune : deux `MeshInstance3D` positionnées à `MOON_DISTANCE` = 2 400 u sur le même
  arc, `disable_fog = true` (sans quoi le brouillard à 2 240 u les effacerait entièrement).
  Pas de `moon.glb` livré (même famille de constat que l'écart n°1 sur le hibou) : comme le
  jeu d'origine sans `models.moon`, repli sur une sphère à texture de cratères générée une
  fois au démarrage (`_make_moon_texture()`, 55 taches radiales, mêmes bornes que
  `makeMoonSurfaceTexture()`).
- Ambiante et fog pilotés directement par `day_factor` (`Environment.ambient_light_color/
  energy`, `fog_light_color`) — remplace `AmbientLight`. `HemisphereLight` (`fillLight`) n'a
  pas d'équivalent Godot direct et n'est pas porté (Écart n°7) : son rôle (léger reflet du
  sol dans l'ambiante) est mineur à côté de la lumière directionnelle et du fog déjà en place.
- `moon_fill_progress` : champ câblé mais laissé à 0 — c'est le crochet que l'événement
  pleine lune/lune de sang du lot 8 pilotera (`lerp(base, full, 0) == base`, donc aucun
  effet tant qu'il n'est pas touché).

**Recette** — `tests/test_sky.gd`, 7/7, **pur** (`--script`, aucune dépendance à `Terrain`) :
déterminisme (deux appels au même instant → même direction solaire, même `day_factor`),
bouclage exact après 480 s, lune diamétralement opposée au soleil, `day_factor` borné dans
[0, 1] et atteignant ses deux extrêmes sur un cycle complet.
Recette visuelle en navigateur : dégradé de ciel et ombre du hibou visibles, aucune erreur
console, scène stable sur plusieurs frames consécutives.

**Coût web :** `.pck` 3,98 → **4,18 Mo** (texture de cratères 512×512, générée au
démarrage — pas de fichier supplémentaire à charger).

---

### Lot 6 — HUD, écrans, machine à états ✅ (2026-08-04)

**Livré**
- `autoload/game_state.gd` (**`GameState`**) : `enum State` à 12 valeurs, **dans le même
  ordre** que `const S = {...}` (docs/hibou-3d.html ligne 92) — vérifié valeur par valeur
  par la recette. Champs de manche solo (`score`, `nest`, `combo`, `combo_timer`, `lives`,
  `best`, `buffs`, `over_reason`, `mouse_sensitivity`), signaux `state_changed(previous,
  current)` et `score_changed`, `change_state()`, `reset_round()` (le sous-ensemble de
  `beginGame()` que ce lot peut tester : score/nid/combo/vies/bonus, pas la régénération du
  monde — lot 7).
- `scripts/ui/hud_draw.gd` (**`HudDraw`**) : port 1:1 de `rrect`/`retroBtn`/`scanlines`/
  `drawSpeedFX`, en fonctions **statiques** prenant le `CanvasItem` receveur en premier
  paramètre (Godot n'a pas de contexte de dessin global comme `hctx`). Centralise aussi les
  polices partagées et le filet de secours emoji (voir Écart n°9).
- `scripts/ui/hud.gd` + `scenes/ui/hud.tscn` : port 1:1 de `drawHUD()` solo (score, vies,
  bonus actifs, combo, barre de nid), des instruments de vol (vitesse/altitude/poussée/
  vario, lus sur `OwlFlight.model`), de l'alerte décrochage clignotante et de la vignette de
  vitesse. Le multijoueur (`drawMPStatusBox`, `drawScoreboard`, `drawCrosshair`,
  `drawInventoryBar`), la boussole d'objectifs (cadeau/branches) et les bandeaux lune/
  tempête/pluie **ne sont pas câblés** : leurs données (combat lot 10a/11, gameplay lot 7,
  météo lot 8) n'existent pas encore. Rien n'est bricolé en attendant — `main.gd` les
  branchera quand ces lots arriveront, sans retoucher `hud.gd`.
- `scripts/ui/screen_start.gd`, `screen_paused.gd`, `screen_settings.gd`, `screen_over.gd`
  + leurs scènes, orchestrés par `scripts/ui/screens.gd` : port de `drawStart()`,
  `drawPaused()`, `drawSettings()`, `drawOver()`. Décision C du plan (§4.2) : les menus
  deviennent des `Control`/`Button`/`HSlider` réels au lieu de rectangles hit-testés à la
  main (`startSoloBtnRect`, `getSliderHitArea()`, `handleSliderDrag()` disparaissent).
  Seul **SOLO** est câblé à une vraie transition ; Multijoueur/Campagne/Combat vs IA restent
  visibles (mise en page à 4 boutons conservée) mais `disabled = true` (lots 10-11, voir
  Écart n°10).
- `main.gd` : `_begin_game()` (reset de manche + redécollage, le sous-ensemble testable de
  `beginGame()`) et `_on_crashed_into_ground()` (port de `onGroundCrash()`, branché sur le
  signal `OwlFlight.crashed_into_ground` déjà préparé au lot 2) donnent au lot 6 un aller-
  retour Start → Play → Over **câblé de bout en bout**, pas juste des écrans statiques
  — la transition Over n'a toutefois pas été observée en recette visuelle, voir plus bas.
- `tools/gen_input_map.gd` : action `toggle_settings` (touche **O**) ajoutée aux 18
  actions du lot 0.
- Polices : `VT323-Regular.ttf` et `PressStart2P-Regular.ttf` (Google Fonts, SIL OFL,
  chargées par CDN dans le jeu JS — un export Godot ne peut pas dépendre du réseau) +
  `NotoEmoji-Regular.ttf` en filet de secours pour les émoji (Écart n°9).

**Trois décisions de portage**
1. **La pause n'est plus pilotée par la perte du pointer-lock.** Le JS déclenche PAUSED via
   l'évènement navigateur `pointerlockchange` (Échap navigateur = perte native du
   verrouillage, écoutée passivement) ; aucune touche « pause » n'existe côté clavier
   applicatif. Godot ne reçoit pas cet évènement webplatform-spécifique de façon fiable :
   l'action `pause` (Échap, déjà dans l'`InputMap` du lot 0) bascule **explicitement**
   PLAY ↔ PAUSED. Le comportement perçu (Échap met en pause, un clic ou une touche reprend)
   est identique ; le mécanisme diffère (Écart n°11).
2. **`retroBtn` n'est pas porté pour les vrais `Button`.** Le relief biseauté clair/sombre
   du canvas 2D n'a pas d'équivalent 1:1 en `StyleBoxFlat` (bordure d'une seule couleur).
   `HudDraw.style_button()` garde le code couleur par mode et un retour visuel pressé/
   survolé/désactivé, sans le biseau (Écart n°12). `rrect`/`retroBtn`/`scanlines` restent
   portés à l'identique pour tout ce qui reste en `_draw()` (HUD, chrome des écrans).
3. **`drawSpeedFX` n'a pas de dégradé radial natif.** `CanvasItem` n'expose pas
   l'équivalent de `createRadialGradient` ; un `GradientTexture2D` étiré sur un rectangle
   1280×720 non carré déformerait le cercle en ellipse. Approximé par 16 anneaux
   concentriques à alpha interpolé — effet équivalent, pas pixel-identique (non pertinent
   pour un effet de juice, contrairement au terrain ou au vol).

**Piège rencontré — émoji et polices Godot.** VT323/Press Start 2P ne couvrent aucun émoji
(🦉 ❤️ ⚡…) : dans un `<canvas>` de navigateur, un glyphe manquant bascule automatiquement
sur une police système ; un `Font` Godot ne le fait **jamais** tout seul. Sans filet de
secours, chaque émoji du HUD/des écrans s'affichait en tofu (repéré à l'écran par Rémi lors
de la recette visuelle). Fixé en deux temps : `NotoEmoji-Regular.ttf` (contours
**monochromes**, pas Noto Color Emoji — ~15× plus lourd pour des bitmaps couleur) posé en
`fallbacks` sur les deux polices (une fois, via `HudDraw._static_init()`, Godot 4.4+) ; les
quelques glyphes hors du bloc Unicode Emoji que Noto Emoji ne couvre pas non plus (flèches
`←`/`→`, triangles `▲`/`▼`) remplacés par de l'ASCII (`<-`/`->`, `^`/`v`) plutôt que d'ajouter
une troisième police pour deux caractères. Voir Écart n°9.

**Recette** — `tests/test_game_state.gd`, 31/31, **pur** (script direct, `GameState` est un
autoload donc indisponible en `--script`, Écart n°4 — le test instancie la classe elle-même) :
les 12 valeurs de l'enum dans l'ordre exact du JS, état initial, `change_state`/
`state_changed` (ancien **et** nouvel état transmis), `score`/`score_changed`,
`reset_round()` (remet la manche à zéro sans toucher `state`/`best`/`mouse_sensitivity`).
Recette visuelle en navigateur (captures `canvas.toDataURL()` — voir Écart n°14 sur
`page.screenshot()`) : navigation complète **Start → clic SOLO → Play → Échap → Paused →
O → Réglages → glisser le curseur → clic extérieur → Paused → clic → Play** ; HUD lisible
en 1280×720, aucune erreur console sur tout le parcours. La transition Play → Over
(`_on_crashed_into_ground()`) n'a **pas** été déclenchée en conditions réelles — une
plongée pilotée au clavier n'a pas suffi à toucher le sol dans la fenêtre de capture — mais
repose sur le signal `OwlFlight.crashed_into_ground`, déjà exercé par le harnais de parité
du lot 2, et sur les mêmes primitives de dessin que Start/Paused/Réglages, déjà vérifiées à
l'écran. Régression : lots 1 (11/11), 3+4 (30/30), 5 (7/7) toujours au vert.

**Coût web :** `.pck` 4,18 → **5,50 Mo** (+1,32 Mo : VT323 0,15 + Press Start 2P 0,12 +
Noto Emoji 1,98 Mo bruts, avant compression réseau — poste dominé par le filet de secours
emoji, seule police du lot dont la couverture Unicode le justifie).

---

### Lot 7 — Gameplay solo ✅ (2026-08-17)

Le lot qui fait passer le portage de « maquette qui vole » à **jeu**. Tout ce que le
lot 6 affichait sans données — score, combo, nid, vies, bonus — est désormais piloté
par des règles.

**Livré**
- `scripts/gameplay/branch.gd` + `branch_field.gd` (`scenes/entities/branch.tscn`) :
  les 14 branches, leur ballotement, leur halo qui respire, le recyclage à 420 u, et
  une branche sur douze **pourrie** qui casse le combat au contact.
- `scripts/gameplay/bear.gd` + `bear_pack.gd` (`bear.tscn`) : l'IA de meute complète —
  traque avec **anticipation** (l'ours vise où le hibou *sera*), dérive aléatoire
  renouvelée par à-coups, séquence traque → préparation télégraphiée en rouge →
  **charge en ligne figée** (donc esquivable au virage serré) → récupération,
  répulsion entre ours (`BEAR_PACK_DIST`), rampe de difficulté `BEAR_RAMP_TIME`,
  effectif visé `bearTarget()`.
- `scripts/gameplay/gift.gd` (`gift.tscn`) : le cadeau garanti à intervalle, son halo
  doré pulsé et son **pilier de lumière** planté dans le sol — qui vient rejoindre le
  hibou s'il le distance de plus de 650 u.
- `scripts/gameplay/loot.gd` : `LOOT_TYPES` et le tirage pondéré, **sans une seule
  mention de `GameState`** — c'est ce qui le rend compilable en test `--script`
  (Écart n°4). L'application du lot vit dans `SoloRound.apply_loot()`.
- `scripts/gameplay/collectible_spawn.gd` : `collectibleSpawnPos()`, fonction pure —
  tirage biaisé vers l'avant du hibou et vers le sol, rabattu dans l'arène.
- `scripts/gameplay/solo_round.gd` (**`SoloRound`**) : les règles. Gains de collecte
  (combo × 10 × bonus ✨), nid et vie gagnée à 100 %, rase-mottes (`updateSkim`),
  décroissance des bonus, invulnérabilité et clignotement du hibou, contact d'ours,
  game over.
- `scripts/ui/screen_lootbox.gd` (`screen_lootbox.tscn`) : la roulette **reportée du
  lot 6** (Écart n°13, désormais levé), avec son freinage amorti, son curseur rouge et
  ses deux temps (le bonus s'applique, puis l'écran rend la main).
- `scripts/world/world.gd` (**`GameWorld`**) : `beginGame()` régénère la carte —
  **chaque partie solo se joue sur un terrain neuf**, comme dans le jeu d'origine.
- `scripts/world/boundary_grid.gd` : la grille de bordure d'arène, **reportée du
  lot 5**, qui apparaît en fondu dans les 22 dernières unités avant la muraille.
- `scripts/ui/hud.gd` : la boussole d'objectifs (`drawTargetIndicator`), reportée du
  lot 6 faute de cibles — deux flèches en bord d'écran vers le cadeau 🎁 et la branche
  saine la plus proche 🌿.
- `assets/models/bear.glb` (40 Ko) : le vrai modèle du jeu, jusque-là non importé.

**Trois décisions de portage**
1. **Les entités sont mises en réserve, pas détruites.** Le JS fait
   `removeBranch(i); branches.push(newBranch())` à chaque ramassage — création et
   destruction de nœuds, de matériaux et de textures en pleine partie. Ici, les 14
   branches et les ours sont **recyclés sur place** (`Branch.reroll()`,
   `Bear.set_active()`), avec un vivier d'ours qui grandit à la demande plutôt que
   d'allouer d'emblée les dix du plafond. Même comportement observable, sans churn
   d'allocation dans une boucle à 60 Hz — ce qui compte davantage en WebAssembly
   qu'en JS.
2. **Le recouvrement des `Area3D` est interrogé, pas écouté.** La décision B (§4.2)
   prévoyait de remplacer les boucles de distance par le signal `area_entered`. C'est
   juste pour une branche ou un cadeau — qui sont **consommés** à l'entrée — mais faux
   pour un ours : un contact qui commence pendant l'invulnérabilité doit pouvoir mordre
   **plus tard**, une fois la protection expirée. `area_entered` ne se déclenchant qu'à
   l'entrée, ce cas serait perdu. Les trois familles passent donc par une interrogation
   par pas (`get_overlapping_areas()`), ce qui redonne exactement la sémantique du JS.
   La recette le vérifie explicitement (« l'invulnérabilité encaisse le contact
   suivant », puis le même contact devient fatal une fois la protection écoulée).
3. **Chaque entité porte son rayon, la sonde du hibou est un point.** Le JS compare
   `owlGroup.position.distanceTo(item) < R`, avec un `R` propre à chaque type (3 u pour
   une branche, 3,5 pour le cadeau, 4 pour un ours). Ce partage est conservé tel quel :
   les constantes se lisent comme en JS. Godot n'ayant pas de forme ponctuelle, la
   sonde est une sphère de 0,05 u — une branche se ramasse donc à 3,05 u au lieu de
   3,00, invisible pour un hibou large de 2,6.

**Bug trouvé par la recette.** À la mort du hibou, `_blink_owl()` continuait de tourner
après le passage en `OVER` et **remettait le hibou visible** juste après que le game
over l'ait caché. Corrigé en faisant sortir un contact fatal de `_physics_process`
au lieu de sortir seulement de la boucle de ramassage — l'ordre de traitement suit
maintenant celui du JS (`updateSkim` → `updateBranches` + décompte du combo →
`updateBears` → `updateGift`), ce qui décide aussi de ce qui l'emporte quand une
branche et un ours sont touchés dans la même frame.

**Piège rencontré — la carte régénérée pendant sa propre construction.** Le maillage
du terrain se construit en tâche de fond (~2,6 s en natif, **139 s** sous SwiftShader
en navigateur). Lancer une partie avant la fin de cette construction faisait retourner
`rebuild_async()` immédiatement (garde `_building`) : les graines de `Terrain` étaient
neuves, le relief **affiché** restait celui d'avant — un décor qui ment sur le sol où
le hibou vole et où les branches apparaissent. Corrigé par une demande en attente
(`_rebuild_pending`) qui relance un second passage dès le premier terminé.

**Recette**
- `tests/test_gameplay.gd`, **28/28**, pur (`--script`) : table des lots (cinq entrées,
  poids sommant à 1, ordre exact), tirage pondéré vérifié tranche par tranche,
  invariants d'apparition des ramassables sur 400 tirages (jamais hors arène, jamais
  sous le sol, jamais au-dessus du plafond de 320 u, biais vers l'avant mesuré à
  330/400), et la rampe d'effectif des ours point par point.
- `tests/test_solo_round.tscn`, **45/45** : une **vraie manche**, jouée dans la scène
  complète avec le serveur physique. Départ de partie (carte neuve, 14 branches toutes
  à portée, 2 ours, état remis à zéro), collecte et multiplication par le combo,
  branche pourrie qui casse la série, nid plein qui rend une vie, bonus ✨ ×5, ours qui
  coûte une vie puis qui tue, décroissance des bonus et répercussion du bonus ⚡ sur le
  modèle de vol, roulette déroulée intégralement. Stable sur trois exécutions
  consécutives.
- Régression : lots 1 (11/11), 3+4 (30/30 + la nouvelle assertion sur les `Area3D`),
  5 (7/7), 6 (31/31) toujours au vert.
- Recette visuelle en navigateur (`canvas.toDataURL()`, Écart n°14) : partie lancée,
  branches et ours visibles dans la scène, aucune erreur console.

**Coût web :** `.pck` 5,50 → **5,49 Mo**. Le lot n'ajoute qu'un modèle de 40 Ko et
**aucune texture** : le halo radial et le terrain sont générés au démarrage, et les
émoji sont rendus par une police déjà embarquée au lot 6 (Écart n°15). La légère
baisse vient de la recompression du pack, pas d'un retrait.

---

## Écarts constatés par rapport au plan

| # | Constat | Impact |
|---|---|---|
| 1 | **Le modèle du hibou n'est pas `barnowl.glb`.** Le jeu charge `modele-hibou/OwlWings_animation.glb` (**3,26 Mo**, avec son clip d'animation d'ailes). `docs/models/barnowl.glb` (9,4 Mo) est présent mais **jamais référencé** par `MODEL_URLS`. | Le §10.1 « rebudget de barnowl.glb » vise le mauvais fichier. Le vrai poste est `OwlWings_animation.glb` (3,26 Mo), et le budget total des modèles descend de 12,4 à ~6,3 Mo utiles. Allège le lot 12. |
| 2 | Le plancher web transféré est de ~9 Mo (gzip), pas 20–40 Mo. | Risque 🔴 « poids du runtime » du §11 → rétrogradé à 🟡. |
| 5 | **Godot importe un `.glb` en `PackedScene` mais un `.obj` en simple `Mesh`.** `cabin.obj` doit donc être enveloppé à la main dans un `MeshInstance3D`. Il est de plus livré sans `.mtl` (le jeu Three.js colorait ses pièces par nom : Roof / Cabin / Chimney / Door). | Les chalets reçoivent une teinte bois unique au lieu de quatre couleurs par pièce. Écart **visuel mineur, assumé** ; aucune calibration couleur globale n'est prévue au plan avant le lot 12, ce point y sera repris avec le reste. |
| 4 | **Les autoloads n'existent pas en mode `--script`.** Godot y remplace la `SceneTree`, donc aucun autoload n'est instancié — `Terrain` est introuvable à la compilation *comme* à l'exécution. | Les tests qui touchent une scène se lancent comme une **exécution normale du projet** (`godot --headless res://tests/test_world.tscn`). Les harnais sans autoload (parité du vol, parité du terrain, recette du hibou) restent en `--script`. |
| 3 | **`Vector3`, `Quaternion` et `Basis` sont en flottants 32 bits** dans une compilation standard de Godot, alors que le `number` de JavaScript et le `float` scalaire de GDScript sont des 64 bits. Mesuré : `Vector3.x = 0.10000000149…` contre `0.10000000000…`. Le §5.4 ne redoutait que les écarts d'ULP sur `sin()` ; la vraie source de divergence est structurelle et bien plus grosse. | C'est l'origine des 0,43 % d'écart du lot 2 : il naît dès le premier pas (~4×10⁻⁷ u) puis se propage par intégration, mais reste **borné** parce que le modèle est dissipatif. **Conséquence directe pour le lot 3 : `terrain_height(x, z)` doit prendre et rendre des `float` scalaires et ne jamais faire transiter une coordonnée par un `Vector3`**, sous peine de tronquer le relief à 32 bits. Recompiler Godot en double précision n'est pas justifié (build custom, mémoire, templates web) pour 0,43 % sur 800 u de vol. |
| 6 | **`sky.gdshader` n'est pas un portage direct de `makeSky()`.** Le jeu d'origine sème 1 600 `THREE.Points` individuels sur une texture canvas plaquée en fond de scène. Un shader de ciel Godot (`shader_type sky;`) n'a pas d'équivalent à « une texture 2D derrière la scène » : le dégradé est reconstruit par l'élévation du rayon de vue (`EYEDIR.y`) et les étoiles par une grille de cellules hachées sur la sphère céleste, chacune avec sa phase de scintillement propre. | Équivalent visuel, pas byte-identique : aucune des 1 600 positions/couleurs d'étoiles du jeu d'origine n'est reproduite au pixel près — non pertinent dans un dôme procédural. Pas de parité chiffrée prévue pour ce point, contrairement au terrain ou au vol (lot 5 n'est pas marqué ⭐ bloquant). |
| 7 | **`moon.glb` n'existe pas** dans les assets fournis, comme `barnowl.glb` (écart n°1) : le §9 du plan le nomme mais aucun fichier de ce nom n'est livré. | Repli sur le même mécanisme que le jeu d'origine sans `models.moon` : sphère + texture de cratères procédurale générée au démarrage (`_make_moon_texture()`). Coût nul en poids de `.pck` (aucun fichier chargé), léger coût CPU au premier `_ready()` (512×512 px, une fois). |
| 8 | **`HemisphereLight` (`fillLight`) n'est pas porté.** Godot n'a pas de nœud d'éclairage à deux couleurs ciel/sol séparées de l'ambiante principale. | Reflet du sol dans l'ambiante non reproduit — effet mineur, déjà couvert en pratique par `Environment.ambient_light_color` + le fog. Pas de contournement construit (pas de fausse lumière hémisphérique bricolée) : l'effort n'est pas proportionné à un effet aussi discret. |
| 9 | **VT323/Press Start 2P ne couvrent aucun émoji**, et un `Font` Godot ne bascule jamais tout seul sur une police système pour un glyphe manquant (contrairement à un `<canvas>` de navigateur) — repéré à l'écran par Rémi lors de la recette visuelle du lot 6 (tofu partout : 🦉, ❤️, ⚡…). | Corrigé par un filet de secours `NotoEmoji-Regular.ttf` (contours **monochromes** — Noto Color Emoji, en bitmaps couleur, aurait pesé ~15× plus) posé une fois sur les deux polices (`HudDraw._static_init()`). Les glyphes encore hors de sa couverture (`←`/`→`, `▲`/`▼` — Formes géométriques/Flèches, pas Emoji) sont remplacés par de l'ASCII (`<-`/`->`, `^`/`v`) ; deux icônes decoratives de fin de ligne (🎁/🌿 dans le texte d'aide) restent en tofu à très petite taille — non gênant pour la lisibilité, à reprendre si besoin lors du calibrage visuel du lot 12. |
| 10 | **Multijoueur/Campagne/Combat vs IA ne sont pas câblés sur l'écran Start.** Les quatre boutons de `drawStart()` sont recréés (mise en page identique), mais trois n'ont ni écran ni système derrière eux avant les lots 10-11. | `disabled = true` sur les trois : visibles (parité de mise en page), non cliquables (honnête sur ce qui marche). Le raccourci clavier `[M]` du JS n'est pas affiché, pour ne pas promettre un raccourci mort. |
| 11 | **La pause n'est plus pilotée par la perte du pointer-lock** (`pointerlockchange`, un évènement web-spécifique que Godot ne relaie pas de façon fiable en export), mais par un basculement explicite de l'action `pause` (Échap). | Comportement perçu identique (Échap met en pause, clic/touche reprend, vérifié en recette visuelle) ; seul le mécanisme diffère. Documenté plutôt que reproduit à l'identique — reproduire fidèlement un évènement de plateforme absent serait un contournement plus fragile que la solution native Godot. |
| 12 | **`retroBtn` (relief biseauté clair/sombre) n'est pas porté pour les vrais `Button`** des écrans (décision C, §4.2) : `StyleBoxFlat` n'a qu'une seule couleur de bordure. `HudDraw.style_button()` garde la couleur par mode et les états pressé/survolé/désactivé, sans le biseau. | Écart visuel mineur, assumé — `rrect`/`retroBtn`/`scanlines` restent portés à l'identique partout où le rendu reste en `_draw()` (HUD, chrome des écrans), qui est la majorité de la surface rétro à l'écran. |
| 13 | **L'écran Cadeau/Loot box (`drawLootbox()`) n'est pas porté.** Contrairement au HUD ou aux menus, ce n'est pas un écran de navigation : son seul déclencheur est le ramassage d'un cadeau en jeu (`giftItem`, lot 7), et son animation (défilement, `rollLoot()`, application des bonus) est de la logique de jeu, pas de la présentation. | Reporté au lot 7 en bloc avec le système de cadeau dont il dépend — un aperçu statique sans déclencheur réel aurait été du code mort, contraire à l'esprit du lot (§4.2 décision C vise des écrans **navigables**, celui-ci ne l'est pas). `GameState.State.LOOT` existe déjà dans l'énumération (valeur 4, ordre JS), prêt à être branché.  **✅ Levé au lot 7** : portée avec le cadeau qui l'ouvre, et déroulée intégralement par la recette. |
| 14 | **`page.screenshot()` de Playwright reste indéfiniment bloqué** (« waiting for fonts to load ») sur l'export web dès que la scène 3D est chargée (`document.fonts.ready` ne se résout jamais sur cette page — aucun `@font-face` DOM, donc pas lié aux polices ajoutées ce lot). `Page.captureScreenshot` en CDP brut bloque pareillement. | Ce n'est **ni** un bug du jeu **ni** un vrai blocage : `canvas.toDataURL()` exécuté **dans** la page (`page.evaluate`) aboutit toujours, juste lentement (~30-90 s par image sous SwiftShader avec cette scène — forêt + terrain + shader de ciel + HUD), le temps que le rendu logiciel produise une frame lisible. Pour toute recette visuelle des lots suivants : lire les pixels par `canvas.toDataURL()` plutôt que `page.screenshot()`/CDP, et prévoir des délais généreux (60-90 s) entre chaque capture. |
| 15 | **Les textures emoji ne passent pas par un canvas.** Le jeu dessine chaque emoji (🪵 🌿 🍃 🍂 🐻 🎁 🔥) dans un `<canvas>` 128 px, en fait une `CanvasTexture`, et la plaque sur un `THREE.Sprite`. Godot n'a pas d'équivalent direct de « rendre du texte dans une image » à l'exécution. | Remplacé par un `Label3D` en mode panneau d'affichage, avec la police Noto Emoji déjà embarquée au lot 6 (Écart n°9) : **aucune texture générée, aucun fichier de plus**, et le glyphe reste net à toute distance là où une texture de 128 px se serait floutée de près. Conséquence : les emoji sont en **contours monochromes** et non en couleur, cohérent avec le choix déjà fait pour le HUD. |
| 16 | **Aucun effet n'est déclenché par le gameplay porté.** Le JS appelle `spawnFX`, `spawnFX3D`, `screenShake`, `hitFlash` et `triggerHitStop` à une douzaine d'endroits dans le code de ce lot (collecte, branche pourrie, vie gagnée, contact d'ours, ramassage du cadeau, poussière de charge). | Ces appels sont **volontairement absents** plutôt que remplacés par des approximations : ils forment le lot 9 en entier (pool de particules 3D, texte flottant, secousse d'écran, ralenti d'impact), qui doit trancher `GPUParticles3D` vs `CPUParticles3D` vs `MultiMesh` sur mesure réelle en web. Les emplacements sont repérables dans le source JS aux mêmes lignes que la logique déjà portée ; rien à défaire, seulement à ajouter. |
| 17 | **Les entités sont recyclées, pas créées et détruites.** Le JS détruit puis reconstruit sprite, matériaux et halo à chaque ramassage de branche et à chaque mort d'ours. | Vivier fixe pour les branches, à croissance à la demande pour les ours (`Branch.reroll()`, `Bear.set_active()`). Comportement observable identique — nouvelle essence, nouveau tirage de pourriture, nouvelle position — sans allocation ni libération dans une boucle à 60 Hz, ce qui pèse davantage en WebAssembly qu'en JS. |
| 18 | **La régénération de carte ne bloque pas.** `beginGame()` en JS reconstruit le terrain de façon synchrone (le navigateur fige le temps du calcul). Ici `rebuild_async()` l'étale sur plusieurs frames. | Strictement mieux : la partie démarre immédiatement et **rien n'est faux entre-temps** — la hauteur du sol vient de la fonction `Terrain.effective_ground_y`, exacte dès la première frame pour le vol comme pour l'apparition des branches ; seul le relief **visible** rattrape son retard. A révélé un vrai défaut au passage : une demande reçue pendant une construction était perdue (voir « Piège rencontré », lot 7). |
| 19 | **Godot n'a pas de `wireframe: true` hors mode debug.** Le quadrillage de bordure d'arène est une `SphereGeometry` affichée en fil de fer côté Three.js. | Reconstruit en maillage de **lignes** (`PRIMITIVE_LINES`) aux mêmes 40×28 subdivisions : mêmes parallèles, mêmes méridiens, et un maillage qui reste valide en export release (contrairement à `RenderingServer.set_debug_generate_wireframes`, réservé au debug). |
| 20 | **La décision B prévoyait le signal `area_entered` ; c'est le recouvrement qui est interrogé à chaque pas.** Le signal ne se déclenche qu'à l'**entrée** dans la zone. | Juste pour une branche ou un cadeau (consommés à l'entrée), faux pour un ours : un contact commencé pendant l'invulnérabilité doit pouvoir mordre une fois celle-ci expirée, sans que le hibou ait à ressortir puis rentrer. `get_overlapping_areas()` par pas redonne exactement la sémantique du JS, pour un coût négligeable (une poignée de zones). Vérifié explicitement par la recette. |
