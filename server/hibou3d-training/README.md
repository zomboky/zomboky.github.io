# hibou3d-training

Environnement d'entraînement par **self-play évolutionnaire** pour le bot
campagne de [Hibou 3D](../../docs/hibou-3d.html). Tourne entièrement en
headless (aucun rendu, aucun GPU) — pensé pour un serveur Oracle Cloud
gratuit, en arrière-plan pendant des heures.

Voir `plans/hibou3d-training.md` (racine du dépôt) pour le contexte complet :
pourquoi ce projet existe, les deux garde-fous demandés (oubli catastrophique
et overfitting au self-play), et comment les résultats seront réinjectés dans
le jeu.

## Principe

Le bot du jeu est une machine à états heuristique (`approach` / `extend` /
`break` / `evade`) pilotée par 14 paramètres numériques (le « génome »). Cet
outil fait évoluer une population de génomes par algorithme génétique
(sélection par tournoi, crossover BLX-α, mutation gaussienne, élitisme), où le
fitness de chaque individu combine trois éléments :

1. **Performance contre la population courante** — le combat en self-play qui
   pousse le bot à progresser.
2. **Performance contre le Hall of Fame** (`src/hall-of-fame.js`) — archive
   permanente des champions des générations passées. Un individu qui
   « oublierait » comment battre les stratégies d'il y a 50 générations pour
   se sur-spécialiser contre la population actuelle perd des points ici, donc
   la sélection l'élimine. **C'est le garde-fou contre l'oubli
   catastrophique.**
3. **Performance contre 4 archétypes humains fixes** (`src/archetypes.js` —
   rusher, sniper, acrobat, newbie) qui ne co-évoluent jamais. Un style gagnant
   uniquement en interne mais qui se ferait détruire par un joueur humain de
   base est pénalisé ici. **C'est le garde-fou contre l'overfitting au
   self-play.**

Un bonus de diversité comportementale (fitness sharing simplifié sur le %
de temps passé dans chaque état + la précision de tir) empêche en plus toute
la population de converger vers un seul style.

## Installation

```bash
npm install
```

Seule dépendance : `three` (utilisé uniquement pour `Vector3`/`Quaternion`/
`Object3D`/`MathUtils`, pas de rendu — fonctionne parfaitement en Node
headless).

## Lancer un entraînement

```bash
node src/train.js \
  --generations 150 \        # nombre de générations
  --population 24 \          # taille de la population
  --match-duration 45 \      # durée simulée d'un match, en secondes
  --pop-sample 4 \           # adversaires tirés de la population par individu/génération
  --hof-sample 3 \           # adversaires tirés du Hall of Fame par individu/génération
  --hof-interval 8 \         # ajoute le meilleur individu au HoF toutes les N générations
  --hof-max 24 \             # taille max du Hall of Fame (élagage par diversité au-delà)
  --elite 2 \                # nombre d'individus élites conservés intacts
  --mutation-rate 0.2 \      # probabilité de mutation par gène
  --dashboard-port 3000 \    # port du dashboard web de suivi
  --dashboard-host 127.0.0.1 \ # écoute locale par défaut (aucune auth sur le dashboard) — voir "Sur Oracle" ci-dessous
  --checkpoint-interval 5    # sauvegarde un checkpoint toutes les N générations
```

Puis ouvrir `http://localhost:3000` (ou l'IP si `--dashboard-host 0.0.0.0`) dans
un navigateur : la page (fond blanc, zéro dépendance) affiche en direct le
résultat de chaque match, sa durée, le débit de matchs/seconde et l'ETA, le
meilleur/moyen fitness, la diversité génétique et les scores du meilleur bot
contre les 4 archétypes.

## Sur le serveur Oracle

Le pipeline `.github/workflows/deploy.yml` copie automatiquement ce dossier
vers `/opt/hibou3d-training` à chaque déploiement (push sur `master`), avec
`npm install` déjà fait — **mais ce n'est volontairement PAS un service
systemd** : contrairement aux serveurs WebSocket/API du site, c'est un job
ponctuel de plusieurs heures que tu démarres/arrêtes toi-même. Seuls `src/` et
les fichiers `package.json` sont rafraîchis à chaque déploiement ;
`checkpoints/` et `results/` sont préservés (un push sans rapport ne détruit
pas un entraînement en cours).

Le dossier appartient à l'utilisateur système `hibou3dd` (même compte que le
serveur multijoueur). Pour lancer/reprendre un entraînement en arrière-plan
malgré la déconnexion SSH :

```bash
ssh <user>@<ip-oracle>
sudo -u hibou3dd screen -S hibou3d-training
cd /opt/hibou3d-training
sudo -u hibou3dd node src/train.js --generations 150 --population 24
# Ctrl+A puis D pour détacher l'écran sans tuer le process
```

Pour revenir voir la progression : `sudo -u hibou3dd screen -r
hibou3d-training`. Pour reprendre après interruption :
`node src/train.js --resume checkpoints/latest.json ...`.

Le dashboard écoute en local uniquement par défaut (`127.0.0.1`, pas
d'authentification). Pour le consulter depuis ton poste, ouvre un tunnel SSH
plutôt que d'exposer le port publiquement :

```bash
ssh -L 3000:127.0.0.1:3000 <user>@<ip-oracle>
```

puis ouvre `http://localhost:3000` dans ton navigateur.

Les débits réels dépendent fortement du CPU — la page affiche le débit mesuré
et l'ETA recalculée en direct, donc pas besoin de deviner à l'avance : lancer,
regarder le dashboard, ajuster `--generations`/`--population` si besoin (le
process peut être interrompu à tout moment, l'entraînement reprend depuis le
dernier checkpoint).

## Reprendre un entraînement interrompu

```bash
node src/train.js --resume checkpoints/latest.json --generations 300 ...
```

`checkpoints/latest.json` est réécrit à chaque checkpoint (en plus de
`checkpoints/gen-N.json`, gardé pour l'historique).

## Résultat

`results/best-genome.json` contient le meilleur génome jamais trouvé (mis à
jour dès qu'un nouveau record de fitness apparaît), avec son détail de
performance (scores contre population/HoF/archétypes, comportement observé).
C'est ce fichier qui sert de base à la Phase 8 (réinjection dans
`BOT_DIFFICULTY_TUNING` côté jeu).

## Structure

| Fichier | Rôle |
|---|---|
| `src/constants.js` | Constantes de vol/combat/arène (copie fidèle du jeu, arène réduite ×2) |
| `src/terrain.js` | Bruit fBm/ridged, montagnes, rivières, muraille — terrain déterministe |
| `src/arena.js` | Bordure d'arène ellipsoïdale, garde-fou de ciblage |
| `src/flight.js` | Modèle de vol (portance/traînée/décrochage/dégâts) |
| `src/combat.js` | Balles, détection d'impact, dégâts, réparation passive |
| `src/owl-state.js` | Fabrique d'état d'un combattant (spawn/respawn) |
| `src/bot-ai.js` | IA de décision paramétrée par le génome à 14 gènes |
| `src/simulation.js` | Boucle de match headless (2 génomes s'affrontent) |
| `src/genome.js` | Encodage des gènes, crossover, mutation, distance |
| `src/archetypes.js` | 4 profils humains fixes (anti-overfitting) |
| `src/hall-of-fame.js` | Archive de champions (anti-oubli catastrophique) |
| `src/evolution.js` | Boucle évolutionnaire (fitness, sélection, sharing) |
| `src/dashboard-server.js` + `src/dashboard.html` | Suivi en direct |
| `src/train.js` | CLI, checkpointing, orchestration |
