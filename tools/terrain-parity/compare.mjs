// Compare les deux échantillonnages du terrain et applique les critères du lot 3.
//
//   node tools/terrain-parity/compare.mjs [trace_js.json] [trace_godot.json]
//
// Ce que ce harnais cherche vraiment (PLAN_GODOT.md §5.4) : `hashNoise` amplifie
// `sin()` par 43 758,5453, ce qui transforme un écart de quelques ULP entre deux
// implémentations de la libm en une valeur de bruit *complètement différente*. Un
// tel écart ne se voit pas « un peu » : il se voit comme un relief entièrement
// autre. C'est pourquoi le seuil de réussite est serré, et pourquoi l'échec
// attendu serait franc plutôt que marginal.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const a = JSON.parse(readFileSync(process.argv[2] || resolve(here, 'out/trace_js.json'), 'utf8'));
const b = JSON.parse(readFileSync(process.argv[3] || resolve(here, 'out/trace_godot.json'), 'utf8'));

/** Écart d'altitude toléré, en unités monde. Le relief va de -21 à +489 u ; une
 *  divergence du hash produirait des mètres, pas des micromètres. */
const HEIGHT_TOLERANCE = 1e-6;
/** Écart toléré sur le semis (pics, méandres) : arithmétique entière, donc exact. */
const SEED_TOLERANCE = 1e-9;

/** Node alloue les petits Buffer dans un pool partagé : `.buffer` renvoie tout le
 *  pool, pas la tranche. Il faut donc passer par l'offset et la longueur, sinon on
 *  compare de la mémoire voisine au lieu des données. */
function decode(b64) {
  const buf = Buffer.from(b64, 'base64');
  return new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8);
}

function stats(x, y, label) {
  if (x.length !== y.length) {
    console.error(`${label} : longueurs différentes (${x.length} contre ${y.length}).`);
    process.exit(1);
  }
  let maxAbs = 0, index = -1, sum = 0;
  for (let i = 0; i < x.length; i++) {
    const d = Math.abs(x[i] - y[i]);
    sum += d;
    if (d > maxAbs) { maxAbs = d; index = i; }
  }
  return { maxAbs, index, mean: sum / x.length, n: x.length };
}

const heights = stats(decode(a.heights_b64), decode(b.heights_b64), 'heights');
const forest = stats(decode(a.forest_b64), decode(b.forest_b64), 'forest');
const peaks = stats(decode(a.peaks_b64), decode(b.peaks_b64), 'peaks');
const riverShape = stats(decode(a.river_shape_b64), decode(b.river_shape_b64), 'river_shape');
const riverPoints = stats(decode(a.river_points_b64), decode(b.river_points_b64), 'river_points');

const jsHeights = decode(a.heights_b64);
const worstX = a.grid.origin + Math.floor(heights.index / a.grid.n) * a.grid.step;
const worstZ = a.grid.origin + (heights.index % a.grid.n) * a.grid.step;

const fmt = (n) => n === 0 ? '0 (exact)' : n.toExponential(3);
console.log('');
console.log('── Parité du terrain : JavaScript ↔ GDScript ─────────────────────');
console.log(`  Points échantillonnés          ${heights.n} (grille ${a.grid.n}×${a.grid.n}, pas ${a.grid.step} u)`);
console.log(`  Amplitude du relief            ${Math.min(...jsHeights).toFixed(3)} → ${Math.max(...jsHeights).toFixed(3)} u`);
console.log(`  Pics de montagne               ${peaks.n / 4} de chaque côté, écart max ${fmt(peaks.maxAbs)}`);
console.log(`  Rivières                       ${a.river_counts.length} de chaque côté (${a.river_counts.join(', ')} points)`);
console.log(`    forme (largeur, profondeur)  écart max ${fmt(riverShape.maxAbs)}`);
console.log(`    tracé des méandres           écart max ${fmt(riverPoints.maxAbs)}`);
console.log(`  Altitude : écart max           ${fmt(heights.maxAbs)} u  en (${worstX}, ${worstZ})`);
console.log(`  Altitude : écart moyen         ${fmt(heights.mean)} u`);
console.log(`  Masque de forêt : écart max    ${fmt(forest.maxAbs)}`);
console.log('');

const sameCounts = JSON.stringify(a.river_counts) === JSON.stringify(b.river_counts);
const checks = [
  ['pics semés en même nombre', peaks.n > 0 && peaks.n % 4 === 0],
  ['pics identiques (arithmétique entière)', peaks.maxAbs < SEED_TOLERANCE],
  ['même nombre de rivières et de méandres', sameCounts],
  ['tracé des rivières identique', riverPoints.maxAbs < SEED_TOLERANCE && riverShape.maxAbs < SEED_TOLERANCE],
  [`altitude identique à ${HEIGHT_TOLERANCE} u près`, heights.maxAbs < HEIGHT_TOLERANCE],
  [`masque de forêt identique à ${HEIGHT_TOLERANCE} près`, forest.maxAbs < HEIGHT_TOLERANCE],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${label}`);
  if (!ok) failed++;
}
console.log('');
if (failed === 0) {
  console.log('Lot 3 : parité du terrain OK — le hash sin() ne diverge pas.');
} else {
  console.error(`Lot 3 : ${failed} critère(s) non tenu(s).`);
  console.error('Repli prévu au plan (§5.4) : remplacer Math.sin par un hash entier');
  console.error('déterministe DES DEUX CÔTÉS, y compris dans docs/hibou-3d.html.');
}
process.exit(failed === 0 ? 0 : 1);
