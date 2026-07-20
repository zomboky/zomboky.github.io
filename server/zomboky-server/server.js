'use strict';

// zomboky-server — API générale du site (ex-orange-server, recentrée) :
//   - compteur de visiteurs global (public, rate-limité)
//   - verrou par mot de passe de la page Hibou 3D (login + verify)
//   - login admin (réservé aux futurs tableaux de bord, ex. progression
//     de la campagne Hibou 3D — voir plans/hibou3d-campagne.md)

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const express = require('express');

const PORT = process.env.ZOMBOKY_SERVER_PORT || 8096;
const HOST = process.env.ZOMBOKY_SERVER_HOST || '127.0.0.1';
const DATA_DIR = path.join(__dirname, 'data');
const DASHBOARD_PASSWORD = process.env.ZOMBOKY_DASHBOARD_PASSWORD || '';
const HIBOU3D_PASSWORD = process.env.HIBOU3D_V6_PASSWORD || '';
const CAMPAIGN_SOLO_PASSWORD = process.env.CAMPAGNE_SOLO_PWD || '';

const app = express();
app.use(express.json());

// CORS ouvert : les pages HTTPS zomboky.github.io doivent pouvoir appeler
// cette API cross-origin. Ce n'est pas ce qui protège les données (voir
// authentification par mot de passe ci-dessous) — juste ce qui autorise le
// navigateur à faire la requête.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------------------------------------------------------------------
// Authentification par mot de passe (tableau de bord admin)
// ---------------------------------------------------------------------
// Le mot de passe n'est jamais committé dans le repo : il est fourni au
// service via la variable d'environnement ZOMBOKY_DASHBOARD_PASSWORD (voir
// deploy/zomboky-server.service, alimentée par le secret GitHub Actions
// ORANGE_DASHBOARD_PASSWORD — nom historique conservé — au déploiement).

const sessions = new Map(); // token -> expiresAt (ms)
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

const hibouSessions = new Map(); // token -> expiresAt (ms)
const HIBOU_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

const loginAttempts = new Map(); // ip -> { count, windowStart }
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

const hibouLoginAttempts = new Map();

const campaignSessions = new Map(); // token -> expiresAt (ms)
const CAMPAIGN_SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const campaignLoginAttempts = new Map();

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

function campaignPasswordMatches(candidate) {
  if (!CAMPAIGN_SOLO_PASSWORD) return false;
  const a = sha256(candidate);
  const b = sha256(CAMPAIGN_SOLO_PASSWORD);
  return crypto.timingSafeEqual(a, b);
}

function campaignRateLimited(ip) {
  const now = Date.now();
  const entry = campaignLoginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    campaignLoginAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

function requireCampaignAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const expiresAt = token && campaignSessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) campaignSessions.delete(token);
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

// Vérification d'un token admin (les futurs endpoints du dashboard de
// campagne Hibou 3D s'appuieront sur le même requireAuth).
app.get('/api/verify', requireAuth, (req, res) => {
  res.json({ ok: true });
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
// Authentification mode Campagne (en développement — accès solo réservé,
// voir plans/hibou3d-campagne.md et docs/hibou-3d.html #campaign-lock)
// ---------------------------------------------------------------------
app.post('/api/hibou3d/campaign-login', (req, res) => {
  if (!CAMPAIGN_SOLO_PASSWORD) {
    return res.status(503).json({ error: 'mot de passe non configuré côté serveur' });
  }
  if (campaignRateLimited(req.ip)) {
    return res.status(429).json({ error: 'trop de tentatives, réessayez plus tard' });
  }
  const password = (req.body && req.body.password) || '';
  if (!campaignPasswordMatches(password)) {
    return res.status(401).json({ error: 'mot de passe incorrect' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  campaignSessions.set(token, Date.now() + CAMPAIGN_SESSION_TTL_MS);
  res.json({ token, expiresIn: CAMPAIGN_SESSION_TTL_MS });
});

app.get('/api/hibou3d/campaign-verify', requireCampaignAuth, (req, res) => {
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.type('text').send('zomboky-server ok'));

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

app.listen(PORT, HOST, () => {
  console.log(`zomboky-server à l'écoute sur ${HOST}:${PORT}`);
  if (!DASHBOARD_PASSWORD) {
    console.warn('ZOMBOKY_DASHBOARD_PASSWORD absent : /api/login refusera toute connexion.');
  }
  if (!CAMPAIGN_SOLO_PASSWORD) {
    console.warn('CAMPAGNE_SOLO_PWD absent : /api/hibou3d/campaign-login refusera toute connexion.');
  }
});
