// Everything the eye sees of the world: Palmera's streets, pseudo-3D rooftops
// with long afternoon shadows, palms, traffic, people, tracers, skid marks
// and the pulsing beacon over the current objective. Pure drawing — the
// simulation lives in game.js and its systems.

import { BLOCK, ROAD, COLS, ROWS, WORLD_W, WORLD_H, COLORS } from './config.js';

/** Darken or lighten a #rrggbb colour by a factor. */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

/** A stable little hash so roof details and plaza tints never flicker. */
function hash(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The full world frame. Camera centres on (cam.x, cam.y). */
export function drawScene(ctx, G, w, h) {
  const cam = G.camera;
  ctx.save();
  ctx.translate(Math.round(w / 2 - cam.x), Math.round(h / 2 - cam.y));
  const view = { x0: cam.x - w / 2 - 90, y0: cam.y - h / 2 - 90, x1: cam.x + w / 2 + 90, y1: cam.y + h / 2 + 90 };
  // Beyond the map: dry ground to the north and sides, the sea to the south.
  ctx.fillStyle = '#a79b7d';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  const seaGrad = ctx.createLinearGradient(0, WORLD_H, 0, WORLD_H + 320);
  seaGrad.addColorStop(0, COLORS.sea);
  seaGrad.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = seaGrad;
  ctx.fillRect(view.x0, WORLD_H, view.x1 - view.x0, view.y1 - WORLD_H);
  drawGround(ctx, G, view);
  drawRoads(ctx, G, view);
  drawLocationDecals(ctx, G, view);
  drawSkids(ctx, G);
  drawPickups(ctx, G);
  drawTrees(ctx, G, view);
  drawBuildings(ctx, G, view);
  drawMarker(ctx, G);
  for (const car of G.cars) drawCar(ctx, G, car);
  for (const ped of G.peds) drawPed(ctx, G, ped);
  if (!G.player.inCar && G.state !== 'title') drawPlayer(ctx, G);
  drawEffects(ctx, G);
  ctx.restore();
  drawSeaFoam(ctx, G, w, h);
}

function drawGround(ctx, G, view) {
  ctx.fillStyle = COLORS.sidewalk;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (const block of G.city.blocks) {
    if (block.x > view.x1 || block.y > view.y1 || block.x + BLOCK < view.x0 || block.y + BLOCK < view.y0) continue;
    if (block.kind === 'park') {
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(block.x, block.y, BLOCK, BLOCK);
      ctx.fillStyle = COLORS.plaza;
      ctx.fillRect(block.x + BLOCK / 2 - 8, block.y, 16, BLOCK);
      ctx.fillRect(block.x, block.y + BLOCK / 2 - 8, BLOCK, 16);
    } else if (block.kind === 'beach') {
      ctx.fillStyle = COLORS.sand;
      ctx.fillRect(block.x, block.y, BLOCK, BLOCK);
      ctx.fillStyle = 'rgba(190, 160, 100, 0.35)';
      for (let n = 0; n < 8; n++) {
        ctx.fillRect(block.x + hash(block.x, n * 7) * BLOCK, block.y + hash(block.y, n * 13) * BLOCK, 5, 3);
      }
    } else if (block.kind === 'lot') {
      ctx.fillStyle = '#43464c';
      ctx.fillRect(block.x + 6, block.y + 6, BLOCK - 12, BLOCK - 12);
      ctx.strokeStyle = 'rgba(240, 238, 225, 0.5)';
      ctx.lineWidth = 2;
      for (const spot of G.city.parkingSpots) {
        if (Math.abs(spot.x - (block.x + BLOCK / 2)) > BLOCK / 2 || Math.abs(spot.y - (block.y + BLOCK / 2)) > BLOCK / 2) continue;
        ctx.strokeRect(spot.x - 15, spot.y - 24, 30, 48);
      }
    } else {
      ctx.fillStyle = hash(block.x, block.y) > 0.5 ? COLORS.plaza : COLORS.sidewalk;
      ctx.fillRect(block.x + 4, block.y + 4, BLOCK - 8, BLOCK - 8);
    }
  }
  // The wet sand shine where the beach meets the promenade.
  ctx.fillStyle = COLORS.sandWet;
  ctx.fillRect(0, WORLD_H - ROAD - 6, WORLD_W, 6);
}

function drawRoads(ctx, G, view) {
  ctx.fillStyle = COLORS.road;
  for (let i = 0; i <= COLS; i++) ctx.fillRect(i * (BLOCK + ROAD), 0, ROAD, WORLD_H);
  for (let j = 0; j <= ROWS; j++) ctx.fillRect(0, j * (BLOCK + ROAD), WORLD_W, ROAD);
  ctx.fillStyle = COLORS.roadEdge;
  for (let i = 0; i <= COLS; i++) { ctx.fillRect(i * (BLOCK + ROAD), 0, 3, WORLD_H); ctx.fillRect(i * (BLOCK + ROAD) + ROAD - 3, 0, 3, WORLD_H); }
  // Lane dashes down the centre of every road.
  ctx.fillStyle = COLORS.lane;
  for (let i = 0; i <= COLS; i++) {
    const cx = i * (BLOCK + ROAD) + ROAD / 2 - 2;
    for (let y = 8; y < WORLD_H; y += 44) if (y > view.y0 - 60 && y < view.y1) ctx.fillRect(cx, y, 4, 24);
  }
  for (let j = 0; j <= ROWS; j++) {
    const cy = j * (BLOCK + ROAD) + ROAD / 2 - 2;
    for (let x = 8; x < WORLD_W; x += 44) if (x > view.x0 - 60 && x < view.x1) ctx.fillRect(x, cy, 24, 4);
  }
  // Crosswalks at every crossing.
  ctx.fillStyle = 'rgba(217, 213, 198, 0.75)';
  for (let i = 0; i <= COLS; i++) {
    for (let j = 0; j <= ROWS; j++) {
      const x = i * (BLOCK + ROAD);
      const y = j * (BLOCK + ROAD);
      if (x > view.x1 || y > view.y1 || x + ROAD < view.x0 || y + ROAD < view.y0) continue;
      for (let s = 0; s < 5; s++) {
        ctx.fillRect(x + 8 + s * 13, y - 12, 7, 10);
        ctx.fillRect(x + 8 + s * 13, y + ROAD + 2, 7, 10);
      }
    }
  }
}

/**
 * Named places get a painted pad and a small sign, so the cantina, the docks
 * and the gym read as destinations when Rico rolls up: a tinted apron on the
 * ground and the place's name lettered over it.
 */
function drawLocationDecals(ctx, G, view) {
  ctx.textAlign = 'center';
  for (const loc of Object.values(G.city.locations)) {
    if (loc.x < view.x0 || loc.x > view.x1 || loc.y < view.y0 || loc.y > view.y1) continue;
    ctx.fillStyle = 'rgba(255, 190, 60, 0.13)';
    ctx.beginPath();
    ctx.ellipse(loc.x, loc.y, 46, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 84, 20, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 252, 240, 0.9)';
    ctx.strokeStyle = 'rgba(60, 44, 14, 0.55)';
    ctx.lineWidth = 3;
    const label = loc.name.toUpperCase();
    ctx.strokeText(label, loc.x, loc.y - 42);
    ctx.fillText(label, loc.x, loc.y - 42);
  }
  ctx.textAlign = 'left';
}

function drawSkids(ctx, G) {
  ctx.fillStyle = 'rgba(18, 18, 20, 0.4)';
  for (const s of G.skids) ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
}

function drawPickups(ctx, G) {
  for (const p of G.pickups) {
    const bob = Math.sin(G.time * 4 + p.x) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    if (p.kind === 'cash') {
      ctx.rotate(Math.sin(G.time * 2 + p.y) * 0.4);
      ctx.fillStyle = '#3f9e4d';
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = '#eaf7ea';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3);
    } else {
      ctx.fillStyle = '#f5f6fa';
      roundRect(ctx, -9, -9, 18, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#d64541';
      ctx.fillRect(-2.5, -7, 5, 14);
      ctx.fillRect(-7, -2.5, 14, 5);
    }
    ctx.restore();
  }
}

function drawTrees(ctx, G, view) {
  for (const t of G.city.trees) {
    if (t.x < view.x0 || t.x > view.x1 || t.y < view.y0 || t.y > view.y1) continue;
    ctx.fillStyle = 'rgba(20, 30, 16, 0.25)';
    ctx.beginPath();
    ctx.ellipse(t.x + 7, t.y + 9, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = COLORS.palmTrunk;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.quadraticCurveTo(t.x + 3, t.y - 6, t.x + 5, t.y - 11);
      ctx.stroke();
      ctx.strokeStyle = COLORS.palmLeaf;
      ctx.lineWidth = 2.6;
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2 + hash(t.x, t.y) * 2;
        ctx.beginPath();
        ctx.moveTo(t.x + 5, t.y - 11);
        ctx.quadraticCurveTo(t.x + 5 + Math.cos(a) * 11, t.y - 15 + Math.sin(a) * 5, t.x + 5 + Math.cos(a) * 17, t.y - 8 + Math.sin(a) * 9);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#5da24a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6fb45a';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(ctx, G, view) {
  for (const b of G.city.buildings) {
    if (b.x > view.x1 || b.y > view.y1 || b.x + b.w < view.x0 || b.y + b.h < view.y0) continue;
    const lift = 4 + b.floors * 1.6;
    // Long afternoon shadow, then the wall skirt, then the lifted roof.
    ctx.fillStyle = 'rgba(24, 20, 14, 0.20)';
    ctx.fillRect(b.x + lift * 0.9, b.y + lift * 1.2, b.w, b.h);
    ctx.fillStyle = shade(b.roof, 0.55);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const rx = b.x - lift * 0.35;
    const ry = b.y - lift;
    ctx.fillStyle = b.roof;
    ctx.fillRect(rx, ry, b.w, b.h);
    ctx.strokeStyle = 'rgba(40, 32, 24, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, b.w, b.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.fillRect(rx + 5, ry + 5, b.w - 10, 4);
    // Roof furniture: AC boxes, and a water tower on the taller slabs.
    ctx.fillStyle = shade(b.roof, 0.8);
    const n = 1 + Math.floor(hash(b.x, b.y) * 3);
    for (let k = 0; k < n; k++) {
      ctx.fillRect(rx + 10 + hash(b.x + k * 31, b.y) * (b.w - 34), ry + 10 + hash(b.x, b.y + k * 47) * (b.h - 34), 15, 11);
    }
    if (b.tower && b.w > 60) {
      const tx = rx + b.w - 26;
      const ty = ry + 16;
      ctx.fillStyle = '#7a5c40';
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d4630';
      ctx.fillRect(tx - 8, ty - 2, 16, 3);
    }
    // A lit sign band on downtown slabs sells the height from above.
    if (b.floors >= 8) {
      ctx.fillStyle = 'rgba(255, 214, 120, 0.85)';
      ctx.fillRect(rx + 6, ry + b.h - 10, b.w - 12, 3);
    }
  }
}

function drawMarker(ctx, G) {
  const m = G.marker;
  if (!m || G.state !== 'playing') return;
  const pulse = 14 + Math.sin(G.time * 5) * 4;
  const grad = ctx.createLinearGradient(0, m.y - 130, 0, m.y);
  grad.addColorStop(0, 'rgba(255, 209, 26, 0)');
  grad.addColorStop(1, 'rgba(255, 209, 26, 0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(m.x - 5, m.y - 130, 10, 130);
  ctx.strokeStyle = '#ffd11a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(m.x, m.y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd11a';
  ctx.beginPath();
  ctx.moveTo(m.x, m.y - 34 - Math.sin(G.time * 5) * 4);
  ctx.lineTo(m.x - 8, m.y - 48 - Math.sin(G.time * 5) * 4);
  ctx.lineTo(m.x + 8, m.y - 48 - Math.sin(G.time * 5) * 4);
  ctx.closePath();
  ctx.fill();
}

export function drawCar(ctx, G, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(15, 15, 18, 0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 6, 25, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#14161a';
  for (const [wx, wy] of [[13, -12], [13, 12], [-13, -12], [-13, 12]]) ctx.fillRect(wx - 4, wy - 2.5, 8, 5);
  // Body.
  const len = car.kind === 'van' ? 50 : 45;
  const wid = car.kind === 'van' ? 24 : 22;
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 10, 12, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (car.kind === 'cop') {
    ctx.fillStyle = COLORS.copStripe;
    ctx.fillRect(-9, -wid / 2 + 1, 17, wid - 2);
    const flash = Math.sin(G.time * 11) > 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#5a1210';
    ctx.fillRect(-3, -7, 6, 6);
    ctx.fillStyle = flash ? '#2f6bff' : '#12264f';
    ctx.fillRect(-3, 1, 6, 6);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#ffd11a';
    ctx.font = 'bold 5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2);
  }
  // Glasshouse and a highlight along the roof.
  ctx.fillStyle = '#1d2a38';
  roundRect(ctx, car.kind === 'van' ? 2 : -7, -wid / 2 + 3.5, car.kind === 'van' ? 12 : 16, wid - 7, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 210, 235, 0.5)';
  ctx.fillRect(car.kind === 'van' ? 4 : -5, -wid / 2 + 5, 4, wid - 10);
  // Lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 2.5, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 2.5, 4);
  ctx.fillStyle = car._brake ? '#ff5040' : '#8c2b24';
  ctx.fillRect(-len / 2 - 0.5, -wid / 2 + 3, 2.5, 4);
  ctx.fillRect(-len / 2 - 0.5, wid / 2 - 7, 2.5, 4);
  ctx.restore();
}

function drawPed(ctx, G, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(15, 15, 18, 0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.down) {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -5, -11, 10, 22, 5);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -13, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const stride = Math.sin(G.time * 9 + ped.id * 2) * 2.2;
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(30, 30, 34, 0.85)';
  ctx.fillRect(1, -6 + stride * 0.4, 6, 3.4);
  ctx.fillRect(1, 2.6 - stride * 0.4, 6, 3.4);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(1.5, 0, 4.1, 0, Math.PI * 2);
  ctx.fill();
  if (ped.role === 'cop') {
    ctx.fillStyle = '#e8ecf4';
    ctx.fillRect(-1, -4, 4.5, 8);
  }
  if (ped.role === 'thug') {
    ctx.fillStyle = '#15161a';
    ctx.beginPath();
    ctx.arc(1.5, 0, 4.3, Math.PI * 0.7, Math.PI * 1.7);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(15, 15, 18, 0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // A soft ring so the player reads at a glance in a crowd.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(p.angle);
  ctx.fillStyle = COLORS.playerShirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(1.5, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#191c20';
    ctx.fillRect(6, -1.4, 8, 2.8);
  }
  ctx.restore();
  // The arrest ring closing in is drawn by the HUD; a flash when hurt is too.
}

function drawEffects(ctx, G) {
  for (const t of G.tracers) {
    ctx.strokeStyle = `rgba(255, 230, 150, ${Math.max(0, t.life * 5)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x0, t.y0);
    ctx.lineTo(t.x1, t.y1);
    ctx.stroke();
  }
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSeaFoam(ctx, G, w, h) {
  // Animated foam where the sea meets the promenade, in screen space.
  const cam = G.camera;
  const seaScreenY = WORLD_H - cam.y + h / 2;
  if (seaScreenY > h + 40 || seaScreenY < -40) return;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 3; row++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 26) {
      const y = seaScreenY + 8 + row * 16 + Math.sin(x * 0.02 + G.time * 1.4 + row * 2) * 3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
