// Keyboard + mouse input. One object the game loop reads each frame;
// keys are stored by their code (KeyW, ArrowUp, Space, ...) so layouts
// do not matter, and every key the game uses is listed in GAME_KEYS.

export const GAME_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'KeyE', 'KeyF', 'KeyR', 'KeyM', 'KeyP', 'Escape', 'Enter',
  'ShiftLeft', 'ShiftRight',
];

export function createInput(canvas) {
  const input = {
    keys: {},
    pressed: {}, // keys pressed since the last frame was consumed
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    // World-space aim point, filled in by main.js after the camera moves.
    aimX: 0,
    aimY: 0,
  };

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      input.keys[event.code] = true;
      input.pressed[event.code] = true;
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys[event.code] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = {};
    input.mouseDown = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return input;
}

// ---- Helpers the game loop calls once a frame ----

export function isDown(input, ...codes) {
  return codes.some((c) => input.keys[c]);
}

// True once when the key went down (edge-triggered); consumed by this call.
export function wasPressed(input, ...codes) {
  for (const c of codes) {
    if (input.pressed[c]) {
      input.pressed[c] = false;
      return true;
    }
  }
  return false;
}

export function wasMousePressed(input) {
  const p = input.mousePressed;
  input.mousePressed = false;
  return p;
}

// Clear the edge-triggered buffers at the end of a frame.
export function endFrame(input) {
  input.pressed = {};
  input.mousePressed = false;
}
