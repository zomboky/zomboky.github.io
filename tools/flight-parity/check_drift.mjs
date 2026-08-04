// Garde-fou anti-dérive de la transcription du modèle de vol.
//
//   node tools/flight-parity/check_drift.mjs          # vérifie
//   node tools/flight-parity/check_drift.mjs --update # ré-enregistre l'empreinte
//
// Voir tools/lib/js_source.mjs pour le pourquoi.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkOrUpdate } from '../lib/js_source.mjs';

const here = dirname(fileURLToPath(import.meta.url));

checkOrUpdate({
  gamePath: resolve(here, '../../docs/hibou-3d.html'),
  stampPath: resolve(here, 'source_fingerprint.json'),
  markers: ['function updateFlight(dt) {'],
  what: 'le modèle de vol (updateFlight)',
  transcript: 'tools/flight-parity/flight_reference.mjs',
  argv: process.argv,
});
