// The HUD and the screens around the game: cash, health and wanted stars,
// the mission banner and objective line, the minimap with its GPS route and
// police blips, context prompts, and the title / pause / busted / wasted
// overlays. Drawn over the world every frame.

import { WORLD_W, WORLD_H, ROAD, BLOCK, COLORS } from './config.js';
import { findPath, districtAt } from './city.js';
import { carName } from './game.js';

const FONT = 'system-ui, "Segoe UI", sans-serif';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 14, 20, 0.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function stars(ctx, G, x, y) {
  ctx.font = '26px ' + FONT;
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    const on = i < G.police.stars;
    const cooling = G.police.stars > 0 && G.police.hideTime > 3 && Math.sin(G.time * 6) > 0;
    ctx.fillStyle = on ? (cooling ? '#9fb7c9' : '#ffd11a') : 'rgba(255, 255, 255, 0.22)';
    ctx.fillText('★', x - (4 - i) * 30, y);
  }
  if (G.police.bust > 0.05) {
    ctx.fillStyle = 'rgba(255, 70, 50, 0.9)';
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillText('BUSTED?', x, y + 22);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - 120, y + 28, 120, 6);
    ctx.fillStyle = '#ff5040';
    ctx.fillRect(x - 120, y + 28, 120 * Math.min(1, G.police.bust / 1.5), 6);
  }
}

function minimap(ctx, G, w, h) {
  const mw = 208;
  const mh = Math.round(mw * WORLD_H / WORLD_W);
  const x = w - mw - 16;
  const y = h - mh - 16;
  panel(ctx, x - 6, y - 6, mw + 12, mh + 12);
  const sx = (px) => x + (px / WORLD_W) * mw;
  const sy = (py) => y + (py / WORLD_H) * mh;
  ctx.fillStyle = '#274b63';
  ctx.fillRect(x, y, mw, mh);
  ctx.fillStyle = '#8fa583';
  ctx.fillRect(x, y, mw, mh * 0.94);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(x, y + mh * 0.9, mw, mh * 0.045);
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(x, y + mh * 0.945, mw, mh * 0.055);
  ctx.strokeStyle = 'rgba(230, 228, 215, 0.8)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 11; i++) {
    ctx.beginPath();
    ctx.moveTo(sx(i * (BLOCK + ROAD) + ROAD / 2), y);
    ctx.lineTo(sx(i * (BLOCK + ROAD) + ROAD / 2), y + mh);
    ctx.stroke();
  }
  for (let j = 0; j <= 8; j++) {
    ctx.beginPath();
    ctx.moveTo(x, sy(j * (BLOCK + ROAD) + ROAD / 2));
    ctx.lineTo(x + mw, sy(j * (BLOCK + ROAD) + ROAD / 2));
    ctx.stroke();
  }
  // GPS route to the objective.
  if (G.marker && G.state === 'playing') {
    const px = G.player.inCar ? G.player.car.x : G.player.x;
    const py = G.player.inCar ? G.player.car.y : G.player.y;
    if (!G._gps || G._gps.mx !== G.marker.x || G._gps.my !== G.marker.y || G.time - G._gps.at > 1.5) {
      G._gps = { mx: G.marker.x, my: G.marker.y, at: G.time, path: findPath(G.city, px, py, G.marker.x, G.marker.y) };
    }
    ctx.strokeStyle = '#ffd11a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(px), sy(py));
    for (const p of G._gps.path) ctx.lineTo(sx(p.x), sy(p.y));
    ctx.stroke();
    const pulse = 3.4 + Math.sin(G.time * 5) * 1.2;
    ctx.fillStyle = '#ffd11a';
    ctx.beginPath();
    ctx.arc(sx(G.marker.x), sy(G.marker.y), pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips flash blue and red; the player is a white arrow.
  for (const car of G.cars) {
    if (car.kind !== 'cop') continue;
    ctx.fillStyle = Math.sin(G.time * 9) > 0 ? '#3b82f6' : '#ef4444';
    ctx.fillRect(sx(car.x) - 2, sy(car.y) - 2, 4, 4);
  }
  const px = G.player.inCar ? G.player.car.x : G.player.x;
  const py = G.player.inCar ? G.player.car.y : G.player.y;
  const pa = G.player.inCar ? G.player.car.angle : G.player.angle;
  ctx.save();
  ctx.translate(sx(px), sy(py));
  ctx.rotate(pa);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '10px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(px), x + 4, y + mh - 5);
}

export function drawHUD(ctx, G, w, h) {
  if (G.state === 'title') return;
  // Cash and health, top left.
  panel(ctx, 14, 14, 196, 58);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 22px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('$' + G.cash.toLocaleString('en-US'), 26, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(26, 50, 168, 9);
  ctx.fillStyle = G.player.hp > 30 ? '#4ade80' : '#ef4444';
  ctx.fillRect(26, 50, 168 * Math.max(0, G.player.hp) / 100, 9);
  stars(ctx, G, w - 22, 42);
  minimap(ctx, G, w, h);

  // Weapon and speed, bottom left.
  if (G.player.inCar) {
    const speed = Math.round(Math.hypot(G.player.car.vx, G.player.car.vy) * 0.24);
    panel(ctx, 14, h - 84, 168, 68);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px ' + FONT;
    ctx.fillText(speed + ' mph', 26, h - 48);
    ctx.font = '12px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(carName(G.player.car), 26, h - 30);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(110, h - 56, 58, 6);
    ctx.fillStyle = G.player.car.hp > 40 ? '#4ade80' : '#ef4444';
    ctx.fillRect(110, h - 56, 58 * Math.max(0, G.player.car.hp) / 100, 6);
  } else {
    panel(ctx, 14, h - 58, 168, 42);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText(G.player.weapon === 'pistol' ? '🔫 Pistol' : '✊ Fists', 26, h - 31);
  }

  // Objective line, top centre.
  if (G.objective) {
    ctx.font = 'bold 16px ' + FONT;
    const tw = ctx.measureText(G.objective).width + 30;
    panel(ctx, (w - tw) / 2, 14, tw, 34);
    ctx.fillStyle = '#ffd11a';
    ctx.textAlign = 'center';
    let text = G.objective;
    if (G.marker) {
      const px = G.player.inCar ? G.player.car.x : G.player.x;
      const py = G.player.inCar ? G.player.car.y : G.player.y;
      text += ` · ${Math.round(Math.hypot(G.marker.x - px, G.marker.y - py) / 10)}m`;
    }
    ctx.fillText(text, w / 2, 37);
  }

  // Mission banner: title and Sol's line, fading.
  if (G.bannerUntil > G.time) {
    const alpha = Math.min(1, (G.bannerUntil - G.time) / 1.2, (G.time - G.bannerAt) / 0.4 + 0.2);
    ctx.globalAlpha = Math.max(0, alpha);
    const bw = Math.min(620, w - 80);
    panel(ctx, (w - bw) / 2, 64, bw, 74);
    ctx.fillStyle = '#ffd11a';
    ctx.font = 'bold 19px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(G.bannerTitle, w / 2, 92);
    ctx.fillStyle = '#f3f4f6';
    ctx.font = '14px ' + FONT;
    wrapText(ctx, G.bannerText, w / 2, 114, bw - 36, 17);
    ctx.globalAlpha = 1;
  }

  // Context prompt, bottom centre.
  if (G.prompt) {
    ctx.font = 'bold 15px ' + FONT;
    const tw = ctx.measureText(G.prompt).width + 30;
    panel(ctx, (w - tw) / 2, h - 96, tw, 32);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.prompt, w / 2, h - 74);
  }

  // Hurt flash and low-health pulse.
  if (G.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200, 30, 20, ${G.hurtFlash * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (G.player.hp < 30 && G.state === 'playing') {
    ctx.fillStyle = `rgba(180, 20, 10, ${0.1 + Math.sin(G.time * 5) * 0.05})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (G.audio.muted) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('muted (M)', w - 16, h - 10);
  }
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (ctx.measureText(trial).width > maxW && line) {
      ctx.fillText(line, cx, y);
      y += lineH;
      line = word;
    } else line = trial;
  }
  if (line) ctx.fillText(line, cx, y);
}

function bigOverlay(ctx, w, h, title, lines, accent = '#ffd11a') {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.66)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 54px ' + FONT;
  ctx.fillText(title, w / 2, h / 2 - 60);
  ctx.fillStyle = '#f3f4f6';
  ctx.font = '17px ' + FONT;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 8 + i * 26));
}

/** Title, pause and end-of-run screens. */
export function drawOverlay(ctx, G, w, h) {
  if (G.state === 'title') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(10, 12, 24, 0.25)');
    grad.addColorStop(0.55, 'rgba(10, 12, 24, 0.05)');
    grad.addColorStop(1, 'rgba(10, 12, 24, 0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd11a';
    ctx.font = 'bold 76px ' + FONT;
    ctx.fillText('PALMERA', w / 2, h * 0.34);
    ctx.fillStyle = '#ff7847';
    ctx.fillText('HEAT', w / 2, h * 0.34 + 72);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '18px ' + FONT;
    ctx.fillText('An open-world crime saga in sun-soaked Palmera City', w / 2, h * 0.34 + 112);
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = '#7ee787';
    ctx.fillText(G.hasSave ? 'Press ENTER to continue · N for a new game' : 'Press ENTER to start', w / 2, h * 0.62);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
    ctx.font = '15px ' + FONT;
    const controls = [
      'WASD / arrows — move & drive · SHIFT — sprint · SPACE — handbrake',
      'Mouse — aim · Click — punch / shoot · F — enter & exit cars · E — interact / save at home',
      'Q — take a stash run from Sol · P — pause · M — mute',
    ];
    controls.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.62 + 36 + i * 23));
    ctx.fillStyle = 'rgba(248, 250, 252, 0.6)';
    ctx.font = '13px ' + FONT;
    ctx.fillText('Steal cars. Run jobs for Sol Duarte. Outrun the Palmera PD.', w / 2, h - 26);
  } else if (G.state === 'paused') {
    bigOverlay(ctx, w, h, 'PAUSED', ['Press P or ESC to resume', `Cash $${G.cash.toLocaleString('en-US')} · Story jobs done: ${G.missionIndex}/6`]);
  } else if (G.state === 'busted') {
    bigOverlay(ctx, w, h, 'BUSTED', [`The Palmera PD impound your ride and fine you $${G.lastFine}.`, 'Press ENTER to walk out of Central Station'], '#7fb3d5');
  } else if (G.state === 'wasted') {
    bigOverlay(ctx, w, h, 'WASTED', [`St. Coral Hospital patches you up for $${G.lastFine}.`, 'Press ENTER to check out'], '#ef4444');
  } else if (G.state === 'complete') {
    bigOverlay(ctx, w, h, 'PALMERA IS YOURS', ['Story complete — Rico Vega owns these streets now.', 'Press ENTER to keep roaming: stash runs, fast cars, five stars.'], '#7ee787');
  }
}
