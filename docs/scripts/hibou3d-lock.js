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

  function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
  }

  // Implémentation SHA-256 pure JS (pas de dépendance à window.crypto.subtle,
  // qui exige un contexte sécurisé/HTTPS — le site tourne en HTTP simple).
  function sha256Hex(str) {
    // Convertit en chaîne d'octets UTF-8 pour supporter les accents/emoji.
    var bytes = unescape(encodeURIComponent(str));

    function rrot(v, a) { return (v >>> a) | (v << (32 - a)); }

    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var k = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];

    var bitLen = bytes.length * 8;
    bytes += '\x80';
    while (bytes.length % 64 !== 56) bytes += '\x00';

    var words = [];
    for (var i = 0; i < bytes.length; i++) {
      words[i >> 2] = (words[i >> 2] || 0) | (bytes.charCodeAt(i) << ((3 - (i % 4)) * 8));
    }
    words[words.length] = Math.floor(bitLen / 0x100000000);
    words[words.length] = bitLen >>> 0;

    for (var chunk = 0; chunk < words.length; chunk += 16) {
      var w = words.slice(chunk, chunk + 16);
      for (var t = 16; t < 64; t++) {
        var w15 = w[t - 15], w2 = w[t - 2];
        var s0 = rrot(w15, 7) ^ rrot(w15, 18) ^ (w15 >>> 3);
        var s1 = rrot(w2, 17) ^ rrot(w2, 19) ^ (w2 >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }

      var a = h[0], b = h[1], c = h[2], d = h[3];
      var e = h[4], f = h[5], g = h[6], hh = h[7];

      for (var i2 = 0; i2 < 64; i2++) {
        var S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + k[i2] + w[i2]) | 0;
        var S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;

        hh = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }

      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }

    return h.map(function (v) {
      return (v >>> 0).toString(16).padStart(8, '0');
    }).join('');
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
    try {
      var hash = sha256Hex(input.value);
      if (hash === EXPECTED_HASH) {
        unlock();
      } else {
        showError('Code incorrect.');
        input.value = '';
        input.focus();
      }
    } catch (err) {
      showError('Erreur : ' + err.message);
    }
  });
})();
