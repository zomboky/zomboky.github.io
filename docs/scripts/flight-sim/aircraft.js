import * as THREE from '../../three/build/three.module.min.js';
import { getPartDef, isMirrored } from './parts.js';

// Un "design" est juste { parts: [{ uid, id, parent, node }, ...] } — c'est
// aussi exactement le format sauvegardé/chargé via flight-server (voir
// save.js). `parent` référence l'uid d'une autre pièce (ou null pour la
// racine), `node` le nom du nœud d'accroche utilisé sur cette pièce parente.

let nextUid = 1;
export function makeUid() { return `p${nextUid++}`; }

export function findPart(design, uid) {
  return design.parts.find((p) => p.uid === uid);
}

// Retire une pièce et toute sa descendance (retirer un fuselage retire donc
// tout ce qui est monté dessus ou plus loin dans la chaîne).
export function removePartAndDescendants(design, uid) {
  const toRemove = new Set([uid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of design.parts) {
      if (toRemove.has(p.parent) && !toRemove.has(p.uid)) {
        toRemove.add(p.uid);
        changed = true;
      }
    }
  }
  design.parts = design.parts.filter((p) => !toRemove.has(p.uid));
}

// Position locale "canonique" (côté droit / non-mirrorée) de chaque pièce,
// obtenue en remontant la chaîne des points d'accroche parent → enfant.
export function computeLocalPositions(parts) {
  const byUid = new Map(parts.map((p) => [p.uid, p]));
  const pos = new Map();
  function resolve(uid) {
    if (pos.has(uid)) return pos.get(uid);
    const part = byUid.get(uid);
    if (!part.parent) {
      pos.set(uid, new THREE.Vector3(0, 0, 0));
      return pos.get(uid);
    }
    const parentPos = resolve(part.parent);
    const parentDef = getPartDef(byUid.get(part.parent).id);
    const offset = parentDef.nodes()[part.node] || [0, 0, 0];
    // Pour les pièces dont l'origine locale n'est PAS déjà à leur point
    // d'attache (fuselage/moteur, centrés — voir mountOffset() dans
    // parts.js), il faut aussi décaler par leur propre demi-étendue pour que
    // ce soit leur face, et non leur centre, qui touche le nœud du parent.
    const childDef = getPartDef(part.id);
    const mount = childDef.mountOffset ? childDef.mountOffset(part.node) : [0, 0, 0];
    const v = parentPos.clone()
      .add(new THREE.Vector3(offset[0], offset[1], offset[2]))
      .add(new THREE.Vector3(mount[0], mount[1], mount[2]));
    pos.set(uid, v);
    return v;
  }
  parts.forEach((p) => resolve(p.uid));
  return pos;
}

// Nœuds d'accroche libres actuellement disponibles sur l'avion, pour un nom
// de nœud donné (ex: 'right' pour poser une aile) — utilisé par le hangar
// pour savoir où faire s'accrocher le fantôme de la pièce sélectionnée.
export function freeNodes(design, nodeName) {
  const positions = computeLocalPositions(design.parts);
  const occupied = new Set(design.parts.map((p) => `${p.parent}:${p.node}`));
  const out = [];
  for (const part of design.parts) {
    const def = getPartDef(part.id);
    const nodes = def.nodes();
    if (nodeName in nodes && !occupied.has(`${part.uid}:${nodeName}`)) {
      const offset = nodes[nodeName];
      const worldPos = positions.get(part.uid).clone().add(new THREE.Vector3(offset[0], offset[1], offset[2]));
      out.push({ parentUid: part.uid, node: nodeName, position: worldPos });
    }
  }
  return out;
}

const MIN_INERTIA = 4;
const AIR_DENSITY = 1.2;

// Construit le modèle runtime complet à partir d'un design : Group Three.js
// prêt à afficher + agrégats physiques utilisés par physics.js.
export function buildAircraft(design) {
  const positions = computeLocalPositions(design.parts);
  const group = new THREE.Group();

  const massInstances = []; // { position (Vector3, relatif à l'origine avion), mass }
  const surfaces = [];      // { position, area, axis:'lift'|'side', controlAxis, controlGain, side }
  const engines = [];       // { thrust, spoolRate }
  let dragArea = 0;

  for (const part of design.parts) {
    const def = getPartDef(part.id);
    const canonicalPos = positions.get(part.uid);
    const mirrored = isMirrored(def);
    const sides = mirrored ? [1, -1] : [1];

    for (const side of sides) {
      const pos = new THREE.Vector3(canonicalPos.x * side, canonicalPos.y, canonicalPos.z);
      const mesh = new THREE.Mesh(
        def.geometry(),
        new THREE.MeshStandardMaterial({ color: def.color, metalness: 0.15, roughness: 0.7 }),
      );
      mesh.position.copy(pos);
      mesh.scale.x = side;
      mesh.castShadow = true;
      mesh.userData.partUid = part.uid;
      group.add(mesh);

      massInstances.push({ position: pos, mass: def.mass });
      if (def.dragArea) dragArea += def.dragArea;
      if (def.thrust) engines.push({ thrust: def.thrust, spoolRate: def.spoolRate || 1 });
      if (def.wingArea) {
        surfaces.push({
          position: pos,
          area: def.wingArea,
          axis: def.mountsTo.includes('top') ? 'side' : 'lift',
          controlAxis: def.controlAxis || null,
          controlGain: def.controlGain || 0,
          side,
        });
      }
    }
  }

  const totalMass = massInstances.reduce((s, m) => s + m.mass, 0) || 1;
  const centerOfMass = massInstances
    .reduce((acc, m) => acc.addScaledVector(m.position, m.mass), new THREE.Vector3())
    .divideScalar(totalMass);

  let ipitch = 0, iyaw = 0, iroll = 0;
  for (const m of massInstances) {
    const dx = m.position.x - centerOfMass.x;
    const dy = m.position.y - centerOfMass.y;
    const dz = m.position.z - centerOfMass.z;
    ipitch += m.mass * (dy * dy + dz * dz);
    iyaw += m.mass * (dx * dx + dz * dz);
    iroll += m.mass * (dx * dx + dy * dy);
  }

  for (const s of surfaces) s.position = s.position.clone().sub(centerOfMass);

  // Recentre le Group sur le centre de masse : ainsi group.position peut
  // directement représenter la position du CoM en vol, et les rotations
  // appliquées au Group (voir physics.js) pivotent naturellement autour du
  // CoM plutôt que d'un point arbitraire (la racine de l'arbre de pièces).
  for (const mesh of group.children) mesh.position.sub(centerOfMass);

  const thrustMax = engines.reduce((s, e) => s + e.thrust, 0);
  const spoolRate = engines.length ? engines.reduce((s, e) => s + e.spoolRate, 0) / engines.length : 1;

  // Points d'ancrage du train d'atterrissage : sous le fuselage le plus bas
  // (généré automatiquement, ce n'est pas une pièce du catalogue — voir plan).
  const fuselageParts = design.parts.filter((p) => getPartDef(p.id).category === 'fuselage' || getPartDef(p.id).category === 'nose');
  let lowestRadius = 0.6, frontZ = 0, backZ = 0;
  if (fuselageParts.length) {
    for (const p of fuselageParts) {
      const def = getPartDef(p.id);
      if (def.radius) lowestRadius = Math.max(lowestRadius, def.radius);
    }
    const zs = fuselageParts.map((p) => positions.get(p.uid).z);
    frontZ = Math.min(...zs) - 1.0;
    backZ = Math.max(...zs) + 1.0;
  }
  const gearClearance = lowestRadius + 0.15;
  const gear = [
    new THREE.Vector3(0, -gearClearance, frontZ).sub(centerOfMass),
    new THREE.Vector3(1.1, -gearClearance, backZ).sub(centerOfMass),
    new THREE.Vector3(-1.1, -gearClearance, backZ).sub(centerOfMass),
  ];

  return {
    group,
    mass: totalMass,
    centerOfMass,
    inertia: {
      pitch: Math.max(MIN_INERTIA, ipitch),
      yaw: Math.max(MIN_INERTIA, iyaw),
      roll: Math.max(MIN_INERTIA, iroll),
    },
    surfaces,
    engines,
    thrustMax,
    spoolRate,
    dragArea: Math.max(0.3, dragArea),
    gear,
    gearClearance,
    airDensity: AIR_DENSITY,
    partCount: design.parts.length,
  };
}

export function validateDesign(design) {
  const cats = design.parts.map((p) => getPartDef(p.id).category);
  const errors = [];
  if (!cats.includes('fuselage')) errors.push('Il faut au moins un fuselage.');
  if (!cats.includes('engine')) errors.push('Il faut au moins un moteur.');
  if (!cats.includes('wing')) errors.push('Il faut au moins une aile.');
  return errors;
}
