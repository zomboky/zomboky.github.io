import * as THREE from '../three/build/three.module.min.js';
import {OrbitControls} from '../three/examples/jsm/controls/OrbitControls.js';

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
    canvas : document.querySelector("#background")
});

renderer.setPixelRatio( window.devicePixelRatio) ; 
renderer.setSize(window.innerWidth, window.innerHeight);

// Contrôle souris

const controls = new OrbitControls(camera, renderer.domElement);


// camera.position.setZ(30);
// camera.position.setX(30);
// camera.position.setY(30);



// renderer.render( scene, camera); 


//const geometry = new THREE.SphereGeometry( 15, 32, 16 ); 

const geometry = new THREE.TorusGeometry(10, 3, 16, 100);
const material_basic = new THREE.MeshBasicMaterial( { color: 0xFF6347, wireframe : true } ); 
const material_standard = new THREE.MeshStandardMaterial( { color : 0xFF6347 });
const object = new THREE.Mesh(geometry, material_standard);

//scene.add(object);



// Lumières 

const pointlight = new THREE.PointLight(0xffffff);
pointlight.position.set(0, 0, 0);

const ambientlight = new THREE.AmbientLight(0xffffff);
ambientlight.position.set()

scene.add(pointlight, ambientlight); // le code parle de lui même c'est golmon

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
const saturn_texture = new THREE.TextureLoader().load('../assets/textures/saturn_planet.jpg');
const saturn_material = new THREE.MeshStandardMaterial({map : saturn_texture});
const saturn = new THREE.Mesh(saturn_geometry, saturn_material);


saturn.rotation.x = THREE.MathUtils.degToRad(90);  //axe rouge 
saturn.rotation.y = THREE.MathUtils.degToRad(0);  // vert
saturn.rotation.z = THREE.MathUtils.degToRad(90);  //axe bleu


scene.add(saturn);



// Add Saturn Rings

const rings_geometry = new THREE.RingGeometry( 3.6, 6.5, 32 ); 
const rings_material = new THREE.MeshBasicMaterial( { color: 0xffff00, side: THREE.DoubleSide } );
const rings = new THREE.Mesh( rings_geometry, rings_material ); 


rings.rotation.x = THREE.MathUtils.degToRad(0);  //axe rouge 
rings.rotation.y = THREE.MathUtils.degToRad(90);  // vert
rings.rotation.z = THREE.MathUtils.degToRad(0);  //axe bleu

scene.add(rings);

//scene.add(rings);


// Add stars

function addStar(color) {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color });
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



// position initiale de la caméra

const basePos = new THREE.Vector3(50, 20, 50);
camera.position.copy(basePos);
camera.lookAt(0,0,0);
controls.update();



// Move Camera 

function MoveCamera(){

    const t = document.body.getBoundingClientRect().top;

    camera.position.z = t * -0.01;
    camera.position.x = t * -0.01;
    camera.position.y = t * -0.1;
    camera.lookAt(0, 0, 0);
    controls.update();

} 

document.body.onscroll = MoveCamera;
MoveCamera();

function animate(){


    requestAnimationFrame( animate );

    object.rotation.x += 0.01; 
    object.rotation.y += 0.005;
    object.rotation.z += 0.01;

    controls.update();

    renderer.render( scene, camera);

}

animate();




