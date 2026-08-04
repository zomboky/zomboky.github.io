// Référence JavaScript du modèle de vol, pour la recette du lot 2 (PLAN_GODOT.md §9.2).
//
// C'est une TRANSCRIPTION VERBATIM de `updateFlight()` — docs/hibou-3d.html,
// lignes 2531-2748 — sortie de la closure du module pour être exécutable sous Node.
// Seules trois choses changent, et aucune ne touche au calcul :
//   1. les commandes arrivent en argument au lieu d'être lues dans `keys` (étape 1) ;
//   2. les effets de bord de scène (secousse d'écran, crash au sol, collision
//      d'arbre) sont remontés dans l'état au lieu d'appeler le jeu ;
//   3. `rnd()` passe par un mulberry32 semé, pour que le tremblement de décrochage
//      soit rejouable des deux côtés.
//
// Le vrai Three.js du dépôt est importé : Vector3, Quaternion et MathUtils sont
// donc exactement ceux du jeu, et non une réimplémentation qui pourrait diverger.
//
// ⚠️ Si `updateFlight()` change dans le jeu, cette transcription doit être reprise.
// `check_drift.mjs` compare l'empreinte du bloc source et échoue si elle a bougé.

import * as THREE from '../../docs/three/build/three.module.min.js';

// ── Constantes, recopiées telles quelles (§2.3) ──────────────────────────
export const YAW_RATE = THREE.MathUtils.degToRad(70);
export const PITCH_RATE = THREE.MathUtils.degToRad(55);
export const ROLL_RATE = THREE.MathUtils.degToRad(200);

export const THRUST_ACCEL = 28;
export const MAX_SPEED = 34;
export const CRUISE_THROTTLE = 0.6;
export const BRAKE_RATE = 0.55;
export const BRAKE_DRAG = 0.9;

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
export const WIND_ACCEL = 3.1;

export const STALL_SPEED = 9.5;
export const STALL_RECOVER = 13;

export const DRIFT_ACCEL = 6;

export const ARENA_CENTER = new THREE.Vector3(0, 35, 0);
export const ARENA_RADIUS_XZ = 1400;
export const ARENA_RADIUS_Y = 630;
export const BOUNDARY_FADE_DIST = 22;

// ── mulberry32, recopié de docs/hibou-3d.html ────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ellipsoidFactor(pos) {
  const dx = (pos.x - ARENA_CENTER.x) / ARENA_RADIUS_XZ;
  const dy = (pos.y - ARENA_CENTER.y) / ARENA_RADIUS_Y;
  const dz = (pos.z - ARENA_CENTER.z) / ARENA_RADIUS_XZ;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Vecteurs temporaires — zéro allocation par frame, comme dans le jeu.
const _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _right = new THREE.Vector3();
const _acc = new THREE.Vector3(), _tmp = new THREE.Vector3(), _tgtAng = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _UP_AXIS = new THREE.Vector3(0, 1, 0);
const _q1 = new THREE.Quaternion();

export class FlightReference {
  constructor({ rngSeed = 1, groundY = -3.0, groundClear = 1.2 } = {}) {
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.angRate = new THREE.Vector3();
    this.speed = 0;
    this.throttle = 0;
    this.stallMode = false;
    this.stallTimer = 0;
    this.prevThrustHeld = false;

    this.governEff = { leftWing: 0, rightWing: 0, tail: 0 };
    this.storm = { active: false, windAngle: 0, windForce: 0, gustPhase: 0 };
    this.buffs = { speed: 0 };

    this.groundY = groundY;
    this.groundClear = groundClear;
    this.rng = mulberry32(rngSeed);
    this.rnd = (a, b) => a + this.rng() * (b - a);

    this.flight = { aoa: 0, stall: false, climb: 0, throttle: 0 };
    this.screenShake = 0;
    this.groundCrash = false;
    this.lastDriftSeverity = 0;
  }

  effectiveGroundY() { return this.groundY; }

  reset(startPosition = [ARENA_CENTER.x, 16, ARENA_CENTER.z]) {
    this.position.set(...startPosition);
    this.quaternion.identity();
    this.speed = MAX_SPEED * 0.55;
    this.velocity.set(0, 0, -this.speed);
    this.angRate.set(0, 0, 0);
    this.throttle = CRUISE_THROTTLE;
    this.stallMode = false;
    this.stallTimer = 0;
    this.prevThrustHeld = false;
    this.groundCrash = false;
    this.flight = { aoa: 0, stall: false, climb: 0, throttle: this.throttle };
  }

  // Équivalents des rotations locales de Object3D, appliquées au quaternion.
  _rotateLocal(axis, angle) {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.multiply(_q1);
  }

  _rotateWorld(axis, angle) {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.premultiply(_q1);
  }

  // ── updateFlight(dt) ───────────────────────────────────────────────────
  step(input, dt) {
    const { position, quaternion, velocity, angRate, governEff, storm, buffs } = this;
    const rnd = this.rnd;
    this.groundCrash = false;

    // 1. Lecture des commandes (fournies par l'appelant).
    const yawIn = input.yaw, pitchIn = input.pitch, rollIn = input.roll;
    const mdx = input.mouseDx || 0, mdy = input.mouseDy || 0;

    // 2. Dynamique de rotation : inertie + autorité selon la vitesse air.
    let authority = THREE.MathUtils.clamp(
      (this.speed - CTRL_MIN_SPEED) / (CTRL_FULL_SPEED - CTRL_MIN_SPEED), 0.2, 1);
    if (this.stallMode) authority *= 0.3;

    const rollMult = 1 - Math.max(governEff.leftWing, governEff.rightWing);
    const pitchMult = 1 - governEff.tail;
    const yawMult = 1 - Math.max(governEff.leftWing, governEff.rightWing, governEff.tail);
    _tgtAng.set(pitchIn * PITCH_RATE * pitchMult, yawIn * YAW_RATE * yawMult,
                rollIn * ROLL_RATE * rollMult).multiplyScalar(authority);
    const kAng = 1 - Math.exp(-ANG_RESPONSE * dt);
    angRate.lerp(_tgtAng, kAng);
    this._rotateLocal(new THREE.Vector3(1, 0, 0), angRate.x * dt);
    this._rotateLocal(new THREE.Vector3(0, 1, 0), angRate.y * dt);
    this._rotateLocal(new THREE.Vector3(0, 0, 1), angRate.z * dt);
    this._rotateLocal(new THREE.Vector3(0, 1, 0), mdx);
    this._rotateLocal(new THREE.Vector3(1, 0, 0), -mdy);

    // 3. Repère local du hibou.
    const q = quaternion;
    _fwd.set(0, 0, -1).applyQuaternion(q);
    _up.set(0, 1, 0).applyQuaternion(q);
    _right.set(1, 0, 0).applyQuaternion(q);
    const curBank = Math.asin(THREE.MathUtils.clamp(_right.y, -1, 1));

    // 4. Poussée moteur.
    const thrustHeld = input.thrust;
    const brakeHeld = input.brake;
    if (thrustHeld && !this.prevThrustHeld) this.throttle = Math.max(this.throttle, CRUISE_THROTTLE);
    if (thrustHeld) this.throttle = Math.min(1, this.throttle + 0.8 * dt);
    if (brakeHeld) this.throttle = Math.max(0, this.throttle - BRAKE_RATE * dt);
    this.prevThrustHeld = thrustHeld;

    const speedBoost = buffs.speed > 0 ? 1.4 : 1;
    const climbFade = 1 - 0.85 * THREE.MathUtils.smoothstep(_fwd.y, 0.35, 0.9);
    const thrust = this.throttle * THRUST_ACCEL * speedBoost * climbFade;

    // 5. Vitesse air & incidence.
    const v = velocity.length();
    const vUp = velocity.dot(_up);
    const vFwd = velocity.dot(_fwd);
    const vRight = velocity.dot(_right);
    const aoa = v > 0.6 ? Math.atan2(-vUp, Math.abs(vFwd) + 1e-3) : 0;

    // 6. Coefficient de portance.
    const absAoa = Math.abs(aoa);
    const stalling = absAoa > STALL_AOA;
    let CL;
    if (!stalling) {
      CL = CL_MAX * (aoa / STALL_AOA);
    } else {
      const over = Math.min(1, (absAoa - STALL_AOA) / STALL_AOA);
      CL = Math.sign(aoa) * CL_MAX * (1 - 0.75 * over);
    }

    // 6bis. Décrochage « en cloche ».
    const climbStall = _fwd.y > 0.45 && v < STALL_SPEED;
    if (!this.stallMode && (stalling || climbStall)) { this.stallMode = true; this.stallTimer = 0.8; }
    if (this.stallMode) {
      this.stallTimer -= dt;
      angRate.x = THREE.MathUtils.lerp(angRate.x, -1.5, 1 - Math.exp(-3.5 * dt));
      angRate.z += rnd(-1, 1) * 2.4 * dt;
      this.screenShake = Math.max(this.screenShake, 2.5);
      if (this.stallTimer <= 0 && v > STALL_RECOVER && _fwd.y < 0.25 && absAoa < STALL_AOA * 0.8) {
        this.stallMode = false;
      }
    }

    // 7. Bilan des forces.
    _acc.set(0, -OWL_MASS * GRAVITY, 0);
    _acc.addScaledVector(_fwd, thrust * OWL_MASS);

    const altAGL = position.y - this.effectiveGroundY(position.x, position.z);
    const groundEffect = THREE.MathUtils.clamp(1 - altAGL / 6, 0, 1);

    const dynLift = AIR_LIFT * v * v * CL * (1 + 0.3 * groundEffect);
    const flapLift = FLAP_LIFT * (0.35 + 0.65 * this.throttle) * Math.max(0, 1 - v / FLAP_FADE)
                   * (1 - THREE.MathUtils.smoothstep(_fwd.y, 0.35, 0.8));
    const wingLiftMult = 1 - (governEff.leftWing + governEff.rightWing) / 2;
    _acc.addScaledVector(_up, (dynLift + flapLift) * wingLiftMult * OWL_MASS);

    if (v > 1e-3) {
      const drag = AIR_DRAG * (brakeHeld ? 1 + BRAKE_DRAG : 1) * v * v
                 + INDUCED_DRAG * CL * CL * v * (1 - 0.35 * groundEffect);
      _acc.addScaledVector(velocity, (-drag / v) * OWL_MASS);
    }

    _acc.addScaledVector(_right, -vRight * SIDE_GRIP * OWL_MASS);

    // 8. Vent de tempête.
    if (storm.active) {
      const w = storm.windForce * WIND_ACCEL * OWL_MASS;
      _acc.x += Math.cos(storm.windAngle) * w;
      _acc.z += Math.sin(storm.windAngle) * w;
      _acc.y -= w * (0.55 + 0.35 * Math.sin(storm.gustPhase * 0.5));
      _acc.x += rnd(-1, 1) * w * 0.5;
      _acc.y += rnd(-1, 1) * w * 0.35;
      _acc.z += rnd(-1, 1) * w * 0.5;
    }

    _acc.divideScalar(OWL_MASS);

    // 9. Intégration semi-implicite + virage coordonné.
    velocity.addScaledVector(_acc, dt);
    const driftSeverity = Math.max(governEff.leftWing, governEff.rightWing, governEff.tail);
    this.lastDriftSeverity = driftSeverity;
    if (driftSeverity > 0) {
      const driftSign = governEff.leftWing > governEff.rightWing ? -1 : 1;
      velocity.addScaledVector(_right, driftSign * DRIFT_ACCEL * driftSeverity * dt);
    }
    const vmax = MAX_SPEED * speedBoost * 1.2;
    if (velocity.lengthSq() > vmax * vmax) velocity.setLength(vmax);
    position.addScaledVector(velocity, dt);
    this.speed = velocity.length();

    const levelness = 1 - THREE.MathUtils.clamp(Math.abs(_fwd.y) / 0.85, 0, 1);
    if (this.speed > 3 && levelness > 0) {
      const turnRate = GRAVITY * Math.tan(THREE.MathUtils.clamp(curBank, -1.45, 1.45)) / this.speed;
      const a = turnRate * dt * levelness;
      const ca = Math.cos(a), sa = Math.sin(a);
      const vx = velocity.x, vz = velocity.z;
      velocity.x = vx * ca + vz * sa;
      velocity.z = -vx * sa + vz * ca;
      this._rotateWorld(_UP_AXIS, a);
    }

    // 10. Bordure ellipsoïde + plancher terrain.
    const offset = _tmp.copy(position).sub(ARENA_CENTER);
    const f = ellipsoidFactor(position);
    const pushStart = 1 - BOUNDARY_FADE_DIST / ARENA_RADIUS_XZ;
    if (f > pushStart) {
      _dir.copy(offset).normalize();
      const vOut = velocity.dot(_dir);
      if (vOut > 0) {
        const strength = THREE.MathUtils.clamp((f - pushStart) / (1 - pushStart), 0, 1);
        velocity.addScaledVector(_dir, -vOut * strength * Math.min(1, 6 * dt));
      }
      if (f > 1) position.copy(ARENA_CENTER).addScaledVector(offset, 1 / f);
    }
    const groundY = this.effectiveGroundY(position.x, position.z) + this.groundClear;
    if (position.y < groundY) {
      position.y = groundY;
      this.groundCrash = true;
    }

    // 11. État de vol pour les instruments.
    this.flight.aoa = aoa;
    this.flight.stall = stalling || this.stallMode;
    this.flight.climb = velocity.y;
    this.flight.throttle = this.throttle;

    return THREE.MathUtils.clamp(this.speed / MAX_SPEED, 0, 1);
  }
}
