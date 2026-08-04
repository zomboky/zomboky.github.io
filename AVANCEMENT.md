# AVANCEMENT — Portage Hibou 3D → Godot 4

> Journal d'exécution de [`PLAN_GODOT.md`](PLAN_GODOT.md).
> Mis à jour à chaque lot terminé. **Source de vérité de l'état du portage.**

**Branche :** `claude/hibou3d-godot-port-o1yuew`
**Projet Godot :** `godot/hibou3d/`
**Moteur :** Godot 4.5 stable (binaire versionné dans `godot-tool/`, voir son README)

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
| 1 | Hibou + caméra | ⬜ à faire | |
| 2 | Modèle de vol ⭐ | ⬜ à faire | |
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

---

## Écarts constatés par rapport au plan

| # | Constat | Impact |
|---|---|---|
| 1 | **Le modèle du hibou n'est pas `barnowl.glb`.** Le jeu charge `modele-hibou/OwlWings_animation.glb` (**3,26 Mo**, avec son clip d'animation d'ailes). `docs/models/barnowl.glb` (9,4 Mo) est présent mais **jamais référencé** par `MODEL_URLS`. | Le §10.1 « rebudget de barnowl.glb » vise le mauvais fichier. Le vrai poste est `OwlWings_animation.glb` (3,26 Mo), et le budget total des modèles descend de 12,4 à ~6,3 Mo utiles. Allège le lot 12. |
| 2 | Le plancher web transféré est de ~9 Mo (gzip), pas 20–40 Mo. | Risque 🔴 « poids du runtime » du §11 → rétrogradé à 🟡. |
