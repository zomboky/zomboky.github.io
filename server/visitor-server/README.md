# visitor-server

Petite API Express qui alimente le compteur de visiteurs affiché sur
`docs/index.html` et `docs/chess.html` (`docs/scripts/visitor-counter.js`).
Extrait de `orange-server` (qui n'a rien à voir avec un compteur de
visiteurs) pour vivre dans son propre service, déployé indépendamment.

Le compteur est stocké dans un simple fichier JSON (pas de base de
données) et incrémenté au plus une fois par heure et par IP :

```
server.js       API Express (GET/POST /api/visitor-count, GET /health)
deploy/         systemd + config Apache pour le déploiement Oracle Cloud
```

## Développement local

```
cd server/visitor-server
npm install
node server.js
```

Puis :

```
curl http://127.0.0.1:8097/api/visitor-count
curl -X POST http://127.0.0.1:8097/api/visitor-count
```

## Variables d'environnement

- `VISITOR_SERVER_HOST` (défaut `127.0.0.1`)
- `VISITOR_SERVER_PORT` (défaut `8097`)
- `VISITOR_COUNT_FILE` (défaut `<repo>/data/visitor-count.json` en local ;
  `/var/lib/visitor-server/visitor-count.json` en production, voir
  `deploy/visitor-server.service`)
- `VISITOR_SERVER_DATA_DIR` (défaut `<repo>/data`, seulement utilisé pour
  calculer la valeur par défaut de `VISITOR_COUNT_FILE`)

## Déploiement

`.github/workflows/deploy.yml` déploie ce dossier sur la même VM Oracle
Cloud que `chess-server` et `orange-server`, selon le même schéma :
utilisateur système dédié (`visitord`), service systemd écoutant en local
(`127.0.0.1:8097`, jamais exposé directement à Internet), reverse-proxy
Apache (`/visitor-api/`).
