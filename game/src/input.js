// input.js — the keyboard, kept as two sets: keys held down right now and
// keys pressed since the last frame, so menus can react to a tap while
// driving reads the held set.

const held = new Set();
const tapped = new Set();

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) tapped.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => {
    held.clear();
    tapped.clear();
  });
}

export const isDown = (code) => held.has(code);

// True once per physical press; reading it consumes the tap.
export function wasTapped(code) {
  if (!tapped.has(code)) return false;
  tapped.delete(code);
  return true;
}

export function endFrame() {
  tapped.clear();
}

// Movement axes from either WASD or the arrow keys: x right, y down.
export function moveAxes() {
  const x = (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0);
  const y = (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0) - (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0);
  return { x, y };
}
