// Contrôles tactiles du vol : joystick flottant (tangage/roulis) + boutons
// (lacet gauche/droite, poussée, frein). Le HUD de flight-sim étant du DOM
// pur (contrairement au HUD canvas 2D de hibou-3d.html), ces contrôles sont
// eux aussi de vrais éléments DOM plutôt que dessinés sur un canvas.
//
// Événements tactiles natifs (touchstart/move/end/cancel), pas Pointer
// Events, pour un support multi-touch fiable (joystick + jusqu'à 4 boutons
// pressés simultanément), même logique que hibou-3d.html.

const JOYSTICK_RADIUS = 60;

export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function makeButton(id, label, ariaLabel) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.type = 'button';
  btn.textContent = label;
  btn.setAttribute('aria-label', ariaLabel);
  return btn;
}

export function createTouchControls({ mount }) {
  const root = document.createElement('div');
  root.id = 'touch-controls';
  root.hidden = true;

  const joystickZone = document.createElement('div');
  joystickZone.id = 'tc-joystick-zone';
  const joystickBase = document.createElement('div');
  joystickBase.id = 'tc-joystick-base';
  const joystickKnob = document.createElement('div');
  joystickKnob.id = 'tc-joystick-knob';
  joystickZone.append(joystickBase, joystickKnob);

  const yawLeftBtn = makeButton('tc-yaw-left', '◀', 'Lacet gauche');
  const yawRightBtn = makeButton('tc-yaw-right', '▶', 'Lacet droite');
  const throttleBtn = makeButton('tc-throttle', '▲', 'Poussée');
  const brakeBtn = makeButton('tc-brake', '■', 'Frein');

  root.append(joystickZone, yawLeftBtn, yawRightBtn, throttleBtn, brakeBtn);
  mount.appendChild(root);

  const joystick = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
  const buttons = {
    yawLeft: { el: yawLeftBtn, active: false, id: null },
    yawRight: { el: yawRightBtn, active: false, id: null },
    throttle: { el: throttleBtn, active: false, id: null },
    brake: { el: brakeBtn, active: false, id: null },
  };

  function pressButton(key, id) {
    const b = buttons[key];
    b.active = true;
    b.id = id;
    b.el.classList.add('pressed');
  }
  function releaseButton(key) {
    const b = buttons[key];
    b.active = false;
    b.id = null;
    b.el.classList.remove('pressed');
  }
  function releaseButtonByTouchId(id) {
    for (const key of Object.keys(buttons)) {
      if (buttons[key].active && buttons[key].id === id) releaseButton(key);
    }
  }

  function bindButton(key) {
    buttons[key].el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      pressButton(key, t.identifier);
    }, { passive: false });
  }
  for (const key of Object.keys(buttons)) bindButton(key);

  function setJoystickVisual(active) {
    joystickBase.style.opacity = active ? '1' : '0';
    joystickKnob.style.opacity = active ? '1' : '0';
  }

  joystickZone.addEventListener('touchstart', (e) => {
    if (joystick.active) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    joystick.active = true;
    joystick.id = t.identifier;
    joystick.baseX = t.clientX;
    joystick.baseY = t.clientY;
    joystick.dx = 0;
    joystick.dy = 0;
    joystickBase.style.left = `${t.clientX}px`;
    joystickBase.style.top = `${t.clientY}px`;
    joystickKnob.style.left = `${t.clientX}px`;
    joystickKnob.style.top = `${t.clientY}px`;
    setJoystickVisual(true);
  }, { passive: false });

  function handleWindowTouchMove(e) {
    if (!joystick.active) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== joystick.id) continue;
      e.preventDefault();
      let dx = t.clientX - joystick.baseX;
      let dy = t.clientY - joystick.baseY;
      const d = Math.hypot(dx, dy);
      if (d > JOYSTICK_RADIUS) { dx = (dx / d) * JOYSTICK_RADIUS; dy = (dy / d) * JOYSTICK_RADIUS; }
      joystick.dx = dx;
      joystick.dy = dy;
      joystickKnob.style.left = `${joystick.baseX + dx}px`;
      joystickKnob.style.top = `${joystick.baseY + dy}px`;
    }
  }

  function handleWindowTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (joystick.active && t.identifier === joystick.id) {
        joystick.active = false;
        joystick.dx = 0;
        joystick.dy = 0;
        joystick.id = null;
        setJoystickVisual(false);
      }
      releaseButtonByTouchId(t.identifier);
    }
  }

  window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
  window.addEventListener('touchend', handleWindowTouchEnd, { passive: false });
  window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: false });

  function show() { root.hidden = false; }
  function hide() {
    root.hidden = true;
    joystick.active = false;
    joystick.dx = 0;
    joystick.dy = 0;
    joystick.id = null;
    setJoystickVisual(false);
    for (const key of Object.keys(buttons)) releaseButton(key);
  }

  function getInput() {
    return {
      pitch: joystick.active ? clamp(-joystick.dy / JOYSTICK_RADIUS, -1, 1) : 0,
      roll: joystick.active ? clamp(joystick.dx / JOYSTICK_RADIUS, -1, 1) : 0,
      yaw: (buttons.yawRight.active ? 1 : 0) - (buttons.yawLeft.active ? 1 : 0),
      throttleUp: buttons.throttle.active,
      brake: buttons.brake.active,
    };
  }

  return { show, hide, getInput };
}
