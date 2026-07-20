'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const PORT = process.env.FLIGHT_SERVER_PORT || 8097;
const HOST = process.env.FLIGHT_SERVER_HOST || '127.0.0.1';
const DESIGNS_DIR = process.env.FLIGHT_DESIGNS_DIR || path.join(__dirname, 'data', 'designs');

// Codes plus longs que ceux de chess-server (4 chars) car ils doivent rester
// valables indéfiniment (pastebin), pas juste le temps d'une partie de 30min :
// plus d'entropie = moins de collisions à mesure que la collection grandit.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O, 1/I
const CODE_LENGTH = 6;
const MAX_DESIGN_NAME_LEN = 40;

fs.mkdirSync(DESIGNS_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '128kb' }));

// CORS ouvert : la page HTTPS zomboky.github.io/flight-sim.html doit pouvoir
// appeler cette API cross-origin. Pas de donnée sensible stockée ici (juste
// des arbres de pièces d'avion), donc pas d'authentification nécessaire —
// seule une limite de débit protège contre l'abus en écriture (voir plus bas).
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function codePath(code) {
  return path.join(DESIGNS_DIR, `${code}.json`);
}

function generateCode() {
  let code;
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (fs.existsSync(codePath(code)));
  return code;
}

function normalizeCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : null;
}

// Écriture atomique (fichier .tmp puis renommage) pour éviter qu'une lecture
// concurrente ne tombe sur un fichier à moitié écrit — même pattern que
// writeVisitorCount() dans zomboky-server/server.js.
function writeDesignFile(code, payload) {
  const target = codePath(code);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  fs.renameSync(tmp, target);
}

// Limite de débit en écriture très simple (fenêtre glissante en mémoire) :
// dissuade l'abus sans nécessiter d'authentification pour un pastebin public.
const writeAttempts = new Map(); // ip -> { count, windowStart }
const WRITE_WINDOW_MS = 10 * 60 * 1000;
const WRITE_MAX_PER_WINDOW = 30;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = writeAttempts.get(ip);
  if (!entry || now - entry.windowStart > WRITE_WINDOW_MS) {
    writeAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > WRITE_MAX_PER_WINDOW;
}

app.get('/health', (req, res) => res.type('text').send('ok'));

app.post('/api/designs', (req, res) => {
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Trop de sauvegardes récentes, réessaie plus tard.' });
  }
  const parts = req.body && req.body.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'Avion invalide (aucune pièce).' });
  }
  const name = String((req.body && req.body.name) || '').trim().slice(0, MAX_DESIGN_NAME_LEN);
  const code = generateCode();
  writeDesignFile(code, { name, parts, createdAt: new Date().toISOString() });
  res.json({ code });
});

app.get('/api/designs/:code', (req, res) => {
  const code = normalizeCode(req.params.code);
  if (!code) return res.status(400).json({ error: 'Code invalide.' });
  const file = codePath(code);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Avion introuvable pour ce code.' });
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Fichier corrompu.' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`flight-server à l'écoute sur ${HOST}:${PORT} (designs: ${DESIGNS_DIR})`);
});
