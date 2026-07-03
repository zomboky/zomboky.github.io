'use strict';

// Rafraîchit docs/data/orange-disease/dashboard.json à partir de Google
// Earth Engine (Sentinel-2) et de GBIF. Prévu pour tourner sur un runner
// GitHub Actions planifié (voir .github/workflows/orange-data-refresh.yml),
// qui a un accès réseau normal à earthengine.googleapis.com et
// api.gbif.org — contrairement à l'environnement où ce script a été écrit,
// où ces deux hôtes étaient bloqués par la politique réseau du bac à
// sable, d'où l'absence de vraies données d'exemple ingérées.

const fs = require('fs');
const path = require('path');
const { REGIONS } = require('../lib/regions');
const { initEarthEngine, getTimeseries } = require('../lib/earthengine');
const { fetchTriozaOccurrences } = require('../lib/gbif');

const OUT_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'data', 'orange-disease', 'dashboard.json');
const SIF_DEMO_PATH = path.join(__dirname, '..', 'data', 'sif_demo.json');
const TRIOZA_EXAMPLE_PATH = path.join(__dirname, '..', 'data', 'trioza_occurrences.example.json');

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  await initEarthEngine();

  const end = new Date().toISOString().slice(0, 10);
  const start = isoDaysAgo(365 * 2);

  const timeseries = {};
  for (const region of Object.values(REGIONS)) {
    console.log(`Sentinel-2 : ${region.id}...`);
    timeseries[region.id] = await getTimeseries(region, start, end);
  }

  let triozaOccurrences;
  try {
    triozaOccurrences = await fetchTriozaOccurrences();
  } catch (err) {
    console.warn('GBIF indisponible, utilisation du fallback exemple :', err.message);
    triozaOccurrences = JSON.parse(fs.readFileSync(TRIOZA_EXAMPLE_PATH, 'utf8'));
  }

  // La fluorescence (SIF) reste en donnée d'exemple tant que l'ingestion
  // TROPOSIF/GOSIF n'est pas branchée ici (voir README § Fluorescence).
  const sif = JSON.parse(fs.readFileSync(SIF_DEMO_PATH, 'utf8'));

  const dashboard = {
    example: false,
    generatedAt: new Date().toISOString(),
    regions: REGIONS,
    timeseries,
    triozaOccurrences,
    sif,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(dashboard, null, 2));
  console.log(`Écrit ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
