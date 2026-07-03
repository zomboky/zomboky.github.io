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
lib/regions.js          définitions des 5 zones (bbox, contexte maladie)
lib/earthengine.js       auth + requêtes Earth Engine (Sentinel-2, indices)
lib/gbif.js               requête GBIF (occurrences Trioza erytreae)
server.js                 API Express optionnelle (voir "Deux chemins de données")
scripts/refresh-dashboard-data.js   génère docs/data/orange-disease/dashboard.json
scripts/fetch-gbif-occurrences.js   rafraîchit data/trioza_occurrences.json
deploy/                   systemd + config Apache pour le déploiement Oracle Cloud
data/*.example.json, sif_demo.json   données de secours explicitement marquées "example"
```

### Deux chemins de données (et pourquoi)

1. **Chemin principal — fichier statique.** Un workflow GitHub Actions
   planifié (`.github/workflows/orange-data-refresh.yml`) tourne sur un
   runner `ubuntu-latest` (accès réseau normal à Earth Engine et GBIF),
   régénère `docs/data/orange-disease/dashboard.json` et le commit
   directement dans le repo. `docs/orange-disease.html` charge ce fichier
   en `fetch()` same-origin — rapide, mobile-friendly, aucun souci CORS.

   **Pourquoi pas un appel direct au serveur Node depuis la page ?**
   `docs/` est servi en HTTPS par GitHub Pages, alors que `orange-server`
   tourne en HTTP simple sur `bear.servebeer.com` (port 443 bloqué côté
   Oracle Cloud Security List — exactement la même contrainte déjà
   documentée dans `server/chess-server/README.md` pour le WebSocket
   d'échecs). Un navigateur interdit à une page HTTPS d'appeler du
   contenu HTTP actif (mixed content) : un `fetch()` cross-origin vers
   `http://bear.servebeer.com/...` échouerait silencieusement depuis
   `https://zomboky.github.io/...`.

2. **Chemin secondaire — API live.** `server.js` reste déployé sur
   `bear.servebeer.com` (`/orange-api/...`) pour des requêtes ponctuelles
   en accès direct (`http://bear.servebeer.com/orange-api/timeseries?...`),
   utile pour explorer des plages de dates personnalisées hors du tableau
   de bord par défaut. Il n'est **pas** utilisé par la page HTTPS pour la
   même raison de mixed content.

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
   du repo `zomboky/zomboky.github.io`. Utilisé par :
   - `orange-data-refresh.yml` (chemin principal, écrit dans un fichier
     temporaire sur le runner, jamais persisté) ;
   - `deploy.yml` (écrit `/opt/orange-server/gee-key.json` sur la VM,
     permissions 600, propriétaire `oranged`).

Sans ce secret, `orange-data-refresh.yml` échoue explicitement (message
clair dans les logs Actions) et `docs/orange-disease.html` continue
d'afficher son état "en attente du premier rafraîchissement".

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

Puis `curl http://127.0.0.1:8096/api/regions` ou
`.../api/timeseries?region=brazil_cinturao`.

Pour régénérer le fichier statique localement (nécessite aussi
`GEE_KEY_PATH`) :

```
npm run refresh:dashboard
```

## Déploiement

`deploy.yml` (à la racine du repo) déploie `orange-server` sur la même VM
Oracle Cloud que `chess-server`, selon le même schéma : utilisateur
système dédié (`oranged`), service systemd écoutant en local
(`127.0.0.1:8096`), reverse-proxy Apache (`/orange-api/`). Le timer
`orange-ingest.timer` rafraîchit `data/trioza_occurrences.json`
hebdomadairement sur la VM (chemin secondaire uniquement — le chemin
principal est le workflow planifié, indépendant de la VM).
