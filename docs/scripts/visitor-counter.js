(function () {
  var STORAGE_KEY = 'zomboky_visitor_count';
  var STARTING_NUMBER = 1994; // clin d'oeil rétro, pas un vrai compteur global

  var count = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  if (isNaN(count)) count = STARTING_NUMBER;
  count += 1;
  localStorage.setItem(STORAGE_KEY, count);

  var el = document.getElementById('visitor-counter-digits');
  if (el) el.textContent = String(count).padStart(6, '0');
})();
