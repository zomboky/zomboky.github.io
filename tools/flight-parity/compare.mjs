// Compare les deux traces et applique les critères de recette du lot 2 (§9.2).
//
//   node tools/flight-parity/compare.mjs [trace_js.json] [trace_godot.json]
//
// Sort en code 1 si un critère n'est pas tenu — c'est un verrou : le plan interdit
// de passer au lot 3 avec un modèle de vol « presque » porté, parce que l'IA du
// bot (lot 10b) et le multijoueur (lot 11) en dépendent tous les deux directement.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const a = JSON.parse(readFileSync(process.argv[2] || resolve(here, 'out/trace_js.json'), 'utf8'));
const b = JSON.parse(readFileSync(process.argv[3] || resolve(here, 'out/trace_godot.json'), 'utf8'));

/** Écart de position toléré : 1 % de la distance réellement parcourue. */
const POSITION_TOLERANCE_RATIO = 0.01;
/** Écart toléré sur l'instant du décrochage, en secondes. */
const STALL_TOLERANCE = 0.2;

if (a.steps !== b.steps) {
  console.error(`Traces incomparables : ${a.steps} pas contre ${b.steps}.`);
  process.exit(1);
}

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

let maxDrift = 0, maxDriftT = 0;
let maxSpeedDelta = 0, maxAoaDelta = 0;
let stallDisagreements = 0;

for (let i = 0; i < a.samples.length; i++) {
  const sa = a.samples[i], sb = b.samples[i];
  const d = dist(sa.pos, sb.pos);
  if (d > maxDrift) { maxDrift = d; maxDriftT = sa.t; }
  maxSpeedDelta = Math.max(maxSpeedDelta, Math.abs(sa.speed - sb.speed));
  maxAoaDelta = Math.max(maxAoaDelta, Math.abs(sa.aoa - sb.aoa));
  if (sa.stall !== sb.stall) stallDisagreements++;
}

const finalDrift = dist(a.final_position, b.final_position);
const reference = Math.max(a.distance, 1e-9);
const finalRatio = finalDrift / reference;
const maxRatio = maxDrift / reference;
const stallDelta = (a.first_stall_time === null || b.first_stall_time === null)
  ? null : Math.abs(a.first_stall_time - b.first_stall_time);

const fmt = (n, d = 4) => n.toFixed(d);
console.log('');
console.log('── Parité du modèle de vol : JavaScript ↔ GDScript ───────────────');
console.log(`  Pas simulés                    ${a.steps} à ${fmt(a.samples[0].t, 5)} s d'intervalle`);
console.log(`  Distance parcourue             JS ${fmt(a.distance, 3)} u | Godot ${fmt(b.distance, 3)} u`);
console.log(`  Écart de position final        ${fmt(finalDrift)} u  (${fmt(finalRatio * 100, 4)} % de la distance)`);
console.log(`  Écart de position maximal      ${fmt(maxDrift)} u à t = ${fmt(maxDriftT, 2)} s  (${fmt(maxRatio * 100, 4)} %)`);
console.log(`  Écart de vitesse maximal       ${fmt(maxSpeedDelta, 5)} u/s`);
console.log(`  Écart d'incidence maximal      ${fmt(maxAoaDelta, 6)} rad`);
console.log(`  Premier décrochage             JS ${a.first_stall_time?.toFixed(3) ?? 'jamais'} s | Godot ${b.first_stall_time?.toFixed(3) ?? 'jamais'} s`);
console.log(`  Pas en désaccord sur le décrochage  ${stallDisagreements} / ${a.steps}`);
console.log('');

const checks = [
  ['écart final < 1 % de la distance parcourue', finalRatio < POSITION_TOLERANCE_RATIO],
  ['écart maximal < 1 % de la distance parcourue', maxRatio < POSITION_TOLERANCE_RATIO],
  ['décrochage déclenché des deux côtés', a.first_stall_time !== null && b.first_stall_time !== null],
  [`décrochage synchrone à ±${STALL_TOLERANCE} s`, stallDelta !== null && stallDelta <= STALL_TOLERANCE],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${label}`);
  if (!ok) failed++;
}
console.log('');
if (failed === 0) {
  console.log('Lot 2 : recette quantitative OK.');
} else {
  console.error(`Lot 2 : ${failed} critère(s) non tenu(s) — ne pas passer au lot 3.`);
}
process.exit(failed === 0 ? 0 : 1);
