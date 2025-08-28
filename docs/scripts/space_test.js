import { degToRad } from '../three/src/math/MathUtils.js';
import * as THREE from '../three/build/three.module.min.js';
import {OrbitControls} from '../three/examples/jsm/controls/OrbitControls.js';
import { OBJExporter } from '../three/examples/jsm/exporters/OBJExporter.js';
import { EffectComposer } from '../three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../three/examples/jsm/postprocessing/UnrealBloomPass.js';

console.log("le script test.js a bien été chargé");

// scene
const scene = new THREE.Scene();

// camera 
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

// renderer 
const renderer = new THREE.WebGLRenderer({
    canvas : document.querySelector("#background"),
    antialias: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Contrôle souris
const controls = new OrbitControls(camera, renderer.domElement);

// --- Smooth camera roll setup ---
const clock = new THREE.Clock();
const targetPoint = new THREE.Vector3(0, 0, 0); // point que la caméra regarde
let targetCameraQuat = new THREE.Quaternion();  // quaternion cible
const rollDeg = 30;    // roulis désiré (en degrés) -> ajuste pour l'effet
const lambda = 6.0;    // vitesse de convergence (2 lent, 6 moyen, 12 rapide)

// function to compute quaternion target (lookAt + roll around forward axis)
function computeCameraTargetQuaternion(camera, lookAtPoint, rollDegrees) {
  // matrix lookAt gives orientation that points camera->lookAtPoint (with camera.up)
  const m = new THREE.Matrix4().lookAt(camera.position, lookAtPoint, camera.up);

  // quaternion for the lookAt orientation
  const lookQuat = new THREE.Quaternion().setFromRotationMatrix(m);

  // forward axis (from camera to target)
  const forward = new THREE.Vector3().subVectors(lookAtPoint, camera.position).normalize();

  // roll quaternion around forward
  const rollRad = THREE.MathUtils.degToRad(rollDegrees);
  const rollQuat = new THREE.Quaternion().setFromAxisAngle(forward, rollRad);

  // apply look then roll (local roll around forward)
  return lookQuat.multiply(rollQuat);
}

// enable damping on controls for smoother interactions
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// ------------------------------------------
// === RESTE DE TON SCENE (planètes, anneaux, etc)
// ------------------------------------------

// Add Saturn 
const saturn_geometry = new THREE.SphereGeometry(3, 64, 64);
const saturn_texture = new THREE.TextureLoader().load('./assets/textures/saturn_planet/saturn_planet.jpg');
const saturn_material = new THREE.MeshPhongMaterial({
  map : saturn_texture,
  normalMap : new THREE.TextureLoader().load('./assets/textures/saturn_planet/saturn_planet_normal.png'),
  displacementMap : new THREE.TextureLoader().load('./assets/textures/saturn_planet/saturn_planet_disp.png'),
  aoMap : new THREE.TextureLoader().load('./assets/textures/saturn_planet/saturn_planet_ao.png'),
  displacementScale : 0.05,
  aoMapIntensity : 0.1,
});

const saturn = new THREE.Mesh(saturn_geometry, saturn_material);

saturn.rotation.x = THREE.MathUtils.degToRad(90);
saturn.rotation.y = THREE.MathUtils.degToRad(0);
saturn.rotation.z = THREE.MathUtils.degToRad(90);

scene.add(saturn);
saturn.castShadow = true;
saturn.receiveShadow = true; 

// Add Saturn Rings
const innerRadius = 3.6;
const outerRadius = 6.5;
const segments = 128;

const saturn_rings_geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);

// Ajustement de la texture (rotation et formatage)
const pos_saturn_rings = saturn_rings_geometry.attributes.position;
const uv_saturn_rings = new Float32Array(pos_saturn_rings.count * 2);

for (let i = 0; i < pos_saturn_rings.count; i++) {
  const x = pos_saturn_rings.getX(i);
  const y = pos_saturn_rings.getY(i);
  const r = Math.sqrt(x * x + y * y);
  uv_saturn_rings[i * 2] = (r - innerRadius) / (outerRadius - innerRadius);
  const angle = Math.atan2(y, x);
  uv_saturn_rings[i * 2 + 1] = (angle + Math.PI) / (2 * Math.PI);
}

saturn_rings_geometry.setAttribute('uv', new THREE.BufferAttribute(uv_saturn_rings, 2));

const saturn_rings_texture = new THREE.TextureLoader().load('./assets/textures/saturn_rings/saturn_rings.png');

const saturn_rings_material = new THREE.MeshPhongMaterial({
   side: THREE.DoubleSide,
   map : saturn_rings_texture,
   normalMap : new THREE.TextureLoader().load('./assets/textures/saturn_rings/saturn_rings_normal.png'),
   displacementMap : new THREE.TextureLoader().load('./assets/textures/saturn_rings/saturn_rings_disp.png'),
   displacementScale : 0.01,
   transparent : true
});
const saturn_rings = new THREE.Mesh(saturn_rings_geometry, saturn_rings_material); 

saturn_rings.rotation.x = THREE.MathUtils.degToRad(0);
saturn_rings.rotation.y = THREE.MathUtils.degToRad(90);
saturn_rings.rotation.z = THREE.MathUtils.degToRad(0);

scene.add(saturn_rings);
saturn_rings.castShadow = true;
saturn_rings.receiveShadow = true;

// Add lights
const pointlight = new THREE.PointLight(0xffffff);
pointlight.position.set(0, 0, 0);

const ambientlight = new THREE.AmbientLight(0xffffff, 0.3);

const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -30;
sunLight.shadow.camera.right = 30;
sunLight.shadow.camera.top = 30;
sunLight.shadow.camera.bottom = -30;

scene.add(pointlight, sunLight);

// helpers (non ajoutés par défaut)
const lighthelper = new THREE.PointLightHelper(pointlight);
const gridhelper = new THREE.GridHelper(200, 50);
const axesHelper = new THREE.AxesHelper(10);

// Add stars (postprocess composer is defined below, keep same order)
const composer = new EffectComposer(renderer);
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.85
);

composer.addPass(renderScene);
composer.addPass(bloomPass);

function addStar(color) {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24);
  const material = new THREE.MeshStandardMaterial({ 
    color,
    emissive: color,
    emissiveIntensity: 2
  });
  const star = new THREE.Mesh(geometry, material);
  const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(300));
  star.position.set(x, y, z);
  scene.add(star);
}

const numStars = 600;
for (let i = 0; i < numStars; i++) {
  const color = i < numStars / 2 ? 0xffff00 : 0xffffff;
  addStar(color);
}

// Ajout de jupiter 
const jupiter = new THREE.Mesh(
  new THREE.SphereGeometry(3, 64, 64),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/jupiter_planet/jupiter_planet.jpg'),
    displacementMap : new THREE.TextureLoader().load('./assets/textures/jupiter_planet/jupiter_planet_disp.png'),
    aoMap : new THREE.TextureLoader().load('./assets/textures/jupiter_planet/jupiter_planet_ao.png')
  })
);
scene.add(jupiter);
jupiter.castShadow = true;
jupiter.receiveShadow = true;
jupiter.position.set(-5, 40, 8);
jupiter.rotation.x = THREE.MathUtils.degToRad(90);
jupiter.rotation.y = THREE.MathUtils.degToRad(90);

// Ajout de Neptune
const neptune = new THREE.Mesh(
  new THREE.SphereGeometry(3, 128, 128),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/neptune_planet/neptune_planet.jpg'),
  })
);
scene.add(neptune);
neptune.castShadow = true;
neptune.receiveShadow = true;
neptune.position.set(10, 85, 11);
neptune.rotation.x = THREE.MathUtils.degToRad(90);
neptune.rotation.y = THREE.MathUtils.degToRad(0);

// Ajout de Uranus
const uranus = new THREE.Mesh(
  new THREE.SphereGeometry(3, 128, 128),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/uranus_planet/uranus_planet.jpg'),
  })
);
scene.add(uranus);
uranus.castShadow = true;
uranus.receiveShadow = true;
uranus.position.set(6.8, 106, 15);
uranus.rotation.x = THREE.MathUtils.degToRad(90);
uranus.rotation.y = THREE.MathUtils.degToRad(0);

// Uranus Rings
const uranus_innerRadius = 3.5;
const uranus_outerRadius = 6.5;
const uranus_segments = 128;
const uranus_ringsGeometry = new THREE.RingGeometry(uranus_innerRadius, uranus_outerRadius, uranus_segments);

// Recalcul des UV pour que la texture s’affiche correctement
const posUranus = uranus_ringsGeometry.attributes.position;
const uvUranus = new Float32Array(posUranus.count * 2);
for (let i = 0; i < posUranus.count; i++) {
  const x = posUranus.getX(i);
  const y = posUranus.getY(i);
  const r = Math.sqrt(x * x + y * y);
  uvUranus[i * 2] = (r - uranus_innerRadius) / (uranus_outerRadius - uranus_innerRadius);
  const angle = Math.atan2(y, x);
  uvUranus[i * 2 + 1] = (angle + Math.PI) / (2 * Math.PI);
}
uranus_ringsGeometry.setAttribute('uv', new THREE.BufferAttribute(uvUranus, 2));

const uranus_ringsMaterial = new THREE.MeshPhongMaterial({
  side: THREE.DoubleSide,
  map: new THREE.TextureLoader().load('./assets/textures/uranus_rings/uranus_rings_color.jpg'),
  alphaMap: new THREE.TextureLoader().load('./assets/textures/uranus_rings/uranus_rings_alpha.jpg'),
  transparent: true
});

const uranus_rings = new THREE.Mesh(uranus_ringsGeometry, uranus_ringsMaterial);
uranus_rings.rotation.x = THREE.MathUtils.degToRad(60);
uranus.add(uranus_rings);
uranus_rings.castShadow = true;
uranus_rings.receiveShadow = true;

// ------------------------------------------
// === CAMERA INITIAL POSITION (no lookAt calls)
// ------------------------------------------

// position initiale de la caméra
const basePos = new THREE.Vector3(2, 5, 7);
camera.position.copy(basePos);

// compute initial target quaternion and set camera orientation there to avoid jump
targetCameraQuat.copy(computeCameraTargetQuaternion(camera, targetPoint, rollDeg));
camera.quaternion.copy(targetCameraQuat);

// controls.update initial
controls.update();

// Move Camera (scroll-driven position change) - removed camera.lookAt calls
function MoveCamera() {
  const t = document.body.getBoundingClientRect().top;
  camera.position.z = basePos.z + t * -0.01;
  camera.position.x = basePos.x + t * -0.01;
  camera.position.y = basePos.y + t * -0.2;

  // NOTE: we do NOT call camera.lookAt here. The animate() loop recomputes
  // the target quaternion and slerps the camera orientation smoothly.
  // debug:
  // console.log("Position caméra : ", camera.position);
}

document.body.onscroll = MoveCamera;
MoveCamera();

// ------------------------------------------
// === ANIMATE LOOP (smooth quaternion slerp)
// ------------------------------------------

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // recompute camera target quaternion each frame (handles camera.position changes)
  targetCameraQuat.copy(computeCameraTargetQuaternion(camera, targetPoint, rollDeg));

  // frame-rate independent interpolation factor
  const alpha = 1 - Math.exp(-lambda * delta);

  // smooth slerp to target orientation
  camera.quaternion.slerp(targetCameraQuat, alpha);

  // update controls (damping)
  controls.update();

  // render with composer (bloom)
  composer.render();
}

animate();

// exporter & helper functions kept as before
const exporter = new OBJExporter();
const obj = exporter.parse(scene);

function download(content, filename, mimeType) {
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}
