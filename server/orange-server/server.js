'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { REGIONS } = require('./lib/regions');
const { initEarthEngine, getTimeseries } = require('./lib/earthengine');

const PORT = process.env.ORANGE_SERVER_PORT || 8096;
const HOST = process.env.ORANGE_SERVER_HOST || '127.0.0.1';
const DATA_DIR = path.join(__dirname, 'data');

const app = express();

// Ce service n'est pas la source principale du tableau de bord (voir
// README : mixed-content HTTPS -> HTTP interdit par les navigateurs
// lorsque la page est servie par GitHub Pages, comme documenté pour le
// chess-server WebSocket). Il reste utile pour des requêtes ponctuelles en
// accès direct http://bear.servebeer.com/orange-api/... — CORS ouvert pour
// ce cas d'usage.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

const TIMESERIES_TTL_MS = 6 * 60 * 60 * 1000; // 6h : la donnée satellite ne change pas dans la journée
const cache = new Map();

async function cachedTimeseries(regionId, start, end) {
  const region = REGIONS[regionId];
  if (!region) throw Object.assign(new Error('region inconnue'), { status: 404 });
  const key = `${regionId}|${start}|${end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TIMESERIES_TTL_MS) return hit.data;
  await initEarthEngine();
  const data = await getTimeseries(region, start, end);
  cache.set(key, { ts: Date.now(), data });
  return data;
}

function defaultStart(endIso, months) {
  const d = new Date(`${endIso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function readJsonWithFallback(primaryPath, fallbackPath) {
  const p = fs.existsSync(primaryPath) ? primaryPath : fallbackPath;
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

app.get('/health', (req, res) => res.type('text').send('orange-server ok'));

app.get('/api/regions', (req, res) => res.json(Object.values(REGIONS)));

app.get('/api/timeseries', async (req, res) => {
  const { region } = req.query;
  if (!region || !REGIONS[region]) {
    return res.status(400).json({ error: 'paramètre region invalide', regions: Object.keys(REGIONS) });
  }
  const end = req.query.end || new Date().toISOString().slice(0, 10);
  const start = req.query.start || defaultStart(end, 24);
  try {
    const points = await cachedTimeseries(region, start, end);
    res.json({ region, start, end, points });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

app.get('/api/vector-occurrences', (req, res) => {
  const data = readJsonWithFallback(
    path.join(DATA_DIR, 'trioza_occurrences.json'),
    path.join(DATA_DIR, 'trioza_occurrences.example.json')
  );
  if (!data) return res.status(404).json({ error: 'aucune donnée disponible' });
  res.json(data);
});

app.get('/api/sif', (req, res) => {
  const data = readJsonWithFallback(
    path.join(DATA_DIR, 'sif_cache.json'),
    path.join(DATA_DIR, 'sif_demo.json')
  );
  if (!data) return res.status(404).json({ error: 'aucune donnée disponible' });
  res.json(data);
});

app.listen(PORT, HOST, () => {
  console.log(`orange-server à l'écoute sur ${HOST}:${PORT}`);
});
