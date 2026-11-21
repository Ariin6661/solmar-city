// Solmar City — keyboard and mouse state.
// Tracks held keys, edge-triggered presses and the mouse in canvas
// coordinates. Game keys never scroll the page.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressedSet = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.gameKeys = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'KeyE', 'KeyF', 'KeyR', 'KeyP', 'KeyM', 'KeyN',
    ]);
    window.addEventListener('keydown', (e) => {
      if (this.gameKeys.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressedSet.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) {
    return this.held.has(code);
  }

  downAny(codes) {
    return codes.some((c) => this.held.has(c));
  }

  pressed(code) {
    return this.pressedSet.has(code);
  }

  // Like pressed(), but consumes the edge so a second check in the same
  // frame (dialogue advance, then enter-car) does not see it twice.
  consumePressed(code) {
    const hit = this.pressedSet.has(code);
    if (hit) this.pressedSet.delete(code);
    return hit;
  }

  consumeClick() {
    const c = this.mouse.clicked;
    this.mouse.clicked = false;
    return c;
  }

  // Call once per frame, after the update, so edges fire exactly once.
  endFrame() {
    this.pressedSet.clear();
    this.mouse.clicked = false;
  }
}
