# chess-server

Petit serveur WebSocket (Node.js + [`ws`](https://www.npmjs.com/package/ws)) qui
sert d'arbitre et de relais pour le jeu d'échecs multijoueur de
`docs/chess.html`. Il gère la création de parties avec un code à 4
caractères, la validation des coups côté serveur (avec `chess.js`, la même
copie que celle utilisée par le client), le relais des coups entre les deux
joueurs, la liste des personnes connectées (pseudo obligatoire), et une
partie solo contre le bot **GM Hibou Chess** (Stockfish en coulisses,
profondeur fixe 18, aucune mention de Stockfish côté UI).

Le serveur ne stocke rien en base de données : tout est en mémoire, les
parties inactives depuis 30 minutes sont automatiquement supprimées (ce qui
tue aussi le process Stockfish associé s'il s'agissait d'une partie contre
le bot).

## HTTP uniquement (pas de HTTPS/WSS)

Le site et ce relais fonctionnent volontairement en **HTTP simple**
(`ws://`, pas `wss://`). Un vhost HTTPS avait été mis en place à un moment,
mais le port 443 est bloqué au niveau de la Security List Oracle Cloud (le
port 80 est le seul ouvert publiquement) — toute tentative de connexion en
HTTPS/WSS échoue donc silencieusement pour les visiteurs. Le client
(`docs/scripts/chess-multiplayer.js`) pointe vers `ws://bear.servebeer.com/chess-ws`
et affiche un avertissement si la page elle-même est chargée en HTTPS (ex.
via GitHub Pages), car un navigateur interdit à une page HTTPS d'ouvrir une
connexion `ws://` non sécurisée (contenu mixte). Pour jouer en multijoueur,
utilisez donc `http://bear.servebeer.com/chess.html`.

Si un jour le port 443 est ouvert côté OCI Security List et que vous voulez
réactiver HTTPS, il faudra relancer un certbot (`.github/workflows/chess-diagnose.yml`
avec `setup_tls: true`) et repasser `PRODUCTION_WS_URL` en `wss://` côté
client.

## Bot "GM Hibou Chess" (Stockfish)

- Le binaire Stockfish est installé manuellement sur le serveur (compilé
  depuis les sources dans `/home/opc/Stockfish`), puis copié une fois vers
  `/opt/stockfish/stockfish` (`root:root`, exécutable par tous) car le
  service tourne en utilisateur restreint `chessd` avec `ProtectHome=true` :
  il ne peut pas lire `/home/opc`. Cette copie **n'est pas automatisée** par
  le déploiement — à refaire manuellement si le binaire est mis à jour :
  ```
  sudo cp /home/opc/Stockfish/src/stockfish /opt/stockfish/stockfish
  sudo chown root:root /opt/stockfish/stockfish
  sudo chmod 755 /opt/stockfish/stockfish
  ```
- `server/chess-server/stockfish.js` spawn un process Stockfish par partie
  contre le bot (protocole UCI), et l'interroge avec `go depth 18` à chaque
  coup (profondeur fixe, pas de limite de temps ni de niveau réduit).
- Le chemin du binaire est configurable via la variable d'environnement
  `STOCKFISH_PATH` (par défaut `/opt/stockfish/stockfish`, positionnée dans
  `deploy/chess-server.service`).

## Déploiement automatique

Le workflow `.github/workflows/deploy.yml` déploie ce dossier à chaque push
sur `master`, en plus du site statique :

1. copie `server/chess-server` vers `/opt/chess-server` sur le serveur Oracle Cloud ;
2. installe les dépendances (`npm install --omit=dev`) ;
3. installe/relance le service systemd `chess-server` (écoute en local sur
   `127.0.0.1:8095`, jamais exposé directement à Internet) ;
4. installe une configuration Apache (`/etc/httpd/conf.d/chess-ws.conf`) qui
   fait un reverse-proxy WebSocket de `http://votre-domaine/chess-ws` vers
   le serveur Node local.

Aucun port supplémentaire n'a besoin d'être ouvert dans la security list
Oracle Cloud : tout passe par le port 80 déjà utilisé par Apache.

## Vérifications ponctuelles à faire une fois sur le serveur

Ces points ne peuvent pas être vérifiés depuis ce dépôt et méritent un coup
d'œil manuel (`ssh` sur la machine) après le premier déploiement :

- **Version de Node.js** : `dnf install -y nodejs` installe la version du
  dépôt par défaut d'Oracle Linux, qui peut être ancienne. Le serveur a
  besoin de Node **>= 18**. Si besoin :
  ```
  sudo dnf module reset nodejs
  sudo dnf module enable -y nodejs:20
  sudo dnf install -y nodejs
  ```
- **Modules Apache** : `mod_proxy` et `mod_proxy_wstunnel` doivent être
  chargés. Sur Oracle Linux, ils le sont généralement par défaut via
  `/etc/httpd/conf.modules.d/00-proxy.conf`. Vérifier avec :
  ```
  httpd -M | grep proxy
  ```
  Si `proxy_wstunnel_module` n'apparaît pas, ajoutez
  `LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so` dans ce
  fichier.
- **Binaire Stockfish** : voir la section ci-dessus, à copier manuellement
  vers `/opt/stockfish/stockfish` si absent (sinon les parties contre GM
  Hibou Chess échoueront silencieusement — vérifier
  `journalctl -u chess-server` en cas de doute).

## Test manuel du serveur

```
curl http://127.0.0.1:8095/health
# -> chess-server ok

sudo systemctl status chess-server
sudo journalctl -u chess-server -f
```

Depuis l'extérieur, la page `chess.html` se connecte automatiquement à
`ws://bear.servebeer.com/chess-ws`.

## Développement local

```
cd server/chess-server
npm install
node server.js
```

Puis ouvrez `docs/chess.html?ws=ws://localhost:8095/chess-ws` (servi par un
serveur statique quelconque, ex. `python3 -m http.server` dans `docs/`) pour
pointer le client vers l'instance locale sans passer par Apache. Sans
Stockfish installé localement, le mode "Jouer contre GM Hibou Chess" ne
fonctionnera pas (la partie se crée mais aucun coup ne revient) — les
parties humain contre humain restent testables normalement.
