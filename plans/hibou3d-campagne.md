# Hibou 3D — Campagne solo : état des lieux et feuille de route

## Ce qui existe déjà (v1, livrée)

La première version de la campagne est intégrée dans `docs/hibou-3d.html` :

- **`CAMPAIGN_LEVELS`** : 6 niveaux data-driven (nombre d'ours, adversaire,
  objectif, vies, cinématiques — tout s'édite dans ce tableau).
- **Deux types de niveaux** :
  - `ground` — mode survie paramétré : ours au sol **immobiles** (embuscades
    posées sur la trajectoire du hibou, flag `static` dans `newBear`/`updateBears`),
    objectif de collecte de branches avec chrono, lunes/tempêtes/cadeaux coupés ;
  - `dogfight` — combat aérien 1v1 contre un **ours volant** : mesh d'ours
    (`makeBotBearVisual`) monté sur l'IA de bot existante
    (`BOT_DIFFICULTY_TUNING` easy/medium/hard/expert, `updateBotAI` inchangé).
- **Carte de campagne** (`drawCampaignSelect`) : chemin, nœuds
  débloqués/verrouillés, hibou animé qui vole vers le niveau fraîchement débloqué.
- **Progression localStorage** (clé `h3d_campaign_v1`) : niveaux débloqués,
  victoires/tentatives/meilleur temps par niveau, intros déjà vues, et un
  `pid` anonyme généré dès maintenant en prévision de la télémétrie.
- **Cinématiques** : mini-timeline data-driven (`intro`/`outroWin`/`outroLose`
  par niveau — travelling ou orbite caméra + texte, letterbox, skippable),
  fondu au noir générique entre les écrans.

Le reste de ce document est la feuille de route pour enrichir le jeu de
manière cohérente, par ordre de dépendance approximatif.

---

## 1. Entraînement génétique d'un génome « ours au sol » (Oracle)

Aujourd'hui les ours au sol de la campagne sont immobiles. L'objectif est de
les rendre mobiles avec une IA de poursuite **entraînée** comme le bot volant
(self-play évolutionnaire dans `server/hibou3d-training/`, job screen sur le
serveur Oracle).

### Génome ours (nouveau)

Plages calées sur les constantes actuelles du jeu (`newBear`, `updateBears`,
`BEAR_LUNGE_*`, `BEAR_PACK_DIST` dans `docs/hibou-3d.html`) :

```
spdBase, lead, driftMag, driftPeriod,          — poursuite/anticipation
lungeRange, windupTime, lungeTime,             — machine à états de charge
lungeSpeedMul, recoverTime, lungeCooldownMin,
packDist,                                      — répulsion de meute
flankWeight  (NOUVEAU)                         — encerclement : chaque ours vise
                                                 un point décalé perpendiculairement
                                                 autour de la proie
```

### Fichiers à créer dans `server/hibou3d-training/src/`

- `bear-genome.js` — `BEAR_GENE_RANGES` ci-dessus.
- `bear-ai.js` — portage 1:1 de `updateBears` (stalk/windup/lunge/recover,
  lead, drift, séparation) paramétré par le génome.
- `prey-archetypes.js` — le hibou **proie est scripté** (réutilise `flight.js`,
  `owl-state.js`, `terrain.js`) : 4 profils de fuite `straight` (ligne droite),
  `weaver` (zigzag), `skimmer` (rase-mottes), `collector` (vole de point de
  collecte en point de collecte — le plus proche d'un vrai joueur, à pondérer
  davantage dans le fitness).
- `bear-simulation.js` — `simulateHunt(bearTuning, preyArchetype, { bearCount,
  duration })` : N ours contre 1 proie, « prise » = contact ; évaluer chaque
  génome avec `bearCount ∈ {1, 2, 3}` pour un comportement robuste au nombre.
- `train-bears.js` — clone court de `train.js` : checkpoints
  `checkpoints/bear-gen-N.json`, meilleur génome `results/bear-best.json`
  (dossiers déjà préservés par `deploy.yml`), dashboard sur le port 3001 pour
  cohabiter avec un run owl.

### Refactor léger préalable (rétro-compatible)

- `genome.js` → fabrique `makeGenomeOps(GENE_RANGES)` retournant
  `{ randomGenome, crossover, mutate, genomeDistance }` ; les exports actuels
  deviennent l'instance « owl ».
- `evolution.js` → accepter un objet `domain { ops, archetypes, playMatch }`
  optionnel (défaut = comportement owl actuel). Le HoF est inutile pour l'ours
  (la proie ne co-évolue pas) : `hofSample=0`.

### ⚠ Fitness — le piège à éviter

Maximiser les captures produit un ours injouable. Utiliser une **cible de
temps de capture** : fitness = `-|meanTimeToCatch - target|`, avec
`--target-catch-time` en CLI (90 s ≈ facile, 30 s ≈ difficile), moyenné sur
les archétypes. Les paliers de campagne = runs à cibles différentes et/ou
checkpoints de générations intermédiaires. **Playtester chaque génome avant
de le figer dans le jeu.**

### Intégration côté jeu

Même workflow manuel que `expert` : copier les valeurs du JSON dans un objet
`BEAR_DIFFICULTY_TUNING` du jeu ; `updateBears` lit `b.tuning` (défaut =
constantes actuelles pour que le mode survie classique ne change pas) ; retirer
le flag `static` des niveaux concernés (`bears: { count, genome }` dans
`CAMPAIGN_LEVELS`).

## 2. Paliers d'ours volants supplémentaires — presque gratuit

Piocher des génomes de **générations intermédiaires** du training owl existant
(`checkpoints/gen-N.json` sur Oracle : une génération ~10 est un « ours volant
facile », etc.), les valider avec `node src/elo.js` (écart Elo vs easy/medium/
hard), puis les coller comme nouvelles difficultés dans `BOT_DIFFICULTY_TUNING`
et les référencer dans `CAMPAIGN_LEVELS`. Aucun code nouveau.

## 3. N adversaires volants simultanés

La v1 est volontairement restée 1v1 (zéro refactor risqué). Pour des niveaux
à 2-3 ours volants :

- Refactor `bot` → `bots[]` dans `docs/hibou-3d.html` ; passer l'entité en
  paramètre à `botRespawn`, `botTakeHit`, `botDie`, `updateBotDamage`,
  `updateBotFlight`, `updateBotAI`, `updateBotFire` (aujourd'hui elles lisent
  la globale `bot`). **Faire le refactor pur d'abord (1 bot, zéro changement
  de comportement), committer, puis ajouter le multi-bots.**
- `updateBullets` : tester les balles du joueur contre chaque bot vivant.
- `CAMPAIGN_LEVELS` : `opponent` → `opponents: [ { kind, difficulty }, … ]`.
- Auras de couleurs différentes par adversaire ; plafond ~4 (perf mobile).
- Audit final : `rg 'bot\.'` pour traquer les usages de la globale.

## 4. Télémétrie + dashboard admin (progression des joueurs)

Objectif : voir sur un tableau de bord combien de joueurs jouent la campagne
et où ils bloquent. Le stockage joueur reste en localStorage ; le serveur ne
reçoit que des événements anonymes.

- **Serveur** (`server/zomboky-server/server.js` — le login admin `/api/login`
  et `requireAuth` y sont déjà prêts) :
  - `POST /api/hibou3d/telemetry` — public, rate-limité par IP (réutiliser le
    pattern `visitorRateLimit`), payload validé/tronqué :
    `{ pid, lvl, ev: 'start'|'win'|'lose'|'quit', durS, kills, deaths, v: 1 }`.
    Stockage JSONL par jour dans `/var/lib/zomboky-server/hibou3d/`
    (répertoire à créer dans `deploy.yml` ; PAS sous `/opt`, qui est écrasé).
  - `GET /api/hibou3d/campaign-stats` — derrière `requireAuth` : agrégats par
    niveau (starts, wins, taux de réussite, durée médiane, joueurs uniques par
    `pid`, funnel de progression).
- **Client** (`docs/hibou-3d.html`) : `sendTelemetry(ev, data)` en
  `fetch(…, { keepalive: true })` **fire-and-forget dans un try/catch** — le
  jeu ne doit jamais dépendre du serveur (tester avec Oracle coupé). Le `pid`
  anonyme existe déjà dans la sauvegarde `h3d_campaign_v1`.
- **Dashboard** : page `docs/hibou3d-admin.html` — login par mot de passe
  (POST `/api/login`), tableau par niveau + funnel en canvas 2D maison.

## 5. Enrichissements de gameplay (petits, indépendants)

- **Étoiles par niveau** (1 = victoire, 2 = sans mourir, 3 = sous un temps
  `starTimeS` par niveau) — le champ `bestTimeS` est déjà sauvegardé ;
  affichage sur les nœuds de la carte.
- **Nouveaux objectifs** : `survive` (tenir X secondes), élimination sans
  respawn (`respawns: false` — les adversaires ne réapparaissent pas, victoire
  quand tous morts).
- **Ours au sol animés** : si un `bear.glb` avec clips d'animation est ajouté,
  cloner via `SkeletonUtils` + mixer par ours (plafonner ~6 mixers actifs pour
  le mobile) ; sinon garder le bob procédural actuel.
- **Cinématique de fin de campagne** plus longue (le système de cutscene
  accepte déjà des timelines arbitraires), écran de crédits.
- **Niveaux mixtes** : ours au sol + ours volant dans le même niveau (nécessite
  d'activer les systèmes solo et multijoueur simultanément — vérifier les
  gates `multiplayerMode` dans `update()` avant de s'y lancer).

## Ordre conseillé

1. (§2) paliers d'ours volants via checkpoints existants — quasi gratuit ;
2. (§5) étoiles + objectif `survive` — petit et visible ;
3. (§4) télémétrie + dashboard — indépendant du gameplay ;
4. (§3) refactor N bots ;
5. (§1) entraînement du génome ours au sol (le plus gros morceau), puis
   remplacement progressif des ours immobiles par des ours entraînés.
