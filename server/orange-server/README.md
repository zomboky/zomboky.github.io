# orange-server

API et scripts d'ingestion pour le tableau de bord de monitoring/prédiction
des maladies des orangers de `docs/orange-disease.html`. Comparaison
Brésil (Cinturão Citrícola) / Espagne (Valence, Murcie, Andalousie), avec
un score de risque interactif basé sur des anomalies NDVI/NDMI/SIF.

## Deux disques de maladie différents — pas "la même maladie"

Le Huanglongbing (HLB / citrus greening) est **endémique au Brésil**
(environ 44-47 % des arbres de la Cinturão Citrícola touchés en 2024-2025
selon [Fundecitrus](https://www.fundecitrus.com.br/pes/pesquisar/)) mais
**n'est pas confirmé en Espagne/UE** (voir la fiche
[EPPO Trioza erytreae](https://gd.eppo.int/taxon/TRIZER)). En Espagne, la
vraie problématique est :
- le **CTV** (Citrus Tristeza Virus), endémique depuis l'épidémie de 1957 ;
- la **biosécurité** face au vecteur *Trioza erytreae*, établi depuis 2014
  sur la côte atlantique (Galice, puis Asturies/Cantabrie/Pays basque) et
  qui se rapproche progressivement des zones de production (Valence,
  Murcie, Andalousie) ;
- le risque d'introduction du **Mal secco** (*Plenodomus tracheiphilus*),
  absent d'Espagne/Portugal/Maroc mais présent ailleurs en Méditerranée.

Le tableau de bord reflète cette différence : les zones espagnoles ne sont
pas notées sur un risque HLB qu'elles n'ont pas, mais sur des anomalies de
vigueur/stress hydrique (alerte précoce générique) et sur la distance au
front du vecteur.

## Architecture

```
lib/regions.js           définitions des 5 zones (bbox, contexte maladie)
lib/earthengine.js       auth + requêtes Earth Engine (Sentinel-2, indices)
lib/gbif.js              requête GBIF (occurrences Trioza erytreae)
lib/buildDashboard.js    assemble le JSON complet du tableau de bord
server.js                API Express protégée par mot de passe (seule source de données)
scripts/refresh-dashboard-data.js   snapshot JSON pour inspection en dev local uniquement
scripts/fetch-gbif-occurrences.js   rafraîchit data/trioza_occurrences.json
deploy/                  systemd + config Apache pour le déploiement Oracle Cloud
data/*.example.json, sif_demo.json   données de secours explicitement marquées "example"
```

### Page confidentielle, protégée par mot de passe

`docs/orange-disease.html` n'est plus liée depuis le menu du site et n'est
accessible qu'en connaissant son URL. Elle affiche un écran de
verrouillage (`docs/scripts/orange-disease-lock.js`) qui échange le mot de
passe contre un jeton de session auprès de `POST /api/login`, puis charge
les données via `GET /api/dashboard` (en-tête `Authorization: Bearer
<token>`). **Aucune donnée sensible n'est plus committée dans le dépôt** :
`server.js` est la seule source, et le mot de passe n'existe que côté
serveur (variable d'environnement `ORANGE_DASHBOARD_PASSWORD`, jamais dans
le code).

**Contrainte HTTPS.** `docs/` est servi en HTTPS par GitHub Pages ; un
navigateur interdit à une page HTTPS d'appeler un serveur en HTTP simple
(mixed content). `bear.servebeer.com` doit donc répondre en HTTPS sur le
port 443 pour que la page fonctionne. Le websocket d'échecs
(`server/chess-server/README.md`) contourne ce problème en restant en HTTP
pur ; ici on ne peut pas se permettre cette solution (le mot de passe et
les données circuleraient en clair), donc il faut le vrai certificat :

1. Le vhost Apache HTTPS + certificat Let's Encrypt sont provisionnés par
   `.github/workflows/chess-diagnose.yml` (`workflow_dispatch` avec
   `setup_tls: true`) — il inclut désormais aussi `orange-api.conf`.
2. **Action manuelle obligatoire, une fois** : ouvrir le port 443 en
   entrée dans la *Security List* OCI de la VM (console Oracle Cloud →
   Networking → Virtual Cloud Networks → votre VCN → Security Lists →
   règle d'ingress TCP 443 depuis 0.0.0.0/0). Sans ça, le port reste
   injoignable depuis Internet même si Apache l'écoute localement — c'est
   documenté comme le blocage actuel dans `server/chess-server/README.md`.
   Cette étape ne peut être faite que depuis le compte Oracle Cloud du
   propriétaire du site.

Tant que le port 443 n'est pas ouvert, la page affiche simplement une
erreur de chargement — rien de cassé, juste indisponible.

## Mettre en place l'accès Earth Engine (à faire une fois)

1. Créer un projet Google Cloud sur [console.cloud.google.com](https://console.cloud.google.com/).
2. Activer l'**Earth Engine API** (APIs & Services → Library).
3. Enregistrer ce projet auprès d'Earth Engine sur
   [code.earthengine.google.com/register](https://code.earthengine.google.com/register)
   (étape séparée de l'activation d'API, obligatoire).
4. Créer un compte de service (IAM & Admin → Service Accounts), générer une
   clé JSON (onglet Keys → Add Key → JSON). **Ne jamais commit ce fichier.**
   Tout compte de service du projet enregistré à l'étape 3 a
   automatiquement accès à Earth Engine.
5. Ajouter le contenu du JSON comme secret GitHub Actions
   `GEE_SERVICE_ACCOUNT_KEY` (Settings → Secrets and variables → Actions)
   du repo `zomboky/zomboky.github.io`. Utilisé par `deploy.yml`, qui
   écrit `/opt/orange-server/gee-key.json` sur la VM (permissions 600,
   propriétaire `oranged`).
6. Ajouter un second secret GitHub Actions `ORANGE_DASHBOARD_PASSWORD`
   avec le mot de passe de ton choix pour accéder au tableau de bord.
   `deploy.yml` l'écrit dans `/opt/orange-server/orange-dashboard-password.env`
   (permissions 600), lu par le service systemd au démarrage. Change ce
   secret à tout moment pour changer le mot de passe — il suffit de
   redéployer (push sur `master`) pour qu'il prenne effet.

Sans `GEE_SERVICE_ACCOUNT_KEY`, `/api/dashboard` et `/api/timeseries`
répondent 502. Sans `ORANGE_DASHBOARD_PASSWORD`, `/api/login` répond 503 :
personne ne peut se connecter, la page reste bloquée sur l'écran de
verrouillage.

## Fluorescence (SIF) — état actuel

Il n'existe **pas** de produit SIF temps réel dans le catalogue Earth
Engine standard (vérifié : seuls les gaz troposphériques classiques y sont
présents, `COPERNICUS/S5P/OFFL/L3_*`). Deux sources réelles identifiées :

- **TROPOSIF** (L2B, S5P/TROPOMI, projet ESA) : résolution ~3,5×5,5 km,
  mais disponible **seulement mai 2018 – mars 2021** (produit arrêté),
  téléchargeable hors GEE via le
  [S5P-PAL Data Portal](https://data-portal.s5p-pal.com/products/troposif.html).
- **GOSIF** (dérivé OCO-2 + MODIS EVI) : grille 0,05°, pas de temps 8
  jours, **continu jusqu'à aujourd'hui** — mieux adapté à un tableau de
  bord vivant, mais nécessite un pipeline de téléchargement/ingestion
  séparé (fichiers raster globaux, pas d'API REST simple identifiée pour
  l'instant).

**Aucune des deux n'a été branchée dans ce commit** : l'environnement de
développement n'avait pas accès réseau à ces hôtes pour valider le format
exact d'accès (politique d'egress du bac à sable). `data/sif_demo.json`
contient donc un **exemple synthétique clairement marqué `"example":
true`**, affiché avec un badge "DONNÉE D'EXEMPLE" dans l'UI tant qu'un
vrai fichier `data/sif_cache.json` (même structure, `example: false`)
n'a pas été déposé par un script d'ingestion à écrire (GOSIF recommandé
pour la continuité temporelle).

## Occurrences du vecteur (GBIF)

`lib/gbif.js` interroge l'API publique GBIF pour *Trioza erytreae*
(`taxonKey=5153544`, [fiche espèce](https://www.gbif.org/species/5153544),
licence CC BY-NC 4.0 — garder l'attribution visible). Utilisé par le
workflow planifié et par `scripts/fetch-gbif-occurrences.js` /
`deploy/orange-ingest.timer` (rafraîchissement hebdomadaire côté serveur,
chemin secondaire uniquement).

## Développement local

```
cd server/orange-server
npm install
GEE_KEY_PATH=/chemin/vers/votre/cle.json node server.js
```

Puis `curl http://127.0.0.1:8096/api/regions` (public) ou, pour les routes
protégées, récupère d'abord un jeton :

```
curl -X POST http://127.0.0.1:8096/api/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ton-mot-de-passe-local"}'
# -> {"token": "...", "expiresIn": 43200000}

curl http://127.0.0.1:8096/api/dashboard -H 'Authorization: Bearer <token>'
```

En local, définis `ORANGE_DASHBOARD_PASSWORD` avant de lancer le serveur :

```
ORANGE_DASHBOARD_PASSWORD=test GEE_KEY_PATH=/chemin/vers/votre/cle.json node server.js
```

Pour un instantané JSON sur disque à inspecter sans lancer le serveur
(fichier local uniquement, jamais commité) :

```
npm run refresh:dashboard
```

## Déploiement

`deploy.yml` (à la racine du repo) déploie `orange-server` sur la même VM
Oracle Cloud que `chess-server`, selon le même schéma : utilisateur
système dédié (`oranged`), service systemd écoutant en local
(`127.0.0.1:8096`), reverse-proxy Apache (`/orange-api/`). Le timer
`orange-ingest.timer` rafraîchit `data/trioza_occurrences.json`
hebdomadairement sur la VM.
