# hibou3d-server

Serveur WebSocket (Node.js + [`ws`](https://www.npmjs.com/package/ws)) qui
relaie l'état des joueurs pour le mode multijoueur de `docs/hibou-3d.html`.
Contrairement à `chess-server` (qui arbitre les règles des échecs côté
serveur), ce serveur est un **relais volontairement léger** : chaque client
simule son propre vol et ses propres balles, détecte lui-même les touches
sur les hiboux adverses et les signale au serveur, qui se contente de
relayer aux autres joueurs de la partie. Le serveur n'applique que des
garde-fous simples :

- cadence de tir plafonnée à 100 coups/s par joueur (6000 coups/min),
- munitions comptées côté serveur (chargeur de 150, +60 par caisse
  ramassée, jamais au-delà de 150),
- refus de tir/touche pour un joueur mort,
- 4 joueurs maximum par partie.

## Parties publiques, sans code

Il n'y a pas de code de partie à saisir : toutes les parties sont publiques.
Le message `quick-join` rejoint la partie ouverte la plus ancienne ayant une
place libre, ou en crée une nouvelle s'il n'y en a aucune. La liste des
parties en cours (avec les pseudos des joueurs dedans) est diffusée à tous
les clients connectés (`lobby`), tout comme la liste des joueurs en ligne
(`presence`, même mécanique que chess-server, pseudo obligatoire).

Chaque joueur d'une partie reçoit une couleur d'aura assignée par le serveur
dans l'ordre `brown`, `purple`, `yellow`, `green` (première libre), rendue
disponible à nouveau quand le joueur quitte.

Tout est en mémoire : une partie vide est supprimée immédiatement, une
partie inactive depuis 30 minutes est balayée.

## HTTP uniquement (pas de HTTPS/WSS)

Même contrainte que `chess-server` (voir son README pour le détail) : le
port 443 est bloqué par la Security List Oracle Cloud, donc ce relais parle
`ws://` simple. Le multijoueur n'est donc jouable que depuis
`http://bear.servebeer.com/hibou-3d.html` — une page chargée en HTTPS
(GitHub Pages) ne peut pas ouvrir de connexion `ws://` (contenu mixte) et le
client affiche un avertissement dans ce cas.

## Déploiement automatique

Le workflow `.github/workflows/deploy.yml` déploie ce dossier à chaque push
sur `master`, comme les autres backends :

1. copie `server/hibou3d-server` vers `/opt/hibou3d-server` ;
2. `npm install --omit=dev` ;
3. service systemd `hibou3d-server` (utilisateur `hibou3dd`, écoute sur
   `127.0.0.1:8098`, jamais exposé directement) ;
4. reverse-proxy Apache `/hibou3d-ws` → `ws://127.0.0.1:8098/hibou3d-ws`
   (`deploy/hibou3d-ws.conf`).

Aucun port supplémentaire à ouvrir dans la security list : tout passe par le
port 80 d'Apache.

## Test manuel du serveur

```
curl http://127.0.0.1:8098/health
# -> hibou3d-server ok

sudo systemctl status hibou3d-server
sudo journalctl -u hibou3d-server -f
```

## Développement local

```
cd server/hibou3d-server
npm install
node server.js
```

Puis servez `docs/` avec un serveur statique quelconque (ex.
`python3 -m http.server` dans `docs/`) et ouvrez
`http://localhost:8000/hibou-3d.html?ws=ws://localhost:8098/hibou3d-ws`
dans deux navigateurs/profils pour tester à deux joueurs.
