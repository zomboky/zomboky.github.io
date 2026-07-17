'use strict';
// Bordure d'arène — porte docs/hibou-3d.html L.549-552 (ellipsoidFactor) et
// L.901-909 (botClampTarget/BOT_SAFE_FACTOR/BOT_TARGET_CLEAR).
import { ARENA_CENTER, ARENA_RADIUS_XZ, ARENA_RADIUS_Y, BOT_SAFE_FACTOR, BOT_TARGET_CLEAR } from './constants.js';
import { effectiveGroundY } from './terrain.js';

export function ellipsoidFactor(pos) {
  const dx = (pos.x - ARENA_CENTER.x) / ARENA_RADIUS_XZ;
  const dy = (pos.y - ARENA_CENTER.y) / ARENA_RADIUS_Y;
  const dz = (pos.z - ARENA_CENTER.z) / ARENA_RADIUS_XZ;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const _aiTmp = { x: 0, y: 0, z: 0 };
export function botClampTarget(p) {
  const f = ellipsoidFactor(p);
  if (f > BOT_SAFE_FACTOR) {
    _aiTmp.x = p.x - ARENA_CENTER.x; _aiTmp.y = p.y - ARENA_CENTER.y; _aiTmp.z = p.z - ARENA_CENTER.z;
    const s = BOT_SAFE_FACTOR / f;
    p.x = ARENA_CENTER.x + _aiTmp.x * s;
    p.y = ARENA_CENTER.y + _aiTmp.y * s;
    p.z = ARENA_CENTER.z + _aiTmp.z * s;
  }
  p.y = Math.max(p.y, effectiveGroundY(p.x, p.z) + BOT_TARGET_CLEAR);
}
