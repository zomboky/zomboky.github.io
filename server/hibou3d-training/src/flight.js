'use strict';
// Modèle de vol — porte fidèlement updateBotFlight (docs/hibou-3d.html
// L.3785-3884), généralisé pour prendre un `owl` générique en paramètre au
// lieu de lire le global `bot`. Même physique que le joueur (constantes
// identiques, voir constants.js) : décrochage, portance/traînée, dégâts des
// gouvernes, effet de sol, bordure d'arène dure, collision terrain → crash.
import * as THREE from 'three';
import {
  ARENA_CENTER, MAX_SPEED, THRUST_ACCEL, OWL_MASS, GRAVITY, AIR_LIFT, AIR_DRAG,
  INDUCED_DRAG, FLAP_LIFT, FLAP_FADE, SIDE_GRIP, STALL_AOA, CL_MAX,
  CTRL_MIN_SPEED, CTRL_FULL_SPEED, ANG_RESPONSE, PITCH_RATE, YAW_RATE, ROLL_RATE,
  STALL_SPEED, STALL_RECOVER, DRIFT_ACCEL, OWL_GROUND_CLEAR,
} from './constants.js';
import { effectiveGroundY } from './terrain.js';
import { ellipsoidFactor } from './arena.js';

const _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _right = new THREE.Vector3();
const _acc = new THREE.Vector3(), _tmp = new THREE.Vector3(), _tgtAng = new THREE.Vector3();
const _UP_AXIS = new THREE.Vector3(0, 1, 0);

// input = { yawIn, pitchIn, rollIn, thrustHeld, brakeHeld } (mêmes conventions que le joueur)
// Retourne 'crash' si l'owl a touché le sol/l'eau cette frame, sinon null.
export function updateFlight(owl, input, dt) {
  const rollMult = 1 - Math.max(owl.governEff.leftWing, owl.governEff.rightWing);
  const pitchMult = 1 - owl.governEff.tail;
  const yawMult = 1 - Math.max(owl.governEff.leftWing, owl.governEff.rightWing, owl.governEff.tail);
  let authority = THREE.MathUtils.clamp(
    (owl.speed - CTRL_MIN_SPEED) / (CTRL_FULL_SPEED - CTRL_MIN_SPEED), 0.2, 1);
  if (owl.stallMode) authority *= 0.3;

  _tgtAng.set(input.pitchIn * PITCH_RATE * pitchMult, input.yawIn * YAW_RATE * yawMult,
              input.rollIn * ROLL_RATE * rollMult).multiplyScalar(authority);
  const kAng = 1 - Math.exp(-ANG_RESPONSE * dt);
  owl.angRate.lerp(_tgtAng, kAng);
  owl.obj.rotateX(owl.angRate.x * dt);
  owl.obj.rotateY(owl.angRate.y * dt);
  owl.obj.rotateZ(owl.angRate.z * dt);

  const q = owl.obj.quaternion;
  _fwd.set(0, 0, -1).applyQuaternion(q);
  _up.set(0, 1, 0).applyQuaternion(q);
  _right.set(1, 0, 0).applyQuaternion(q);
  const curBank = Math.asin(THREE.MathUtils.clamp(_right.y, -1, 1));

  if (input.thrustHeld) owl.throttle = Math.min(1, owl.throttle + 0.8 * dt);
  else if (input.brakeHeld) owl.throttle = Math.max(0, owl.throttle - 0.55 * dt);
  const climbFade = 1 - 0.85 * THREE.MathUtils.smoothstep(_fwd.y, 0.35, 0.9);
  const thrust = owl.throttle * THRUST_ACCEL * climbFade;

  const v = owl.velocity.length();
  const vUp = owl.velocity.dot(_up);
  const vFwd = owl.velocity.dot(_fwd);
  const vRight = owl.velocity.dot(_right);
  const aoa = v > 0.6 ? Math.atan2(-vUp, Math.abs(vFwd) + 1e-3) : 0;

  const absAoa = Math.abs(aoa);
  const stalling = absAoa > STALL_AOA;
  let CL;
  if (!stalling) CL = CL_MAX * (aoa / STALL_AOA);
  else { const over = Math.min(1, (absAoa - STALL_AOA) / STALL_AOA); CL = Math.sign(aoa) * CL_MAX * (1 - 0.75 * over); }

  const climbStall = _fwd.y > 0.45 && v < STALL_SPEED;
  if (!owl.stallMode && (stalling || climbStall)) { owl.stallMode = true; owl.stallTimer = 0.8; }
  if (owl.stallMode) {
    owl.stallTimer -= dt;
    owl.angRate.x = THREE.MathUtils.lerp(owl.angRate.x, -1.5, 1 - Math.exp(-3.5 * dt));
    if (owl.stallTimer <= 0 && v > STALL_RECOVER && _fwd.y < 0.25 && absAoa < STALL_AOA * 0.8) owl.stallMode = false;
  }

  _acc.set(0, -OWL_MASS * GRAVITY, 0);
  _acc.addScaledVector(_fwd, thrust * OWL_MASS);

  const altAGL = owl.obj.position.y - effectiveGroundY(owl.obj.position.x, owl.obj.position.z);
  const groundEffect = THREE.MathUtils.clamp(1 - altAGL / 6, 0, 1);
  const dynLift = AIR_LIFT * v * v * CL * (1 + 0.3 * groundEffect);
  const flapLift = FLAP_LIFT * (0.35 + 0.65 * owl.throttle) * Math.max(0, 1 - v / FLAP_FADE)
                  * (1 - THREE.MathUtils.smoothstep(_fwd.y, 0.35, 0.8));
  const wingLiftMult = 1 - (owl.governEff.leftWing + owl.governEff.rightWing) / 2;
  _acc.addScaledVector(_up, (dynLift + flapLift) * wingLiftMult * OWL_MASS);

  if (v > 1e-3) {
    const drag = AIR_DRAG * v * v + INDUCED_DRAG * CL * CL * v * (1 - 0.35 * groundEffect);
    _acc.addScaledVector(owl.velocity, (-drag / v) * OWL_MASS);
  }
  _acc.addScaledVector(_right, -vRight * SIDE_GRIP * OWL_MASS);
  _acc.divideScalar(OWL_MASS);

  owl.velocity.addScaledVector(_acc, dt);
  const driftSeverity = Math.max(owl.governEff.leftWing, owl.governEff.rightWing, owl.governEff.tail);
  if (driftSeverity > 0) {
    const driftSign = owl.governEff.leftWing > owl.governEff.rightWing ? -1 : 1;
    owl.velocity.addScaledVector(_right, driftSign * DRIFT_ACCEL * driftSeverity * dt);
  }
  if (owl.velocity.lengthSq() > MAX_SPEED * MAX_SPEED) owl.velocity.setLength(MAX_SPEED);
  owl.obj.position.addScaledVector(owl.velocity, dt);
  owl.speed = owl.velocity.length();

  const levelness = 1 - THREE.MathUtils.clamp(Math.abs(_fwd.y) / 0.85, 0, 1);
  if (owl.speed > 3 && levelness > 0) {
    const turnRate = GRAVITY * Math.tan(THREE.MathUtils.clamp(curBank, -1.45, 1.45)) / owl.speed;
    const a = turnRate * dt * levelness;
    const ca = Math.cos(a), sa = Math.sin(a);
    const vx = owl.velocity.x, vz = owl.velocity.z;
    owl.velocity.x = vx * ca + vz * sa;
    owl.velocity.z = -vx * sa + vz * ca;
    owl.obj.rotateOnWorldAxis(_UP_AXIS, a);
  }

  const f = ellipsoidFactor(owl.obj.position);
  if (f > 1) {
    _tmp.copy(owl.obj.position).sub(ARENA_CENTER);
    owl.obj.position.copy(ARENA_CENTER).addScaledVector(_tmp, 1 / f);
  }
  const groundY = effectiveGroundY(owl.obj.position.x, owl.obj.position.z) + OWL_GROUND_CLEAR;
  if (owl.obj.position.y < groundY) {
    owl.obj.position.y = groundY;
    return 'crash';
  }
  return null;
}
