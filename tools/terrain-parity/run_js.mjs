// Échantillonne le terrain de référence sur la grille de parité et écrit la trace.
//
//   node tools/terrain-parity/run_js.mjs [sortie.json]
//
// La grille est définie par une formule exacte en flottants (pas de tirage, pas de
// fichier de points) : les deux implémentations la reconstruisent à l'identique.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TerrainReference } from './terrain_reference.mjs';

/** 100 × 100 = 10 000 points, de -1650 à +1617 : centre, arène, muraille, extérieur. */
export const GRID_N = 100;
export const GRID_ORIGIN = -1650.0;
export const GRID_STEP = 33.0;

const here = dirname(fileURLToPath(import.meta.url));
const outPath = process.argv[2] || resolve(here, 'out/trace_js.json');

/** Flottants transportés en base64 de float64 bruts : le JSON de Godot arrondit
 *  à 15 chiffres significatifs, or c'est précisément la dernière décimale qu'on
 *  cherche à comparer ici. */
export const encode = (values) =>
  Buffer.from(new Float64Array(values).buffer).toString('base64');

const terrain = new TerrainReference();

const heights = [];
const forest = [];
for (let i = 0; i < GRID_N; i++) {
  const x = GRID_ORIGIN + i * GRID_STEP;
  for (let j = 0; j < GRID_N; j++) {
    const z = GRID_ORIGIN + j * GRID_STEP;
    heights.push(terrain.terrainHeight(x, z));
    forest.push(terrain.forestDensity(x, z));
  }
}

// Le semis lui-même fait partie de ce qui doit coïncider : deux implémentations
// peuvent partager `terrainHeight()` et diverger parce qu'elles n'ont pas tiré
// les mêmes pics ou les mêmes méandres.
const peaks = terrain.mountainPeaks.flatMap(p => [p.x, p.z, p.h, p.r]);
const riverShape = terrain.riverPaths.flatMap(r => [r.width, r.depth]);
const riverPoints = terrain.riverPaths.flatMap(r => r.points.flatMap(p => [p.x, p.z]));
const riverCounts = terrain.riverPaths.map(r => r.points.length);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({
  source: 'javascript',
  grid: { n: GRID_N, origin: GRID_ORIGIN, step: GRID_STEP },
  peaks_b64: encode(peaks),
  river_counts: riverCounts,
  river_shape_b64: encode(riverShape),
  river_points_b64: encode(riverPoints),
  heights_b64: encode(heights),
  forest_b64: encode(forest),
}));

const min = Math.min(...heights), max = Math.max(...heights);
console.log(`JS  : ${heights.length} points échantillonnés, ${peaks.length / 4} pics, ${riverCounts.length} rivières`);
console.log(`      altitudes de ${min.toFixed(3)} à ${max.toFixed(3)}`);
console.log(`      trace → ${outPath}`);
