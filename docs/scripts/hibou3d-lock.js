(function () {
  'use strict';

  var API_BASE = 'https://bear.servebeer.com/orange-api';
  var SESSION_KEY = 'h3d_v6_token';

  var lock = document.getElementById('hibou-lock');
  var form = document.getElementById('hibou-lock-form');
  var input = document.getElementById('hibou-lock-input');
  var error = document.getElementById('hibou-lock-error');
  var submitBtn = form.querySelector('button');

  function showLock() {
    document.body.classList.add('hibou-locked');
  }

  function unlock(token) {
    sessionStorage.setItem(SESSION_KEY, token);
    document.body.classList.remove('hibou-locked');
    if (typeof window.__hibouStart === 'function') window.__hibouStart(token);
  }

  function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
  }

  window.__hibouRelock = function () {
    sessionStorage.removeItem(SESSION_KEY);
    showLock();
  };

  // Empêche les touches/clics saisis dans le formulaire de remonter jusqu'aux
  // contrôles du jeu (écoutés sur window) tant que l'écran est verrouillé.
  ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend']
    .forEach(function (type) {
      lock.addEventListener(type, function (e) { e.stopPropagation(); });
    });

  function attemptLogin(password) {
    submitBtn.disabled = true;
    fetch(API_BASE + '/api/hibou3d/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            throw new Error(body.error || ('HTTP ' + res.status));
          });
        }
        return res.json();
      })
      .then(function (body) {
        unlock(body.token);
      })
      .catch(function (err) {
        showError(
          err.message === 'mot de passe incorrect'
            ? 'Code incorrect.'
            : 'Connexion au serveur impossible (' + err.message + ').'
        );
        input.value = '';
        input.focus();
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  }

  function verifyAndUnlock(token) {
    fetch(API_BASE + '/api/hibou3d/verify', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('invalid');
        unlock(token);
      })
      .catch(function () {
        sessionStorage.removeItem(SESSION_KEY);
        // Le verrou reste affiché — l'utilisateur doit ressaisir son code.
      });
  }

  var existingToken = sessionStorage.getItem(SESSION_KEY);
  if (existingToken) {
    verifyAndUnlock(existingToken);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.style.display = 'none';
    attemptLogin(input.value);
  });
})();
