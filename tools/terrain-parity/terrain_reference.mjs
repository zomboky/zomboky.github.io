// Référence JavaScript du terrain procédural, pour la recette du lot 3
// (PLAN_GODOT.md §5.4 et §9 lot 3).
//
// Transcription verbatim de docs/hibou-3d.html, lignes 749-1017, sortie de la
// closure du module pour être exécutable sous Node. Rien n'est réécrit : la
// moindre reformulation d'une expression flottante changerait le relief.
//
// Le vrai Three.js du dépôt est importé pour `MathUtils.smoothstep` et
// `MathUtils.clamp`, afin de ne pas dépendre d'une réimplémentation.
//
// ⚠️ `check_drift.mjs` empreinte les fonctions sources : si le jeu Three.js
// change, la CI le signale au lieu de laisser la référence pourrir en silence.

import * as THREE from '../../docs/three/build/three.module.min.js';

export const TERRAIN_SIZE = 4500;
export const TERRAIN_SEGS = 240;
export const WATER_Y = -3.0;
export const HILL_AMP = 24;
export const GROUND_DETAIL_AMP = 5.5;
export const SNOW_LINE = 46;
export const TREE_LINE = 38;

export const ARENA_RADIUS_XZ = 1400;
export const RING_START = ARENA_RADIUS_XZ * 0.86;
export const RING_FULL = ARENA_RADIUS_XZ * 1.18;
export const RING_BASE = 240;
export const RING_VAR = 260;

export const CANONICAL_TERRAIN_SEED = 483.271;
export const PEAK_SEED = 73939133;
export const RIVER_SEED = 20260716;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TerrainReference {
  constructor({ terrainSeed = CANONICAL_TERRAIN_SEED, peakSeed = PEAK_SEED,
                riverSeed = RIVER_SEED } = {}) {
    this.terrainSeed = terrainSeed;
    this.peakSeed = peakSeed;
    this.mountainPeaks = [];
    this.riverPaths = [];
    this.riverRng = mulberry32(riverSeed);
    this.fillMountainPeaks();
    this.fillRiverPaths();
  }

  hashNoise(ix, iz) {
    const n = Math.sin(ix * 127.1 + iz * 311.7 + this.terrainSeed * 17.3) * 43758.5453;
    return n - Math.floor(n);
  }

  valueNoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = this.hashNoise(ix, iz), b = this.hashNoise(ix + 1, iz);
    const c = this.hashNoise(ix, iz + 1), d = this.hashNoise(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }

  fbm(x, z, octaves = 5) {
    let sum = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.valueNoise(x * freq, z * freq);
      amp *= 0.5; freq *= 2.03;
    }
    return sum;
  }

  ridged(x, z, octaves = 3) {
    let sum = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(this.valueNoise(x * freq, z * freq) * 2 - 1);
      sum += amp * n * n;
      amp *= 0.5; freq *= 2.03;
    }
    return sum;
  }

  fillMountainPeaks() {
    const peakRng = mulberry32(this.peakSeed >>> 0);
    const peakRnd = (a, b) => a + peakRng() * (b - a);
    this.mountainPeaks.length = 0;
    const peakCount = Math.floor(peakRnd(10, 15));
    for (let i = 0; i < peakCount; i++) {
      const angle = (i / peakCount) * Math.PI * 2 + peakRnd(-0.5, 0.5);
      const dist = peakRnd(140, ARENA_RADIUS_XZ * 0.72);
      this.mountainPeaks.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        h: peakRnd(22, 70),
        r: peakRnd(80, 200),
      });
    }
  }

  fillRiverPaths() {
    const riverRng = this.riverRng;
    this.riverPaths = [];
    const riverCount = 2 + Math.floor(riverRng() * 2);
    for (let i = 0; i < riverCount; i++) {
      const startAngle = (i / riverCount) * Math.PI * 2 + (riverRng() - 0.5);
      let x = Math.cos(startAngle) * ARENA_RADIUS_XZ * 0.9;
      let z = Math.sin(startAngle) * ARENA_RADIUS_XZ * 0.9;
      let dirAngle = startAngle + Math.PI + (riverRng() - 0.5) * 0.6;
      const points = [{ x, z }];
      const steps = 14 + Math.floor(riverRng() * 6);
      const stepLen = (ARENA_RADIUS_XZ * 0.78) / steps;
      for (let s = 0; s < steps; s++) {
        dirAngle += (riverRng() - 0.5) * 0.7;
        x += Math.cos(dirAngle) * stepLen;
        z += Math.sin(dirAngle) * stepLen;
        points.push({ x, z });
      }
      this.riverPaths.push({ points, width: 10 + riverRng() * 8, depth: 6 + riverRng() * 5 });
    }
  }

  riverCarve(x, z) {
    let carve = 0;
    for (const river of this.riverPaths) {
      const pts = river.points;
      let minDistSq = Infinity, tAlong = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i].x, az = pts[i].z, bx = pts[i + 1].x, bz = pts[i + 1].z;
        const abx = bx - ax, abz = bz - az;
        const abLenSq = abx * abx + abz * abz || 1;
        let t = ((x - ax) * abx + (z - az) * abz) / abLenSq;
        t = Math.max(0, Math.min(1, t));
        const px = ax + abx * t, pz = az + abz * t;
        const dx = x - px, dz = z - pz;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) { minDistSq = dSq; tAlong = (i + t) / (pts.length - 1); }
      }
      const dist = Math.sqrt(minDistSq);
      const w = river.width * (1 + tAlong * 1.8);
      const depthHere = river.depth * (0.6 + tAlong * 0.8);
      carve += depthHere * (1 - THREE.MathUtils.smoothstep(dist, 0, w));
    }
    return carve;
  }

  terrainHeight(x, z) {
    let h = (this.fbm(x * 0.008, z * 0.008) * 2 - 1) * HILL_AMP;
    h += (this.fbm(x * 0.035, z * 0.035, 3) * 2 - 1) * GROUND_DETAIL_AMP;
    h += (this.ridged(x * 0.05, z * 0.05, 3) - 0.35) * (GROUND_DETAIL_AMP * 1.6);
    for (const p of this.mountainPeaks) {
      const dx = x - p.x, dz = z - p.z;
      h += p.h * Math.exp(-(dx * dx + dz * dz) / (p.r * p.r));
    }
    const d = Math.hypot(x, z);
    const ringT = THREE.MathUtils.smoothstep(d, RING_START, RING_FULL);
    if (ringT > 0) {
      const ridge = this.fbm(x * 0.0016 + 31.4, z * 0.0016 - 12.9, 3);
      const crag = this.fbm(x * 0.008 - 5.1, z * 0.008 + 44.2, 3);
      h += ringT * (RING_BASE + ridge * RING_VAR + crag * 90);
    }
    h -= this.riverCarve(x, z);
    const flat = THREE.MathUtils.smoothstep(d, 25, 80);
    return h * flat;
  }

  effectiveGroundY(x, z) {
    return Math.max(this.terrainHeight(x, z), WATER_Y);
  }

  forestDensity(x, z) {
    return this.fbm(x * 0.006 + 57.3, z * 0.006 - 91.7, 3);
  }
}
