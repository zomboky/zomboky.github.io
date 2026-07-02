# chess-server

Petit serveur WebSocket (Node.js + [`ws`](https://www.npmjs.com/package/ws)) qui
sert d'arbitre et de relais pour le jeu d'échecs multijoueur de
`docs/chess.html`. Il gère la création de parties avec un code à 4
caractères, la validation des coups côté serveur (avec `chess.js`, la même
copie que celle utilisée par le client), et le relais des coups entre les
deux joueurs.

Le serveur ne stocke rien en base de données : tout est en mémoire, les
parties inactives depuis 30 minutes sont automatiquement supprimées.

## Déploiement automatique

Le workflow `.github/workflows/deploy.yml` déploie ce dossier à chaque push
sur `master`, en plus du site statique :

1. copie `server/chess-server` vers `/opt/chess-server` sur le serveur Oracle Cloud ;
2. installe les dépendances (`npm install --omit=dev`) ;
3. installe/relance le service systemd `chess-server` (écoute en local sur
   `127.0.0.1:8095`, jamais exposé directement à Internet) ;
4. installe une configuration Apache (`/etc/httpd/conf.d/chess-ws.conf`) qui
   fait un reverse-proxy WebSocket de `https://votre-domaine/chess-ws` vers
   le serveur Node local.

Aucun port supplémentaire n'a besoin d'être ouvert dans la security list
Oracle Cloud : tout passe par le port 443/80 déjà utilisé par Apache.

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
- **VirtualHost dédié** : `chess-ws.conf` s'applique à la configuration
  globale du serveur. Si votre site est servi par un `<VirtualHost>` HTTPS
  qui redéfinit ses propres directives `Proxy*` (souvent le cas avec un
  vhost généré par Certbot), copiez les deux lignes `ProxyPass` /
  `ProxyPassReverse` de `deploy/chess-ws.conf` à l'intérieur de ce
  `<VirtualHost>`.
- **SELinux** : le déploiement exécute `setsebool -P
  httpd_can_network_connect 1` pour autoriser Apache à contacter le process
  Node local. Si SELinux n'est pas actif, cette commande est sans effet
  (pas d'erreur bloquante).

## Test manuel du serveur

```
curl http://127.0.0.1:8095/health
# -> chess-server ok

sudo systemctl status chess-server
sudo journalctl -u chess-server -f
```

Depuis l'extérieur, une fois le reverse-proxy en place, la page
`chess.html` se connecte automatiquement à `wss://votre-domaine/chess-ws`.

## Développement local

```
cd server/chess-server
npm install
node server.js
```

Puis ouvrez `docs/chess.html?ws=ws://localhost:8095/chess-ws` (servi par un
serveur statique quelconque, ex. `python3 -m http.server` dans `docs/`) pour
pointer le client vers l'instance locale sans passer par Apache.
