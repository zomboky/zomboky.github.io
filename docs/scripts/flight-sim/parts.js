import * as THREE from '../../three/build/three.module.min.js';

// Repère avion (identique à hibou-3d.html) : nez → -Z, haut → +Y, droite → +X.
// Convention structurelle : chaque pièce attache SANS rotation relative à son
// point d'accroche parent — seule sa position locale varie. Toute la
// géométrie est donc construite directement dans le bon sens (le fuselage
// s'étend le long de Z, une aile le long de X, une dérive le long de Y...),
// ce qui évite d'avoir à composer des quaternions par pièce : seul le groupe
// racine de l'avion tourne, en vol (voir physics.js).

export const MAX_PARTS = 10;

export const CATEGORIES = [
  { id: 'fuselage', label: 'Fuselage' },
  { id: 'nose', label: 'Nez' },
  { id: 'wing', label: 'Aile' },
  { id: 'engine', label: 'Moteur' },
  { id: 'control', label: 'Gouverne' },
];

function box(sx, sy, sz, cx = 0, cy = 0, cz = 0) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  geo.translate(cx, cy, cz);
  return geo;
}

// --- Fuselage : cylindre le long de Z, centré sur son propre repère local ---
function fuselageGeometry(radius, length) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 14);
  geo.rotateX(Math.PI / 2); // l'axe du cylindre (Y par défaut) devient Z
  return geo;
}
function fuselageNodes(radius, length) {
  const half = length / 2;
  return {
    front: [0, 0, -half],
    back: [0, 0, half],
    right: [radius, 0, 0],
    top: [0, radius, 0],
  };
}

// Décalage à appliquer au CENTRE d'une pièce dont la géométrie est centrée
// avec une étendue le long de Z (fuselage, moteur) quand elle est posée sur
// le nœud 'front'/'back' d'un parent : sans ce décalage, son origine (le
// centre) coïnciderait avec la face du parent au lieu de sa propre face
// opposée, provoquant un recouvrement pouvant aller jusqu'à la moitié de sa
// longueur (visible en chaînant deux fuselages). Les pièces dont l'origine
// locale est déjà à leur point d'attache (nez, aile, gouverne — géométrie
// translatée dans leurs fonctions *Geometry ci-dessus) n'ont pas besoin de
// cette méthode et gardent un décalage nul par défaut.
function zExtentMountOffset(length, nodeName) {
  if (nodeName === 'front') return [0, 0, -length / 2];
  if (nodeName === 'back') return [0, 0, length / 2];
  return [0, 0, 0];
}

// --- Nez : cône dont la base plate (le point d'attache) est à l'origine, la pointe vers -Z ---
function noseGeometry(radius, length) {
  const geo = new THREE.ConeGeometry(radius, length, 14);
  geo.rotateX(-Math.PI / 2); // pointe vers -Y par défaut → vers -Z
  geo.translate(0, 0, -length / 2);
  return geo;
}

// --- Aile : s'étend de x=0 (emplanture, le point d'accroche) à x=span (saumon) ---
function wingGeometry(span, chord, thickness) {
  return box(span, thickness, chord, span / 2, 0, 0);
}
function wingNodes(span) {
  return { tip: [span, 0, 0] };
}

// --- Dérive (rudder) : s'étend de y=0 (base, point d'accroche) vers y=height ---
function finGeometry(height, chord, thickness) {
  return box(thickness, height, chord, 0, height / 2, 0);
}

// --- Empennage horizontal / aileron : petite surface plate près de son point d'accroche ---
function smallSurfaceGeometry(span, chord, thickness, dir = 1) {
  return box(span, thickness, chord, (dir * span) / 2, 0, 0);
}

// --- Moteur : nacelle cylindrique centrée sur son point d'accroche ---
function engineGeometry(radius, length) {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.85, length, 12);
  geo.rotateX(Math.PI / 2);
  return geo;
}

export const PART_DEFS = [
  // ── Fuselages : peuvent s'accrocher au nœud 'front' ou 'back' d'un autre
  // fuselage (chaînage), ou être la toute première pièce posée (racine).
  {
    id: 'fuselage-short', category: 'fuselage', label: 'Fuselage court', mass: 40,
    color: 0x8a97a3, mountsTo: ['front', 'back'],
    radius: 0.6, length: 1.6, dragArea: 0.9,
    geometry() { return fuselageGeometry(this.radius, this.length); },
    nodes() { return fuselageNodes(this.radius, this.length); },
    mountOffset(nodeName) { return zExtentMountOffset(this.length, nodeName); },
  },
  {
    id: 'fuselage-long', category: 'fuselage', label: 'Fuselage long', mass: 65,
    color: 0x7d8a96, mountsTo: ['front', 'back'],
    radius: 0.55, length: 3.2, dragArea: 1.1,
    geometry() { return fuselageGeometry(this.radius, this.length); },
    nodes() { return fuselageNodes(this.radius, this.length); },
    mountOffset(nodeName) { return zExtentMountOffset(this.length, nodeName); },
  },
  {
    id: 'fuselage-wide', category: 'fuselage', label: 'Fuselage large', mass: 90,
    color: 0x69747e, mountsTo: ['front', 'back'],
    radius: 0.85, length: 2.0, dragArea: 1.6,
    geometry() { return fuselageGeometry(this.radius, this.length); },
    nodes() { return fuselageNodes(this.radius, this.length); },
    mountOffset(nodeName) { return zExtentMountOffset(this.length, nodeName); },
  },

  // ── Nez : s'accroche au nœud 'front' d'un fuselage, aucun nœud exposé ──
  {
    id: 'nose-pointed', category: 'nose', label: 'Nez pointu', mass: 12,
    color: 0xd7dee4, mountsTo: ['front'],
    radius: 0.6, length: 1.3, dragArea: 0.15,
    geometry() { return noseGeometry(this.radius, this.length); },
    nodes() { return {}; },
  },
  {
    id: 'nose-round', category: 'nose', label: 'Nez arrondi', mass: 16,
    color: 0xc7d6e0, mountsTo: ['front'],
    radius: 0.6, length: 0.6, dragArea: 0.22,
    geometry() {
      const geo = new THREE.SphereGeometry(this.radius, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, -this.radius * 0.15);
      return geo;
    },
    nodes() { return {}; },
  },
  {
    id: 'nose-blunt', category: 'nose', label: 'Nez plat', mass: 10,
    color: 0xbfc9d1, mountsTo: ['front'],
    radius: 0.6, length: 0.5, dragArea: 0.35,
    geometry() {
      const geo = new THREE.CylinderGeometry(this.radius, this.radius * 0.7, this.length, 14);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, -this.length / 2);
      return geo;
    },
    nodes() { return {}; },
  },

  // ── Ailes : s'accrochent au nœud 'right' d'un fuselage, auto-symétrisées
  // (voir aircraft.js), exposent un nœud 'tip' pour les ailerons ──
  {
    id: 'wing-straight', category: 'wing', label: 'Aile droite', mass: 22,
    color: 0x3f7fd1, mountsTo: ['right'], wingArea: 2.6,
    span: 2.4, chord: 1.0, thickness: 0.12,
    geometry() { return wingGeometry(this.span, this.chord, this.thickness); },
    nodes() { return wingNodes(this.span); },
  },
  {
    id: 'wing-swept', category: 'wing', label: 'Aile en flèche', mass: 20,
    color: 0x2f6fc2, mountsTo: ['right'], wingArea: 2.1,
    span: 2.6, chord: 0.85, thickness: 0.1,
    geometry() {
      const geo = wingGeometry(this.span, this.chord, this.thickness);
      geo.translate(0, 0, 0);
      return geo;
    },
    nodes() { return wingNodes(this.span); },
  },
  {
    id: 'wing-delta', category: 'wing', label: 'Aile delta', mass: 26,
    color: 0x1f5aa8, mountsTo: ['right'], wingArea: 2.9,
    span: 2.0, chord: 1.6, thickness: 0.12,
    geometry() { return wingGeometry(this.span, this.chord, this.thickness); },
    nodes() { return wingNodes(this.span); },
  },

  // ── Moteurs : s'accrochent au nœud 'front' ou 'back' d'un fuselage. La
  // poussée pointe toujours vers -Z (nez) dans le repère avion, quel que
  // soit le point de montage. ──
  {
    id: 'engine-prop', category: 'engine', label: 'Hélice', mass: 30,
    color: 0x444444, mountsTo: ['front', 'back'],
    thrust: 1400, spoolRate: 1.4, radius: 0.35, length: 0.7, dragArea: 0.25,
    geometry() { return engineGeometry(this.radius, this.length); },
    nodes() { return {}; },
    mountOffset(nodeName) { return zExtentMountOffset(this.length, nodeName); },
  },
  {
    id: 'engine-jet', category: 'engine', label: 'Réacteur', mass: 55,
    color: 0x2b2b2b, mountsTo: ['front', 'back'],
    thrust: 2600, spoolRate: 0.7, radius: 0.45, length: 1.3, dragArea: 0.4,
    geometry() { return engineGeometry(this.radius, this.length); },
    nodes() { return {}; },
    mountOffset(nodeName) { return zExtentMountOffset(this.length, nodeName); },
  },

  // ── Gouvernes ──
  // Profondeur (élévateur) : s'accroche au nœud 'right' d'un fuselage,
  // agit en tangage, auto-symétrisée comme une aile.
  {
    id: 'control-elevator', category: 'control', label: 'Profondeur', mass: 8,
    color: 0xd9463f, mountsTo: ['right'], wingArea: 0.55, controlAxis: 'pitch', controlGain: 0.32,
    span: 1.1, chord: 0.5, thickness: 0.08,
    geometry() { return wingGeometry(this.span, this.chord, this.thickness); },
    nodes() { return {}; },
  },
  // Direction (dérive) : s'accroche au nœud 'top' d'un fuselage, agit en
  // lacet, non symétrisée (surface verticale unique dans l'axe).
  {
    id: 'control-rudder', category: 'control', label: 'Direction', mass: 7,
    color: 0xd9463f, mountsTo: ['top'], wingArea: 0.5, controlAxis: 'yaw', controlGain: 0.32,
    height: 1.0, chord: 0.55, thickness: 0.08,
    geometry() { return finGeometry(this.height, this.chord, this.thickness); },
    nodes() { return {}; },
  },
  // Aileron : s'accroche au nœud 'tip' d'une aile, agit en roulis, auto-symétrisé.
  {
    id: 'control-aileron', category: 'control', label: 'Aileron', mass: 5,
    color: 0xd9463f, mountsTo: ['tip'], wingArea: 0.3, controlAxis: 'roll', controlGain: 0.32,
    span: 0.5, chord: 0.4, thickness: 0.07,
    geometry() { return smallSurfaceGeometry(this.span, this.chord, this.thickness, -1); },
    nodes() { return {}; },
  },
];

export function getPartDef(id) {
  const def = PART_DEFS.find((p) => p.id === id);
  if (!def) throw new Error(`Pièce inconnue: ${id}`);
  return def;
}

export function partsInCategory(categoryId) {
  return PART_DEFS.filter((p) => p.category === categoryId);
}

// Une pièce mirrorée (aile / profondeur / aileron) compte pour 1 seule pièce
// du budget de MAX_PARTS même si elle produit 2 surfaces physiques.
export function isMirrored(def) {
  return def.mountsTo.includes('right') || def.mountsTo.includes('tip');
}
