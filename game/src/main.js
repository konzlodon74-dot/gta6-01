// Bootstrap: size the canvas, run the fixed-step loop, draw every frame.
// With ?shot=<name> the game stages a screenshot scene instead of the title
// screen (see shots.js); that is how the entry's screenshots are taken.

import { createGame } from './game.js';
import { drawScene } from './render.js';
import { drawHUD, drawOverlay } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const G = createGame(canvas);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  G.viewSize = { w: canvas.width, h: canvas.height };
}
addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
if (params.has('shot')) {
  stageShot(G, params.get('shot'));
  document.title = 'Palmera Heat — shot ready';
}

// Exposed for automated play-testing and screenshot tooling.
window.__palmera = G;

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!G.frozen) {
    accumulator += delta;
    while (accumulator >= G.STEP) {
      G.step(G.STEP);
      accumulator -= G.STEP;
    }
  }
  drawScene(ctx, G, canvas.width, canvas.height);
  drawHUD(ctx, G, canvas.width, canvas.height);
  drawOverlay(ctx, G, canvas.width, canvas.height);
}
requestAnimationFrame(frame);
