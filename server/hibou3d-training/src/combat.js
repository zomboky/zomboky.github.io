'use strict';
// Combat headless — porte docs/hibou-3d.html L.3295-3377 (balles/hit detection),
// L.3312-3325 (classifyHitLocation), L.3720-3777 (dégâts/réparation). Pas de
// sprites : une balle est un objet plain { pos, vel, owner, life }.
import * as THREE from 'three';
import {
  OWL_HITBOX, OWL_COLLIDE_RADIUS, MP_BULLET_SPEED, MP_BULLET_LIFE, MP_FIRE_RATE,
  CRIT_CHANCE, GOVERN_FIRST_HIT_MIN, GOVERN_FIRST_HIT_MAX, GOVERN_REPEAT_HIT_ADD,
  GOVERN_DEGRADE_INTERVAL, GOVERN_DEGRADE_CHANCE, GOVERN_DEGRADE_STEP,
  REPAIR_TIME, LIFE_MAX,
} from './constants.js';
import { effectiveGroundY } from './terrain.js';
import { rnd } from './util.js';

export function spawnBullet(bullets, originPos, dir, owner) {
  bullets.push({ pos: originPos.clone(), vel: dir.clone().multiplyScalar(MP_BULLET_SPEED), owner, life: MP_BULLET_LIFE });
}

const _hitLocal = new THREE.Vector3();
function classifyHitLocation(targetObj, worldPos) {
  _hitLocal.copy(worldPos);
  targetObj.worldToLocal(_hitLocal);
  if (Math.abs(_hitLocal.x) > OWL_HITBOX.w * 0.2) {
    return _hitLocal.x > 0 ? 'right-wing' : 'left-wing';
  }
  if (_hitLocal.z < -OWL_HITBOX.d * 0.15 && _hitLocal.y > -OWL_HITBOX.h * 0.1) return 'head';
  if (_hitLocal.z > OWL_HITBOX.d * 0.3) return 'tail';
  return 'body';
}

const _segA = new THREE.Vector3(), _segAB = new THREE.Vector3(), _segClosest = new THREE.Vector3();
function segmentDistanceTo(center, a, b) {
  _segAB.copy(b).sub(a);
  const len2 = _segAB.lengthSq();
  let t = 0;
  if (len2 > 1e-8) t = THREE.MathUtils.clamp(_segClosest.copy(center).sub(a).dot(_segAB) / len2, 0, 1);
  _segClosest.copy(a).addScaledVector(_segAB, t);
  return _segClosest.distanceTo(center);
}

// Applique les dégâts d'un impact sur `victim` — miroir de botTakeHit/onMPHitMe
// (L.3721-3743). Retourne 'headshot' | 'shot' | null (impact absorbé sans mort).
export function applyHit(victim, location, simTime) {
  if (!victim.alive || victim.invul > 0) return null;
  victim.lastHitTime = simTime;
  victim.hitReact = true;
  victim.stats.damageTaken++;

  if (location === 'head') return 'headshot';

  victim.life--;
  if (Math.random() < CRIT_CHANCE) victim.life--;

  const govPart = location === 'left-wing' ? 'leftWing' : location === 'right-wing' ? 'rightWing' : location === 'tail' ? 'tail' : null;
  if (govPart) {
    if (victim.governEff[govPart] > 0) victim.governEff[govPart] = Math.min(1, victim.governEff[govPart] + GOVERN_REPEAT_HIT_ADD);
    else victim.governEff[govPart] = rnd(GOVERN_FIRST_HIT_MIN, GOVERN_FIRST_HIT_MAX);
  }

  return victim.life <= 0 ? 'shot' : null;
}

// Dégradation périodique + réparation passive — miroir de updateBotDamage (L.3756-3777).
export function updateDamage(owl, dt, simTime) {
  const damaged = owl.life < LIFE_MAX || owl.governEff.leftWing > 0 || owl.governEff.rightWing > 0 || owl.governEff.tail > 0;
  if (!damaged) { owl.repairProgress = 0; return; }

  owl.degradeAccum += dt;
  if (owl.degradeAccum >= GOVERN_DEGRADE_INTERVAL) {
    owl.degradeAccum -= GOVERN_DEGRADE_INTERVAL;
    for (const part of ['leftWing', 'rightWing', 'tail']) {
      if (owl.governEff[part] > 0 && owl.governEff[part] < 1 && Math.random() < GOVERN_DEGRADE_CHANCE) {
        owl.governEff[part] = Math.min(1, owl.governEff[part] + GOVERN_DEGRADE_STEP);
      }
    }
  }

  owl.repairProgress = THREE.MathUtils.clamp((simTime - owl.lastHitTime) / REPAIR_TIME, 0, 1);
  if (owl.repairProgress >= 1) {
    owl.life = LIFE_MAX;
    owl.governEff.leftWing = 0; owl.governEff.rightWing = 0; owl.governEff.tail = 0;
    owl.degradeAccum = 0; owl.repairProgress = 0;
    owl.lastHitTime = simTime;
  }
}

// Avance toutes les balles d'un match à 2 combattants et applique les impacts.
// `onDeath(victim, cause)` est appelé quand un impact tue la cible.
export function updateBullets(bullets, owlA, owlB, dt, simTime, onDeath) {
  const hitRadius = Math.max(1.3, OWL_COLLIDE_RADIUS * 2.5);
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    _segA.copy(b.pos);
    b.pos.addScaledVector(b.vel, dt);

    if (b.pos.y < effectiveGroundY(b.pos.x, b.pos.z)) { bullets.splice(i, 1); continue; }
    if (b.life <= 0) { bullets.splice(i, 1); continue; }

    const target = b.owner === owlA.id ? owlB : owlA;
    if (!target.alive) continue;
    if (segmentDistanceTo(target.obj.position, _segA, b.pos) > hitRadius) continue;

    const location = classifyHitLocation(target.obj, b.pos);
    const shooter = b.owner === owlA.id ? owlA : owlB;
    shooter.stats.shotsHit++;
    const cause = applyHit(target, location, simTime);
    if (cause) onDeath(target, shooter, cause);
    bullets.splice(i, 1);
  }
}

// Tir d'un owl — miroir de updateBotFire (L.3084-4102), paramétré par tuning.aimConeRad.
const _fireDir = new THREE.Vector3(), _firePos = new THREE.Vector3();
export function updateFire(owl, bullets, dt) {
  if (!owl.wantsToFire || owl.ammo <= 0) { owl.fireAccum = 0; return; }
  owl.fireAccum += dt * MP_FIRE_RATE;
  const n = Math.min(Math.floor(owl.fireAccum), owl.ammo, 6);
  owl.fireAccum -= Math.floor(owl.fireAccum);
  if (n <= 0) return;
  const jitter = owl.tuning.aimConeRad * 0.6;
  _fireDir.set(0, 0, -1).applyQuaternion(owl.obj.quaternion);
  _fireDir.x += rnd(-jitter, jitter);
  _fireDir.y += rnd(-jitter, jitter);
  _fireDir.normalize();
  _firePos.set(0, -0.28, -0.9);
  owl.obj.localToWorld(_firePos);
  for (let i = 0; i < n; i++) {
    spawnBullet(bullets, _firePos, _fireDir, owl.id);
    owl.stats.shotsFired++;
  }
}
