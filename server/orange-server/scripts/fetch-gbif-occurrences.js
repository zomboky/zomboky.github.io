'use strict';

// Rafraîchit data/trioza_occurrences.json depuis GBIF, pour usage local ou
// par le service systemd orange-ingest.timer sur le serveur déployé (voir
// deploy/orange-ingest.service). Logique partagée avec le workflow
// GitHub Actions dans lib/gbif.js.

const fs = require('fs');
const path = require('path');
const { fetchTriozaOccurrences } = require('../lib/gbif');

const OUT_PATH = path.join(__dirname, '..', 'data', 'trioza_occurrences.json');

fetchTriozaOccurrences()
  .then((payload) => {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
    console.log(`Écrit ${payload.count} occurrences dans ${OUT_PATH}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
