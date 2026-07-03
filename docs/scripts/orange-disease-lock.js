(function () {
  'use strict';

  var PASSWORD = 'RJ45';
  var SESSION_KEY = 'od_unlocked';

  var form = document.getElementById('od-lock-form');
  var input = document.getElementById('od-lock-input');
  var error = document.getElementById('od-lock-error');

  function unlock() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    document.body.classList.remove('od-locked');
    if (typeof window.__odInit === 'function') window.__odInit();
  }

  if (sessionStorage.getItem(SESSION_KEY) === 'true') {
    unlock();
    return;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (input.value === PASSWORD) {
      unlock();
    } else {
      error.style.display = 'block';
      input.value = '';
      input.focus();
    }
  });
})();
