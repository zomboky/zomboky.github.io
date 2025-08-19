import * as THREE from '../three/build/three.module.min.js';
import {OrbitControls} from '../three/examples/jsm/controls/OrbitControls.js';

console.log("le script corridor.js a bien été chargé");

// scene 
const scene = new THREE.Scene();

// camera 
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);


camera.position.set(0, 0, 30); 

// renderer 
const renderer = new THREE.WebGLRenderer({
    canvas : document.querySelector("#background"),

});

// lumière 

const pointlight = new THREE.PointLight(0xffffff, 10); // blanc, intensité 1
pointlight.position.set(5, 5, 5);
scene.add(pointlight);

// Set size du renderer ( toute la fenetre + resize dynamique)
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});





/////////////////////////////////

const sphere_geometry = new THREE.SphereGeometry(3, 64, 64);
const sphere_material = new THREE.MeshStandardMaterial({color : 0xff0000});
const sphere = new THREE.Mesh(sphere_geometry, sphere_material);

scene.add(sphere);


// helpers 

const lighthelper = new THREE.PointLightHelper(pointlight);
const gridhelper = new THREE.GridHelper(200, 50);
const axesHelper = new THREE.AxesHelper(10); // 10 = longueur des axes

scene.add(axesHelper, gridhelper, lighthelper);



// OrbitControls    

const controls = new OrbitControls(camera, renderer.domElement);

function animate(){


    requestAnimationFrame( animate ); 
    controls.update(); 
    renderer.render(scene, camera); 

}

animate();
