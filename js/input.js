// input.js — keyboard input with edge detection and rebinding-friendly action map.
// Exposes Input.isDown(action), Input.justPressed(action), Input.justReleased(action).

const Input = (() => {
  const ACTIONS = {
    left:    ['ArrowLeft', 'KeyA'],
    right:   ['ArrowRight', 'KeyD'],
    up:      ['ArrowUp', 'KeyW'],
    down:    ['ArrowDown', 'KeyS'],
    jump:    ['Space'],
    attack:  ['KeyX', 'KeyJ'],
    mute:    ['KeyM'],
    confirm: ['Enter', 'Space', 'KeyZ'],
    pause:   ['KeyP', 'Escape'],
    debug:   ['Backquote'],
  };

  const keysDown   = new Set();
  const keysJustDown = new Set();
  const keysJustUp   = new Set();

  function init() {
    window.addEventListener('keydown', (e) => {
      if (isHandled(e.code)) e.preventDefault();
      if (!keysDown.has(e.code)) keysJustDown.add(e.code);
      keysDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (isHandled(e.code)) e.preventDefault();
      keysDown.delete(e.code);
      keysJustUp.add(e.code);
    });
    window.addEventListener('blur', () => {
      keysDown.clear();
    });
  }

  function isHandled(code) {
    for (const k in ACTIONS) {
      if (ACTIONS[k].includes(code)) return true;
    }
    return false;
  }

  function isDown(action) {
    const codes = ACTIONS[action];
    if (!codes) return false;
    for (const c of codes) if (keysDown.has(c)) return true;
    return false;
  }

  function justPressed(action) {
    const codes = ACTIONS[action];
    if (!codes) return false;
    for (const c of codes) if (keysJustDown.has(c)) return true;
    return false;
  }

  function justReleased(action) {
    const codes = ACTIONS[action];
    if (!codes) return false;
    for (const c of codes) if (keysJustUp.has(c)) return true;
    return false;
  }

  function endFrame() {
    keysJustDown.clear();
    keysJustUp.clear();
  }

  function anyJustPressed() {
    return keysJustDown.size > 0;
  }

  return { init, isDown, justPressed, justReleased, endFrame, anyJustPressed };
})();
