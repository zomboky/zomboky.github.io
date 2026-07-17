'use strict';
// Fabrique d'état d'un hibou combattant — équivalent headless de l'objet `bot`
// construit par spawnBotEntity()/botRespawn() dans docs/hibou-3d.html
// (L.3672-3718), sans le visuel (obj est un THREE.Object3D nu, pas de sprite).
import * as THREE from 'three';
import { ARENA_CENTER, ARENA_RADIUS_XZ, LIFE_MAX, MP_MAG_CAP, CRUISE_THROTTLE, MAX_SPEED } from './constants.js';
import { effectiveGroundY } from './terrain.js';
import { rnd } from './util.js';

let _nextId = 1;

export function createOwl(name, tuning) {
  return {
    id: _nextId++, name, tuning,
    obj: new THREE.Object3D(),
    velocity: new THREE.Vector3(), angRate: new THREE.Vector3(),
    speed: 0, throttle: 0, stallMode: false, stallTimer: 0,
    life: LIFE_MAX, governEff: { leftWing: 0, rightWing: 0, tail: 0 },
    ammo: MP_MAG_CAP, fireAccum: 0,
    alive: true, invul: 0, respawnTimer: 0,
    degradeAccum: 0, lastHitTime: 0, repairProgress: 0,
    aiState: 'approach', aiTimer: 0, targetPoint: new THREE.Vector3(),
    fireIntentTimer: 0, wantsToFire: false,
    stateTimer: 0, breakCooldown: 0, jinkTimer: 0, jinkSign: 1, hitReact: false,
    // Métriques de match — collectées pour le fitness/diversité (voir simulation.js)
    stats: { kills: 0, deaths: 0, crashes: 0, shotsFired: 0, shotsHit: 0, damageDealt: 0, damageTaken: 0, stateTime: { approach: 0, extend: 0, break: 0, evade: 0 } },
  };
}

// Point de spawn autour d'un centre donné (à `dist` de distance), même esprit
// que botRespawn() (L.3695-3717) mais sans dépendre d'un joueur local fixe.
export function respawnOwl(owl, aroundPos, simTime) {
  const angle = rnd(0, Math.PI * 2);
  const dist = rnd(60, 140);
  const cx = aroundPos ? aroundPos.x : ARENA_CENTER.x;
  const cz = aroundPos ? aroundPos.z : ARENA_CENTER.z;
  const x = cx + Math.cos(angle) * dist;
  const z = cz + Math.sin(angle) * dist;
  owl.obj.position.set(x, effectiveGroundY(x, z) + rnd(25, 60), z);
  owl.obj.quaternion.identity();
  owl.obj.rotateY(rnd(0, Math.PI * 2));
  owl.speed = MAX_SPEED * 0.55;
  owl.velocity.set(0, 0, -owl.speed).applyQuaternion(owl.obj.quaternion);
  owl.angRate.set(0, 0, 0);
  owl.throttle = CRUISE_THROTTLE;
  owl.stallMode = false; owl.stallTimer = 0;
  owl.life = LIFE_MAX;
  owl.governEff.leftWing = 0; owl.governEff.rightWing = 0; owl.governEff.tail = 0;
  owl.degradeAccum = 0; owl.repairProgress = 0;
  owl.lastHitTime = simTime;
  owl.ammo = MP_MAG_CAP; owl.fireAccum = 0;
  owl.alive = true; owl.invul = 90;
  owl.aiState = 'approach'; owl.aiTimer = 0; owl.fireIntentTimer = 0; owl.wantsToFire = false;
  owl.stateTimer = 0; owl.breakCooldown = 0; owl.jinkTimer = 0; owl.jinkSign = 1; owl.hitReact = false;
}

// Point de spawn initial aléatoire dans l'arène (équivalent mpSpawnLocalOwl, L.3542-3567).
export function spawnOwlInArena(owl, simTime) {
  const angle = rnd(0, Math.PI * 2);
  const dist = rnd(0, ARENA_RADIUS_XZ * 0.75);
  const x = ARENA_CENTER.x + Math.cos(angle) * dist;
  const z = ARENA_CENTER.z + Math.sin(angle) * dist;
  owl.obj.position.set(x, effectiveGroundY(x, z) + rnd(25, 60), z);
  owl.obj.quaternion.identity();
  owl.obj.rotateY(rnd(0, Math.PI * 2));
  owl.speed = MAX_SPEED * 0.55;
  owl.velocity.set(0, 0, -owl.speed).applyQuaternion(owl.obj.quaternion);
  owl.angRate.set(0, 0, 0);
  owl.throttle = CRUISE_THROTTLE;
  owl.stallMode = false; owl.stallTimer = 0;
  owl.life = LIFE_MAX;
  owl.governEff.leftWing = 0; owl.governEff.rightWing = 0; owl.governEff.tail = 0;
  owl.degradeAccum = 0; owl.repairProgress = 0;
  owl.lastHitTime = simTime;
  owl.ammo = MP_MAG_CAP; owl.fireAccum = 0;
  owl.alive = true; owl.invul = 90;
  owl.aiState = 'approach'; owl.aiTimer = 0; owl.fireIntentTimer = 0; owl.wantsToFire = false;
  owl.stateTimer = 0; owl.breakCooldown = 0; owl.jinkTimer = 0; owl.jinkSign = 1; owl.hitReact = false;
}
