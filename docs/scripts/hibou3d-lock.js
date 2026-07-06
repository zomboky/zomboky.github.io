(function () {
  'use strict';

  // Hash SHA-256 (hex) du mot de passe v6, injecté au déploiement à partir
  // du secret GitHub HIBOU3D_V6_PASSWORD (voir .github/workflows/deploy.yml) —
  // le mot de passe en clair n'est jamais écrit dans les fichiers servis.
  var EXPECTED_HASH = '__HIBOU3D_V6_PASSWORD_HASH__';
  var SESSION_KEY = 'h3d_v6_unlocked';

  var lock = document.getElementById('hibou-lock');
  var form = document.getElementById('hibou-lock-form');
  var input = document.getElementById('hibou-lock-input');
  var error = document.getElementById('hibou-lock-error');

  function unlock() {
    sessionStorage.setItem(SESSION_KEY, '1');
    document.body.classList.remove('hibou-locked');
  }

  function sha256Hex(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', data).then(function (digest) {
      return Array.from(new Uint8Array(digest))
        .map(function (b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    });
  }

  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    document.body.classList.remove('hibou-locked');
  }

  if (EXPECTED_HASH === '__HIBOU3D_V6_PASSWORD_HASH__') {
    console.warn('hibou3d-lock: hash non injecté (build local ?) — le verrou v6 restera fermé.');
  }

  // Empêche les touches/clics saisis dans le formulaire de remonter jusqu'aux
  // contrôles du jeu (écoutés sur window) tant que l'écran est verrouillé.
  ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend']
    .forEach(function (type) {
      lock.addEventListener(type, function (e) { e.stopPropagation(); });
    });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.style.display = 'none';
    sha256Hex(input.value).then(function (hash) {
      if (hash === EXPECTED_HASH) {
        unlock();
      } else {
        error.textContent = 'Code incorrect.';
        error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    });
  });
})();
