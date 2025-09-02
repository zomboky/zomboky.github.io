

import { degToRad } from '../three/src/math/MathUtils.js';
import * as THREE from '../three/build/three.module.min.js';
import {OrbitControls} from '../three/examples/jsm/controls/OrbitControls.js';
import { OBJExporter } from '../three/examples/jsm/exporters/OBJExporter.js';
import { EffectComposer } from '../three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OBJLoader } from '../three/examples/jsm/loaders/OBJLoader.js';



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
sunLight.position.set(-100, 50, 50); // direction de la lumière (origine des rayons)
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



//scene.add(axesHelper);



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


saturn.rotation.x = THREE.MathUtils.degToRad(115);    //axe rouge 
saturn.rotation.y = THREE.MathUtils.degToRad(0);    // vert
saturn.rotation.z = THREE.MathUtils.degToRad(0);  //axe bleu


scene.add(saturn);
saturn.position.set(7, 68, 10);
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

  // U = rayon normalisé (0 - 1)
  uv_saturn_rings[i * 2] = (r - innerRadius) / (outerRadius - innerRadius);

  // V = angle normalisé (0 - 1)
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
   transparent : true} );
const saturn_rings = new THREE.Mesh( saturn_rings_geometry, saturn_rings_material ); 



saturn_rings.position.set(7, 68, 10);
saturn_rings.rotation.x = THREE.MathUtils.degToRad(30);
saturn_rings.rotation.z = THREE.MathUtils.degToRad(30);

scene.add(saturn_rings);
saturn_rings.castShadow = true;
saturn_rings.receiveShadow = true;



// Add stars

const composer = new EffectComposer(renderer);         // On a besoin de ça pour le shader bloom
const renderScene = new RenderPass(scene, camera);    //  et de ça également

const bloomPass = new UnrealBloomPass(                          // Création du bllom
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,  // intensité du bloom
  0.4,  // radius
  0.85  // threshold
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

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(600)); // Espace de 600 unités autour de la scène

  star.position.set(x, y, z);

  scene.add(star);
}

const numStars = 900;
for (let i = 0; i < numStars; i++) {
  const color = i < numStars / 2 ? 0xffff00 : 0xffffff; // jaune ou blanc
  addStar(color);
}


// Ajout de jupiter 
const jupiter = new THREE.Mesh(
  new THREE.SphereGeometry(3, 64, 64),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/jupiter_planet/jupiter_planet.jpg'),
    //normalMap : new THREE.TextureLoader().load('./assets/textures/upiter_planet/jupiter_planet_normal.png'),
    displacementMap : new THREE.TextureLoader().load('./assets/textures/jupiter_planet/jupiter_planet_disp.png'),
    aoMap : new THREE.TextureLoader().load('./assets/textures/jupiter_planet/jupiter_planet_ao.png')
  })
);

scene.add(jupiter);
jupiter.castShadow = true;
jupiter.receiveShadow = true;
jupiter.position.set(3, 100, 11);

jupiter.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
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
//neptune.position.set(10, 85, 11);

neptune.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
neptune.rotation.y = THREE.MathUtils.degToRad(0);
//neptune.rotation.z = THREE.MathUtils.degToRad(90);

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
uranus.position.set(-5, 40, 8);

uranus.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
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
//uranus_rings.position.set(6.8, 106, 15);

uranus_rings.rotation.x = THREE.MathUtils.degToRad(60);

uranus.add(uranus_rings);
uranus_rings.castShadow = true;
uranus_rings.receiveShadow = true;


// Add planet mars

const mars = new THREE.Mesh(
  new THREE.SphereGeometry(3, 128, 128),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/mars_planet/mars_planet.jpg'),
    normalMap : new THREE.TextureLoader().load('./assets/textures/mars_planet/mars_planet_normal.jpg'),
    displacementMapMap : new THREE.TextureLoader().load('./assets/textures/mars_planet/mars_planet_disp.jpg'),
    displacementScale : 0.05,
  })
);

scene.add(mars);
mars.castShadow = true;
mars.receiveShadow = true;
mars.position.set(14, 146, 14);

mars.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
mars.rotation.y = THREE.MathUtils.degToRad(0);


// Ajout de la Terre

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(3, 128, 128),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/earth_planet/earth_planet.jpg'),
    normalMap : new THREE.TextureLoader().load('./assets/textures/earth_planet/earth_planet_normal.png'),
    displacementMapMap : new THREE.TextureLoader().load('./assets/textures/earth_planet/earth_planet_disp.png'),
    displacementScale : 0.05,
  })
);

scene.add(earth);
earth.castShadow = true;
earth.receiveShadow = true;
earth.position.set(11, 200, 16);

earth.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
earth.rotation.y = THREE.MathUtils.degToRad(0);


// Ajout de Vénus

const venus = new THREE.Mesh(
  new THREE.SphereGeometry(3, 128, 128),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/venus_planet/venus_planet.jpg'),
    normalMap : new THREE.TextureLoader().load('./assets/textures/venus_planet/venus_planet_normal.png'),
    displacementMapMap : new THREE.TextureLoader().load('./assets/textures/venus_planet/venus_planet_disp.png'),
    displacementScale : 0.1,
  })
);

scene.add(venus);
venus.castShadow = true;
venus.receiveShadow = true;
venus.position.set(19, 250, 20);

venus.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
venus.rotation.y = THREE.MathUtils.degToRad(0);

// Ajout de mercure

const mercury = new THREE.Mesh(
  new THREE.SphereGeometry(3, 128, 128),
  new THREE.MeshPhongMaterial({
    map : new THREE.TextureLoader().load('./assets/textures/mercury_planet/mercury_planet.jpg'),
    normalMap : new THREE.TextureLoader().load('./assets/textures/mercury_planet/mercury_planet_normal.png'),
    displacementMapMap : new THREE.TextureLoader().load('./assets/textures/mercury_planet/mercury_planet_disp.png'),
    displacementScale : 0.1,
  })
);

scene.add(mercury);
mercury.castShadow = true;
mercury.receiveShadow = true;
mercury.position.set(11, 280, 20);

mercury.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
mercury.rotation.y = THREE.MathUtils.degToRad(0);




// position initiale de la caméra

const basePos = new THREE.Vector3(2, 5, 7); // position initiale caméra
camera.position.copy(basePos);
camera.lookAt(0,0,0); // Camera scroll


controls.update();

// Caméra fluide 
let targetPos = basePos.clone(); // copie de basePos pour pas changer sa valeur initiale
                                //  stocke la position vers laquelle la caméra doit aller

 



// Move Camera 

function MoveCamera() {



  const t = document.body.getBoundingClientRect().top;
  targetPos.set(
    basePos.x + t * -0.01, // X
    basePos.y + t * -0.2,  // Y
    basePos.z + t * -0.01  // Z
  );


  camera.lookAt(0, 0, 0);
 

  //partie debug
  console.log("Position caméra : ", camera.position) //3, 40, 8 
}

document.body.onscroll = MoveCamera;
MoveCamera();




function animate(){


    requestAnimationFrame( animate );



    controls.update();
    camera.position.lerp(targetPos, 0.05); // 0.05 = vitesse de lissage
    camera.lookAt(0, 0, 0);



    //renderer.render( scene, camera);
    composer.render();
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




