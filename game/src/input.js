// Keyboard and mouse state, polled by the simulation each step. Keys are
// tracked by code so layout does not matter; one-shot presses are queued so
// a tap between frames is never lost.

export function createInput(canvas) {
  const held = new Set();
  const pressed = [];
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    pressed.push(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  addEventListener('keyup', (event) => held.delete(event.code));
  addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** True while any of the given key codes is held. */
    down: (...codes) => codes.some((code) => held.has(code)),
    /** True once per physical press of any of the given codes. */
    take: (...codes) => {
      let hit = false;
      for (let i = pressed.length - 1; i >= 0; i--) {
        if (codes.includes(pressed[i])) { pressed.splice(i, 1); hit = true; }
      }
      return hit;
    },
    /** Call at the end of a step: clears per-step mouse clicks and stale presses. */
    endStep() {
      mouse.clicked = false;
      if (pressed.length > 24) pressed.splice(0, pressed.length - 24);
    },
  };
}
