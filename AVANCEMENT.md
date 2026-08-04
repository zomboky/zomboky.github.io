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
**En cours :** Lot 3 — terrain analytique + eau (§9, lot 3).

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

### 4. Règles de travail sur ce portage

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
| 3 | Terrain analytique + eau ⭐ | ⬜ à faire | |
| 4 | Décor instancié | ⬜ à faire | |
| 5 | Ciel, jour/nuit, lumières | ⬜ à faire | |
| 6 | HUD + écrans | ⬜ à faire | |
| 7 | Gameplay solo | ⬜ à faire | |
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

---

## Écarts constatés par rapport au plan

| # | Constat | Impact |
|---|---|---|
| 1 | **Le modèle du hibou n'est pas `barnowl.glb`.** Le jeu charge `modele-hibou/OwlWings_animation.glb` (**3,26 Mo**, avec son clip d'animation d'ailes). `docs/models/barnowl.glb` (9,4 Mo) est présent mais **jamais référencé** par `MODEL_URLS`. | Le §10.1 « rebudget de barnowl.glb » vise le mauvais fichier. Le vrai poste est `OwlWings_animation.glb` (3,26 Mo), et le budget total des modèles descend de 12,4 à ~6,3 Mo utiles. Allège le lot 12. |
| 2 | Le plancher web transféré est de ~9 Mo (gzip), pas 20–40 Mo. | Risque 🔴 « poids du runtime » du §11 → rétrogradé à 🟡. |
| 3 | **`Vector3`, `Quaternion` et `Basis` sont en flottants 32 bits** dans une compilation standard de Godot, alors que le `number` de JavaScript et le `float` scalaire de GDScript sont des 64 bits. Mesuré : `Vector3.x = 0.10000000149…` contre `0.10000000000…`. Le §5.4 ne redoutait que les écarts d'ULP sur `sin()` ; la vraie source de divergence est structurelle et bien plus grosse. | C'est l'origine des 0,43 % d'écart du lot 2 : il naît dès le premier pas (~4×10⁻⁷ u) puis se propage par intégration, mais reste **borné** parce que le modèle est dissipatif. **Conséquence directe pour le lot 3 : `terrain_height(x, z)` doit prendre et rendre des `float` scalaires et ne jamais faire transiter une coordonnée par un `Vector3`**, sous peine de tronquer le relief à 32 bits. Recompiler Godot en double précision n'est pas justifié (build custom, mémoire, templates web) pour 0,43 % sur 800 u de vol. |
