// hud.js — everything painted over the world: cash and health, the
// wanted stars, the objective banner and its timer, the dialogue lines,
// the bust meter, and the minimap with its GPS route. Plus the screens
// that frame the game — title, pause, busted, wasted, story complete.

import { WORLD, WATER_X, SAND_X, COLORS, districtAt } from './config.js';
import { gpsRoute } from './city.js';

const FONT = 'system-ui, sans-serif';

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(16,20,26,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

export function drawHud(ctx, G) {
  const W = G.viewW;
  // Cash and health, top left.
  panel(ctx, 16, 14, 208, 64);
  ctx.fillStyle = COLORS.cash;
  ctx.font = `700 24px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')}`, 30, 44);
  ctx.fillStyle = 'rgba(240,244,248,0.85)';
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(districtAt(G.player.x, G.player.y), 30, 64);
  // Health bar under the cash.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(132, 30, 78, 9);
  ctx.fillStyle = G.player.hp > 30 ? '#7dd069' : COLORS.danger;
  ctx.fillRect(132, 30, 78 * Math.max(0, G.player.hp) / 100, 9);
  if (G.player.inCar) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(132, 46, 78, 7);
    ctx.fillStyle = '#e0a458';
    ctx.fillRect(132, 46, 78 * Math.max(0, G.player.inCar.hp) / 100, 7);
  }

  drawStars(ctx, G, W - 24, 22);
  drawMinimap(ctx, G, W - 224, 52);

  // Objective banners stack upward from the bottom: story last (highest).
  let by = G.viewH - 86;
  if (G.sideObjective) {
    objectiveBanner(ctx, G, G.sideObjective, COLORS.sideBeacon, by);
    by -= 46;
  }
  if (G.objective) objectiveBanner(ctx, G, G.objective, COLORS.beacon, by);
  const stackTop = by - 14; // the first free line above the banners

  // The banner a finished job leaves behind.
  if (G.banner && G.time < G.banner.until) {
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,12,16,0.55)';
    const w = ctx.measureText(G.banner.text).width + 44;
    panel(ctx, (W - w) / 2, 92, w, 44, 0.5);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(G.banner.text, W / 2, 122);
  }

  // Dialogue: the freshest line that has not expired, above the banners.
  const line = [...G.dialogue].reverse().find((d) => G.time < d.until);
  let dialogueTop = null;
  if (line) {
    const w = Math.min(W - 80, 620);
    const dy = stackTop - 52;
    dialogueTop = dy;
    panel(ctx, (W - w) / 2, dy, w, 52, 0.62);
    ctx.textAlign = 'left';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(line.who, (W - w) / 2 + 16, dy + 22);
    ctx.font = `400 14px ${FONT}`;
    ctx.fillStyle = '#f2f4f6';
    wrapText(ctx, line.text, (W - w) / 2 + 16, dy + 42, w - 32, 17, 2);
  }

  // Bust meter: a red arc of trouble over Nico's head, in screen space.
  if (G.bust > 0.02 && G.state === 'playing') {
    const px = G.player.x - G.camera.x;
    const py = G.player.y - G.camera.y - 44;
    ctx.fillStyle = 'rgba(10,12,16,0.6)';
    ctx.beginPath(); ctx.roundRect(px - 42, py - 10, 84, 13, 6); ctx.fill();
    ctx.fillStyle = COLORS.danger;
    ctx.beginPath(); ctx.roundRect(px - 40, py - 8, 80 * G.bust, 9, 5); ctx.fill();
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('BUSTED?', px, py - 14);
  }

  // Context hint: what F would do right now, above whatever is stacked.
  if (G.hint && G.state === 'playing') {
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,12,16,0.55)';
    const w = ctx.measureText(G.hint).width + 30;
    const hy = (dialogueTop !== null ? dialogueTop : stackTop + 14) - 40;
    panel(ctx, (W - w) / 2, hy, w, 30, 0.5);
    ctx.fillStyle = '#f2f4f6';
    ctx.fillText(G.hint, W / 2, hy + 20);
  }
}

function drawStars(ctx, G, right, top) {
  const size = 21;
  for (let i = 0; i < 5; i++) {
    const cx = right - i * (size + 7) - size / 2;
    const cy = top + size / 2;
    star(ctx, cx, cy, size / 2, i < G.stars ? '#ffd76a' : 'rgba(255,255,255,0.22)');
  }
}

function star(ctx, cx, cy, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function objectiveBanner(ctx, G, obj, color, y) {
  const W = G.viewW;
  const distM = Math.round(Math.hypot(obj.x - G.player.x, obj.y - G.player.y) / 10);
  let text = `${obj.label} — ${distM} m`;
  if (obj.timer !== null && obj.timer !== undefined) {
    const s = Math.max(0, Math.ceil(obj.timer));
    text += ` — ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  ctx.font = `600 15px ${FONT}`;
  const w = ctx.measureText(text).width + 46;
  panel(ctx, (W - w) / 2, y, w, 36, 0.58);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc((W - w) / 2 + 18, y + 18, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2f4f6';
  ctx.textAlign = 'left';
  ctx.fillText(text, (W - w) / 2 + 32, y + 23);
}

function drawMinimap(ctx, G, x, y) {
  const w = 200;
  const h = 140;
  const sx = w / WORLD.w;
  const sy = h / WORLD.h;
  panel(ctx, x - 6, y - 6, w + 12, h + 12, 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#a2937a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(x + SAND_X * sx, y, (WATER_X - SAND_X) * sx, h);
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(x + WATER_X * sx, y, (WORLD.w - WATER_X) * sx, h);
  ctx.strokeStyle = 'rgba(30,32,38,0.7)';
  ctx.lineWidth = 1.6;
  for (const ax of [300, 900, 1500, 2100, 2700, 3300]) {
    ctx.beginPath(); ctx.moveTo(x + ax * sx, y); ctx.lineTo(x + ax * sx, y + h); ctx.stroke();
  }
  for (const syLine of [300, 900, 1500, 2100]) {
    ctx.beginPath(); ctx.moveTo(x, y + syLine * sy); ctx.lineTo(x + w, y + syLine * sy); ctx.stroke();
  }

  // GPS routes: side work in cyan under the story's amber.
  const route = (obj, color) => {
    if (!obj) return;
    const pts = gpsRoute(G.city, G.player.x, G.player.y, obj.x, obj.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = x + p.x * sx;
      const py = y + p.y * sy;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + obj.x * sx, y + obj.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  };
  route(G.sideObjective, COLORS.sideBeacon);
  route(G.objective, COLORS.beacon);

  // Police blips flash; Nico is a white arrow that turns with him.
  const flash = Math.sin(G.time * 6) > 0;
  for (const cop of G.cops) {
    ctx.fillStyle = flash ? '#ff5252' : '#4d9fff';
    ctx.beginPath();
    ctx.arc(x + cop.x * sx, y + cop.y * sy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const heading = G.player.inCar ? G.player.inCar.angle : G.player.angle;
  ctx.save();
  ctx.translate(x + G.player.x * sx, y + G.player.y * sy);
  ctx.rotate(heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4.4, -3.8);
  ctx.lineTo(-4.4, 3.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      lines++;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = trial;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineH);
}

// --- the framing screens -------------------------------------------------

export function drawTitle(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2b4a6f');
  grad.addColorStop(0.55, '#c96f4a');
  grad.addColorStop(1, '#e8a56b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Sun and a skyline of Palmera silhouettes.
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.arc(W * 0.72, H * 0.34, 52, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(24,28,40,0.88)';
  const base = H * 0.78;
  const towers = [0.02, 0.1, 0.19, 0.3, 0.42, 0.53, 0.63, 0.74, 0.85, 0.93];
  towers.forEach((tx, i) => {
    const tw = W * 0.075;
    const th = H * (0.16 + ((i * 37) % 10) * 0.022);
    ctx.fillRect(W * tx, base - th, tw, th);
  });
  ctx.fillRect(0, base, W, H - base);
  // Palm silhouettes.
  ctx.strokeStyle = 'rgba(24,28,40,0.9)';
  ctx.lineWidth = 5;
  for (const px of [W * 0.08, W * 0.9]) {
    ctx.beginPath();
    ctx.moveTo(px, base + 6);
    ctx.quadraticCurveTo(px + 6, base - 60, px + 14, base - 92);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(px + 14, base - 92);
      ctx.quadraticCurveTo(px + 14 + Math.cos(a) * 22, base - 92 + Math.sin(a) * 12 - 8, px + 14 + Math.cos(a) * 36, base - 92 + Math.sin(a) * 20 + 10);
      ctx.stroke();
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(W * 0.062)}px ${FONT}`;
  ctx.fillText('PALMERA HEAT', W / 2, H * 0.3);
  ctx.font = `500 ${Math.round(W * 0.016)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,244,224,0.92)';
  ctx.fillText('An open-world crime story on the Costa Serena — one driver, one debt, one whole city.', W / 2, H * 0.365);

  ctx.font = `600 ${Math.round(W * 0.017)}px ${FONT}`;
  ctx.fillStyle = '#ffd76a';
  if (G.hasSave) {
    ctx.fillText('ENTER — continue      N — new game', W / 2, H * 0.56);
  } else {
    ctx.fillText('ENTER — start your story', W / 2, H * 0.56);
  }

  ctx.font = `400 ${Math.round(W * 0.0135)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,244,224,0.85)';
  const controls = [
    'WASD / arrows — walk and drive      SHIFT — run      F — enter / leave a car',
    'SPACE — shove (on foot) / handbrake (in a car)      P or ESC — pause',
    'Follow the amber marker for story work, cyan for side jobs. The minimap draws your route.',
    "Venn's Garage fits new plates for $150 and the law forgets your face.",
  ];
  controls.forEach((line, i) => ctx.fillText(line, W / 2, H * (0.66 + i * 0.045)));
}

export function drawPause(ctx, G) {
  veil(ctx, G);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('PAUSED', G.viewW / 2, G.viewH * 0.4);
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = 'rgba(240,244,248,0.9)';
  ctx.fillText('P or ESC — back to the streets', G.viewW / 2, G.viewH * 0.48);
  ctx.fillText(`Cash $${G.cash.toLocaleString('en-US')} · earned $${G.earned.toLocaleString('en-US')} · story ${G.storyDone ? 'complete' : `job ${Math.min(G.storyStep + 1, 6)} of 6`}`, G.viewW / 2, G.viewH * 0.54);
  ctx.fillText('Progress saves itself at every job done.', G.viewW / 2, G.viewH * 0.585);
}

export function drawBusted(ctx, G) {
  veil(ctx, G, 'rgba(40,10,10,0.55)');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('BUSTED', G.viewW / 2, G.viewH * 0.42);
  ctx.fillStyle = '#f2f4f6';
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText(`The Palmera police take $${G.lastFine} for their trouble and leave you at the station door.`, G.viewW / 2, G.viewH * 0.52);
  ctx.fillText('ENTER — back on the street', G.viewW / 2, G.viewH * 0.6);
}

export function drawWasted(ctx, G) {
  veil(ctx, G, 'rgba(30,8,8,0.6)');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e5484d';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('WASTED', G.viewW / 2, G.viewH * 0.42);
  ctx.fillStyle = '#f2f4f6';
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText(`St. Serena patches you up and bills you $${G.lastFine}. The city kept your car keys warm.`, G.viewW / 2, G.viewH * 0.52);
  ctx.fillText('ENTER — leave the hospital', G.viewW / 2, G.viewH * 0.6);
}

function veil(ctx, G, color = 'rgba(10,14,20,0.55)') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, G.viewW, G.viewH);
}
