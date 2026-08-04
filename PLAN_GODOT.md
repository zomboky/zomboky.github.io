# PLAN_GODOT.md — Portage de **Hibou 3D** (Three.js) vers **Godot 4**, export Web → itch.io

> **Statut : plan de travail, aucun code écrit.**
> Ce document est la feuille de route complète du portage. Il n'est pas destiné à être
> exécuté d'un bloc : il découpe le travail en **lots livrables et testables un par un**.
> Rien ne commence tant que la section [§12 Questions ouvertes](#12-questions-ouvertes--décisions-à-prendre-avant-le-lot-0) n'est pas tranchée.

---

## 1. Mission

Porter le jeu web **Hibou 3D** — actuellement `docs/hibou-3d.html` (~6 300 lignes de JS
module + Three.js) — vers **Godot Engine 4**, en gardant **la jouabilité navigateur**
(export HTML5 / WebAssembly, moteur de rendu **Compatibility**), pour une publication
finale sur **itch.io**.

### Principes directeurs (non négociables)

| # | Règle | Traduction concrète dans ce plan |
|---|---|---|
| 1 | **Traduction conceptuelle, pas ligne à ligne** | Chaque système JS est d'abord remappé sur l'arborescence de nœuds Godot (§4), puis seulement porté. Certains systèmes changent de nature (l'eau CPU devient un shader, `SkeletonUtils.clone` devient `PackedScene.instantiate`, le hit-testing manuel du HUD devient des `Button`). |
| 2 | **Rigueur mathématique 3D** | §5 fixe les conventions (axes, quaternions, `Basis`/`Transform3D`) et donne la table de conversion exhaustive. Le modèle de vol est le cœur du jeu : il se porte **à la constante près**, pas « à peu près ». |
| 3 | **Shaders** | Le jeu **ne contient aucun GLSL personnalisé** (audit fait, §2.4). Rien à traduire. En revanche 4 GDShaders **neufs** sont à écrire (§6.3) — c'est un gain, pas une dette. |
| 4 | **Optimisation web permanente** | Chaque lot a une ligne « coût web ». `MultiMeshInstance3D` pour les 3 000 arbres, `scaling_3d_scale` pour la résolution adaptative, budget de poids `.pck` suivi lot par lot (§10). |
| 5 | **Pas à pas** | 13 lots (§7 à §9), chacun avec ses fichiers, sa correspondance JS→Godot et sa **définition de terminé** vérifiable. Un lot = une PR. |

---

## 2. Audit de l'existant (fait — sert de cahier des charges)

### 2.1 Inventaire des fichiers

| Fichier | Taille | Rôle |
|---|---|---|
| `docs/hibou-3d.html` | 299 Ko / 6 296 lignes | **Tout le jeu** : un seul `<script type="module">` (lignes 79–6294) |
| `docs/scripts/hibou3d-multiplayer.js` | 565 lignes | Réseau WebSocket, hiboux distants, lobby |
| `docs/scripts/hibou3d-lock.js` | 96 lignes | Verrou d'accès du mode campagne |
| `docs/three/build/` | ~340 Ko | Build local de Three.js (importmap) |
| `docs/models/*.glb`, `cabin.obj` | **~12,4 Mo** | 13 modèles (dont `barnowl.glb` = **9,4 Mo** à lui seul) |
| `server/hibou3d-server/server.js` | — | Relais WebSocket (`bear.servebeer.com`, wss/443) |
| `server/hibou3d-training/` | 16 modules | Entraînement génétique du bot (Node, hors jeu) |
| `plans/hibou3d-multiplayer.md`, `plans/hibou3d-campagne.md` | — | Docs d'architecture existantes — **à lire avant le lot 10/11** |

### 2.2 Systèmes à porter (avec leur emplacement source)

| Système | Lignes JS | Complexité de portage |
|---|---|---|
| Renderer / scène / qualité adaptative | 157–229 | ⚪ Faible — remplacé par des réglages projet |
| Cycle jour/nuit + ciel + lune + étoiles | 230–411 | 🟡 Moyenne — devient un `Sky` + shader |
| Particules 3D (pool de `Points` additifs) | 412–566 | 🟡 Moyenne — `GPUParticles3D` ou MultiMesh |
| Volume de jeu ellipsoïde + grille de bordure | 579–631 | ⚪ Faible |
| Chargement GLB + normalisation + instanciation | 634–748 | 🟢 **Simplifié** — import éditeur, plus de loader runtime |
| **Terrain procédural analytique** (fBm, pics, rivières, muraille) | 749–1138 | 🔴 **Élevée** — cœur déterministe, doit être bit-compatible (§5.4) |
| Nuages instanciés | 1139–1221 | ⚪ Faible |
| Pleine lune / lune de sang | 1222–1302 | ⚪ Faible |
| Tempête + rochers | 1303–1457 | 🟡 Moyenne |
| Météo dynamique (pluie/neige/brouillard/éclairs) | 1458–1586 | 🟡 Moyenne |
| Forêts (3 000 arbres instanciés + colliders analytiques) | 1587–1683 | 🟡 Moyenne — MultiMesh |
| Hameaux (chalets procéduraux, feux de camp, pool de lumières) | 1684–1904 | 🟡 Moyenne |
| Le hibou + caméra + anti-clipping + battement d'ailes | 1905–2083 | 🟡 Moyenne |
| Entrées clavier / souris / tactile / pointer-lock | 2084–2465 | 🟡 Moyenne — refonte via `InputMap` |
| **Modèle de vol aérodynamique** | 2466–2806 | 🔴 **Élevée** — le cœur du feeling, port 1:1 obligatoire |
| Textures emoji (canvas) | 2807–2843 | 🟢 **Simplifié** — pré-cuisson en PNG |
| Cadeau bonus + loot box | 2844–3001 | ⚪ Faible |
| Branches / nid / score / combo | 3002–3117 | ⚪ Faible |
| Rase-mottes | 3118–3145 | ⚪ Faible |
| Ours (GLB clonés, IA de meute, charge) | 3146–3388 | 🟡 Moyenne |
| Combat MP (canon, balles, dégâts localisés, mort/respawn) | 3389–4221 | 🔴 Élevée |
| **IA du bot** (vol + tactique + tir, 4 difficultés) | 4222–4686 | 🔴 Élevée — port 1:1, réglages existants à préserver |
| Campagne (6 niveaux data-driven, carte, progression) | 3477–3600, 4687–4955 | 🟡 Moyenne |
| Cinématiques (mini-timeline caméra) | 3602–3705 | ⚪ Faible |
| **HUD + écrans** (canvas 2D, ~1 000 lignes) | 4956–6010 | 🔴 Élevée en volume, faible en risque |
| Boucle principale / init / reset | 6011–6296 | ⚪ Faible |
| **Multijoueur** (WS, lobby, interpolation) | `hibou3d-multiplayer.js` | 🔴 Élevée |

### 2.3 Constantes structurantes (à recopier telles quelles)

```
ARENA_RADIUS_XZ = 1400      ARENA_RADIUS_Y = 630        TERRAIN_SIZE = 4500
TERRAIN_SEGS = 240 (96 mobile)   WATER_Y = -3.0     HILL_AMP = 24
SNOW_LINE = 46   TREE_LINE = 38   RING_BASE = 240   RING_VAR = 260
CANONICAL_TERRAIN_SEED = 483.271  ← déterminisme multijoueur, ne JAMAIS changer
TREE_COUNT = 3000 (550 mobile)   CLOUD_COUNT = 64 (15)   STAR_COUNT = 1600 (500)
FX3D_MAX = 320 (90)
Vol : YAW_RATE 70°/s, PITCH_RATE 55°/s, ROLL_RATE 200°/s, THRUST_ACCEL 28,
      MAX_SPEED 34, OWL_MASS 1.6, GRAVITY 9.8, AIR_LIFT 0.05, AIR_DRAG 0.02,
      INDUCED_DRAG 0.03, FLAP_LIFT 13, FLAP_FADE 17, SIDE_GRIP 0.6,
      STALL_AOA 18°, CL_MAX 1.5, ANG_RESPONSE 7, STALL_SPEED 9.5, STALL_RECOVER 13
Caméra : CAMERA_LOCAL_OFFSET (0, 2, 6.5), CAMERA_MIN_DIST 2.5, FOV 70 → 84 (dynamique)
Réseau : SEND_HZ 15, REMOTE_EXTRAP_MAX 0.3 s
```

### 2.4 Résultats d'audit importants

- ✅ **Aucun shader GLSL personnalisé.** Que des `MeshStandardMaterial`, `MeshBasicMaterial`,
  `SpriteMaterial`, `PointsMaterial`. La contrainte « traduis mon GLSL en GDShader » du
  brief ne s'applique donc à **rien d'existant**.
- ✅ **Aucun son.** `grep -c 'Audio|sound'` → **0**. L'audio est une **opportunité post-parité**
  (§11), pas une charge de portage.
- ⚠️ **Le terrain est déterministe et partagé par le réseau.** `CANONICAL_TERRAIN_SEED` +
  `hashNoise()` basé sur `Math.sin(...) * 43758.5453` doivent produire des hauteurs
  identiques côté Godot, sinon les hiboux distants apparaissent enterrés (§5.4).
- ⚠️ **`barnowl.glb` = 9,4 Mo** pour un seul modèle. Rebudget obligatoire au lot 12.
- ⚠️ Le verrou campagne (`campaignLoginAttempt`) fait un **appel serveur réel** avec token
  vérifié : ce n'est pas un verrou client. Il faut reproduire l'appel HTTP, pas le contourner.

---

## 3. Les 3 questions d'architecture — et leurs réponses (déjà obtenues par lecture du code)

Le brief demandait de poser 3 questions avant de planifier. Le code étant accessible,
elles ont été résolues par audit ; les réponses sont ce qui structure tout le plan.

**Q1 — Où vit la source de vérité de la physique : dans Three.js ou dans du code métier séparé ?**
→ **Dans du code métier pur.** `updateFlight()` intègre un vrai vecteur vitesse sous
4 forces (poussée / portance / traînée / pesanteur) avec incidence et décrochage, et
n'utilise Three.js que comme bibliothèque de `Vector3`/`Quaternion`. **Conséquence
majeure : on ne branche PAS le hibou sur la physique de Godot.** On garde l'intégration
custom (voir §4.2, décision A).

**Q2 — Comment le monde est-il représenté : assets statiques ou génération procédurale ?**
→ **Procédural et analytique.** `terrainHeight(x, z)` est une fonction fermée (fBm +
pics gaussiens + creusement de rivières + muraille annulaire) utilisée **à la fois** pour
le maillage, les collisions, le placement des arbres, des ours et de la caméra. Aucun
échantillonnage de grille, aucun heightmap sur disque. **Conséquence : on ne porte pas
un terrain, on porte une fonction** — et elle doit rester bit-identique (§5.4).

**Q3 — Quelle est la surface d'état partagé entre le rendu et la logique (multijoueur, HUD) ?**
→ **Très large et volontairement plate.** Tout vit dans la closure du module : ~80 variables
globales, une machine à états à 12 valeurs (`S.START` … `S.QUICK_SELECT`), et un HUD canvas 2D
qui lit directement ces globales. Le multijoueur, lui, est **déjà isolé** derrière un objet
`hooks` explicite. **Conséquence : le multijoueur se porte proprement en autonome (lot 11),
mais l'état du jeu doit être re-structuré en autoloads/singletons Godot** plutôt que recopié
en 80 variables de script (§4.3).

---

## 4. Architecture Godot cible

### 4.1 Table de correspondance Three.js → Godot 4

| Three.js | Godot 4 | Notes de portage |
|---|---|---|
| `THREE.Scene` | `Node3D` racine (`Main.tscn`) | — |
| `THREE.PerspectiveCamera(70, …, 0.1, 3200)` | `Camera3D` (`fov`, `near`, `far`) | `far = 3200` conservé (lune à 2400, étoiles 1700–2500) |
| `THREE.WebGLRenderer` | Réglages projet + `Viewport` | `renderer/rendering_method = gl_compatibility` |
| `renderer.setPixelRatio(scale)` | `get_viewport().scaling_3d_scale` | **Meilleur** : ne dégrade pas le HUD 2D |
| `THREE.Mesh` | `MeshInstance3D` | — |
| `THREE.InstancedMesh` | **`MultiMeshInstance3D`** | Arbres, montagnes, nuages, hameaux |
| `THREE.Points` (étoiles, FX, pluie) | `GPUParticles3D` **ou** `MultiMeshInstance3D` | ⚠️ Vérifier le support particules GPU en Compatibility sur la version retenue ; **repli `CPUParticles3D`** décidé au lot 9 après mesure |
| `THREE.Sprite` (emoji, balles) | `Sprite3D` (`billboard = ENABLED`) | — |
| `THREE.Sprite` + `AdditiveBlending` (halos, auras, glow) | `MeshInstance3D` (`QuadMesh`) + `StandardMaterial3D` `blend_mode = ADD`, `billboard_mode = ENABLED`, `shading_mode = UNSHADED` | `Sprite3D` n'expose pas le blend additif |
| `THREE.CanvasTexture` (emoji, lune, dégradé de ciel) | PNG **pré-cuits** à l'import | Pas de canvas à l'exécution ; évite la dépendance à la police emoji du système |
| `THREE.AmbientLight` | `WorldEnvironment` → `Environment.ambient_light_*` | — |
| `THREE.HemisphereLight` | `Environment.ambient_light_color` + `ambient_light_sky_contribution` | Pas d'équivalent 1:1 ; recalibrage visuel au lot 5 |
| `THREE.DirectionalLight` + shadow camera | `DirectionalLight3D`, `directional_shadow_mode = ORTHOGONAL` | `shadow.bias` → `shadow_bias` / `shadow_normal_bias` |
| `THREE.PointLight` (feux de camp) | `OmniLight3D` | ⚠️ Compatibility limite le nombre d'omnis par objet → garder le **pool** existant (`initCampfireLightPool`) |
| `THREE.Fog` (linéaire, `near`/`far`) | `Environment.fog_mode = DEPTH` + `fog_depth_begin` / `fog_depth_end` | Bon équivalent du fog linéaire |
| `scene.background = texture dégradé` | `Environment.background_mode = SKY` + `Sky` + `ShaderMaterial` | Étoiles intégrées au shader de ciel (§6.3) |
| `GLTFLoader` / `OBJLoader` (runtime) | **Import éditeur** → `.tscn` / `Mesh` natifs | Supprime l'écran de chargement de 12 Mo |
| `SkeletonUtils.clone()` | `PackedScene.instantiate()` | Natif : chaque instance a son propre `AnimationPlayer` |
| `THREE.AnimationMixer` + `timeScale` | `AnimationPlayer.speed_scale` | Mapping direct de `FLAP_CLIP_RATE_MIN/MAX` |
| Canvas 2D HUD (`hctx.*`) | `CanvasLayer` → `Control._draw()` | Port 1:1 pour les jauges ; `Control`/`Button` pour les **menus** (§6.2) |
| `requestAnimationFrame(loop)` | `_process(delta)` / `_physics_process` | §5.5 |
| `localStorage` | `user://` + `ConfigFile` ou `FileAccess` | ⚠️ En web, `user://` = IndexedDB, **asynchrone à la synchro** (§10.4) |
| `fetch()` (verrou campagne) | `HTTPRequest` | CORS à vérifier depuis le domaine itch.io |
| `WebSocket` | `WebSocketPeer` | Fonctionne en export web ; protocole JSON inchangé (§9.11) |
| `document.exitPointerLock` / `requestPointerLock` | `Input.mouse_mode = MOUSE_MODE_CAPTURED` | Godot gère le pointer-lock web nativement |

### 4.2 Trois décisions d'architecture structurantes

> Ce sont les endroits où « penser Godot » veut dire **refuser** la solution Godot évidente.

**Décision A — Le hibou n'est PAS un `CharacterBody3D`, et le monde n'a PAS de `StaticBody3D`.**

Réflexe naturel : hibou = `CharacterBody3D`, terrain = `HeightMapShape3D`, arbres =
`StaticBody3D`. **On ne le fait pas**, pour trois raisons :
1. Le hibou vole à 34 u/s. Un serveur physique classique tunnelise ou coûte cher à ces
   vitesses ; l'intégration semi-implicite maison est déjà correcte et **testée**.
2. 3 000 arbres en `StaticBody3D` = 3 000 corps physiques. Sur WebAssembly, c'est
   rédhibitoire. Le jeu teste déjà des **cylindres/cônes analytiques** (`treeColliders`),
   coût quasi nul.
3. `terrainHeight(x, z)` donne la hauteur du sol **exactement**, en O(1), sans raycast.
   Un `HeightMapShape3D` serait moins précis ET plus lourd.

→ **Le hibou est un `Node3D`** piloté par un script d'intégration. Godot sert de moteur
de **rendu et de scène**, pas de moteur physique. C'est aussi ce qui garantit la parité
de feeling et le déterminisme multijoueur.

**Décision B — `Area3D` seulement là où il apporte quelque chose.**

On garde les tests analytiques pour : sol, arbres, bordure ellipsoïde, balles (test
segment/sphère existant, qui fait autorité côté tireur).
On utilise `Area3D` + `SphereShape3D` pour les **ramassables** (branches, caisses de
munitions, kits de soin, cadeau) et les **ours** : ce sont des tests peu nombreux,
non critiques pour le réseau, et le signal `body_entered`/`area_entered` remplace
avantageusement les boucles `updateBranches`/`bearContactCheck`.

**Décision C — Le HUD est porté en deux temps.**

Le HUD canvas 2D fait ~1 000 lignes. Traduire `hctx.fillRect` → `draw_rect`,
`fillText` → `draw_string`, `arc` → `draw_arc` est **mécanique et sans risque** : on le
fait 1:1 dans `_draw()` pour les instruments de vol (badge, jauges, viseur, radar).
Mais les **écrans** (`drawStart`, `drawCampaignSelect`, `drawQuickSelect`, `drawLevelEnd`,
`drawPaused`, `drawSettings`, lobby MP) sont aujourd'hui accompagnés d'un hit-testing
manuel (`handleCampaignSelectClick`, `handleQuickSelectClick`, `handleLevelEndClick`,
`getSliderHitArea`…). Ces écrans deviennent des **scènes `Control` avec de vrais
`Button`/`HSlider`** : ~200 lignes de hit-testing manuel disparaissent purement et simplement.

### 4.3 Arborescence de nœuds

```
Main (Node3D)                        ← GameState/orchestration
├── WorldEnvironment                 ← ciel, brouillard, ambiante, tonemap
├── Sun (DirectionalLight3D)         ← moonLight : soleil le jour, lune la nuit
├── World (Node3D)
│   ├── Terrain (MeshInstance3D)     ← maillage généré par TerrainGen
│   ├── Water (MeshInstance3D)       ← PlaneMesh + GDShader d'ondulation
│   ├── Forest (MultiMeshInstance3D × N essences)
│   ├── Mountains (MultiMeshInstance3D)
│   ├── Clouds (MultiMeshInstance3D × 3 protos)
│   ├── Village (Node3D)             ← chalets + Campfires (pool d'OmniLight3D)
│   ├── BoundaryGrid (MeshInstance3D) ← sphère unlit + shader de fade
│   └── MoonMesh (MeshInstance3D)
├── Owl (Node3D)                     ← ⚠️ PAS CharacterBody3D (décision A)
│   ├── Model (Node3D)               ← barnowl.glb instancié
│   │   └── AnimationPlayer          ← battement d'ailes (speed_scale)
│   ├── Cannon (MeshInstance3D)
│   ├── Aura (MeshInstance3D quad additif)
│   ├── PickupArea (Area3D)          ← décision B
│   ├── SpringArm3D                  ← remplace updateCameraClip (§6.1)
│   │   └── Camera3D                 ← offset (0, 2, 6.5), FOV dynamique
│   └── BoostTrail (GPUParticles3D)
├── Entities (Node3D)
│   ├── Bears / Branches / Rocks / Bullets / AmmoCrates / HealKits / Gift
│   └── RemoteOwls (Node3D)          ← hiboux distants (MP) + bot (campagne)
├── FX (Node3D)                      ← pool de particules 3D, fumée, éclats
└── UI (CanvasLayer)
    ├── HUD (Control, _draw 1:1)     ← instruments, radar, viseur, combo
    ├── Screens (Control)            ← Start, CampaignMap, QuickSelect,
    │                                   LevelEnd, Paused, Settings, Lootbox
    ├── MPLobby (Control)
    └── Cutscene (Control)           ← letterbox + texte
```

### 4.4 Autoloads (singletons) — remplace les ~80 globales de la closure

| Autoload | Remplace | Contenu |
|---|---|---|
| `GameState` | `state`, `score`, `nest`, `combo`, `lives`, `buffs`, `roundTime`… | Machine à états (enum de 12 valeurs), signaux `state_changed`, `score_changed` |
| `Terrain` | `terrainHeight`, `fbm`, `riverCarve`, `effectiveGroundY`, seeds | **Fonctions pures, sans état de scène** — testables hors jeu (§9.3) |
| `Config` | `LOW_SPEC`, `pixelScale`, `mouseSensitivity`, `isMobile` | Détection plateforme + qualité adaptative |
| `Save` | `loadCampaignProgress`, `saveCampaignProgress`, `pid` | `user://` + flush explicite en web (§10.4) |
| `Net` | `hibou3d-multiplayer.js` | `WebSocketPeer`, lobby, remotes, protocole inchangé |
| `Campaign` | `CAMPAIGN_LEVELS`, `campaignCtx` | Niveaux en **`Resource` custom** plutôt qu'en tableau littéral |

---

## 5. Mathématiques 3D : conventions et conversions

### 5.1 Bonne nouvelle : les conventions coïncident

Three.js **et** Godot 4 utilisent tous deux : **Y-up, main droite, -Z = avant**.
Il n'y a donc **aucune conversion de repère** à faire — pas d'inversion d'axe, pas de
changement de chiralité, pas de transposition de matrices. C'est le cas le plus favorable
possible et il faut en profiter : les positions, vitesses et quaternions se recopient tels quels.

Le code respecte déjà la convention `nez = -Z` (commentaire ligne 3778 :
« *le modèle est tourné de 180° pour respecter la convention nez = -Z du vol* »).

**Le seul piège** : l'ordre d'Euler par défaut est `XYZ` en Three.js, **`YXZ` en Godot**.
Impact réel faible (le vol est en quaternions/`rotateOnAxis`), mais toute lecture
d'angle via `.rotation` doit être re-vérifiée — notamment la lecture de l'angle
d'inclinaison (`curBank`) utilisée par le virage coordonné.

### 5.2 Table de conversion des opérations

| Three.js | GDScript | Piège |
|---|---|---|
| `new THREE.Vector3(x,y,z)` | `Vector3(x,y,z)` | — |
| `v.addScaledVector(u, s)` | `v += u * s` | — |
| `v.copy(u)` | `v = u` | ⚠️ `Vector3` est un **type valeur** en GDScript : la copie est implicite. Tous les `_tmp`/`_fwd` d'optimisation « zéro allocation » de Three.js **disparaissent** |
| `v.lengthSq()` | `v.length_squared()` | — |
| `v.setLength(n)` | `v = v.normalized() * n` | Gérer `v == Vector3.ZERO` |
| `v.dot(u)` / `v.cross(u)` | `v.dot(u)` / `v.cross(u)` | — |
| `v.applyQuaternion(q)` | `q * v` | — |
| `obj.getWorldDirection(v)` | `-node.global_transform.basis.z` | Convention -Z |
| `obj.rotateOnWorldAxis(axis, a)` | `node.global_rotate(axis, a)` | Utilisé par le virage coordonné |
| `obj.rotateX/Y/Z(a)` (local) | `node.rotate_object_local(Vector3.RIGHT/UP/BACK, a)` | ⚠️ **pas** `rotate_x()`, qui tourne autour de l'axe *global* |
| `obj.quaternion.slerp(q, t)` | `quat.slerp(q, t)` | — |
| `THREE.MathUtils.clamp(x,a,b)` | `clampf(x, a, b)` | — |
| `THREE.MathUtils.lerp(a,b,t)` | `lerpf(a, b, t)` | — |
| `THREE.MathUtils.degToRad(d)` | `deg_to_rad(d)` | — |
| `Math.atan2(y,x)` | `atan2(y, x)` | — |
| `obj.position` (locale) | `node.position` | Identique (transform local) |
| `obj.getWorldPosition(v)` | `node.global_position` | — |
| `obj.add(child)` | `node.add_child(child)` | ⚠️ En Godot, `add_child` **conserve la transform locale**, donc l'objet « saute » — utiliser `reparent()` si on veut préserver la position monde |
| `new THREE.Box3().setFromObject(o)` | `AABB` via `node.get_aabb()` agrégé | Utilisé par `normalizeModel()` (lot 1) |
| `THREE.Color().lerpColors(a,b,t)` | `a.lerp(b, t)` | Attention à l'espace colorimétrique (§10.3) |

### 5.3 Le modèle de vol : ce qui se porte tel quel, et ce qui bouge

`updateFlight()` (lignes 2531–2748) est **11 étapes numérotées**. Le port est un
**recopiage étape par étape** :

1. Lecture des commandes → passe par `InputMap` (§6.4)
2. Dynamique de rotation (autorité selon vitesse air, inertie `ANG_RESPONSE`) → **1:1**
3. Repère local (`_fwd`, `_up`, `_right`) → `basis.z/y/x` (attention au signe sur Z)
4. Incidence (AoA), CL, décrochage → **1:1**
5. Portance / traînée / traînée induite / battement → **1:1**
6. Poussée + gouvernes endommagées (`governEff`) → **1:1**
7. Somme des forces, `a = ΣF / OWL_MASS` → **1:1**
8. Vent de tempête → **1:1** (`rnd()` → `randf_range()`)
9. Intégration semi-implicite + **virage coordonné** (`ω = g·tan(bank)/v`) → attention
   à la lecture de `curBank` (§5.1) et au garde-fou anti-gimbal (`levelness`)
10. Bordure ellipsoïde progressive + plancher terrain → **1:1**
11. Export vers le HUD (`flight.aoa/stall/climb/throttle`) → signal Godot

**Critère de recette du lot 2** : à commandes identiques et `dt` fixe, la trajectoire
Godot doit coïncider avec la trajectoire JS à **< 1 % sur 30 s de vol** (§9.2).

### 5.4 Le point le plus délicat : le déterminisme du terrain

`hashNoise(ix, iz)` fait :
```js
const n = Math.sin(ix * 127.1 + iz * 311.7 + terrainSeed * 17.3) * 43758.5453;
return n - Math.floor(n);
```

Pour que multijoueur et rejouabilité tiennent, la version GDScript doit renvoyer
**exactement** la même valeur. Deux atouts :
- Le `float` de GDScript est un **double 64 bits**, comme le `number` de JavaScript.
- `sin()`, `floor()` de GDScript s'appuient sur la libm C, comme V8.

Deux risques réels :
- `sin()` sur de très grands arguments peut différer de quelques ULP entre implémentations,
  et le `* 43758.5453` **amplifie** cet écart de façon catastrophique (c'est le principe
  même de ce hash).
- La compilation WebAssembly peut utiliser une implémentation de `sin` différente
  de celle du natif → **le même binaire Godot pourrait diverger entre desktop et web**.

**Plan de mitigation (à traiter au lot 3, avant toute autre chose) :**
1. Écrire un harnais qui échantillonne `terrainHeight()` sur une grille de 10 000 points
   en JS (Node) et en GDScript, et compare (`docs/../tools/terrain-parity/`).
2. Si divergence : remplacer `Math.sin` par un **hash entier déterministe**
   (type `wang hash` / `PCG` sur `int64`) **des deux côtés** — c'est-à-dire modifier
   *aussi* le jeu Three.js, dans un commit dédié, pour que les deux restent alignés.
   Un hash entier est exact par construction sur toutes les plateformes.
3. Ne **jamais** changer `CANONICAL_TERRAIN_SEED` sans repasser le harnais.

Le même raisonnement s'applique à `mulberry32()` (arbres, hameaux, pics) qui, lui, est
**déjà** en arithmétique entière 32 bits — donc portable tel quel via des `int` GDScript
masqués en `& 0xFFFFFFFF`.

### 5.5 `_process` vs `_physics_process`

Le jeu JS tourne à `requestAnimationFrame` avec `dt` variable clampé à 0.05 s, et
applique un **ralenti d'impact** (`hitStopTimer`, `hitStopScale`).

→ Le vol et la logique de jeu vont dans **`_physics_process`** (pas variable garanti,
essentiel pour la reproductibilité et la parité de feeling), à **60 Hz**
(`physics/common/physics_ticks_per_second = 60`). Le HUD, la caméra, les particules
cosmétiques et l'interpolation réseau restent en `_process`.
Le hit-stop devient un multiplicateur sur `Engine.time_scale` **ou**, mieux, un `dt`
métier local — décision au lot 9 (`Engine.time_scale` affecterait aussi le réseau).

---

## 6. Choix techniques par domaine

### 6.1 Caméra

`updateCameraClip()` échantillonne 10 points sur le segment hibou→caméra pour rapprocher
la caméra si un arbre ou le relief bloque la vue. **Godot fait ça nativement avec
`SpringArm3D`** — mais `SpringArm3D` s'appuie sur le serveur physique, or on n'a
**pas** de corps physiques pour les arbres (décision A).

→ **Décision : garder l'échantillonnage analytique**, dans un script sur le `SpringArm3D`
(ou un simple `Node3D`), en réutilisant `pointInsideAnyTree()` et `effectiveGroundY()`.
Le `SpringArm3D` reste utile pour la structure et le lissage, `spring_length` étant
piloté par le résultat de l'échantillonnage.

La vue arrière (clic droit, `lookBack`) reste un simple flip de l'offset Z + `rotation.y = PI`.
Le FOV dynamique (`70 + speedRatio² × 14`) se porte tel quel.

### 6.2 HUD

- **Instruments** (badge de vitesse, bille/horizon, jauge d'incidence, alerte décrochage,
  viseur, barre d'inventaire, combo, radar, indicateurs de cible, scoreboard) →
  `Control._draw()`, port mécanique du canvas 2D.
- **Écrans** → scènes `Control` distinctes avec `Button`, `HSlider`, `Label`, `TextureRect`.
- **Polices** : `Press Start 2P` + `VT323` sont chargées depuis Google Fonts.
  → **Les embarquer dans le projet** (`.ttf` dans `assets/fonts/`) : pas de requête
  externe en web, pas de FOUT, et itch.io fonctionne hors-ligne dans le lecteur.
- **Résolution** : `CanvasLayer` avec `stretch_mode = canvas_items`, `aspect = expand`.

### 6.3 Les 4 GDShaders à écrire (aucun n'existe aujourd'hui)

| Shader | Remplace | Gain |
|---|---|---|
| **`sky.gdshader`** | `makeSkyGradient()` (CanvasTexture 2×256 recréée à chaque lerp jour/nuit) + `STAR_COUNT` points | Un `Sky` shader avec dégradé paramétré (`uniform vec3 top/bottom`) + champ d'étoiles procédural : supprime 1 600 points ET la recréation de texture |
| **`water.gdshader`** | `updateWater()` — qui recalcule **des milliers de sommets par frame sur le CPU** | Ondulation dans `vertex()` : **gain net mesurable** sur WebAssembly. Exemple parfait de traduction conceptuelle CPU→GPU |
| **`boundary.gdshader`** | `updateBoundaryGrid()` — grille ellipsoïde dont l'opacité varie avec la distance | Fade calculé dans `fragment()` au lieu d'un `material.opacity` global : bordure bien plus lisible |
| **`terrain.gdshader`** *(optionnel)* | Néant | Le terrain low-poly à couleurs par face marche déjà avec `StandardMaterial3D` (`vertex_color_use_as_albedo`). Shader seulement si on veut de la neige/humidité dynamiques |

**Contrainte Compatibility** : pas de compute shaders, pas de `SCREEN_TEXTURE` gratuit,
éviter les branches lourdes en `fragment()`. Ces 4 shaders sont tous triviaux de ce point de vue.

### 6.4 Entrées

Le jeu gère clavier **AZERTY** (ZQSD + A/E pour le roulis), souris (joystick additionnel
+ pointer-lock), clic droit (vue arrière), et tactile complet (joystick virtuel,
boutons poussée/frein, zone de tir).

→ **`InputMap`** défini dans les réglages projet :
`flight_pitch_up/down`, `flight_yaw_left/right`, `flight_roll_left/right`,
`thrust`, `brake`, `fire`, `look_back`, `pause`, `use_slot_1..3`, `dev_esp`.

Avantages immédiats : le remapping des touches devient possible (le jeu actuel est
**codé en dur en AZERTY**, ce qui exclut les joueurs QWERTY — problème réel pour itch.io),
et la manette arrive gratuitement.

Le tactile devient une scène `TouchControls.tscn` (`TouchScreenButton` + joystick virtuel
custom), affichée si `OS.has_feature("mobile")` ou `DisplayServer.is_touchscreen_available()`.

### 6.5 Instanciation et budget de draw calls

| Contenu | Aujourd'hui | Godot |
|---|---|---|
| 3 000 arbres, 4 essences × N sous-mesh | `InstancedMesh` par pièce | `MultiMeshInstance3D` par (essence × surface) |
| Nuages (64, 3 protos, paliers d'opacité) | `InstancedMesh` par palier | Idem — un `MultiMesh` par palier d'opacité |
| Montagnes de la muraille | `InstancedMesh` | `MultiMeshInstance3D` |
| Chalets de hameaux | Meshes individuels | `MultiMeshInstance3D` par type de pièce |
| Balles, branches, caisses | `Sprite` individuels | Pool de `Sprite3D` **pré-alloués** (jamais `queue_free` en jeu) |
| Particules FX (320 max) | Pool de `Points` recyclés | `GPUParticles3D` ou `MultiMesh` — **le pool reste, on ne crée rien par frame** |

**Règle d'or web : zéro allocation par frame.** Toute la logique de pool/recyclage
existante (`fx3dCursor`, `removeBranch`, `clearBullets`…) est **conservée**, pas
« simplifiée » — c'est elle qui tient le framerate.

---

## 7. Structure du dépôt

Le port vit **à côté** du jeu Three.js, qui reste en ligne et fonctionnel.

```
godot/hibou3d/
├── project.godot                    ← rendering_method = gl_compatibility
├── export_presets.cfg               ← preset "Web" (non versionné si secrets)
├── autoload/
│   ├── game_state.gd  config.gd  save_manager.gd
│   ├── terrain.gd                   ← fonctions pures (fbm, terrain_height, …)
│   └── net.gd                       ← WebSocketPeer
├── scenes/
│   ├── main.tscn/.gd
│   ├── owl/owl.tscn  owl_flight.gd  owl_camera.gd  owl_damage.gd
│   ├── world/terrain.tscn  water.tscn  forest.tscn  clouds.tscn
│   │         village.tscn  boundary.tscn  sky.tscn
│   ├── entities/bear.tscn  branch.tscn  rock.tscn  bullet.tscn
│   │            ammo_crate.tscn  heal_kit.tscn  gift.tscn  remote_owl.tscn
│   ├── ui/hud.tscn  screen_start.tscn  screen_campaign_map.tscn
│   │      screen_quick_select.tscn  screen_level_end.tscn  screen_paused.tscn
│   │      screen_settings.tscn  lootbox.tscn  mp_lobby.tscn  cutscene.tscn
│   │      touch_controls.tscn
│   └── fx/particles.tscn  smoke.tscn  boost_trail.tscn
├── scripts/
│   ├── flight/flight_model.gd       ← port 1:1 de updateFlight (§5.3)
│   ├── ai/bot_ai.gd  bot_flight.gd  bot_tuning.gd
│   ├── ai/bear_ai.gd
│   ├── world/terrain_gen.gd  weather.gd  moon_events.gd  storm.gd
│   └── campaign/campaign_levels.gd  cutscene_player.gd
├── resources/
│   ├── levels/lv1.tres … lv6.tres   ← CAMPAIGN_LEVELS en Resource custom
│   └── materials/  shaders/         ← sky, water, boundary, terrain
├── assets/
│   ├── models/                      ← les .glb existants (rebudgétés, lot 12)
│   ├── fonts/                       ← Press Start 2P, VT323 embarquées
│   └── textures/emoji/              ← 🐻 🌿 🎁 … pré-cuits en PNG
└── tests/                           ← GUT ou harnais maison (§9)

tools/terrain-parity/                ← harnais JS↔GDScript (§5.4)
docs/hibou-3d.html                   ← INCHANGÉ, reste en ligne
```

---

## 8. Découpage en lots

> Un lot = une branche = une PR = une démo jouable ou vérifiable.
> **Aucun lot ne commence avant que le précédent soit recetté.**

| Lot | Titre | Dépend de | Effort |
|---|---|---|---|
| 0 | Socle : projet, Compatibility, export web, CI | — | S |
| 1 | Hibou + caméra (statique) | 0 | S |
| 2 | **Modèle de vol** | 1 | **L** |
| 3 | **Terrain analytique + eau** | 0 | **L** |
| 4 | Décor instancié (arbres, montagnes, nuages, hameaux) | 3 | M |
| 5 | Ciel, cycle jour/nuit, lumières, brouillard | 3 | M |
| 6 | HUD + machine à états d'écrans | 1 | M |
| 7 | Gameplay solo (branches, ours, combo, rase-mottes, cadeau/loot) | 2,3,6 | L |
| 8 | Événements (lunes, tempête, rochers, météo) | 5,7 | M |
| 9 | Effets (particules, hit-stop, shake, fumée) | 7 | M |
| 10 | Combat + IA bot + campagne + cinématiques | 7 | **XL** |
| 11 | Multijoueur WebSocket | 10 | L |
| 12 | Mobile, perf, poids, export itch.io | tous | M |
| 13 | *(post-parité)* Audio, remapping, accessibilité | 12 | M |

---

## 9. Détail des lots

### Lot 0 — Socle

**Fait :** création de `godot/hibou3d/`, `project.godot` avec
`rendering/renderer/rendering_method = "gl_compatibility"` (et `.mobile` idem),
`physics_ticks_per_second = 60`, `stretch_mode = canvas_items`.
Installation des templates d'export web. Preset « Web » minimal. Un `Main.tscn` qui
affiche un cube et un `Label`. Ajout d'un job CI (`.github/workflows/`) qui **build
l'export web à chaque push** et publie l'artefact.

**Terminé quand :** l'export web se charge dans un navigateur, en Compatibility,
avec le cube visible et le FPS affiché. Poids du build noté (référence de départ).

**Coût web :** c'est ici qu'on mesure le **poids plancher** du runtime Godot (~20–40 Mo
de `.wasm` avant compression). Si ce plancher est jugé rédhibitoire, c'est **maintenant**
qu'on l'apprend, pas au lot 12.

---

### Lot 1 — Hibou + caméra

**Fait :** import de `barnowl.glb`, scène `owl.tscn`, portage de `normalizeModel()`
(mise à l'échelle par `AABB`, alignement au sol, yaw), `SpringArm3D` + `Camera3D` à
l'offset `(0, 2, 6.5)`, FOV 70 dynamique, `AnimationPlayer` pour le battement d'ailes
(`speed_scale` = `FLAP_CLIP_RATE_MIN..MAX`), vue arrière (`look_back`).
`InputMap` complet défini (§6.4). Anti-clipping **désactivé** (pas encore d'arbres).

**Terminé quand :** le hibou tourne sur lui-même au clavier, les ailes battent, la
caméra suit avec le roulis, la vue arrière fonctionne.

---

### Lot 2 — Modèle de vol ⭐

Le lot le plus important du projet : c'est lui qui décide si le port « a le même goût ».

**Fait :** `scripts/flight/flight_model.gd` — port des 11 étapes de `updateFlight()`
(§5.3), toutes les constantes de §2.3, décrochage en cloche (`stallMode`,
`STALL_SPEED`/`STALL_RECOVER`), autorité des gouvernes selon la vitesse air,
inertie de rotation, virage coordonné, bordure ellipsoïde progressive.
Sortie de l'état de vol (`aoa`, `stall`, `climb`, `throttle`) via signal.

**Terminé quand — recette quantitative :**
1. Un harnais rejoue une **séquence de commandes scriptée** (30 s : décollage, virage
   serré, chandelle jusqu'au décrochage, récupération, rase-mottes) en JS **et** en Godot
   à `dt` fixe de 1/60 s.
2. Écart de position finale **< 1 %** de la distance parcourue ; le décrochage se déclenche
   à la **même seconde ± 0,2 s**.
3. Recette subjective : Rémi vole 5 minutes dans les deux versions et valide le feeling.

**Si la recette 1–2 échoue** : ne pas passer au lot 3. Un modèle de vol « presque » porté
est une dette qui contamine l'IA du bot (lot 10) et le multijoueur (lot 11), qui en dépendent
tous les deux directement.

---

### Lot 3 — Terrain + eau ⭐

**Fait, dans cet ordre strict :**
1. **D'abord le harnais de parité** (§5.4) : `tools/terrain-parity/`. Comparaison
   `terrainHeight()` JS vs GDScript sur 10 000 points. **Cette étape conditionne tout le reste.**
2. Port des fonctions pures dans l'autoload `Terrain` : `hashNoise`, `valueNoise`, `fbm`,
   `ridged`, `mulberry32`, `fillMountainPeaks`, `fillRiverPaths`, `riverCarve`,
   `terrainHeight`, `effectiveGroundY`, `forestDensity`, muraille annulaire
   (`RING_START/FULL/BASE/VAR`).
3. Génération du maillage : `PlaneMesh` 240×240 → `ArrayMesh` **non indexé** (facettes
   franches) avec **couleur par face** (`vertex_color_use_as_albedo`), `flat shading`
   par normales dupliquées. Palette de §`makeTerrain()` recopiée (herbes/roche/neige/
   sable/vase/lit de rivière + second canal d'« humidité »).
4. Eau : `PlaneMesh` + **`water.gdshader`** (ondulation en `vertex()`, §6.3),
   au lieu du recalcul CPU.
5. `regenerateTerrainSeed()` / `restoreCanonicalTerrain()` / `disposeWorldGeometry()`.

**Terminé quand :** le terrain Godot est **visuellement superposable** au terrain
Three.js à graine canonique (captures côte à côte depuis 3 points fixes), et le harnais
de parité passe. Le hibou du lot 2 se pose et crashe au bon endroit.

**Coût web :** la génération du maillage (240² × 2 triangles non indexés ≈ 345 k sommets)
doit être **mesurée** au démarrage. Si elle bloque le thread principal > 1 s en WASM,
la découper en plusieurs frames (`await get_tree().process_frame`) derrière l'écran de chargement.

---

### Lot 4 — Décor instancié

**Fait :** `makeTrees()` (3 000 arbres, masque de bruit, exclusion lacs/pentes/`TREE_LINE`,
`treeColliders` analytiques conservés), `makeMountainScenery()`, `makeClouds()` (dérive
+ recyclage en bord de carte), `makeBuildings()` (chalets simple/étage/tour de guet,
feux de camp, pool d'`OmniLight3D`). Tout en `MultiMeshInstance3D` (§6.5).
Réactivation de l'anti-clipping caméra du lot 1.

**Terminé quand :** 3 000 arbres à ≥ 60 FPS desktop et ≥ 30 FPS sur le mobile de référence,
draw calls comptés dans le moniteur Godot, collisions d'arbres identiques au jeu JS.

---

### Lot 5 — Ciel, jour/nuit, lumières

**Fait :** `sky.gdshader` (dégradé + étoiles procédurales), `WorldEnvironment`,
`DirectionalLight3D` unique (soleil le jour / lune la nuit, comme `moonLight`),
ombres orthogonales avec la caméra d'ombre centrée sur le hibou, brouillard
`FOG_MODE_DEPTH`, `updateDayNightCycle()` basé sur `Time.get_unix_time_from_system()`
(**et surtout pas** sur un temps de session : la synchro multijoueur du cycle repose
sur l'horloge murale), mesh de la lune (`moon.glb`) à 2 400 u.

**Terminé quand :** le cycle complet défile, les ombres ne scintillent pas, deux
instances du jeu lancées à 1 minute d'intervalle affichent la **même heure du jour**.

---

### Lot 6 — HUD + écrans

**Fait :** `hud.tscn` (`_draw()` 1:1 : `rrect`, `retroBtn`, `scanlines`, badge de vitesse,
instruments de vol, combo, viseur, barre d'inventaire, indicateurs de cible, `drawSpeedFX`),
puis les écrans en `Control` + `Button` (§4.2 décision C) : Start, Paused, Settings
(avec `HSlider` de sensibilité — remplace `handleSliderDrag`), Over, Lootbox.
Machine à états `GameState` avec l'enum à 12 valeurs et ses signaux.

**Terminé quand :** navigation complète entre tous les écrans à la souris **et** au clavier,
HUD lisible en 1280×720 comme en 390×844 (mobile).

---

### Lot 7 — Gameplay solo

**Fait :** branches (`collectibleSpawnPos` — apparition devant/autour du joueur, halo,
recyclage), nid/score/combo/`MAX_COMBO_TIME`, rase-mottes (`updateSkim`), ours
(clonage par `instantiate()`, IA de meute : traque, `windup`, charge, récupération,
séparation `BEAR_PACK_DIST`, `BEAR_RAMP_TIME`), cadeau garanti + pilier de lumière,
loot box avec roulette (`LOOT_TYPES` et leurs poids), buffs (`speed`/`multi`/`slow`/
`invincible`), vies, `beginGame()`/reset.
`Area3D` pour les ramassables et le contact ours (§4.2 décision B).

**Terminé quand :** une partie solo complète est jouable du début au game over, avec
score/combo/buffs/loot fonctionnels et un comportement d'ours reconnaissable.

---

### Lot 8 — Événements du monde

**Fait :** pleine lune / lune de sang (+ raccourcis debug L/K), tempête (exclusion
mutuelle avec les lunes, debug T), rochers de tempête (icosaèdres taillés au bruit,
chute accélérée, emportés par le vent, poussière à l'impact, punition au contact),
météo dynamique (épisodes de pluie, neige en altitude, densification du brouillard,
assombrissement, éclairs).

**Terminé quand :** chaque événement se déclenche, se cumule correctement (ou s'exclut),
et se termine proprement ; les raccourcis debug fonctionnent.

---

### Lot 9 — Effets

**Fait :** pool de particules 3D (`spawnFX3D` : collecte, poussière, éclats, étincelles,
traînée de boost), particules 2D de texte flottant (`spawnFX` + `worldToScreen`),
`triggerScreenFade`, `screenShake`, `hitFlash`, **hit-stop** (choix `Engine.time_scale`
vs `dt` métier — trancher ici), fumée de dégâts, cascade de combo.
Arbitrage `GPUParticles3D` vs `CPUParticles3D` vs `MultiMesh` **sur mesure réelle en web**.

**Terminé quand :** les effets sont visuellement au niveau du jeu JS et le FPS ne
décroche pas lors d'une collecte en chaîne + impact de rocher simultanés.

---

### Lot 10 — Combat, IA, campagne

Le plus gros lot. Le découper en **4 sous-lots**, chacun mergé séparément :

**10a — Combat** : canon (`makeCannonMesh`), balles (pool, test segment/sphère,
`classifyHitLocation` : aile gauche/droite/queue/corps), munitions, caisses de munitions
et kits de soin (positions **déterministes** par `hash32(matchSeed, idx, gen)`),
système de dégâts (`governEff` : perte d'autorité par gouverne, dérive latérale
`DRIFT_ACCEL`, réparation passive à 30 s), mort/respawn.

**10b — IA du bot** : `updateBotFlight` (même squelette que `updateFlight` mais lisant
un `input` calculé), `updateBotAI` (interception, `extend`, break défensif, jink de fuite,
priorités décrochage > terrain > bordure > cible), `updateBotFire` (cône de visée,
`reactionDelay`, `leadFactor`), et les **4 profils `BOT_DIFFICULTY_TUNING`**
(easy/medium/hard/expert) recopiés **valeur par valeur** — ce sont des réglages issus
d'un entraînement génétique (`server/hibou3d-training/`), ils ne se ré-inventent pas.

**10c — Campagne** : `CAMPAIGN_LEVELS` converti en **`Resource` custom** (`lv1..lv6.tres`),
les deux types de niveau (`ground` : ours statiques + objectif de collecte chronométré,
événements aléatoires coupés / `dogfight` : ours volant piloté par l'IA), carte de campagne
(`drawCampaignSelect` → scène `Control`, chemin + nœuds + hibou animé), progression
`user://` (clé `h3d_campaign_v1`, `pid` anonyme), verrou d'accès (`HTTPRequest` vers
`/api/hibou3d/campaign-login` + `campaign-verify`, token conservé).

**10d — Cinématiques** : mini-timeline `{dur, look, cam, text}`, caméra en offsets
autour d'une cible, travelling `from`/`to` et orbite, letterbox, skip, restauration
de la caméra.

**Terminé quand :** les 6 niveaux sont jouables et gagnables, la progression persiste
après rechargement du navigateur, et les 4 difficultés de bot sont **subjectivement
distinctes** (recette : Rémi bat `easy` sans effort et perd contre `expert`).

---

### Lot 11 — Multijoueur

**Point clé : le protocole ne change pas.** `server/hibou3d-server/server.js` reste
tel quel. Les parties sont **100 % Godot** — le client Three.js ne sera plus utilisé.
Conséquence directe : la parité bit-à-bit du terrain (§5.4) n'est **plus critique**
pour le multijoueur (elle l'était si les deux clients cohabitaient). Elle reste souhaitable
pour la rejouabilité et l'exactitude, mais n'est pas bloquante pour le lancement.

**Fait :** `Net` autoload avec `WebSocketPeer` (wss://`bear.servebeer.com`, reconnexion
avec backoff), messages **à l'identique** : `hello`, `set-pseudo`, `away-status`,
`list-lobby`, `quick-join`, `join-room`, `leave-room`, `state`, `fire`, `hit`, `died`,
`respawn-request`, `pickup-ammo`, `pickup-crate`, `pickup-heal` ; réception :
`presence`, `lobby`, `joined`, `game-full`, `player-joined`, `player-left`, `state`,
`fire`, `hit`, `died`, `respawned`, `ammo`, `respawn-ack`, `crate-taken`, `heal-taken`,
`kill`, `error`.
Format du paquet `state` **inchangé** : `pos[3]` arrondi à 2 décimales, `quat[4]` à 3,
`vel[3]` à 2, `dmg[]`, `seq`, à **15 Hz**.
Hiboux distants : interpolation + extrapolation plafonnée à 0,3 s, auras colorées
(brown/purple/yellow/green), lobby (`Control`), scoreboard, `restoreCanonicalTerrain()`
avant chaque manche.

**Terminé quand :** deux clients Godot jouent ensemble sans divergence, et la progression
multijoueur persiste (`user://` avec flush explicite, voir §10.4).

---

### Lot 12 — Mobile, perf, poids, itch.io

**Fait :**
- `TouchControls.tscn` : joystick virtuel (tangage/roulis proportionnels, pas de lacet —
  comme le jeu actuel), boutons poussée/frein, zone de tir.
- Qualité adaptative : `scaling_3d_scale` piloté par les FPS (portage de
  `updateAdaptiveQuality`, seuils 45/57 FPS, plancher 0,55, plafond 0,85 en mobile).
- Profil `LOW_SPEC` : `TREE_COUNT 550`, `TERRAIN_SEGS 96`, `CLOUD_COUNT 15`,
  `STAR_COUNT 500`, `FX3D_MAX 90`, ombres désactivées, MSAA off.
- **Rebudget des assets** (§10.1) — en particulier `barnowl.glb` (9,4 Mo).
- Export web final, page itch.io (§10.5).

**Terminé quand :** le jeu tient les cibles de §10.2 sur desktop et sur le mobile de
référence, et la page itch.io est publiée (non listée d'abord).

---

### Lot 13 — Post-parité (hors périmètre initial)

Une fois la parité atteinte, ces chantiers deviennent peu coûteux en Godot et sont
**explicitement hors du portage** :
- **Audio** — le jeu n'en a aucun. `AudioStreamPlayer3D` (vent selon la vitesse air,
  battement d'ailes, impacts, ours, tirs) + `AudioStreamPlayer` (musique, UI). Sans doute
  le meilleur rapport effort/impact perçu de toute la liste.
- **Remapping des touches** — le jeu est codé en dur en AZERTY ; `InputMap` rend le
  remapping trivial. Important pour un public itch.io international.
- Manette (gratuite via `InputMap`), accessibilité (taille de texte, daltonisme sur
  les auras), localisation FR/EN.

---

## 10. Optimisation et livraison web

### 10.1 Budget de poids (le vrai risque du projet)

| Poste | Aujourd'hui (Three.js) | Godot (estimation à confirmer au lot 0) |
|---|---|---|
| Runtime moteur | ~340 Ko (three.module.min.js) | **~20–40 Mo de `.wasm`** ⚠️ |
| Modèles 3D | 12,4 Mo (dont `barnowl.glb` 9,4 Mo) | À réimporter/compresser |
| Code jeu | ~300 Ko | Négligeable dans le `.pck` |

**Actions obligatoires au lot 12 :**
1. **`barnowl.glb` (9,4 Mo) : décimation + compression de textures.** C'est le premier
   levier, et de loin. Cible : < 1,5 Mo sans perte visible à la distance de caméra (6,5 u).
2. Compression de textures pour le web (`ETC2/ASTC` selon la cible ; attention, la
   compression VRAM change la taille du `.pck` **et** l'occupation mémoire).
3. **Template d'export personnalisé** : recompiler les templates web en désactivant les
   modules inutilisés (aucun n'est utilisé pour : navigation, CSG, GridMap, WebRTC,
   physique 2D, etc.). Gain typique important sur le `.wasm`.
4. Vérifier que le serveur d'itch.io sert bien en **gzip/brotli** (il le fait) et
   mesurer le **poids transféré**, pas le poids sur disque.
5. Écran de chargement soigné : c'est le premier contact du joueur itch.io.

### 10.2 Cibles de performance

| Cible | Desktop | Mobile de référence |
|---|---|---|
| FPS en vol au-dessus de la forêt | ≥ 60 | ≥ 30 |
| Temps de premier affichage (cache froid, connexion correcte) | < 15 s | < 30 s |
| Pic mémoire | < 1 Go | < 600 Mo |
| Allocations par frame en jeu | **0** | **0** |

### 10.3 Pièges spécifiques à Compatibility

- **Une seule `DirectionalLight3D` avec ombres** est le mode confortable — c'est déjà
  le cas du jeu (`moonLight` unique).
- **Nombre limité d'`OmniLight3D` par objet.** Le pool de lumières de feux de camp
  (`initCampfireLightPool`) est donc **à conserver impérativement**.
- Pas de `SDFGI`, pas de `VoxelGI`, pas de SSAO/SSR, pas de volumétrique.
  Aucun de ces effets n'est utilisé aujourd'hui : sans impact.
- **Espace colorimétrique** : Three.js applique `SRGBColorSpace` explicitement sur les
  `CanvasTexture` et le rendu. Godot gère ça différemment (`Environment` + tonemap).
  → Prévoir une **passe de calibration couleur** au lot 5, captures côte à côte.
  Les couleurs du terrain (`0x16321f`, `0x2e333a`…) risquent de sortir plus claires ou
  plus saturées ; ne pas les corriger une par une avant d'avoir réglé tonemap/exposition.

### 10.4 Sauvegarde en web

`localStorage` est synchrone. En export web Godot, `user://` s'appuie sur **IndexedDB**,
qui est asynchrone : une écriture n'est pas garantie persistée à la fermeture de l'onglet.
→ `Save.gd` doit appeler explicitement le flush après chaque écriture importante
(fin de niveau, déblocage) et **jamais** compter sur une écriture au moment du
`NOTIFICATION_WM_CLOSE_REQUEST`. À tester en dur : jouer un niveau, fermer l'onglet
brutalement, rouvrir, vérifier la progression.

### 10.5 itch.io

- Upload du zip d'export web, coché **« This file will be played in the browser »**.
- Taille de la fenêtre : **1280×720** avec bouton plein écran ; « Mobile friendly »
  activé seulement si le lot 12 valide vraiment le mobile.
- **`SharedArrayBuffer`** : si le build est multi-thread, il faut activer l'option
  d'isolation cross-origin dans les réglages du projet itch.io (COOP/COEP). Un build
  **mono-thread** évite cette dépendance au prix de perfs moindres.
  → **Décision par mesure au lot 12**, avec test réel sur la page itch.io (pas seulement
  en local : le comportement diffère).
- Prévoir : icône, 3–5 captures, GIF de gameplay, description FR + EN, tags
  (`3d`, `flight`, `arcade`, `godot`, `owl`), et **les crédits des modèles**
  (`docs/models/CREDITS.md` — CC-BY 3.0 pour `bear.glb` et `moon.glb` : **l'attribution
  est une obligation légale**, elle doit figurer sur la page itch.io ET dans le jeu).

---

## 11. Risques identifiés

| Risque | Gravité | Mitigation |
|---|---|---|
| **Divergence du hash de terrain** (GDScript vs WASM) | 🟡 Moyen — affecte rejouabilité, pas critique pour MP | Harnais de parité Godot desktop ↔ WASM au lot 3 ; si divergence, repli sur un hash entier |
| **Poids du runtime WebAssembly** | 🔴 Critique — décide de la viabilité | Mesuré dès le **lot 0**, avant tout investissement ; template custom + rebudget assets |
| **Modèle de vol qui « ne sent pas pareil »** | 🔴 Critique — c'est le jeu | Recette quantitative bloquante au lot 2 (§9.2) ; interdiction de passer au lot 3 sans elle |
| Performance mobile en WASM | 🟠 Élevé | Profil `LOW_SPEC` + `scaling_3d_scale` dès le lot 12 ; tester sur un vrai téléphone, pas en émulation |
| Calibration couleur/tonemap | 🟡 Moyen | Passe dédiée au lot 5, captures côte à côte |
| Particules GPU en Compatibility | 🟡 Moyen | Arbitrage par mesure au lot 9, repli `CPUParticles3D`/MultiMesh |
| Persistance `user://` en web | 🟡 Moyen | Flush explicite + test de fermeture brutale (§10.4) |
| CORS sur l'API du verrou campagne depuis itch.io | 🟡 Moyen | Vérifier les en-têtes du serveur Oracle **avant** le lot 10c ; ajouter l'origine itch.io si besoin |
| Volume du HUD (~1 000 lignes) | 🟢 Faible mais long | Travail mécanique, parallélisable, sans risque technique |
| Dérive : « tant qu'on y est, améliorons X » | 🟠 Élevé | **Règle : parité d'abord.** Toute amélioration va au lot 13, aucune exception avant le lot 12 |

---

## 12. Questions ouvertes — décisions à prendre avant le lot 0

1. **Version de Godot.** Viser la dernière 4.x stable, la **figer** dans le dépôt
   (`.godot-version` + version du template d'export dans la CI). Une montée de version
   en cours de portage change les perfs et le comportement de Compatibility.
2. **Parité stricte ou relooking ?** Ce plan suppose **parité stricte** puis améliorations
   au lot 13. Si l'objectif est de repenser le jeu au passage, le découpage change beaucoup.
3. ✅ **DÉCIDÉ : Godot seulement.** Pas de cohabitation Three.js ↔ Godot en multijoueur.
   Le client Three.js reste en ligne (`docs/hibou-3d.html`), mais les parties multijoueur
   seront **100 % Godot** après le portage. Conséquence : la parité bit-à-bit du terrain
   n'est **plus critique** pour le multijoueur, seulement souhaitable pour la rejouabilité.
4. **Mobile : dans le périmètre du portage, ou plus tard ?** Le jeu actuel a un support
   tactile complet ; le maintenir coûte le lot 12 en entier.
5. **Mobile de référence** — quel appareil sert de cible de recette ?
6. **itch.io** : page publique dès la première version jouable, ou non listée jusqu'à la
   parité complète ? (Recommandation : **non listée** jusqu'à la fin du lot 12.)
7. **Audio (lot 13)** : sons libres de droits, ou création ? À anticiper, car c'est
   probablement le plus gros gain de qualité perçue une fois la parité atteinte.

---

## 13. Ordre d'attaque recommandé

Les **trois premiers lots décident du projet**. Ils sont volontairement placés avant
tout travail cosmétique :

```
Lot 0  → réponse à « le poids web est-il acceptable ? »
Lot 2  → réponse à « le vol a-t-il le même goût ? »
Lot 3  → réponse à « le terrain est-il portable et cohérent ? »   (important mais non critique pour MP)
```

**Note — Godot seulement (§12.3) :** Avec l'absence de cohabitation Three.js ↔ Godot,
la parité bit-à-bit du terrain perd son caractère **critique pour le multijoueur**.
Le lot 3 reste important pour la rejouabilité en solo et la stabilité, mais ne bloque plus
le reste du projet si une légère divergence survient.

Si les réponses aux lots 0 et 2 sont bonnes, le reste du portage est long mais **sans
risque technique majeur** : c'est de la traduction méthodique, lot par lot.
Si l'une des deux est mauvaise, on l'apprend en quelques jours plutôt qu'en quelques mois.

---

*Document de planification — aucun code n'a été écrit. Prochaine étape : trancher les
questions de §12, puis lancer le lot 0.*
