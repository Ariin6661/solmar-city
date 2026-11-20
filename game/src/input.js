// Keyboard + mouse state. One shared object the whole game reads.
// Edge-triggered presses live in `pressed` and are cleared each frame
// by main.js after the update step.
export function makeInput() {
  return {
    keys: new Set(), // currently held, by e.code
    pressed: new Set(), // pressed this frame (edge), by e.code
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false, // edge: clicked this frame
    anyKey: false, // set on the first key/click (audio unlock)
  };
}

export function bindInput(input, canvas) {
  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'KeyE', 'KeyF', 'KeyR', 'KeyP', 'KeyM', 'KeyN', 'KeyT', 'Enter', 'Escape',
  ]);
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
      input.anyKey = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrameInput(input) {
  input.pressed.clear();
  input.mousePressed = false;
}

export function keyDown(input, code) {
  return input.keys.has(code);
}

export function keyPressed(input, code) {
  return input.pressed.has(code);
}

// WASD / arrows as a -1..1 axis pair.
export function moveAxis(input) {
  let x = 0;
  let y = 0;
  if (keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft')) x -= 1;
  if (keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight')) x += 1;
  if (keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp')) y -= 1;
  if (keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown')) y += 1;
  return { x, y };
}

// Mouse position in world coordinates, given the camera.
export function mouseWorld(input, cam, canvas) {
  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;
  return {
    x: cam.x + input.mouseX * scaleX - canvas.width / 2,
    y: cam.y + input.mouseY * scaleY - canvas.height / 2,
  };
}
