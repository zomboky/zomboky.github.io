(function () {
  var API_URL = 'https://bear.servebeer.com/zomboky-api/api/visitor-count';
  var el = document.getElementById('visitor-counter-digits');
  if (!el) return;

  el.textContent = '......';

  fetch(API_URL, { method: 'POST' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (typeof data.count === 'number') {
        el.textContent = String(data.count).padStart(6, '0');
      }
    })
    .catch(function () {
      // fallback silencieux : affiche des tirets si le serveur est injoignable
      el.textContent = '------';
    });
})();
