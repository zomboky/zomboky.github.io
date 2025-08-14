import * as THREE from '../js/three.module.min.js';

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

renderer.render( scene, camera); 

