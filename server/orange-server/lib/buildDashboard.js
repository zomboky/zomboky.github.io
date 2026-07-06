'use strict';

const fs = require('fs');
const path = require('path');
const { REGIONS } = require('./regions');
const { getTimeseries } = require('./earthengine');
const { fetchTriozaOccurrences } = require('./gbif');

const SIF_DEMO_PATH = path.join(__dirname, '..', 'data', 'sif_demo.json');
const TRIOZA_EXAMPLE_PATH = path.join(__dirname, '..', 'data', 'trioza_occurrences.example.json');

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function buildDashboard({ start, end } = {}) {
  const rangeEnd = end || new Date().toISOString().slice(0, 10);
  const rangeStart = start || isoDaysAgo(365 * 2);

  const timeseries = {};
  for (const region of Object.values(REGIONS)) {
    timeseries[region.id] = await getTimeseries(region, rangeStart, rangeEnd);
  }

  let triozaOccurrences;
  try {
    triozaOccurrences = await fetchTriozaOccurrences();
  } catch (err) {
    triozaOccurrences = JSON.parse(fs.readFileSync(TRIOZA_EXAMPLE_PATH, 'utf8'));
  }

  // La fluorescence (SIF) reste en donnée d'exemple tant que l'ingestion
  // TROPOSIF/GOSIF n'est pas branchée (voir README § Fluorescence).
  const sif = JSON.parse(fs.readFileSync(SIF_DEMO_PATH, 'utf8'));

  return {
    example: false,
    generatedAt: new Date().toISOString(),
    regions: REGIONS,
    timeseries,
    triozaOccurrences,
    sif,
  };
}

module.exports = { buildDashboard };
