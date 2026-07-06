'use strict';

// Utilitaire de dev local : régénère un instantané JSON du tableau de bord
// sur disque, pour inspection manuelle sans lancer le serveur. Ce fichier
// n'est plus committé dans docs/ (voir server/orange-server/README.md) :
// la seule source servie publiquement est désormais l'API authentifiée
// (server.js, route GET /api/dashboard).

const fs = require('fs');
const path = require('path');
const { initEarthEngine } = require('../lib/earthengine');
const { buildDashboard } = require('../lib/buildDashboard');

const OUT_PATH = path.join(__dirname, '..', 'data', 'dashboard.local.json');

async function main() {
  await initEarthEngine();
  const dashboard = await buildDashboard();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(dashboard, null, 2));
  console.log(`Écrit ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
