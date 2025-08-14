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

camera.position.setZ(30);

// renderer.render( scene, camera); 


//const geometry = new THREE.SphereGeometry( 15, 32, 16 ); 
const geometry = new THREE.TorusGeometry(10, 3, 16, 100);
const material_basic = new THREE.MeshBasicMaterial( { color: 0xFF6347, wireframe : true } ); 
const material_standard = new THREE.MeshStandardMaterial( { color : 0xFF6347 });
const object = new THREE.Mesh(geometry, material_standard);

scene.add(object);


// Contrôle souris

const controls = new OrbitControls(camera, renderer.domElement);

// Lumières 

const pointlight = new THREE.PointLight(0xffffff);
pointlight.position.set(0, 0, 0);

const ambientlight = new THREE.AmbientLight(0xffffff);
ambientlight.position.set()

scene.add(pointlight, ambientlight); // le code parle de lui même c'est golmon

// helpers 

const lighthelper = new THREE.PointLightHelper(pointlight);
const gridhelper = new THREE.GridHelper(200, 50);
//scene.add(lighthelper, gridhelper);

// Add stars

function addStar() {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const star = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(300));

  star.position.set(x, y, z);
  scene.add(star);
}

Array(400).fill().forEach(addStar);


// Move Camera 

function MoveCamera(){
    const t = document.body.getBoundingClientRect().top;

    camera.position.z = t * -0.01;
    camera.position.x = t * -0.01;
    camera.position.y = t * -0.1;

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




