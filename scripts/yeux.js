const bob = document.getElementById('bob');  // <-- ici
const oeilgauche = document.getElementById('oeil-gauche');
const oeildroit = document.getElementById('oeil-droit');

const zoneoeildroit = { xMin: 24, yMin: 16, xMax: 27, yMax: 19 };
const zoneoeilgauche = { xMin: 38, yMin: 16, xMax: 41, yMax: 19 };


// FONCTION CLAMP

/*
Cette fonction s’appelle clamp. Elle sert à limiter une valeur (n) pour qu’elle reste toujours entre deux bornes : un minimum (min) et un maximum (max).

Explication étape par étape :

Si n est plus petit que min, la fonction retourne min.
Si n est plus grand que max, la fonction retourne max.
Si n est entre min et max, la fonction retourne n tel quel.
*/

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}
//////////////////////////////////////////////////////////
// Les variables mouse_pos_x et mouse_pos_y sont définie dans mouse-position.js préalablement chargé

bob.addEventListener('mousemove', () => {
  const rect = bob.getBoundingClientRect();
  const mouseX = Math.floor(mouse_pos_x - rect.left);
  const mouseY = Math.floor(mouse_pos_y - rect.top);

  oeildroit.style.left = clamp(mouseX, zoneoeildroit.xMin, zoneoeildroit.xMax) + 'px';
  oeildroit.style.top = clamp(mouseY, zoneoeildroit.yMin, zoneoeildroit.yMax) + 'px';

  oeilgauche.style.left = clamp(mouseX, zoneoeilgauche.xMin, zoneoeilgauche.xMax) + 'px';
  oeilgauche.style.top = clamp(mouseY, zoneoeilgauche.yMin, zoneoeilgauche.yMax) + 'px';
});



