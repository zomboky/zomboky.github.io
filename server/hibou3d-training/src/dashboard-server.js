'use strict';
// Serveur HTTP natif (module `http`, zéro dépendance) qui sert le dashboard
// de suivi d'entraînement en direct — voir Phase 7 du plan. `getState()` est
// appelé à chaque requête `/api/status`, donc la page reflète toujours l'état
// mémoire le plus récent sans mécanisme de push (simple polling côté client).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_HTML = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');

export function startDashboard(port, getState) {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(DASHBOARD_HTML);
      return;
    }
    if (req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(getState()));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  server.listen(port, () => {
    console.log(`[dashboard] http://localhost:${port} (ou l'IP publique du serveur, port ${port})`);
  });
  return server;
}
