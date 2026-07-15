import * as THREE from '../../three/build/three.module.min.js';
import { createBuilder } from './builder.js';
import { buildAircraft, validateDesign } from './aircraft.js';
import { createFlightState, stepFlight } from './physics.js';
import { createWorld, SPAWN_X, SPAWN_Z, GROUND_Y } from './world.js';
import * as hud from './hud.js';
import { saveDesign, loadDesign as fetchDesign } from './save.js';
import { createTouchControls, isTouchDevice } from './touch-controls.js';

const STATE = { HANGAR: 'hangar', FLIGHT: 'flight' };
let appState = STATE.HANGAR;

const canvas = document.getElementById('flight-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1218);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(6, 4, 7);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x2a2a20, 0.7));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Hangar ──
const builder = createBuilder({
  scene, camera, canvas,
  onChange(design, built) {
    hud.updateHangarStats(built, design, validateDesign(design));
    hud.setHint(design.parts.length && !builder.hasMarkers() && document.querySelector('.part-btn.selected')
      ? "Cette pièce n'a nulle part où s'accrocher sur l'avion actuel." : '');
  },
  onSelectPlaced(uid) { hud.updateSelectionUI(!!uid); },
});
hud.buildPalette((defId) => builder.selectPart(defId));
builder.show();
camera.position.set(6, 4, 7);
hud.updateHangarStats(buildAircraft(builder.getDesign()), builder.getDesign(), validateDesign(builder.getDesign()));

document.getElementById('btn-remove').addEventListener('click', () => builder.removeSelected());
document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('Recommencer un nouvel avion ? La construction actuelle sera perdue.')) builder.resetDesign();
});
document.getElementById('btn-save').addEventListener('click', () => {
  hud.showSaveCode('Sauvegarde en cours…');
  saveDesign(builder.getDesign())
    .then((res) => hud.showSaveCode(res.code))
    .catch((err) => hud.showSaveError(`Échec : ${err.message}`));
});
document.getElementById('btn-copy-code').addEventListener('click', () => {
  const code = document.getElementById('save-code').textContent;
  if (code && navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
});
document.getElementById('btn-load-toggle').addEventListener('click', () => hud.toggleLoadPanel(true));
document.getElementById('btn-load-confirm').addEventListener('click', () => {
  const code = document.getElementById('load-code-input').value;
  if (!code.trim()) return;
  fetchDesign(code)
    .then((res) => { builder.loadDesign({ parts: res.parts }); hud.toggleLoadPanel(false); })
    .catch((err) => alert(`Impossible de charger cet avion : ${err.message}`));
});
document.getElementById('btn-fly').addEventListener('click', () => enterFlight());
document.getElementById('btn-back-hangar').addEventListener('click', () => enterHangar());

// Panneau hangar rétractable : replié par défaut sur petit écran / tactile,
// où il recouvre trop de la vue 3D nécessaire pour taper sur les markers.
const hangarUi = document.getElementById('hangar-ui');
const hangarToggle = document.getElementById('hangar-toggle');
if (window.innerWidth < 640 || isTouchDevice()) hangarUi.classList.add('collapsed');
hangarToggle.addEventListener('click', () => hangarUi.classList.toggle('collapsed'));

// ── Contrôles tactiles (vol) ──
const touch = isTouchDevice() ? createTouchControls({ mount: document.getElementById('flight-hud') }) : null;

// ── Monde + vol ──
let world = null;
let flightRig = null;
let aircraftRuntime = null;
let flightState = null;

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
}

function enterFlight() {
  if (validateDesign(builder.getDesign()).length) return;
  if (!world) { world = createWorld(); scene.add(world.group); scene.background = new THREE.Color(world.skyColor); }
  world.group.visible = true;
  builder.hide();

  aircraftRuntime = buildAircraft(builder.getDesign());
  flightRig = new THREE.Group();
  flightRig.add(aircraftRuntime.group);
  scene.add(flightRig);

  const lowestGearY = Math.min(...aircraftRuntime.gear.map((g) => g.y));
  const spawnPos = new THREE.Vector3(SPAWN_X, GROUND_Y - lowestGearY + 0.03, SPAWN_Z);
  flightState = createFlightState(spawnPos, new THREE.Quaternion());

  document.getElementById('hangar-ui').hidden = true;
  document.getElementById('hangar-toggle').hidden = true;
  document.getElementById('flight-hud').hidden = false;
  appState = STATE.FLIGHT;
  touch?.show();
}

function enterHangar() {
  if (flightRig) { scene.remove(flightRig); disposeGroup(flightRig); flightRig = null; }
  if (world) world.group.visible = false;
  scene.background = new THREE.Color(0x0e1218);
  document.getElementById('hangar-ui').hidden = false;
  document.getElementById('hangar-toggle').hidden = false;
  document.getElementById('flight-hud').hidden = true;
  builder.show();
  appState = STATE.HANGAR;
  touch?.hide();
}

// ── Contrôles clavier ──
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  if (e.key === 'Escape' && appState === STATE.FLIGHT) enterHangar();
  if (e.key === 'Delete' || e.key === 'Backspace') { if (appState === STATE.HANGAR) builder.removeSelected(); }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function readInput() {
  const kb = {
    pitch: (keys['arrowup'] || keys['z'] ? 1 : 0) - (keys['arrowdown'] || keys['s'] ? 1 : 0),
    roll: (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['q'] ? 1 : 0),
    yaw: (keys['e'] ? 1 : 0) - (keys['a'] ? 1 : 0),
    throttleUp: !!keys[' '],
    brake: !!keys['shift'],
  };
  if (!touch) return kb;
  const t = touch.getInput();
  return {
    pitch: THREE.MathUtils.clamp(kb.pitch + t.pitch, -1, 1),
    roll: THREE.MathUtils.clamp(kb.roll + t.roll, -1, 1),
    yaw: THREE.MathUtils.clamp(kb.yaw + t.yaw, -1, 1),
    throttleUp: kb.throttleUp || t.throttleUp,
    brake: kb.brake || t.brake,
  };
}

// ── Caméra poursuite (vol) ──
const _camDesired = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
function updateChaseCamera(dt) {
  _fwd.set(0, 0, -1).applyQuaternion(flightState.quaternion);
  _up.set(0, 1, 0).applyQuaternion(flightState.quaternion);
  _camDesired.copy(flightState.position)
    .addScaledVector(_fwd, -9)
    .addScaledVector(_up, 3);
  camera.position.lerp(_camDesired, Math.min(1, dt * 3.5));
  camera.lookAt(flightState.position.clone().addScaledVector(_up, 0.6));
}

// ── Boucle ──
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  if (appState === STATE.HANGAR) {
    builder.update(dt);
  } else if (appState === STATE.FLIGHT && flightState) {
    stepFlight(flightState, aircraftRuntime, readInput(), dt, GROUND_Y);
    flightRig.position.copy(flightState.position);
    flightRig.quaternion.copy(flightState.quaternion);
    updateChaseCamera(dt);
    hud.updateFlightHud(flightState);
  }

  renderer.render(scene, camera);
}
animate();
