import * as THREE from '../three/build/three.module.min.js';
import {OrbitControls} from '../three/examples/jsm/controls/OrbitControls.js';

console.log("le script corridor.js a bien été chargé");


// Corridor parameters 

const lenght = 30; 
const width = 10;


// scene 
const scene = new THREE.Scene();

// camera 
const camera = new THREE.PerspectiveCamera(
    100,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(-15, 5, 5); 
// regarde vers X positif



// renderer 
const renderer = new THREE.WebGLRenderer({
    canvas : document.querySelector("#background"),
    antialias: true // pour lisser les bords

});

// lumière 

const pointlight = new THREE.PointLight(0xffffff, 10); // blanc, intensité 1
pointlight.position.set(-10, -10, -10);
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

const plane_geometry = new THREE.PlaneGeometry(lenght, width, 400, 400);

const basement_texture = new THREE.TextureLoader().load('../assets/textures/basement_wall_1/basement_wall.png');
const basement_normal_map = new THREE.TextureLoader().load('../assets/textures/basement_wall_1/basement_wall_normalmap.png');
const basement_displacement_map = new THREE.TextureLoader().load('../assets/textures/basement_wall_1/basement_wall_displacementmap.png');
const basement_bumpmap = new THREE.TextureLoader().load('../assets/textures/basement_wall_1/basement_wall_bumpmap.png');

const brick_texture = new THREE.TextureLoader().load('../assets/textures/rockwall8/rockwall8.png');
const brick_normal_map = new THREE.TextureLoader().load('../assets/textures/rockwall8/rockwall8_normalmap.png');
const brick_displacement_map = new THREE.TextureLoader().load('../assets/textures/rockwall8/rockwall8_displacementmap.png');

const rusty_wall_texture = new THREE.TextureLoader().load('../assets/textures/rusty_wall/rusty_wall.png');
const rusty_wall_normal_map = new THREE.TextureLoader().load('../assets/textures/rusty_wall/rusty_wall_normal.png');
const rusty_wall_displacement_map = new THREE.TextureLoader().load('../assets/textures/rusty_wall/rusty_wall_disp.png');
const rust_wall_ao = new THREE.TextureLoader().load('../assets/textures/rusty_wall/rusty_wall_ao.png');


const basement_material = new THREE.MeshStandardMaterial({
    //map : plane_texture,
    side : THREE.DoubleSide,
    map : basement_texture,
    normalMap : basement_normal_map,
    displacementMap : basement_displacement_map,
    displacementScale : 0.05,
    bumpMap : basement_bumpmap
});


const brick_material = new THREE.MeshStandardMaterial({
    //map : plane_texture,
    side : THREE.DoubleSide,
    map : brick_texture,
    normalMap : brick_normal_map,
    displacementMap : brick_displacement_map,
    displacementScale : 0.05
});

const rusty_wall_material = new THREE.MeshPhongMaterial({
    side : THREE.DoubleSide,
    map : rusty_wall_texture,
    normalMap : rusty_wall_normal_map,
    displacementMap : rusty_wall_displacement_map,
    displacementScale : 0.11,
    aoMap : rust_wall_ao,
    aoMapIntensity : 0.5,
});

// MUR FOND

const mur_fond = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width), rusty_wall_material);


scene.add(mur_fond);

mur_fond.position.set(15, 5, 5);
mur_fond.rotation.y = THREE.MathUtils.degToRad(90); // à plat



// MUR GAUCHE

const mur_gauche = new THREE.Mesh(plane_geometry, brick_material);

mur_gauche.position.set(0, 5, 0);


scene.add(mur_gauche);

//plane.rotation.x = THREE.MathUtils.degToRad(90); // à plat


// PLAFOND
const plafond = new THREE.Mesh(
    new THREE.PlaneGeometry(lenght, width), basement_material);

plafond.position.set(0, 10, 5);
plafond.rotation.x = THREE.MathUtils.degToRad(90);

scene.add(plafond);

// MUR DROIT
const mur_droit = new THREE.Mesh(
    new THREE.PlaneGeometry(lenght, width), brick_material);

mur_droit.position.set(0, 5, 10);


scene.add(mur_droit);

// SOL

const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(lenght, width), basement_material);

sol.position.set(0, 0, 5);
sol.rotation.x = THREE.MathUtils.degToRad(90); // à plat

scene.add(sol);



// helpers 

const lighthelper = new THREE.PointLightHelper(pointlight);
const gridhelper = new THREE.GridHelper(200, 50);
const axesHelper = new THREE.AxesHelper(10); // 10 = longueur des axes
const camerahelper = new THREE.CameraHelper( camera );

//scene.add(axesHelper, gridhelper, lighthelper, camerahelper);



// OrbitControls    

const controls = new OrbitControls(camera, renderer.domElement);
//camera OrbitControls regarde vers X positif de base
controls.target.set(camera.position.x + 1, camera.position.y, camera.position.z);
controls.update();


function animate(){


    requestAnimationFrame( animate ); 
    controls.update(); 
    renderer.render(scene, camera); 

     // Faire suivre la lumière à la caméra à chaque frame
      pointlight.position.copy(camera.position);

     // Mettre à jour le helper pour qu'il suive la light
     lighthelper.update();

}

animate();

// Ajout du zoom caméra 

const maxscroll = document.body.scrollHeight - window.innerHeight;


window.addEventListener("scroll", () => {
    const currentscroll = window.scrollY;                // position actuelle du scroll
        console.log(`Camera position: x=${camera.position.x}, y=${camera.position.y}, z=${camera.position.z}`);
    const scrollratio = currentscroll / maxscroll;    // ratio du scoll entre 0 et 1
        console.log('scrollration   : ', scrollratio);
    camera.position.x = - 15 + scrollratio * 30;
    controls.target.set(camera.position.x + 1, camera.position.y, camera.position.z);
    
    controls.update();
});



// DESACTIVER/ACTIVER ORBIT CONTROLS
controls.enableRotate = false;
controls.enableZoom   = false;
controls.enablePan    = false;
