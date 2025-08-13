let ClickCount = 0;
const ours = document.getElementById('ours');  //id "ours"
const counter = document.getElementById('click-counter'); // id "click-counter"

ours.addEventListener('click', () => {
  ClickCount++;
  counter.textContent = "Score d'ours : " + ClickCount;
});


