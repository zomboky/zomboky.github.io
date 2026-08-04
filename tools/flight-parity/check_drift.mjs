// Garde-fou anti-dérive de la transcription.
//
//   node tools/flight-parity/check_drift.mjs          # vérifie
//   node tools/flight-parity/check_drift.mjs --update # ré-enregistre l'empreinte
//
// `flight_reference.mjs` est une copie manuelle de `updateFlight()`. Une copie
// manuelle pourrit dès que l'original bouge, et une référence pourrie transforme
// la recette de parité en tampon de complaisance : elle continuerait de passer
// pendant que le portage aurait cessé d'être fidèle.
//
// On enregistre donc l'empreinte du corps de `updateFlight()` tel qu'il était au
// moment de la transcription. Si le jeu Three.js change, ce script échoue et
// demande de reprendre la transcription — puis de rejouer la parité.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(here, '../../docs/hibou-3d.html');
const STAMP = resolve(here, 'source_fingerprint.json');
const MARKER = 'function updateFlight(dt) {';

/** Corps de la fonction, délimité par appariement d'accolades. */
function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`"${marker}" introuvable dans ${GAME}`);
  let depth = 0;
  for (let i = start + marker.length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Accolade fermante introuvable pour "${marker}"`);
}

const source = readFileSync(GAME, 'utf8');
const body = extractFunction(source, MARKER);
const digest = createHash('sha256').update(body).digest('hex');
const lines = body.split('\n').length;

if (process.argv.includes('--update')) {
  writeFileSync(STAMP, JSON.stringify({
    note: "Empreinte du corps de updateFlight() dans docs/hibou-3d.html au moment de la transcription vers tools/flight-parity/flight_reference.mjs. Régénérer avec --update APRÈS avoir repris la transcription, jamais pour faire taire l'alerte.",
    marker: MARKER,
    lines,
    sha256: digest,
  }, null, 2) + '\n');
  console.log(`Empreinte enregistrée : ${digest} (${lines} lignes)`);
  process.exit(0);
}

const stamp = JSON.parse(readFileSync(STAMP, 'utf8'));
if (stamp.sha256 === digest) {
  console.log(`Référence de vol à jour (updateFlight, ${lines} lignes, ${digest.slice(0, 12)}…).`);
  process.exit(0);
}

console.error('');
console.error('updateFlight() a changé dans docs/hibou-3d.html depuis la transcription.');
console.error(`  empreinte enregistrée : ${stamp.sha256}`);
console.error(`  empreinte actuelle    : ${digest}`);
console.error('');
console.error('Reprendre tools/flight-parity/flight_reference.mjs pour refléter le changement,');
console.error('rejouer la parité, puis relancer ce script avec --update.');
process.exit(1);
