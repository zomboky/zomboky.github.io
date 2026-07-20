# flight-server

API minimaliste de sauvegarde/partage des avions construits dans
`docs/flight-sim.html`. Un avion (arbre de pièces JSON) sauvegardé reçoit
un code court à 6 caractères ; ce même code permet de le recharger plus
tard, sur n'importe quel navigateur.

## Architecture

```
server.js   API Express : POST /api/designs (sauvegarde) et GET /api/designs/:code (chargement)
data/designs/<CODE>.json   un fichier par avion sauvegardé (écriture atomique)
```

Pas de base de données : chaque avion est un petit fichier JSON, comme le
compteur de visiteurs de `zomboky-server`. Pas d'authentification (API
publique, aucune donnée sensible), juste une limite de débit en écriture
par IP pour dissuader l'abus.

## Développement local

```bash
cd server/flight-server
npm install
FLIGHT_SERVER_PORT=8097 node server.js
```

```bash
curl -X POST localhost:8097/api/designs \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","parts":[{"id":"fuselage-a","x":0,"y":0,"z":0}]}'
# => {"code":"AB12CD"}

curl localhost:8097/api/designs/AB12CD
```

## Déploiement

Comme `chess-server`/`zomboky-server` : service systemd dédié
(`deploy/flight-server.service`, utilisateur système `flightd`, écoute sur
`127.0.0.1:8097`) + reverse-proxy Apache (`deploy/flight-api.conf`, chemin
public `/flight-api/`). Voir `.github/workflows/deploy.yml`. Les fichiers
JSON persistent sous `/var/lib/flight-server/designs/` (répertoire
inscriptible séparé du code applicatif en lecture seule).
