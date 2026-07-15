import { CATEGORIES, partsInCategory, MAX_PARTS } from './parts.js';

// Gère tout le DOM non-3D : palette du hangar, panneau de stats, messages,
// et instruments de vol. Pas de framework — sélection d'éléments par id,
// comme le reste du site (voir docs/scripts/visitor-counter.js).

export function buildPalette(onSelectDef) {
  const tabsEl = document.getElementById('part-categories');
  const listEl = document.getElementById('part-list');
  let activeCategory = CATEGORIES[0].id;

  function renderList() {
    listEl.innerHTML = '';
    for (const part of partsInCategory(activeCategory)) {
      const btn = document.createElement('button');
      btn.className = 'part-btn';
      btn.dataset.partId = part.id;
      btn.textContent = part.label;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.part-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onSelectDef(part.id);
      });
      listEl.appendChild(btn);
    }
  }

  tabsEl.innerHTML = '';
  for (const cat of CATEGORIES) {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat.id === activeCategory ? ' selected' : '');
    btn.textContent = cat.label;
    btn.addEventListener('click', () => {
      activeCategory = cat.id;
      document.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      renderList();
    });
    tabsEl.appendChild(btn);
  }
  renderList();
}

export function clearPartSelection() {
  document.querySelectorAll('.part-btn').forEach((b) => b.classList.remove('selected'));
}

export function updateHangarStats(stats, design, errors) {
  document.getElementById('stat-mass').textContent = `${Math.round(stats.mass)} kg`;
  document.getElementById('stat-thrust').textContent = `${Math.round(stats.thrustMax)} N`;
  const wingArea = stats.surfaces.filter((s) => s.axis === 'lift' && !s.controlAxis).reduce((s, w) => s + w.area, 0);
  document.getElementById('stat-wingarea').textContent = `${wingArea.toFixed(1)} m²`;
  document.getElementById('stat-parts').textContent = `${design.parts.length} / ${MAX_PARTS}`;

  const msg = document.getElementById('hangar-message');
  if (errors.length) {
    msg.textContent = errors.join(' ');
    msg.classList.add('error');
  } else {
    msg.textContent = 'Avion prêt à voler.';
    msg.classList.remove('error');
  }
  document.getElementById('btn-fly').disabled = errors.length > 0;
}

export function setHint(text) {
  document.getElementById('hangar-hint').textContent = text || '';
}

export function updateSelectionUI(hasSelection) {
  document.getElementById('btn-remove').disabled = !hasSelection;
}

export function showSaveCode(code) {
  const panel = document.getElementById('save-panel');
  panel.hidden = false;
  document.getElementById('save-code').textContent = code;
}

export function showSaveError(message) {
  const panel = document.getElementById('save-panel');
  panel.hidden = false;
  document.getElementById('save-code').textContent = message;
}

export function toggleLoadPanel(show) {
  document.getElementById('load-panel').hidden = !show;
}

// ── HUD de vol ──
export function updateFlightHud(state) {
  document.getElementById('hud-speed').textContent = `${Math.round(state.airspeed * 3.6)} km/h`;
  document.getElementById('hud-altitude').textContent = `${Math.max(0, Math.round(state.position.y))} m`;
  document.getElementById('hud-throttle').textContent = `${Math.round(state.throttle * 100)} %`;
  document.getElementById('hud-stall').hidden = !state.stalling;
  document.getElementById('hud-ground').hidden = !state.onGround;
}
