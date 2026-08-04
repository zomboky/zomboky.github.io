// Garde-fou anti-dérive de la transcription du terrain.
//
//   node tools/terrain-parity/check_drift.mjs          # vérifie
//   node tools/terrain-parity/check_drift.mjs --update # ré-enregistre l'empreinte
//
// Voir tools/lib/js_source.mjs pour le pourquoi.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkOrUpdate } from '../lib/js_source.mjs';

const here = dirname(fileURLToPath(import.meta.url));

checkOrUpdate({
  gamePath: resolve(here, '../../docs/hibou-3d.html'),
  stampPath: resolve(here, 'source_fingerprint.json'),
  markers: [
    'function hashNoise(ix, iz) {',
    'function valueNoise(x, z) {',
    'function fbm(x, z, octaves = 5) {',
    'function ridged(x, z, octaves = 3) {',
    'function fillMountainPeaks() {',
    'function fillRiverPaths() {',
    'function riverCarve(x, z) {',
    'function terrainHeight(x, z) {',
    'function effectiveGroundY(x, z) {',
    'function forestDensity(x, z) {',
  ],
  what: 'le terrain procédural',
  transcript: 'tools/terrain-parity/terrain_reference.mjs',
  argv: process.argv,
});
