import * as THREE from '../../three/build/three.module.min.js';

// Moteur de vol : généralise le modèle newtonien de hibou-3d.html (poids /
// poussée / portance / traînée, décrochage, intégration semi-implicite) à un
// avion assemblé pièce par pièce. Différence clé : au lieu d'un taux de
// rotation directement commandé, les gouvernes génèrent une vraie PORTANCE
// (Cl(incidence) · q · surface) appliquée à leur position réelle sur
// l'avion ; le COUPLE qui en résulte (bras de levier autour du centre de
// masse) pilote la rotation via l'inertie de l'avion — l'autorité d'une
// gouverne dépend donc naturellement de son éloignement du centre de masse,
// comme sur un vrai avion.

export const GRAVITY = 9.8;
const CL_MAX = 1.7;
const STALL_AOA = THREE.MathUtils.degToRad(20);
const PARASITE_DRAG_COEFF = 0.06;
const INDUCED_DRAG_K = 0.045;
const MAX_SPEED = 70;
const ANGULAR_DAMPING = 5.5; // 1/s — amortissement aérodynamique des rotations

const GROUND_FRICTION_DECEL = 0.6; // m/s² — frottement de roulement du train (coefficient ~0.06·g)
const ROTATE_SPEED = 12; // vitesse sol à partir de laquelle la profondeur reprend la main sur le tangage
const GROUND_LEVEL_RATE = 9; // vitesse de recentrage pitch/roll au sol
const MIN_AERO_SPEED = 3; // en dessous, l'incidence/le dérapage ne sont pas définis (bruit de vitesse verticale au roulage)

const _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _right = new THREE.Vector3();
const _dq = new THREE.Quaternion();

function liftCoefficient(angle) {
  const abs = Math.abs(angle);
  if (abs <= STALL_AOA) return CL_MAX * (angle / STALL_AOA);
  const over = Math.min(1, (abs - STALL_AOA) / STALL_AOA);
  return Math.sign(angle) * CL_MAX * (1 - 0.75 * over);
}

export function createFlightState(spawnPosition, spawnQuaternion) {
  return {
    position: spawnPosition.clone(),
    velocity: new THREE.Vector3(0, 0, 0),
    quaternion: spawnQuaternion.clone(),
    angVel: new THREE.Vector3(0, 0, 0),
    throttle: 0,
    onGround: true,
    stalling: false,
    aoa: 0,
    airspeed: 0,
  };
}

// input = { pitch, yaw, roll ∈ [-1,1], throttleUp: bool, brake: bool }
export function stepFlight(state, aircraft, input, dt, groundY = 0) {
  const q = state.quaternion;
  _fwd.set(0, 0, -1).applyQuaternion(q);
  _up.set(0, 1, 0).applyQuaternion(q);
  _right.set(1, 0, 0).applyQuaternion(q);

  // ── Régime moteur : monte/descend progressivement vers la consigne ──
  const spool = aircraft.spoolRate * 1.4;
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + spool * dt);
  if (input.brake) state.throttle = Math.max(0, state.throttle - spool * 1.5 * dt);

  const v = state.velocity.length();
  const vFwd = state.velocity.dot(_fwd);
  const vUp = state.velocity.dot(_up);
  const vRight = state.velocity.dot(_right);
  const aoa = v > MIN_AERO_SPEED ? Math.atan2(-vUp, Math.abs(vFwd) + 1e-3) : 0;
  const beta = v > MIN_AERO_SPEED ? Math.atan2(vRight, Math.abs(vFwd) + 1e-3) : 0;
  const q_dyn = 0.5 * aircraft.airDensity * v * v;

  const force = new THREE.Vector3(0, -aircraft.mass * GRAVITY, 0);
  const torque = new THREE.Vector3(0, 0, 0);

  force.addScaledVector(_fwd, state.throttle * aircraft.thrustMax);

  let maxCl = 0;
  for (const s of aircraft.surfaces) {
    let effAngle;
    // Une gouverne à l'arrière du centre de masse doit RÉDUIRE sa portance
    // pour cabrer (bras de levier : moins de portance à l'arrière = le nez
    // se lève, comme une bascule) — d'où le signe opposé à l'arrière. Une
    // gouverne hypothétiquement montée à l'avant aurait le comportement
    // inverse (canard), géré naturellement par ce même calcul de signe.
    const aftSign = s.position.z >= 0 ? -1 : 1;
    if (s.axis === 'lift') {
      effAngle = aoa;
      if (s.controlAxis === 'pitch') effAngle += input.pitch * s.controlGain * aftSign;
      if (s.controlAxis === 'roll') effAngle -= input.roll * s.controlGain * s.side;
    } else {
      effAngle = beta;
      if (s.controlAxis === 'yaw') effAngle += input.yaw * s.controlGain * aftSign;
    }
    const cl = liftCoefficient(effAngle);
    if (s.axis === 'lift') maxCl = Math.max(maxCl, Math.abs(cl));
    const forceMag = cl * q_dyn * s.area;
    const dir = s.axis === 'lift' ? _up : _right;
    const surfaceForce = dir.clone().multiplyScalar(forceMag);
    force.add(surfaceForce);

    if (v > 1e-3) {
      const inducedDrag = INDUCED_DRAG_K * cl * cl * q_dyn * s.area;
      force.addScaledVector(state.velocity, -inducedDrag / v);
    }

    const rWorld = s.position.clone().applyQuaternion(q);
    torque.add(rWorld.clone().cross(surfaceForce));
  }
  state.stalling = maxCl > 0 && Math.abs(aoa) > STALL_AOA;

  if (v > 1e-3) {
    const parasiteDrag = PARASITE_DRAG_COEFF * q_dyn * aircraft.dragArea;
    force.addScaledVector(state.velocity, -parasiteDrag / v);
  }

  force.divideScalar(aircraft.mass);
  state.velocity.addScaledVector(force, dt);
  if (state.velocity.lengthSq() > MAX_SPEED * MAX_SPEED) state.velocity.setLength(MAX_SPEED);

  // ── Rotation : couple / inertie, amorti (voir en-tête du fichier) ──
  const torqueLocal = torque.clone().applyQuaternion(q.clone().invert());
  const angAcc = new THREE.Vector3(
    torqueLocal.x / aircraft.inertia.pitch - ANGULAR_DAMPING * state.angVel.x,
    torqueLocal.y / aircraft.inertia.yaw - ANGULAR_DAMPING * state.angVel.y,
    torqueLocal.z / aircraft.inertia.roll - ANGULAR_DAMPING * state.angVel.z,
  );
  state.angVel.addScaledVector(angAcc, dt);

  // ── Intégration position/vitesse puis orientation (Euler semi-implicite) ──
  state.position.addScaledVector(state.velocity, dt);

  _dq.setFromAxisAngle(new THREE.Vector3(1, 0, 0), state.angVel.x * dt); q.multiply(_dq);
  _dq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.angVel.y * dt); q.multiply(_dq);
  _dq.setFromAxisAngle(new THREE.Vector3(0, 0, 1), state.angVel.z * dt); q.multiply(_dq);
  q.normalize();

  // ── Contact sol / train d'atterrissage ──
  let minGearY = Infinity;
  for (const gearOffset of aircraft.gear) {
    const worldY = state.position.y + gearOffset.clone().applyQuaternion(q).y;
    minGearY = Math.min(minGearY, worldY);
  }
  state.onGround = minGearY <= groundY + 1e-3;

  if (state.onGround) {
    const penetration = groundY - minGearY;
    if (penetration > 0) state.position.y += penetration;
    if (state.velocity.y < 0) state.velocity.y = 0;

    const groundSpeed = Math.hypot(state.velocity.x, state.velocity.z);
    if (groundSpeed > 0.05) {
      const decel = Math.min(GROUND_FRICTION_DECEL * dt, groundSpeed);
      const scale = (groundSpeed - decel) / groundSpeed;
      state.velocity.x *= scale;
      state.velocity.z *= scale;
    }

    // Nez et ailes restent à plat au roulage ; le tangage redevient
    // progressivement libre (contrôlé par la profondeur) à l'approche de la
    // vitesse de rotation, plutôt qu'un déverrouillage brutal qui ferait
    // décrocher l'avion en cabrant trop vite dès le seuil franchi.
    const levelK = 1 - Math.exp(-GROUND_LEVEL_RATE * dt);
    state.angVel.z = THREE.MathUtils.lerp(state.angVel.z, 0, levelK);
    const pitchLock = THREE.MathUtils.clamp(1 - groundSpeed / ROTATE_SPEED, 0, 1);
    state.angVel.x = THREE.MathUtils.lerp(state.angVel.x, 0, levelK * pitchLock);
    // Direction assistée au sol (roulette de nez), s'estompe avec la vitesse.
    const steerFactor = Math.max(0, 1 - groundSpeed / ROTATE_SPEED);
    state.angVel.y += input.yaw * 1.6 * steerFactor * dt;
  }

  state.aoa = aoa;
  state.airspeed = state.velocity.length();
  return state;
}
