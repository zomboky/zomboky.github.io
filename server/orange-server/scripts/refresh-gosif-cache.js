'use strict';

// Rafraîchit data/sif_cache.json depuis GOSIF (voir lib/gosif.js). Lourd
// (téléchargement + extraction GDAL par période de 8 jours) : à lancer en
// tâche planifiée (deploy/orange-gosif.timer), pas à chaque requête HTTP.
// buildDashboard.js lit ce fichier avec repli sur data/sif_demo.json tant
// qu'il n'existe pas.

const fs = require('fs');
const path = require('path');
const { REGIONS } = require('../lib/regions');
const { getSifDashboardData } = require('../lib/gosif');

const OUT_PATH = path.join(__dirname, '..', 'data', 'sif_cache.json');
const PRODUCING_REGIONS = Object.values(REGIONS).filter((r) => r.kind !== 'vector_front');

async function main() {
  const data = await getSifDashboardData(PRODUCING_REGIONS, 36);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const tmpPath = OUT_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, OUT_PATH);
  console.log(`Écrit ${OUT_PATH} (dernière période GOSIF : ${data.latestAvailableDate})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
