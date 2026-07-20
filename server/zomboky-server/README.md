# zomboky-server

API générale du site `zomboky.github.io`, hébergée sur le serveur Oracle
(`bear.servebeer.com`) derrière le reverse-proxy Apache `/zomboky-api`.

C'est l'ancien `orange-server`, renommé et recentré après la suppression du
tableau de bord des maladies des orangers (`docs/orange-disease.html`). Les
parties orange (Earth Engine, GBIF, SIF, timers d'ingestion) ont été retirées.

## Endpoints

| Route | Accès | Rôle |
|---|---|---|
| `GET/POST /api/visitor-count` | public (POST rate-limité : 1 incrément/h/IP) | compteur de visiteurs global de la page d'accueil (`docs/scripts/visitor-counter.js`) |
| `POST /api/hibou3d/login` | public (rate-limité) | verrou par mot de passe de la page Hibou 3D (`docs/scripts/hibou3d-lock.js`) |
| `GET /api/hibou3d/verify` | token hibou | validation de session du verrou |
| `POST /api/hibou3d/campaign-login` | public (rate-limité) | verrou du mode Campagne (en développement, accès solo réservé — `docs/hibou-3d.html` #campaign-lock) |
| `GET /api/hibou3d/campaign-verify` | token campagne | validation de session du verrou campagne |
| `POST /api/login` | public (rate-limité) | login admin — réservé aux futurs tableaux de bord (ex. progression de la campagne Hibou 3D, voir `plans/hibou3d-campagne.md`) |
| `GET /api/verify` | token admin | validation d'un token admin |
| `GET /health` | public | sonde de vie |

## Configuration

Variables d'environnement (voir `deploy/zomboky-server.service`) :

- `ZOMBOKY_SERVER_HOST` / `ZOMBOKY_SERVER_PORT` — écoute (défaut `127.0.0.1:8096`,
  même port que l'ancien orange-server : la conf Apache change de chemin, pas de port).
- `VISITOR_COUNT_FILE` — fichier JSON du compteur (`/var/lib/zomboky-server/visitor-count.json`
  en prod ; le compteur historique est migré depuis `/var/lib/orange-server` par le déploiement).
- `ZOMBOKY_DASHBOARD_PASSWORD` — mot de passe du login admin. Alimenté au déploiement par le
  secret GitHub Actions `ORANGE_DASHBOARD_PASSWORD` (nom historique conservé pour ne pas avoir
  à recréer le secret).
- `HIBOU3D_V6_PASSWORD` — mot de passe du verrou de la page Hibou 3D (secret GitHub du même nom).
- `CAMPAGNE_SOLO_PWD` — mot de passe du verrou du mode Campagne, tant qu'il est en développement
  (secret GitHub du même nom). Absent → `/api/hibou3d/campaign-login` refuse toute connexion,
  donc personne (y compris avec le bon code) ne peut entrer en campagne.

## Déploiement

Comme les autres services (`chess-server`, `hibou3d-server`, `flight-server`) :
copié vers `/opt/zomboky-server` par `.github/workflows/deploy.yml`, service
systemd `zomboky-server` (user `zombokyd`), conf Apache `deploy/zomboky-api.conf`.
Le workflow désactive et supprime les anciens services `orange-*` et l'ancienne
conf `/etc/httpd/conf.d/orange-api.conf`.
