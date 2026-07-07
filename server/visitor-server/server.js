'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const PORT = process.env.VISITOR_SERVER_PORT || 8097;
const HOST = process.env.VISITOR_SERVER_HOST || '127.0.0.1';
const DATA_DIR = process.env.VISITOR_SERVER_DATA_DIR || path.join(__dirname, 'data');
const VISITOR_COUNT_FILE = process.env.VISITOR_COUNT_FILE || path.join(DATA_DIR, 'visitor-count.json');

const app = express();

// Le serveur est placé derrière un reverse proxy Apache (voir
// deploy/visitor-api.conf) qui tourne en local sur la même machine :
// sans ça, req.ip vaudrait toujours 127.0.0.1 pour tout le monde et le
// rate-limit du compteur de visites bloquerait tous les visiteurs
// derrière la même IP (le compteur resterait bloqué à 1).
app.set('trust proxy', 'loopback');
app.use(express.json());

// CORS ouvert : les pages HTTPS zomboky.github.io/index.html et
// chess.html doivent pouvoir appeler cette API cross-origin.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => res.type('text').send('visitor-server ok'));

// ---------------------------------------------------------------------
// Compteur de visiteurs (public, rate-limit par IP : 1 incrément / heure)
// ---------------------------------------------------------------------
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
  fs.mkdirSync(path.dirname(VISITOR_COUNT_FILE), { recursive: true });
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
  console.log(`visitor-server à l'écoute sur ${HOST}:${PORT}`);
});
