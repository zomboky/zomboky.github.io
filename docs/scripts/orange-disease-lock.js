(function () {
  'use strict';

  var API_BASE = 'https://bear.servebeer.com/orange-api';
  var SESSION_KEY = 'od_token';

  var form = document.getElementById('od-lock-form');
  var input = document.getElementById('od-lock-input');
  var error = document.getElementById('od-lock-error');
  var submitBtn = form.querySelector('button');

  function showLock() {
    document.body.classList.add('od-locked');
  }

  function unlock(token) {
    sessionStorage.setItem(SESSION_KEY, token);
    document.body.classList.remove('od-locked');
    if (typeof window.__odInit === 'function') window.__odInit(token);
  }

  function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
  }

  window.__odRelock = function () {
    sessionStorage.removeItem(SESSION_KEY);
    showLock();
  };

  function attemptLogin(password) {
    submitBtn.disabled = true;
    fetch(API_BASE + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res
            .json()
            .catch(function () { return {}; })
            .then(function (body) {
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
            ? 'Mot de passe incorrect.'
            : 'Connexion au serveur impossible (' + err.message + ').'
        );
        input.value = '';
        input.focus();
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  }

  var existingToken = sessionStorage.getItem(SESSION_KEY);
  if (existingToken) {
    unlock(existingToken);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.style.display = 'none';
    attemptLogin(input.value);
  });
})();
