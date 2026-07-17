'use strict';
// Génome du bot : les 9 paramètres de difficulté d'origine
// (docs/hibou-3d.html L.3202-3205) + 5 extensions actuellement codées en dur
// dans le jeu (extendDist=30, extendClimb=25, jinkAmplitude=0.45,
// breakPerpWeight=1 implicite, aggressionBias=0 implicite). L'évolution
// explore ces 14 dimensions ; le résultat final réinjecte les meilleures
// valeurs dans BOT_DIFFICULTY_TUNING (voir Phase 8 du plan).
import { rnd } from './util.js';

export const GENE_RANGES = {
  aiTickInterval:     [0.08, 0.6],
  aimConeRad:         [Math.PI / 180 * 1, Math.PI / 180 * 15],
  reactionDelay:      [0.05, 1.2],
  leadFactor:         [0, 1.2],
  throttleCap:        [0.5, 1.0],
  evadeLifeThreshold: [1, 8],
  breakChance:        [0, 1],
  jinkPeriod:         [0, 1.5],
  fireDist:           [80, 300],
  extendDist:         [15, 60],
  extendClimb:        [5, 50],
  jinkAmplitude:      [0.15, 0.8],
  breakPerpWeight:    [0.3, 1.5],
  aggressionBias:     [-0.3, 0.3],
};

export const GENE_NAMES = Object.keys(GENE_RANGES);

export function randomGenome() {
  const g = {};
  for (const name of GENE_NAMES) {
    const [lo, hi] = GENE_RANGES[name];
    g[name] = rnd(lo, hi);
  }
  return g;
}

function clampGene(name, v) {
  const [lo, hi] = GENE_RANGES[name];
  return Math.min(hi, Math.max(lo, v));
}

// BLX-α (blend crossover) : chaque gène de l'enfant est tiré uniformément dans
// l'intervalle [min-α·d, max+α·d] des parents (d = |parentA - parentB|), ce qui
// permet d'explorer légèrement au-delà des deux parents sans jamais sortir des
// bornes physiques du gène.
export function crossover(parentA, parentB, alpha = 0.3) {
  const child = {};
  for (const name of GENE_NAMES) {
    const a = parentA[name], b = parentB[name];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const d = hi - lo;
    child[name] = clampGene(name, rnd(lo - alpha * d, hi + alpha * d));
  }
  return child;
}

// Mutation gaussienne : chaque gène a `rate` de chance d'être perturbé de
// ±5% de son étendue (σ), reclampé dans ses bornes.
export function mutate(genome, rate = 0.2) {
  const child = { ...genome };
  for (const name of GENE_NAMES) {
    if (Math.random() >= rate) continue;
    const [lo, hi] = GENE_RANGES[name];
    const sigma = (hi - lo) * 0.05;
    // Box-Muller pour un bruit gaussien centré sur la valeur actuelle
    const u1 = Math.random() || 1e-9, u2 = Math.random();
    const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
    child[name] = clampGene(name, child[name] + noise);
  }
  return child;
}

// Distance euclidienne normalisée dans l'espace des gènes (0..~1 par gène) —
// utilisée par le Hall of Fame pour choisir les membres les plus diversifiés.
export function genomeDistance(a, b) {
  let sum = 0;
  for (const name of GENE_NAMES) {
    const [lo, hi] = GENE_RANGES[name];
    const span = hi - lo || 1;
    const d = (a[name] - b[name]) / span;
    sum += d * d;
  }
  return Math.sqrt(sum);
}
