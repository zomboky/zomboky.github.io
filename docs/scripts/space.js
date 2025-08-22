import { degToRad } from '../three/src/math/MathUtils.js';
import * as THREE from '../three/build/three.module.min.js';
import {OrbitControls} from '../three/examples/jsm/controls/OrbitControls.js';
import { OBJExporter } from '../three/examples/jsm/exporters/OBJExporter.js';


console.log("le script test.js a bien été chargé");

// scene
const scene = new THREE.Scene();

// camera 

const camera = new THREE.PerspectiveCamera(
    75,                                             // FOV
    window.innerWidth / window.innerHeight,        //  Aspect Ratio
    0.1,                                          //   Render distance near 
    1000                                         //    Render distance far 
    // Avec ces paramètres de render distance normalement on est bon pour tout voir 
);


// renderer 

const renderer = new THREE.WebGLRenderer({
    canvas : document.querySelector("#background"),
    antialias: true, // anti-aliasing pour lisser les bords
});

renderer.setPixelRatio( window.devicePixelRatio) ; 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Contrôle souris

const controls = new OrbitControls(camera, renderer.domElement);


// camera.position.setZ(30);
// camera.position.setX(30);
// camera.position.setY(30);



// renderer.render( scene, camera); 


//const geometry = new THREE.SphereGeometry( 15, 32, 16 ); 





// Lumières 

const pointlight = new THREE.PointLight(0xffffff);
pointlight.position.set(0, 0, 0);

const ambientlight = new THREE.AmbientLight(0xffffff, 0.3);
ambientlight.position.set()   


// Lumière du soleil 
const sunLight = new THREE.DirectionalLight(0xffffff, 2); // couleur, intensité
sunLight.position.set(50, 100, 50); // direction de la lumière (origine des rayons)
sunLight.castShadow = true;         // activer les ombres

// Paramètres des ombres pour plus de réalisme
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -30;
sunLight.shadow.camera.right = 30;
sunLight.shadow.camera.top = 30;
sunLight.shadow.camera.bottom = -30;


scene.add(pointlight, sunLight); // le code parle de lui même c'est golmon

// helpers 

const lighthelper = new THREE.PointLightHelper(pointlight);
const gridhelper = new THREE.GridHelper(200, 50);
const axesHelper = new THREE.AxesHelper(10); // 10 = longueur des axes



scene.add(axesHelper);



// Add Background Image

//const bgimage = new THREE.TextureLoader().load('../assets/textures/space_background.jpg');
//scene.background = bgimage;




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


saturn.rotation.x = THREE.MathUtils.degToRad(90);    //axe rouge 
saturn.rotation.y = THREE.MathUtils.degToRad(0);    // vert
saturn.rotation.z = THREE.MathUtils.degToRad(90);  //axe bleu


scene.add(saturn);
saturn.castShadow = true; 
saturn.receiveShadow = true; 



// Add Saturn Rings

const innerRadius = 3.6;
const outerRadius = 6.5;
const segments = 128;

const rings_geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);

// Ajustement de la texture (rotation et formatage)
const pos = rings_geometry.attributes.position;
const uv = new Float32Array(pos.count * 2);

for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const y = pos.getY(i);
  const r = Math.sqrt(x * x + y * y);

  // U = rayon normalisé (0 - 1)
  uv[i * 2] = (r - innerRadius) / (outerRadius - innerRadius);

  // V = angle normalisé (0 - 1)
  const angle = Math.atan2(y, x);
  uv[i * 2 + 1] = (angle + Math.PI) / (2 * Math.PI);
}

rings_geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

const rings_texture = new THREE.TextureLoader().load('./assets/textures/saturn_rings/saturn_rings.png');


const rings_material = new THREE.MeshPhongMaterial({
   side: THREE.DoubleSide,
   map : rings_texture,
   normalMap : new THREE.TextureLoader().load('./assets/textures/saturn_rings/saturn_rings_normal.png'),
   displacementMap : new THREE.TextureLoader().load('./assets/textures/saturn_rings/saturn_rings_disp.png'),
    displacementScale : 0.01,
   transparent : true} );
const rings = new THREE.Mesh( rings_geometry, rings_material ); 


rings.rotation.x = THREE.MathUtils.degToRad(0);  //axe rouge 
rings.rotation.y = THREE.MathUtils.degToRad(90);  // vert
rings.rotation.z = THREE.MathUtils.degToRad(0);  //axe bleu

scene.add(rings);
rings.castShadow = true;
rings.receiveShadow = true;



// Add stars

function addStar(color) {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24);
  const material = new THREE.MeshStandardMaterial({ 
    color,
    emissive: color,
    emissiveIntensity: 2
   });
  const star = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(300));

  star.position.set(x, y, z);

  scene.add(star);
}

const numStars = 600;
for (let i = 0; i < numStars; i++) {
  const color = i < numStars / 2 ? 0xffff00 : 0xffffff; // jaune ou blanc
  addStar(color);
}


// Ajout de jupiter 
const jupiter = new THREE.Mesh(
  new THREE.SphereGeometry(3, 64, 64),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/jupiter_planet/jupiter_planet.jpg')
  })
);

scene.add(jupiter);
jupiter.position.set(-5, 40, 8);

jupiter.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
jupiter.rotation.y = THREE.MathUtils.degToRad(90);


// position initiale de la caméra

const basePos = new THREE.Vector3(2, 5, 7); // position initiale caméra
camera.position.copy(basePos);
camera.lookAt(0,0,0); // Camera scroll


controls.update();



// Move Camera 

function MoveCamera() {


  const t = document.body.getBoundingClientRect().top;
  camera.position.z = basePos.z + t * -0.01;
  camera.position.x = basePos.x + t * -0.01;
  camera.position.y = basePos.y + t * -0.2;
  camera.lookAt(0, 0, 0);

  //partie debug
  console.log("Position caméra : ", camera.position) //3, 40, 8 
}

document.body.onscroll = MoveCamera;
MoveCamera();

function animate(){


    requestAnimationFrame( animate );

    controls.update();


    renderer.render( scene, camera);

}

animate();



const exporter = new OBJExporter();
const obj = exporter.parse(scene);


function download( content, filename, mimeType ) {
    const blob = new Blob([content], {type: mimeType});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
}

//download(obj, 'model.obj', 'text/plain');


