'use strict';
// Terrain headless — porte fidèlement docs/hibou-3d.html (L.721-938) : bruit de
// valeur (fBm + ridged), pics montagneux gaussiens, rivières serpentantes,
// muraille d'arène. Entièrement déterministe (seeds fixes) : le terrain d'un
// match d'entraînement doit être identique à chaque simulation, sinon le
// fitness mesurerait la chance du terrain plutôt que le comportement du bot.
import * as THREE from 'three';
import { mulberry32 } from './util.js';
import {
  ARENA_RADIUS_XZ, WATER_Y, HILL_AMP, GROUND_DETAIL_AMP,
  RING_START, RING_FULL, RING_BASE, RING_VAR,
  CANONICAL_TERRAIN_SEED, RIVER_SEED,
} from './constants.js';

const terrainSeed = CANONICAL_TERRAIN_SEED;

function hashNoise(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + terrainSeed * 17.3) * 43758.5453;
  return n - Math.floor(n);
}
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hashNoise(ix, iz), b = hashNoise(ix + 1, iz);
  const c = hashNoise(ix, iz + 1), d = hashNoise(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, octaves = 5) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * freq, z * freq);
    amp *= 0.5; freq *= 2.03;
  }
  return sum;
}
function ridged(x, z, octaves = 3) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise(x * freq, z * freq) * 2 - 1);
    sum += amp * n * n;
    amp *= 0.5; freq *= 2.03;
  }
  return sum;
}

// ── Pics montagneux — semis fixe (seedé, pas Math.random()) pour reproductibilité ──
const peakRng = mulberry32(Math.floor(CANONICAL_TERRAIN_SEED * 1e6));
const mountainPeaks = [];
{
  const peakCount = 10 + Math.floor(peakRng() * 5);
  for (let i = 0; i < peakCount; i++) {
    const angle = (i / peakCount) * Math.PI * 2 + (peakRng() - 0.5);
    const dist = 70 + peakRng() * (ARENA_RADIUS_XZ * 0.72 - 70);
    mountainPeaks.push({
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      h: 17.5 + peakRng() * 35,   // rnd(35,105) réduit ×2
      r: 27.5 + peakRng() * 55,   // rnd(55,165) réduit ×2
    });
  }
}

// ── Rivières — PRNG dédié seedé fixe, méandres serpentant vers le centre ──
const riverRng = mulberry32(RIVER_SEED);
const riverPaths = [];
{
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
    riverPaths.push({ points, width: 5 + riverRng() * 4, depth: 3 + riverRng() * 2.5 });
  }
}

function riverCarve(x, z) {
  let carve = 0;
  for (const river of riverPaths) {
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

export function terrainHeight(x, z) {
  let h = (fbm(x * 0.016, z * 0.016) * 2 - 1) * HILL_AMP;
  h += (fbm(x * 0.07, z * 0.07, 3) * 2 - 1) * GROUND_DETAIL_AMP;
  h += (ridged(x * 0.1, z * 0.1, 3) - 0.35) * (GROUND_DETAIL_AMP * 1.6);
  for (const p of mountainPeaks) {
    const dx = x - p.x, dz = z - p.z;
    h += p.h * Math.exp(-(dx * dx + dz * dz) / (p.r * p.r));
  }
  const d = Math.hypot(x, z);
  const ringT = THREE.MathUtils.smoothstep(d, RING_START, RING_FULL);
  if (ringT > 0) {
    const ridge = fbm(x * 0.0032 + 31.4, z * 0.0032 - 12.9, 3);
    const crag = fbm(x * 0.016 - 5.1, z * 0.016 + 44.2, 3);
    h += ringT * (RING_BASE + ridge * RING_VAR + crag * 45);
  }
  h -= riverCarve(x, z);
  const flat = THREE.MathUtils.smoothstep(d, 12, 40);
  return h * flat;
}

export function effectiveGroundY(x, z) {
  return Math.max(terrainHeight(x, z), WATER_Y);
}
