// Appels vers flight-server : sauvegarde d'un avion (reçoit un code) et
// chargement par code. Même pattern que docs/scripts/orange-disease-lock.js
// (fetch + .then, base URL en dur, détection localhost pour le dev local).

var API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:8097'
  : 'https://bear.servebeer.com/flight-api';

function parseError(res) {
  return res.json().catch(() => ({})).then((body) => {
    throw new Error(body.error || `Erreur HTTP ${res.status}`);
  });
}

export function saveDesign(design, name) {
  return fetch(`${API_BASE}/api/designs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || '', parts: design.parts }),
  }).then((res) => (res.ok ? res.json() : parseError(res)));
}

export function loadDesign(code) {
  return fetch(`${API_BASE}/api/designs/${encodeURIComponent(code.trim().toUpperCase())}`)
    .then((res) => (res.ok ? res.json() : parseError(res)));
}
