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

// Lumières 
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
saturn.rotation.z = THREE.MathUtils.degToRad(90);
scene.add(saturn);
saturn.castShadow = true; 
saturn.receiveShadow = true; 

// Saturn Rings
const innerRadius = 3.6;
const outerRadius = 6.5;
const segments = 128;
const saturn_rings_geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);

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
saturn_rings.rotation.y = THREE.MathUtils.degToRad(90);
scene.add(saturn_rings);
saturn_rings.castShadow = true;
saturn_rings.receiveShadow = true;

// Bloom + Stars
const composer = new EffectComposer(renderer);
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, 0.4, 0.85
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

// Jupiter
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

// Neptune
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

// Uranus
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

const uranus_ringsGeometry = new THREE.RingGeometry(3.5, 6.5, 128);
const posUranus = uranus_ringsGeometry.attributes.position;
const uvUranus = new Float32Array(posUranus.count * 2);
for (let i = 0; i < posUranus.count; i++) {
  const x = posUranus.getX(i);
  const y = posUranus.getY(i);
  const r = Math.sqrt(x * x + y * y);
  uvUranus[i * 2] = (r - 3.5) / (6.5 - 3.5);
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

// --- Smooth scroll camera ---
const basePos = new THREE.Vector3(2, 5, 7);
camera.position.copy(basePos);
camera.lookAt(0,0,0);

let targetPos = basePos.clone(); // position cible

function MoveCamera() {
  const t = document.body.getBoundingClientRect().top;
  targetPos.set(
    basePos.x + t * -0.01,
    basePos.y + t * -0.2,
    basePos.z + t * -0.01
  );
}

document.body.onscroll = MoveCamera;
MoveCamera();

// Animate
function animate(){
    requestAnimationFrame(animate);

    // interpolation fluide de la caméra
    camera.position.lerp(targetPos, 0.05); // 0.05 = vitesse de lissage
    camera.lookAt(0, 0, 0);

    controls.update();
    composer.render();
}
animate();

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
//download(obj, 'model.obj', 'text/plain');
