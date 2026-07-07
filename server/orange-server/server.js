'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { REGIONS } = require('./lib/regions');
const { initEarthEngine, getTimeseries } = require('./lib/earthengine');
const { buildDashboard } = require('./lib/buildDashboard');

const PORT = process.env.ORANGE_SERVER_PORT || 8096;
const HOST = process.env.ORANGE_SERVER_HOST || '127.0.0.1';
const DATA_DIR = path.join(__dirname, 'data');
const DASHBOARD_PASSWORD = process.env.ORANGE_DASHBOARD_PASSWORD || '';
const HIBOU3D_PASSWORD = process.env.HIBOU3D_V6_PASSWORD || '';

const app = express();
// Le serveur est placé derrière un reverse proxy Apache (voir
// deploy/orange-api.conf) qui tourne en local sur la même machine :
// sans ça, req.ip vaudrait toujours 127.0.0.1 pour tout le monde et le
// rate-limit du compteur de visites bloquerait tous les visiteurs
// derrière la même IP (le compteur restait bloqué à 1).
app.set('trust proxy', 'loopback');
app.use(express.json());

// CORS ouvert : la page HTTPS zomboky.github.io/orange-disease.html doit
// pouvoir appeler cette API cross-origin. Ce n'est pas ce qui protège les
// données (voir authentification par mot de passe ci-dessous) — juste ce
// qui autorise le navigateur à faire la requête.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------------------------------------------------------------------
// Authentification par mot de passe (tableau de bord confidentiel)
// ---------------------------------------------------------------------
// Le mot de passe n'est jamais committé dans le repo : il est fourni au
// service via la variable d'environnement ORANGE_DASHBOARD_PASSWORD (voir
// deploy/orange-server.service, alimentée par le secret GitHub Actions
// ORANGE_DASHBOARD_PASSWORD au déploiement).

const sessions = new Map(); // token -> expiresAt (ms)
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

const hibouSessions = new Map(); // token -> expiresAt (ms)
const HIBOU_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

const loginAttempts = new Map(); // ip -> { count, windowStart }
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

const hibouLoginAttempts = new Map();

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function passwordMatches(candidate) {
  if (!DASHBOARD_PASSWORD) return false;
  const a = sha256(candidate);
  const b = sha256(DASHBOARD_PASSWORD);
  return crypto.timingSafeEqual(a, b);
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

function hibouPasswordMatches(candidate) {
  if (!HIBOU3D_PASSWORD) return false;
  const a = sha256(candidate);
  const b = sha256(HIBOU3D_PASSWORD);
  return crypto.timingSafeEqual(a, b);
}

function hibouRateLimited(ip) {
  const now = Date.now();
  const entry = hibouLoginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    hibouLoginAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

function requireHibouAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const expiresAt = token && hibouSessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) hibouSessions.delete(token);
    return res.status(401).json({ error: 'authentification requise' });
  }
  next();
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const expiresAt = token && sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'authentification requise' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({ error: "mot de passe non configuré côté serveur" });
  }
  const ip = req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'trop de tentatives, réessayez plus tard' });
  }
  const password = (req.body && req.body.password) || '';
  if (!passwordMatches(password)) {
    return res.status(401).json({ error: 'mot de passe incorrect' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.json({ token, expiresIn: SESSION_TTL_MS });
});

// ---------------------------------------------------------------------
// Authentification Hibou 3D (verrou jeu)
// ---------------------------------------------------------------------
app.post('/api/hibou3d/login', (req, res) => {
  if (!HIBOU3D_PASSWORD) {
    return res.status(503).json({ error: 'mot de passe non configuré côté serveur' });
  }
  if (hibouRateLimited(req.ip)) {
    return res.status(429).json({ error: 'trop de tentatives, réessayez plus tard' });
  }
  const password = (req.body && req.body.password) || '';
  if (!hibouPasswordMatches(password)) {
    return res.status(401).json({ error: 'mot de passe incorrect' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  hibouSessions.set(token, Date.now() + HIBOU_SESSION_TTL_MS);
  res.json({ token, expiresIn: HIBOU_SESSION_TTL_MS });
});

app.get('/api/hibou3d/verify', requireHibouAuth, (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Données (protégées)
// ---------------------------------------------------------------------

const TIMESERIES_TTL_MS = 6 * 60 * 60 * 1000; // 6h : la donnée satellite ne change pas dans la journée
const cache = new Map();
let dashboardCache = null; // { ts, data }

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

async function cachedDashboard() {
  if (dashboardCache && Date.now() - dashboardCache.ts < TIMESERIES_TTL_MS) {
    return dashboardCache.data;
  }
  await initEarthEngine();
  const data = await buildDashboard();
  dashboardCache = { ts: Date.now(), data };
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

// ---------------------------------------------------------------------
// Compteur de visiteurs (public, rate-limit par IP : 1 incrément / heure)
// ---------------------------------------------------------------------
const VISITOR_COUNT_FILE = process.env.VISITOR_COUNT_FILE || path.join(DATA_DIR, 'visitor-count.json');
const visitorRateLimit = new Map(); // ip -> lastIncrementTime (ms)
const VISITOR_RL_WINDOW_MS = 60 * 60 * 1000; // 1h

function readVisitorCount() {
  try {
    return JSON.parse(fs.readFileSync(VISITOR_COUNT_FILE, 'utf8')).count || 0;
  } catch (_) {
    return 0;
  }
}

function writeVisitorCount(count) {
  const tmp = VISITOR_COUNT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ count }), 'utf8');
  fs.renameSync(tmp, VISITOR_COUNT_FILE);
}

app.get('/api/visitor-count', (req, res) => {
  res.json({ count: readVisitorCount() });
});

app.post('/api/visitor-count', (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  const last = visitorRateLimit.get(ip) || 0;
  const count = readVisitorCount();
  if (now - last >= VISITOR_RL_WINDOW_MS) {
    visitorRateLimit.set(ip, now);
    const newCount = count + 1;
    writeVisitorCount(newCount);
    return res.json({ count: newCount, incremented: true });
  }
  res.json({ count, incremented: false });
});

app.get('/api/regions', (req, res) => res.json(Object.values(REGIONS)));

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    res.json(await cachedDashboard());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/timeseries', requireAuth, async (req, res) => {
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

app.get('/api/vector-occurrences', requireAuth, (req, res) => {
  const data = readJsonWithFallback(
    path.join(DATA_DIR, 'trioza_occurrences.json'),
    path.join(DATA_DIR, 'trioza_occurrences.example.json')
  );
  if (!data) return res.status(404).json({ error: 'aucune donnée disponible' });
  res.json(data);
});

app.get('/api/sif', requireAuth, (req, res) => {
  const data = readJsonWithFallback(
    path.join(DATA_DIR, 'sif_cache.json'),
    path.join(DATA_DIR, 'sif_demo.json')
  );
  if (!data) return res.status(404).json({ error: 'aucune donnée disponible' });
  res.json(data);
});

app.listen(PORT, HOST, () => {
  console.log(`orange-server à l'écoute sur ${HOST}:${PORT}`);
  if (!DASHBOARD_PASSWORD) {
    console.warn('ORANGE_DASHBOARD_PASSWORD absent : /api/login refusera toute connexion.');
  }
});
