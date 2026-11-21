// Solmar City — keyboard and mouse.
//
// One object owns every key and the mouse. The game reads it two ways:
// `down` for held keys (driving, walking) and `pressed` for edges that
// fire once (enter car, punch, reload, pause). `pressed` is cleared by the
// main loop after each update, so a single tap never double-fires.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    anyKey: false,
  };

  const GAME_KEYS = [
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'KeyE', 'KeyF', 'KeyR', 'KeyP', 'KeyM', 'KeyN',
  ];

  function onKeyDown(e) {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      input.pressed.add(e.code);
      input.anyKey = true;
    }
    input.keys.add(e.code);
  }

  function onKeyUp(e) {
    input.keys.delete(e.code);
  }

  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  }

  function onMouseDown(e) {
    onMouseMove(e);
    input.mouse.down = true;
    input.mouse.clicked = true;
    input.anyKey = true;
  }

  function onMouseUp() {
    input.mouse.down = false;
  }

  function onBlur() {
    input.keys.clear();
    // A key pressed while the window was blurred must not fire late on return.
    input.pressed.clear();
    input.mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  // True while the physical key is held.
  input.isDown = (code) => input.keys.has(code);

  // True only on the frame the key went down.
  input.wasPressed = (code) => input.pressed.has(code);

  // True if any movement key is held (used to wake the audio context).
  input.moving = () => (
    input.keys.has('KeyW') || input.keys.has('KeyA') ||
    input.keys.has('KeyS') || input.keys.has('KeyD') ||
    input.keys.has('ArrowUp') || input.keys.has('ArrowDown') ||
    input.keys.has('ArrowLeft') || input.keys.has('ArrowRight')
  );

  // Call once per frame, after the update, to clear edge state.
  input.endFrame = () => {
    input.pressed.clear();
    input.mouse.clicked = false;
    input.anyKey = false;
  };

  return input;
}
