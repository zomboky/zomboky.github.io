import * as THREE from '../three/build/three.module.min.js';
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js';
import { OBJExporter } from '../three/examples/jsm/exporters/OBJExporter.js';

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
    canvas : document.querySelector("#background")
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// Contrôle souris
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false; // désactivé au début (mode scroll)

// position initiale de la caméra
const basePos = new THREE.Vector3(2, 5, 7);
camera.position.copy(basePos);
camera.lookAt(0,0,0);

// -------- LUMIERES --------
const pointlight = new THREE.PointLight(0xffffff);
pointlight.position.set(0, 0, 0);

const ambientlight = new THREE.AmbientLight(0xffffff);
scene.add(pointlight, ambientlight);

// -------- SATURNE --------
const saturn_geometry = new THREE.SphereGeometry(3, 64, 64);
const saturn_texture = new THREE.TextureLoader().load('../assets/textures/saturn_planet/saturn_planet.jpg');
const saturn_material = new THREE.MeshStandardMaterial({
  map : saturn_texture,
  normalMap : new THREE.TextureLoader().load('../assets/textures/saturn_planet/saturn_planet_normal.jpg'),
  displacementMap : new THREE.TextureLoader().load('../assets/textures/saturn_planet/saturn_planet_disp.jpg'),
  aoMap : new THREE.TextureLoader().load('../assets/textures/saturn_planet/saturn_planet_ao.jpg'),
  displacementScale : 0.05,
  aoMapIntensity : 0.1,
});
const saturn = new THREE.Mesh(saturn_geometry, saturn_material);
saturn.rotation.x = THREE.MathUtils.degToRad(90);
saturn.rotation.y = THREE.MathUtils.degToRad(0);
saturn.rotation.z = THREE.MathUtils.degToRad(90);
scene.add(saturn);

// -------- ANNEAUX --------
const innerRadius = 3.6;
const outerRadius = 6.5;
const segments = 128;
const rings_geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);

// UV mapping manuel
const pos = rings_geometry.attributes.position;
const uv = new Float32Array(pos.count * 2);
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const y = pos.getY(i);
  const r = Math.sqrt(x * x + y * y);
  uv[i * 2] = (r - innerRadius) / (outerRadius - innerRadius);
  const angle = Math.atan2(y, x);
  uv[i * 2 + 1] = (angle + Math.PI) / (2 * Math.PI);
}
rings_geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

const rings_texture = new THREE.TextureLoader().load('../assets/textures/saturn_rings/saturn_rings.png');
const rings_material = new THREE.MeshBasicMaterial({
   side: THREE.DoubleSide,
   map : rings_texture,
   normalMap : new THREE.TextureLoader().load('../assets/textures/saturn_rings/saturn_rings_normal.png'),
   displacementMap : new THREE.TextureLoader().load('../assets/textures/saturn_rings/saturn_rings_disp.png'),
   displacementScale : 0.01,
   transparent : true
});
const rings = new THREE.Mesh(rings_geometry, rings_material); 
rings.rotation.y = THREE.MathUtils.degToRad(90);
scene.add(rings);

// -------- ETOILES --------
function addStar(color) {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color });
  const star = new THREE.Mesh(geometry, material);
  const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(300));
  star.position.set(x, y, z);
  scene.add(star);
}
for (let i = 0; i < 600; i++) {
  const color = i < 300 ? 0xffff00 : 0xffffff;
  addStar(color);
}

// -------- CAMERA MODES --------
let cameraMode = "scroll"; // "scroll" ou "orbit"

function MoveCamera() {
  if (cameraMode !== "scroll") return;
  const t = document.body.getBoundingClientRect().top;
  camera.position.z = basePos.z + t * -0.01;
  camera.position.x = basePos.x + t * -0.01;
  camera.position.y = basePos.y + t * -0.2;
  camera.lookAt(0, 0, 0);
}
document.body.onscroll = MoveCamera;
MoveCamera();

// -------- TOGGLE BOUTON --------
const toggleBtn = document.getElementById("toggleModeBtn");
toggleBtn.addEventListener("click", () => {
  if (cameraMode === "scroll") {
    cameraMode = "orbit";
    controls.enabled = true;
    toggleBtn.textContent = "Passer en Scroll Controls";
  } else {
    cameraMode = "scroll";
    controls.enabled = false;
    MoveCamera();
    toggleBtn.textContent = "Passer en Orbit Controls";
  }
});

// -------- ANIMATION --------
function animate() {
  requestAnimationFrame(animate);

  saturn.rotation.y += 0.002;

  if (cameraMode === "orbit") {
    controls.update();
  }
  renderer.render(scene, camera);
}
animate();

// -------- EXPORT OBJ (optionnel) --------
const exporter = new OBJExporter();
const obj = exporter.parse(scene);
// download(obj, 'model.obj', 'text/plain');
