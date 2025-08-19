import * as THREE from '../three/build/three.module.min.js';
import {OrbitControls} from '../three/examples/jsm/controls/OrbitControls.js';

console.log("le script corridor.js a bien été chargé");

// scene 
const scene = new THREE.Scene();

// camera 
const camera = new THREE.PerspectiveCamera(
    100,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);


camera.position.set(0, 0, 30); 

// renderer 
const renderer = new THREE.WebGLRenderer({
    canvas : document.querySelector("#background"),
    antialias: true // pour lisser les bords

});

// lumière 

const pointlight = new THREE.PointLight(0xffffff, 10); // blanc, intensité 1
pointlight.position.set(0, 5, 5);
scene.add(pointlight);

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
//scene.add(ambient);



// Set size du renderer ( toute la fenetre + resize dynamique)
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});





/////////////////////////////////

// Construction du corridor

const lenght = 30; 
const width = 10;

const plane_geometry = new THREE.PlaneGeometry(lenght, width, 400, 400);
const plane_texture = new THREE.TextureLoader().load('../assets/textures/rockwall8.png');
const plane_normal_map = new THREE.TextureLoader().load('../assets/textures/rockwall8_normalmap.png');
const displacementmap = new THREE.TextureLoader().load('../assets/textures/rockwall8_displacementmap.png');
const plane_material = new THREE.MeshStandardMaterial({
    //map : plane_texture,
    side : THREE.DoubleSide,
    map : plane_texture,
    normalMap : plane_normal_map,
    displacementMap : displacementmap,
    displacementScale : 0.05
});

const mur_gauche = new THREE.Mesh(plane_geometry, plane_material);

mur_gauche.position.set(0, 5, 0);


scene.add(mur_gauche);

//plane.rotation.x = THREE.MathUtils.degToRad(90); // à plat


// PLAFOND
const plafond = new THREE.Mesh(
    new THREE.PlaneGeometry(lenght, width), plane_material);

plafond.position.set(0, 10, 5);
plafond.rotation.x = THREE.MathUtils.degToRad(90);

scene.add(plafond);

// MUR DROIT
const mur_droit = new THREE.Mesh(
    new THREE.PlaneGeometry(lenght, width), plane_material);

mur_droit.position.set(0, 5, 10);


scene.add(mur_droit);

// SOL

const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(lenght, width), plane_material);

sol.position.set(0, 0, 5);
sol.rotation.x = THREE.MathUtils.degToRad(90); // à plat

scene.add(sol);



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
