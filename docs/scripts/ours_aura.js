const ours = document.querySelector('.ours_img img');

function getRandomColor() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r},${g},${b},1)`;
}

let auraInterval = null;

// Quand la souris entre sur l'image
ours.addEventListener('mouseenter', () => {
  // démarre l'intervalle uniquement si il n'existe pas
  if (!auraInterval) {
    auraInterval = setInterval(() => {
      const color = getRandomColor();
      ours.style.filter = `drop-shadow(0 0 30px ${color}) drop-shadow(0 0 50px ${color})`;
    }, 100); // toutes les 100ms
  }
});

// Quand la souris quitte l'image
ours.addEventListener('mouseleave', () => {
  // arrête l'intervalle
  clearInterval(auraInterval);
  auraInterval = null;
  // remet un filtre neutre ou le retire
  ours.style.filter = 'none';
});
