# Plan — Multijoueur pour Hibou 3D

## Contexte

Hibou 3D (`docs/hibou-3d.html`) est aujourd'hui un jeu solo : un seul hibou pilotable
(modèle physique de vol complet, aérodynamique maison), des ours ("ours") en IA
prédatrice, des collectibles ("branches" — 🪵🌿🍃🍂) et un cadeau bonus, le tout dans
un fichier HTML monolithique de ~2950 lignes (Three.js vendoré, aucun bundler, HUD
en overlay canvas 2D). Le but de cette évolution : transformer Hibou 3D en jeu
multijoueur temps réel (jusqu'à 4 hiboux, combat au canon, parties publiques
visibles/rejoignables depuis un salon), tout en gardant le mode solo intact et sans
dupliquer le moteur physique/rendu déjà en place.

Le repo a déjà un précédent direct à imiter : `server/chess-server/` (relais
WebSocket Node.js léger, sans base de données, déployé sur le VM Oracle Cloud via
`.github/workflows/deploy.yml`, exposé en `ws://` simple car le port 443 est bloqué
côté security list Oracle — voir `server/chess-server/README.md`). Le multijoueur
Hibou 3D suit la même architecture (relais + petites règles de bon sens côté
serveur, pas de simulation physique côté serveur).

**Décision d'architecture actée avec l'utilisateur** : la détection des touches
(balle → hibou) est **client-reportée**, pas serveur-autoritaire. Chaque client
simule localement sa propre balle et détecte lui-même quand elle touche un hibou
adverse (position reçue du réseau), puis envoie un message `hit` au serveur qui se
contente de relayer + de garde-fous simples (cadence de tir, stock de munitions).
C'est le même niveau de confiance que chess-server/flight-server existants — pas de
portage de la géométrie de vol côté Node.

**Contrainte d'infra à respecter** : comme pour les échecs, le multijoueur Hibou 3D
ne fonctionnera qu'en chargeant la page depuis `http://bear.servebeer.com/hibou-3d.html`
(copie miroir HTTP servie par le VM Oracle), pas depuis l'URL HTTPS GitHub Pages
(`https://zomboky.github.io/...`) — un navigateur refuse d'ouvrir une connexion
`ws://` non sécurisée depuis une page HTTPS (contenu mixte). Réutiliser exactement
le pattern de `docs/scripts/chess-multiplayer.js` (bannière d'avertissement +
`?ws=` override pour le dev local).

**Fait architectural clé** : tout le jeu (state, `owlGroup`, `branches`, `bears`,
`S`, etc.) vit à l'intérieur de la closure `window.__hibouStart = async function
(token) {...}` (`docs/hibou-3d.html:93-2944`) — un module ES sœur ne peut donc pas
lire ces variables directement. Le code multijoueur client vit dans un nouveau
fichier `docs/scripts/hibou3d-multiplayer.js`, importé en haut du `<script
type="module">` existant (après la ligne 88), exposant `initMultiplayer(hooks)` où
`hooks` est un petit objet de références/callbacks passés explicitement (scene,
camera, `owlGroup`, `THREE`, `ARENA_CENTER`/`ARENA_RADIUS_XZ`, `effectiveGroundY`,
`worldToScreen`/`drawTargetIndicator`/`rrect`, `hctx`/`hudCanvas`, `S`, getters/
setters d'état, `emojiTexture`, etc.). Quelques nouvelles variables de pont
(`multiplayerMode`, `wingDamage`, `mpAmmo`) restent déclarées directement dans
`hibou-3d.html` car la physique (`updateFlight()`) et le HUD (`drawHUD()`) doivent
les lire de façon synchrone chaque frame.

## Fichiers concernés

**Nouveaux fichiers**
- `docs/scripts/hibou3d-multiplayer.js` — réseau (WebSocket), lobby (liste joueurs
  connectés + parties en cours), rendu des hiboux distants (interpolation, pas de
  simulation), balles, aura colorée, HUD additionnel (croix verte, ESP triche).
- `server/hibou3d-server/server.js` — relais WebSocket, calqué sur
  `server/chess-server/server.js`.
- `server/hibou3d-server/package.json` (dépendance `ws`, `engines.node >= 18`).
- `server/hibou3d-server/README.md` (mêmes avertissements HTTP-only que chess).
- `server/hibou3d-server/deploy/hibou3d-server.service` (systemd, calqué sur
  `server/chess-server/deploy/chess-server.service`).
- `server/hibou3d-server/deploy/hibou3d-ws.conf` (reverse-proxy Apache, calqué sur
  `server/chess-server/deploy/chess-ws.conf`).

**Fichiers modifiés**
- `docs/hibou-3d.html` — import du module, extension de `S`, variables de pont,
  gate des ours, canon + croix HUD, pool de balles, munitions (nouvelle liste
  `ammoCrates` séparée de `branches`), dégâts d'aile dans `updateFlight()`, écrans
  mort/respawn, entrée menu "M" vers le lobby, appel à `initMultiplayer(hooks)`
  juste avant `loop()` (~ligne 2942).
- `.github/workflows/deploy.yml` — 4ᵉ bloc backend (`useradd hibou3dd`, copie/
  `npm install --omit=dev` de `/opt/hibou3d-server`, unité systemd, conf Apache),
  sur le modèle exact des blocs chess/orange/flight déjà présents (lignes ~30-116).

## Serveur — `server/hibou3d-server/server.js`

- Port `8098` (chess=8095, orange interne, flight=8097), chemin WS `/hibou3d-ws`,
  env `HIBOU3D_SERVER_HOST`/`HIBOU3D_SERVER_PORT`.
- **Salons publics sans code** : `rooms = new Map()` (id interne auto-généré, pas de
  code à saisir). Message client `quick-join` : le serveur cherche une room avec
  `players.length < 4`, y ajoute le client, sinon en crée une nouvelle
  automatiquement — ça satisfait "les parties deviennent publiques automatiquement,
  n'importe qui peut les rejoindre" sans aucune gestion de room côté joueur.
  `join-room {roomId}` optionnel pour rejoindre une partie précise vue dans la
  liste plutôt que l'auto-matchmaking.
- Par room : `{ id, players: Map<ws,{id,pseudo,color,ammo,alive}>, colorsInUse: Set,
  lastActivity }`. Couleurs assignées serveur-side dans l'ordre
  `['brown','purple','yellow','green']` (première libre), libérées au départ.
  Cap dur à 4 (`game-full` au-delà). Sweep 30 min d'inactivité (mêmes constantes
  que chess-server), suppression immédiate d'une room vidée (pas besoin de TTL
  pour du temps réel, contrairement aux échecs asynchrones).
- **Protocole JSON** (`type` + `switch`, comme chess-server) :
  - Client→serveur : `hello{pseudo}` (sanitisation identique à
    `sanitizePseudo` de chess-server), `quick-join`, `join-room{roomId}`,
    `leave-room`, `state{pos,quat,vel,ammo,alive,seq}` (~15 Hz), `fire{seq}`,
    `hit{targetId,location}` (location ∈ head/left-wing/right-wing/body),
    `died{cause}`, `respawn-request`, `pickup-ammo`, `away-status{away}`.
  - Serveur→client : `presence` (liste globale, calqué sur
    `broadcastPresence()` de chess-server), `lobby{rooms:[...]}` (parties en
    cours + joueurs dedans), `joined{roomId,color,players}`,
    `player-joined`/`player-left` (avec libération de couleur), `state` relayé
    (sauf à l'émetteur), `fire`/`hit`/`died`/`respawned` relayés, `game-full`,
    `error`.
- **Garde-fous serveur** (pas de simulation, juste des règles) : cadence de tir
  bornée à 100 tirs/s par client (seau de jetons, reflète 6000 coups/min),
  munitions trackées côté serveur (miroir de `ammo` reçu + décrément par tir
  accepté + incrément par `pickup-ammo`), plafond 150, refus de `fire`/`hit` si
  `!alive` ou munitions à 0.
- Heartbeat ping/pong 20 s (garde le tunnel Apache WS vivant, comme chess-server).
  Pas de boucle de tick serveur : chaque `state` reçu est relayé immédiatement (le
  serveur ne simule rien, donc pas de tick d'autorité à gérer).

## Client — `docs/scripts/hibou3d-multiplayer.js`

- Connexion : mêmes mécaniques que `chess-multiplayer.js` — `PRODUCTION_WS_URL =
  'ws://bear.servebeer.com/hibou3d-ws'`, override `?ws=` pour le dev local,
  détection contenu mixte (bannière dessinée en canvas via `hctx`/`rrect`, pas de
  DOM puisque Hibou 3D n'a pas d'infra DOM pour ça).
- Pseudo : `localStorage['h3d-mp-pseudo']`, saisi via `prompt()` natif (pas de
  modal DOM à construire), envoyé une fois via `hello` à la connexion.
- Diffusion de l'état local : échantillonné chaque frame mais **envoyé à 15 Hz**
  (accumulateur de dt), payload `{pos,quat,vel,ammo,alive,seq}`.
- **Hiboux distants** : objets légers, PAS de simulation physique — un clone visuel
  du modèle GLB déjà chargé (même technique que le clonage des ours,
  `bearProto.clone(true)`), avec aura colorée en enfant. Position/rotation
  interpolées (`lerp`/`slerp`) vers la dernière valeur reçue, avec extrapolation
  courte via la vélocité reçue entre deux paquets réseau. Créés à
  `player-joined`/roster initial, cachés (pas détruits) sur `died`, réaffichés sur
  `respawned`, détruits sur `player-left`.

## Lobby / UI (liste joueurs + parties en cours)

- **Recommandation : HUD canvas**, pas d'overlay DOM — le jeu n'a aucune infra DOM
  pour des panneaux/listes, et le lobby n'est qu'un écran plein-écran de plus,
  exactement comme `drawStart()`/`drawPaused()` déjà existants (mêmes helpers
  `rrect()`, `hctx.fillText()`).
- `S` étendu : `{ START:0, PLAY:1, OVER:2, PAUSED:3, LOOT:4, MP_LOBBY:5, MP_DEAD:6 }`.
- `MP_LOBBY` : statut de connexion, liste des joueurs connectés (`presence`), liste
  des parties en cours avec leurs joueurs (`lobby`), bouton/touche pour rejoindre
  (`quick-join`), retour à `S.START`.
- Entrée depuis l'écran d'accueil : touche `M` (ajoutée au listener `keydown`
  existant, avant le raccourci générique qui relance `beginGame()`).

## Aura colorée par joueur

- 4 couleurs fixes : `brown 0x8a5a2b`, `purple 0x9b30ff`, `yellow 0xffe135`,
  `green 0x4caf50`.
- Réutilise tel quel le pattern déjà présent dans le fichier : sprite additif
  teinté enfant d'un `Object3D` (identique au halo de menace des ours
  `menaceMat`/au halo du cadeau) — juste une nouvelle instance teintée par couleur,
  attachée à `owlGroup` local (le joueur voit aussi sa propre aura) et à chaque
  hibou distant.
- Assignation **côté serveur** à l'entrée en room (première couleur libre),
  libérée au départ — le client ne choisit jamais sa couleur, il applique celle
  reçue du serveur.

## Ours désactivés en multijoueur

- Un seul flag `multiplayerMode`. `bearTarget()` (déjà le point de passage unique
  contrôlant la population d'ours) retourne `0` si `multiplayerMode` est actif —
  les 4 sites d'appel `bears.push(newBear())` existants sont déjà tous gardés par
  des comparaisons `bears.length < bearTarget()`, donc **aucune autre modification
  n'est nécessaire** à ces sites. Au passage en mode multijoueur, vider les ours
  restants d'une éventuelle session solo précédente via `removeBear()`.

## Canon, balles, munitions

- **Canon** : mesh procédural simple (petit cylindre, matériau métal sombre),
  enfant d'`owlGroup` à un offset local fixe pointant vers l'avant (-Z), même
  esprit que le hibou procédural de secours `buildOwl()`. Même mesh attaché à
  chaque hibou distant (purement cosmétique pour eux).
- **Croix HUD verte** : point fixe calculé depuis un vecteur local constant du
  canon, projeté à l'écran via `worldToScreen()` existant, dessiné chaque frame en
  mode multijoueur — pas un viseur dynamique, juste un repère fixe à l'écran
  (comme demandé : "il reste fixe par rapport au hibou").
- **Balles = projectiles** (pas de hitscan) : pool `bullets = []`, sprite ou petit
  mesh, vitesse proposée `120 u/s` (~3,5× `MAX_SPEED=34`), durée de vie ~2,5 s
  (~300 unités de portée). Déplacement par frame, collision testée contre les
  hiboux distants via une sphère large (`OWL_COLLIDE_RADIUS * 2.5`) puis
  classification de zone (tête/aile gauche/aile droite/corps) par projection dans
  l'espace local du hibou visé, en subdivisant sa boîte englobante déjà calculée
  dans `setupOwlVisual()`. Sur touche détectée localement : suppression de la
  balle, effet visuel immédiat côté tireur, envoi de `hit{targetId,location}` — la
  victime applique elle-même l'effet quand son propre client reçoit le `hit`
  relayé (jamais l'inverse, pour éviter qu'un client modifie l'état d'un autre).
- **Cadence** : 6000 coups/min = 100 coups/s → cooldown `0.01s` entre tirs tant que
  la touche/clic de tir est maintenu, tir sur clic gauche (souris déjà utilisée
  pour viser en vol via pointer-lock).
- **Chargeur** : 150 coups (`mpMagCap`), décrémenté par tir, jamais rechargé
  manuellement — seulement par ramassage de munitions.
- **Munitions au sol** : nouvelle liste séparée `ammoCrates` (pas un flag sur
  `branches`, pour ne rien risquer de casser en solo), réutilisant telles quelles
  les fonctions génériques déjà existantes `collectibleSpawnPos()` (placement) et
  la logique de recyclage de `updateBranches()` adaptée. Pool proposé : **3
  caisses** (contre 14 branches en solo — "taux d'apparition beaucoup moins
  élevé"), grant proposé `+60` munitions par ramassage (plafonné à 150). Visuel :
  nouvel emoji (ex. 📦) via `emojiTexture()` déjà présent. Le système `branches`
  solo reste intégralement inchangé.

## Dégâts d'aile

- Deux multiplicateurs `wingDamage.left`/`wingDamage.right` (1 = intact),
  lus/multipliés directement dans les formules déjà en place d'`updateFlight()`
  (lignes ~1581-1769) :
  - Portance dynamique (`dynLift`) multipliée par la moyenne des deux ailes.
  - Autorité de roulis multipliée par la moyenne, plus un biais de dérive
    constant proportionnel à `(right - left)` qui tire le hibou vers le côté
    endommagé (comme une vraie aile touchée).
- Sur un `hit` reçu à `left-wing`/`right-wing` (seulement si c'est bien mon propre
  hibou visé) : `wingDamage.X = max(0.25, wingDamage.X * 0.6)` — dégât cumulable,
  plancher à 0,25 pour ne jamais rendre le vol totalement impossible.
- Réinitialisé à `{left:1, right:1}` au respawn.
- Un `hit` au corps : effet cosmétique mineur (flash/secousse), pas de dégât
  persistant — seuls tête et ailes ont un effet mécanique, comme demandé.

## Mort / Game over / Respawn

- Sur `hit` reçu avec `location === 'head'` et `targetId === moi` : `alive=false`,
  minuteur `mpRespawnTimer = 15`, `state = S.MP_DEAD`, hibou local caché, pointer
  lock relâché (même pattern que la mort solo existante), envoi `died` au serveur
  qui relaie aux autres clients (leur copie distante de mon hibou disparaît).
- Écran `S.MP_DEAD` : calqué sur `drawOver()` existant (panneau rouge), mais avec
  un compte à rebours visible et **aucune interaction requise** — transition
  automatique vers `S.PLAY` à 0.
- **Respawn** : position aléatoire dans l'arène en réutilisant
  `ARENA_CENTER`/`ARENA_RADIUS_XZ`/`effectiveGroundY()` déjà existants (angle et
  distance aléatoires, altitude = sol effectif + marge) — même technique que le
  placement des ours/collectibles. Réinitialise vélocité, `wingDamage`,
  `mpAmmo = mpMagCap`, réaffiche le hibou, envoie `respawn-request` pour que le
  serveur relaie `respawned` aux autres clients.
- Une touche non mortelle (aile/corps) ne change jamais `state` — le vol continue,
  seule la maniabilité est affectée.

## Mode "triche" développeur

- Toggle par raccourci clavier volontairement discret (ex. `Ctrl+Shift+X`), jamais
  documenté dans l'écran d'accueil, état persisté dans
  `localStorage['h3d_dev_esp']`.
- Rendu : quand actif, appelle la fonction déjà existante
  `drawTargetIndicator(worldPos, color, label)` pour chaque hibou distant avec sa
  position interpolée courante, sa couleur d'aura et son pseudo — réutilisation
  directe d'un mécanisme déjà en place (flèche de boussole bord d'écran), aucune
  nouvelle logique de dessin nécessaire.

## Déploiement (`.github/workflows/deploy.yml`)

Ajouter un 4ᵉ bloc, calqué mot pour mot sur celui de `chess-server` (lignes
~29-40 du workflow actuel) :
- `id -u hibou3dd >/dev/null 2>&1 || sudo useradd -r -s /sbin/nologin hibou3dd`
- copie de `server/hibou3d-server` vers `/opt/hibou3d-server`, `npm install
  --omit=dev`, `chown -R hibou3dd:hibou3dd`
- copie de l'unité systemd + conf Apache, `daemon-reload`, `enable`/`restart`
  ajoutés aux listes existantes de services.
- Aucun nouveau port à ouvrir côté security list Oracle Cloud — tout passe par le
  reverse-proxy Apache déjà en place sur le port 80, comme pour chess-server.

## Vérification (pas de suite de tests automatisés dans ce repo)

1. Lancer le serveur en local : `cd server/hibou3d-server && npm install && node
   server.js` (log d'écoute sur `127.0.0.1:8098/hibou3d-ws`).
2. Servir `docs/` en local (`python3 -m http.server`), ouvrir deux profils/onglets
   avec `?ws=ws://localhost:8098/hibou3d-ws` (deux `localStorage` distincts →
   deux pseudos).
3. Vérifier le lobby : chaque onglet voit l'autre dans la liste des joueurs
   connectés ; après un `quick-join`, la liste des parties affiche 1 partie 1/4
   puis 2/4.
4. Vérifier les auras : couleurs différentes assignées dans l'ordre
   brown/purple/yellow/green, `game-full` (ou nouvelle room) au 5ᵉ joueur.
5. Piloter dans un onglet, vérifier que l'autre onglet affiche un mouvement
   fluide du hibou distant (interpolation 15 Hz) sans téléportation.
6. Confirmer l'absence totale d'ours en multijoueur, et leur réapparition normale
   au retour en solo (`beginGame()`).
7. Vérifier qu'il n'existe que ~3 caisses de munitions au lieu de 14 branches, et
   que le ramassage augmente le compteur de munitions HUD (plafonné à 150).
8. Combat croisé entre les deux onglets : cadence de tir plafonnée à 100/s même en
   spammant, touche corps = flash sans effet durable, touche d'aile = dérive de
   roulis visible côté touché (inspectable via `window.__hibouDebug()` étendu avec
   `wingDamage`/`mpAmmo`/`alive`), touche tête = écran `MP_DEAD` avec compte à
   rebours 15 s puis respawn aléatoire, munitions et ailes réinitialisées,
   réapparition visible côté adverse.
9. Activer le mode triche dans un onglet, confirmer l'indicateur de position de
   l'adversaire même hors champ/derrière le terrain, et l'absence de tout contrôle
   visible pour un joueur normal.
10. Charger la page en HTTPS et confirmer le message "multijoueur indisponible en
    HTTPS" plutôt qu'un échec silencieux.
11. Fermer un onglet en cours de partie : vérifier que le serveur libère sa
    couleur, prévient les autres clients (`player-left`), et nettoie la room vide.
