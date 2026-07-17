'use strict';
// Constantes extraites de docs/hibou-3d.html — copie fidèle des valeurs de vol,
// combat et arène utilisées par le joueur/bot en jeu. Voir le fichier source
// pour le contexte complet ; ici on ne garde que ce qui est nécessaire à la
// simulation headless (self-play).
//
// ARÈNE : réduite ×2 par rapport au jeu (ARENA_RADIUS_XZ=1400 → 700) pour des
// combats plus denses en entraînement — voir plans/hibou3d-training.md.
import * as THREE from 'three';

export const ARENA_CENTER = new THREE.Vector3(0, 17.5, 0);
export const ARENA_RADIUS_XZ = 700;
export const ARENA_RADIUS_Y = 315;

// ── Terrain (docs/hibou-3d.html L.697-711) — réduit ×2 avec l'arène ──
export const TERRAIN_SIZE = 2250;
export const WATER_Y = -1.5;
export const HILL_AMP = 12;
export const GROUND_DETAIL_AMP = 2.75;
export const SNOW_LINE = 23;
export const TREE_LINE = 19;
export const RING_START = ARENA_RADIUS_XZ * 0.86;
export const RING_FULL = ARENA_RADIUS_XZ * 1.18;
export const RING_BASE = 120;
export const RING_VAR = 130;

export const CANONICAL_TERRAIN_SEED = 42.17;
export const RIVER_SEED = 1337;

// ── Vol (docs/hibou-3d.html L.2253-2289) — identique au jeu, l'arène plus
//    petite ne change pas la physique de vol elle-même ──
export const YAW_RATE = THREE.MathUtils.degToRad(70);
export const PITCH_RATE = THREE.MathUtils.degToRad(55);
export const ROLL_RATE = THREE.MathUtils.degToRad(200);

export const THRUST_ACCEL = 28;
export const MAX_SPEED = 34;
export const CRUISE_THROTTLE = 0.6;
export const BRAKE_RATE = 0.55;

export const OWL_MASS = 1.6;
export const GRAVITY = 9.8;
export const AIR_LIFT = 0.05;
export const AIR_DRAG = 0.02;
export const INDUCED_DRAG = 0.03;
export const FLAP_LIFT = 13;
export const FLAP_FADE = 17;
export const SIDE_GRIP = 0.6;
export const STALL_AOA = THREE.MathUtils.degToRad(18);
export const CL_MAX = 1.5;
export const CTRL_MIN_SPEED = 7;
export const CTRL_FULL_SPEED = 18;
export const ANG_RESPONSE = 7;

export const STALL_SPEED = 9.5;
export const STALL_RECOVER = 13;

export const OWL_GROUND_CLEAR = 1.2;
export const OWL_COLLIDE_RADIUS = 0.3;
export const OWL_HITBOX = { w: 2.6, h: 1.2, d: 1.6 };
export const DRIFT_ACCEL = 6;

// ── Combat (docs/hibou-3d.html L.3140-3173) ──
export const LIFE_MAX = 10;
export const CRIT_CHANCE = 0.1;
export const GOVERN_FIRST_HIT_MIN = 0.10, GOVERN_FIRST_HIT_MAX = 1.0;
export const GOVERN_REPEAT_HIT_ADD = 0.15;
export const GOVERN_DEGRADE_INTERVAL = 5;
export const GOVERN_DEGRADE_CHANCE = 0.5;
export const GOVERN_DEGRADE_STEP = 0.10;
export const REPAIR_TIME = 30;

export const MP_RESPAWN_DELAY = 5;
export const MP_MAG_CAP = 150;
export const MP_FIRE_RATE = 100;
export const MP_BULLET_SPEED = 120;
export const MP_BULLET_LIFE = 2.5;

// ── IA campagne (docs/hibou-3d.html L.897-899) ──
export const BOT_SAFE_FACTOR = 0.78;
export const BOT_TARGET_CLEAR = 14;
export const BOT_PROBE_TIMES = [0.5, 1.1, 2.0];
