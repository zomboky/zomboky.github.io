import * as THREE from '../../three/build/three.module.min.js';

// Monde minimaliste : sol plat (herbe) + piste rectangulaire, pas de relief.
// Repère : nez avion → -Z (voir parts.js) ; la piste est alignée sur Z, le
// point de spawn est au sud (+Z) pour un décollage vers -Z.

export const GROUND_Y = 0;
export const RUNWAY_LENGTH = 420;
export const RUNWAY_WIDTH = 30;
export const SPAWN_X = 0;
export const SPAWN_Z = RUNWAY_LENGTH / 2 - 25;

function grassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4c9a3b';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1200; i++) {
    const shade = Math.random() * 40 - 15;
    ctx.fillStyle = `rgba(${Math.max(0, 60 + shade)},${Math.max(0, 140 + shade)},${Math.max(0, 55 + shade * 0.5)},0.55)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(220, 220);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function runwayTexture() {
  const w = 128, h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3c3c41';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e9e9e9';
  const dashH = 44, gap = 34;
  for (let y = 12; y < h; y += dashH + gap) ctx.fillRect(w / 2 - 4, y, 8, dashH);
  ctx.fillRect(8, 0, 5, h);
  ctx.fillRect(w - 13, 0, 5, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, RUNWAY_LENGTH / 44);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld() {
  const group = new THREE.Group();

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = GROUND_Y - 0.03;
  grass.receiveShadow = true;
  group.add(grass);

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY_WIDTH, RUNWAY_LENGTH),
    new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.9 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, GROUND_Y, 0);
  runway.receiveShadow = true;
  group.add(runway);

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-140, 200, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  group.add(sun);
  group.add(new THREE.AmbientLight(0xffffff, 0.6));

  return { group, groundY: GROUND_Y, skyColor: 0x8fc7ec };
}
