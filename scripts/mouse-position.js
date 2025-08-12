// Variables pour stocker la position de la souris

let mouse_pos_x = 0;
let mouse_pos_y = 0;

document.addEventListener('mousemove', function(event) {
 
  mouse_pos_x = event.clientX; // Donnent la position de la souris en x et y
  mouse_pos_y = event.clientY;
  
  // débugage console
  console.log('Souris en:', mouse_pos_x, mouse_pos_y);
});

