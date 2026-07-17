'use strict';
// IA de décision — porte fidèlement updateBotAI (docs/hibou-3d.html
// L.3912-4079), généralisée à deux combattants symétriques (self vs opponent)
// au lieu de bot vs joueur, et PARAMÉTRÉE par le génome complet à 14 gènes
// (les 9 d'origine + 5 extensions : extendDist, extendClimb, jinkAmplitude,
// breakPerpWeight, aggressionBias — voir genome.js).
import * as THREE from 'three';
import { STALL_RECOVER, MP_BULLET_SPEED, BOT_PROBE_TIMES, ARENA_CENTER, OWL_GROUND_CLEAR } from './constants.js';
import { effectiveGroundY } from './terrain.js';
import { ellipsoidFactor, botClampTarget } from './arena.js';
import { rnd } from './util.js';

const _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _right = new THREE.Vector3();
const _steer = new THREE.Vector3(), _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3();

export function updateAI(self, opponent, dt) {
  const t = self.tuning;
  self.aiTimer -= dt; self.stateTimer -= dt; self.breakCooldown -= dt;
  const distToOpp = self.obj.position.distanceTo(opponent.obj.position);

  const q = self.obj.quaternion;
  _fwd.set(0, 0, -1).applyQuaternion(q);
  _up.set(0, 1, 0).applyQuaternion(q);
  _right.set(1, 0, 0).applyQuaternion(q);
  const bank = Math.asin(THREE.MathUtils.clamp(_right.y, -1, 1));

  if (self.aiTimer <= 0) {
    self.aiTimer = t.aiTickInterval;

    _tmp.copy(self.obj.position).sub(opponent.obj.position);
    _tmp2.set(0, 0, -1).applyQuaternion(opponent.obj.quaternion);
    const underAim = distToOpp < 200 &&
      _tmp.dot(_tmp2) / Math.max(distToOpp, 1) > Math.cos(THREE.MathUtils.degToRad(14));

    const locked = (self.aiState === 'break' || self.aiState === 'extend') && self.stateTimer > 0 && !self.hitReact;
    if (!locked) {
      const breakThreshold = THREE.MathUtils.clamp(t.breakChance - t.aggressionBias, 0, 1);
      if (self.life <= t.evadeLifeThreshold) {
        self.aiState = 'evade';
      } else if ((underAim || self.hitReact) && self.breakCooldown <= 0 && Math.random() < breakThreshold) {
        self.aiState = 'break';
        self.stateTimer = rnd(1.4, 2.2);
        self.breakCooldown = rnd(3.5, 6);
        self.jinkSign = Math.random() < 0.5 ? -1 : 1;
        self.jinkTimer = 0;
      } else if (distToOpp < t.extendDist) {
        self.aiState = 'extend';
        self.stateTimer = rnd(2, 3);
      } else {
        self.aiState = 'approach';
      }
    }
    self.hitReact = false;

    if (self.aiState === 'approach') {
      const tof = distToOpp / MP_BULLET_SPEED;
      self.targetPoint.copy(opponent.obj.position).addScaledVector(opponent.velocity, tof * t.leadFactor);
    } else if (self.aiState === 'extend') {
      _tmp.copy(self.velocity).setY(0);
      if (_tmp.lengthSq() < 1) _tmp.copy(_fwd).setY(0);
      if (_tmp.lengthSq() < 1e-4) _tmp.set(0, 0, -1);
      _tmp.normalize();
      self.targetPoint.copy(self.obj.position).addScaledVector(_tmp, 130);
      self.targetPoint.y += t.extendClimb;
    } else if (self.aiState === 'break') {
      _tmp.copy(self.obj.position).sub(opponent.obj.position).setY(0);
      if (_tmp.lengthSq() < 1e-4) _tmp.set(1, 0, 0);
      _tmp.normalize();
      _tmp2.set(-_tmp.z, 0, _tmp.x).multiplyScalar(self.jinkSign * t.breakPerpWeight);
      self.targetPoint.copy(self.obj.position).addScaledVector(_tmp2, 90).addScaledVector(_tmp, 30);
      self.targetPoint.y += rnd(-10, 22);
    } else { // evade
      _tmp.copy(self.obj.position).sub(opponent.obj.position).setY(0);
      if (_tmp.lengthSq() < 1e-4) _tmp.set(1, 0, 0);
      _tmp.normalize();
      self.targetPoint.copy(self.obj.position).addScaledVector(_tmp, 150);
    }
    botClampTarget(self.targetPoint);
    self.stats.stateTime[self.aiState] = (self.stats.stateTime[self.aiState] || 0) + t.aiTickInterval;
  }

  _steer.copy(self.targetPoint).sub(self.obj.position);
  if (_steer.lengthSq() < 1) _steer.copy(_fwd);
  _steer.normalize();

  if ((self.aiState === 'break' || self.aiState === 'evade') && t.jinkPeriod > 0) {
    self.jinkTimer -= dt;
    if (self.jinkTimer <= 0) { self.jinkTimer = t.jinkPeriod * rnd(0.7, 1.3); self.jinkSign = -self.jinkSign; }
    _steer.addScaledVector(_right, self.jinkSign * t.jinkAmplitude).normalize();
  }

  _tmp.copy(self.obj.position).addScaledVector(self.velocity, 2.2);
  const fPred = ellipsoidFactor(_tmp);
  if (fPred > 0.86) {
    const w = Math.min(0.9, (fPred - 0.86) * 9);
    _tmp2.copy(ARENA_CENTER).sub(self.obj.position).normalize();
    _steer.lerp(_tmp2, w).normalize();
  }

  const side = _steer.dot(_right);
  let yawIn = THREE.MathUtils.clamp(-side * 2.5, -1, 1);
  let pitchIn = THREE.MathUtils.clamp(_steer.dot(_up) * 3, -1, 1);
  const wantBank = THREE.MathUtils.clamp(-side * 1.6, -1.05, 1.05);
  let rollIn = THREE.MathUtils.clamp((wantBank - bank) * 2.5, -1, 1);

  let urgency = 0;
  for (const pt of BOT_PROBE_TIMES) {
    const gy = effectiveGroundY(self.obj.position.x + self.velocity.x * pt, self.obj.position.z + self.velocity.z * pt);
    const deficit = gy + OWL_GROUND_CLEAR + 5 + 7 * pt - (self.obj.position.y + self.velocity.y * pt);
    if (deficit / 18 > urgency) urgency = deficit / 18;
  }
  urgency = Math.min(1, urgency);
  if (urgency > 0) {
    _tmp.copy(self.velocity).setY(0);
    if (_tmp.lengthSq() < 1) _tmp.copy(_fwd).setY(0);
    if (_tmp.lengthSq() < 1e-4) _tmp.set(0, 0, -1);
    _tmp.normalize();
    const lookD = Math.max(35, self.speed * 1.6);
    const c = Math.cos(0.87), s = Math.sin(0.87);
    const gL = effectiveGroundY(self.obj.position.x + (_tmp.x * c + _tmp.z * s) * lookD, self.obj.position.z + (-_tmp.x * s + _tmp.z * c) * lookD);
    const gR = effectiveGroundY(self.obj.position.x + (_tmp.x * c - _tmp.z * s) * lookD, self.obj.position.z + (_tmp.x * s + _tmp.z * c) * lookD);
    const escape = gL < gR ? 1 : -1;
    pitchIn = THREE.MathUtils.lerp(pitchIn, 1, urgency);
    yawIn = THREE.MathUtils.lerp(yawIn, escape * 0.6, urgency);
    rollIn = THREE.MathUtils.lerp(rollIn, THREE.MathUtils.clamp((escape * 0.3 - bank) * 2.5, -1, 1), urgency);
  }

  if (self.speed < STALL_RECOVER) pitchIn = Math.min(pitchIn, 0.45);
  if (self.stallMode) {
    yawIn = 0; pitchIn = 0;
    rollIn = THREE.MathUtils.clamp(-bank * 3, -1, 1);
  }

  self._flightInput = { yawIn, pitchIn, rollIn, thrustHeld: true, brakeHeld: false };
  if (!(urgency > 0 || self.stallMode)) self._throttleCap = t.throttleCap; else self._throttleCap = 1;

  const aimable = self.aiState === 'approach' && urgency <= 0.25 && !self.stallMode;
  _tmp.copy(opponent.obj.position)
    .addScaledVector(opponent.velocity, (distToOpp / MP_BULLET_SPEED) * t.leadFactor)
    .sub(self.obj.position).normalize();
  const aimAngle = Math.acos(THREE.MathUtils.clamp(_fwd.dot(_tmp), -1, 1));
  if (aimable && distToOpp < t.fireDist && aimAngle < t.aimConeRad) {
    self.fireIntentTimer += dt;
  } else {
    self.fireIntentTimer = 0;
  }
  self.wantsToFire = aimable && self.fireIntentTimer >= t.reactionDelay;
}
