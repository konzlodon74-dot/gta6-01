// render.js — how Palmera looks: late sun, long shadows, pastel roofs,
// palms over the coast road and the sea doing its slow sparkle. Only the
// part of the city inside the camera is drawn; everything is shapes the
// code paints, no images at all.

import { WORLD, AVENUES, STREETS, ROAD_HALF, SAND_X, WATER_X, COLORS } from './config.js';
import { CAR_KINDS } from './vehicles.js';

function view(G) {
  const cam = G.camera;
  return { x0: cam.x - 40, y0: cam.y - 40, x1: cam.x + G.viewW + 40, y1: cam.y + G.viewH + 40 };
}

const inView = (v, x, y, pad = 0) => x > v.x0 - pad && x < v.x1 + pad && y > v.y0 - pad && y < v.y1 + pad;

export function drawWorld(ctx, G) {
  const v = view(G);
  drawGround(ctx, G, v);
  drawRoads(ctx, G, v);
  drawDecks(ctx, G, v);
  drawBeacons(ctx, G, v);
  for (const s of G.skids) {
    if (!inView(v, s.x, s.y)) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = `rgba(30,28,26,${0.34 * s.life})`;
    ctx.fillRect(-7, -2.4, 14, 4.8);
    ctx.restore();
  }
  drawBuildings(ctx, G, v);
  drawProps(ctx, G, v);
  for (const car of G.cars) {
    if (inView(v, car.x, car.y, 70)) drawCar(ctx, G, car);
  }
  for (const ped of G.peds) {
    if (ped.state === 'ride') continue;
    if (inView(v, ped.x, ped.y, 30)) drawPed(ctx, G, ped);
  }
  if (!G.player.inCar) drawPlayer(ctx, G);
  drawParticles(ctx, G, v);
}

function drawGround(ctx, G, v) {
  ctx.fillStyle = COLORS.land;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);

  // Block-by-block ground tones: parks green, lots bare concrete.
  for (const b of G.city.blocks) {
    if (!inView(v, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    if (b.kind === 'park') {
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(b.x - 14, b.y - 14, b.w + 28, b.h + 28);
    } else if (b.kind === 'parking') {
      ctx.fillStyle = '#9c9484';
      ctx.fillRect(b.x - 14, b.y - 14, b.w + 28, b.h + 28);
      ctx.strokeStyle = 'rgba(240,238,228,0.5)';
      ctx.lineWidth = 2;
      for (let px = b.x + 12; px < b.x + b.w - 20; px += 62) {
        ctx.strokeRect(px, b.y + 12, 44, 58);
        ctx.strokeRect(px, b.y + b.h - 70, 44, 58);
      }
    } else {
      ctx.fillStyle = COLORS.sidewalk;
      ctx.fillRect(b.x - 14, b.y - 14, b.w + 28, b.h + 28);
    }
  }

  // Sand, the wet line at the water's edge, and the sea itself.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(SAND_X, v.y0, WATER_X - SAND_X, v.y1 - v.y0);
  ctx.fillStyle = COLORS.sandWet;
  ctx.fillRect(WATER_X - 16, v.y0, 16, v.y1 - v.y0);
  const grad = ctx.createLinearGradient(WATER_X, 0, WORLD.w, 0);
  grad.addColorStop(0, COLORS.water);
  grad.addColorStop(1, COLORS.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(WATER_X, v.y0, WORLD.w - WATER_X, v.y1 - v.y0);
  ctx.strokeStyle = 'rgba(191,230,239,0.5)';
  ctx.lineWidth = 2;
  const drift = (G.time * 14) % 46;
  for (let y = Math.floor(v.y0 / 46) * 46; y < v.y1; y += 46) {
    for (let x = WATER_X + 24 + ((y * 7 + drift) % 60); x < v.x1; x += 118) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 26, y);
      ctx.stroke();
    }
  }
  // Foam where the sea meets the sand.
  ctx.strokeStyle = 'rgba(240,250,252,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = v.y0; y < v.y1; y += 30) {
    const wobble = Math.sin(y * 0.05 + G.time * 1.4) * 5;
    ctx.moveTo(WATER_X + wobble, y);
    ctx.lineTo(WATER_X + wobble, y + 16);
  }
  ctx.stroke();
}

function drawRoads(ctx, G, v) {
  ctx.fillStyle = COLORS.asphalt;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_HALF, v.y0, ROAD_HALF * 2, v.y1 - v.y0);
  for (const sy of STREETS) ctx.fillRect(v.x0, sy - ROAD_HALF, v.x1 - v.x0, ROAD_HALF * 2);
  // The coast road's seaward edge is a promenade line.
  ctx.fillRect(SAND_X - 8, v.y0, 10, v.y1 - v.y0);

  ctx.strokeStyle = COLORS.asphaltEdge;
  ctx.lineWidth = 3;
  for (const ax of AVENUES) {
    ctx.beginPath(); ctx.moveTo(ax - ROAD_HALF + 3, v.y0); ctx.lineTo(ax - ROAD_HALF + 3, v.y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + ROAD_HALF - 3, v.y0); ctx.lineTo(ax + ROAD_HALF - 3, v.y1); ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath(); ctx.moveTo(v.x0, sy - ROAD_HALF + 3); ctx.lineTo(v.x1, sy - ROAD_HALF + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(v.x0, sy + ROAD_HALF - 3); ctx.lineTo(v.x1, sy + ROAD_HALF - 3); ctx.stroke();
  }

  // Dashed centre lines, pausing at intersections.
  ctx.strokeStyle = COLORS.laneMark;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const ax of AVENUES) {
    ctx.beginPath(); ctx.moveTo(ax, v.y0); ctx.lineTo(ax, v.y1); ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath(); ctx.moveTo(v.x0, sy); ctx.lineTo(v.x1, sy); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Crosswalks on every intersection approach.
  ctx.fillStyle = 'rgba(232,226,200,0.55)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      if (!inView(v, ax, sy, 130)) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(ax + i * 20 - 6, sy - ROAD_HALF - 14, 12, 10);
        ctx.fillRect(ax + i * 20 - 6, sy + ROAD_HALF + 4, 12, 10);
        ctx.fillRect(ax - ROAD_HALF - 14, sy + i * 20 - 6, 10, 12);
        ctx.fillRect(ax + ROAD_HALF + 4, sy + i * 20 - 6, 10, 12);
      }
    }
  }
}

function drawDecks(ctx, G, v) {
  for (const p of [...G.city.piers, G.city.jetty]) {
    if (!inView(v, p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h))) continue;
    ctx.fillStyle = 'rgba(20,40,50,0.25)';
    ctx.fillRect(p.x + 6, p.y + 8, p.w, p.h);
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(60,44,28,0.6)';
    ctx.lineWidth = 2;
    for (let x = p.x + 18; x < p.x + p.w; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke();
    }
  }
  // Moored boats bobbing by the marina pier.
  for (const boat of G.city.boats) {
    if (!inView(v, boat.x, boat.y, 60)) continue;
    ctx.save();
    ctx.translate(boat.x, boat.y + Math.sin(G.time * 1.3 + boat.x) * 2);
    ctx.rotate(boat.angle);
    ctx.fillStyle = boat.tone;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-12, -8);
    ctx.lineTo(16, -8);
    ctx.lineTo(24, 0);
    ctx.lineTo(16, 8);
    ctx.lineTo(-12, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.restore();
  }
  // The lighthouse itself: white tower, red bands, a lamp room.
  const lh = G.city.spots.lighthouse;
  ctx.fillStyle = 'rgba(30,30,30,0.25)';
  ctx.beginPath(); ctx.ellipse(lh.x + 16, lh.y + 20, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4f1e6';
  ctx.beginPath(); ctx.arc(lh.x, lh.y, 21, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d64541';
  ctx.beginPath(); ctx.arc(lh.x, lh.y, 21, Math.PI * 0.85, Math.PI * 1.35); ctx.fill();
  ctx.beginPath(); ctx.arc(lh.x, lh.y, 21, Math.PI * 1.85, Math.PI * 2.35); ctx.fill();
  ctx.fillStyle = '#2c3550';
  ctx.beginPath(); ctx.arc(lh.x, lh.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.arc(lh.x, lh.y, 4.5, 0, Math.PI * 2); ctx.fill();
}

function drawBeacons(ctx, G, v) {
  const draw = (obj, color) => {
    if (!obj || !inView(v, obj.x, obj.y, 60)) return;
    const pulse = 1 + Math.sin(G.time * 4.2) * 0.16;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    const grad = ctx.createLinearGradient(0, obj.y - 240, 0, obj.y);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(obj.x - 9, obj.y - 240, 18, 240);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(obj.x, obj.y - 268 - Math.sin(G.time * 4.2) * 5);
    ctx.lineTo(obj.x - 10, obj.y - 284 - Math.sin(G.time * 4.2) * 5);
    ctx.lineTo(obj.x + 10, obj.y - 284 - Math.sin(G.time * 4.2) * 5);
    ctx.closePath();
    ctx.fill();
  };
  draw(G.sideObjective, COLORS.sideBeacon);
  draw(G.objective, COLORS.beacon);
}

function drawBuildings(ctx, G, v) {
  for (const b of G.city.buildings) {
    if (!inView(v, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) + 40)) continue;
    const shade = 8 + Math.min(16, b.floors * 2);
    ctx.fillStyle = 'rgba(43,36,28,0.35)';
    ctx.fillRect(b.x + shade, b.y + shade + 5, b.w, b.h);
    ctx.fillStyle = b.body;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Rooftop clutter: air-con boxes, a water tank, the odd pool.
    ctx.fillStyle = 'rgba(90,80,66,0.5)';
    const n = Math.max(1, Math.floor((b.w * b.h) / 26000));
    for (let i = 0; i < n; i++) {
      const rx = b.x + 12 + ((i * 67) % Math.max(20, b.w - 44));
      const ry = b.y + 12 + ((i * 41) % Math.max(20, b.h - 40));
      ctx.fillRect(rx, ry, 16, 12);
    }
    if (b.name) {
      ctx.fillStyle = 'rgba(40,36,30,0.78)';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
  }
  // The garage's service pad gets its own apron and sign.
  const pad = G.city.spots.garagePad;
  ctx.fillStyle = '#8f8a7c';
  ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
  ctx.strokeStyle = COLORS.beacon;
  ctx.lineWidth = 3;
  ctx.strokeRect(pad.x + 4, pad.y + 4, pad.w - 8, pad.h - 8);
  ctx.fillStyle = 'rgba(40,36,30,0.8)';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEW PLATES — $150', pad.x + pad.w / 2, pad.y + pad.h / 2 + 4);
}

function drawProps(ctx, G, v) {
  for (const p of G.city.props) {
    if (!inView(v, p.x, p.y, 40)) continue;
    if (p.kind === 'palm') {
      ctx.strokeStyle = COLORS.palmTrunk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + 3, p.y - 8, p.x + 6, p.y - 13);
      ctx.stroke();
      ctx.strokeStyle = COLORS.palmLeaf;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + p.x * 0.01;
        ctx.beginPath();
        ctx.moveTo(p.x + 6, p.y - 13);
        ctx.quadraticCurveTo(
          p.x + 6 + Math.cos(a) * 13, p.y - 13 + Math.sin(a) * 8 - 5,
          p.x + 6 + Math.cos(a) * 21, p.y - 13 + Math.sin(a) * 13 + 5,
        );
        ctx.stroke();
      }
    } else if (p.kind === 'lamp') {
      ctx.fillStyle = '#3a3f47';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'bench') {
      ctx.fillStyle = '#7a5c3e';
      ctx.fillRect(p.x - 9, p.y - 3, 18, 6);
    }
  }
}

export function drawCar(ctx, G, car) {
  const spec = CAR_KINDS[car.kind];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow, then body, then glass and trim.
  ctx.fillStyle = 'rgba(25,22,20,0.32)';
  ctx.beginPath();
  ctx.roundRect(-spec.len / 2 + 3, -spec.wid / 2 + 5, spec.len, spec.wid, 7);
  ctx.fill();
  ctx.fillStyle = car.wrecked ? '#4c4a48' : car.color;
  ctx.beginPath();
  ctx.roundRect(-spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 7);
  ctx.fill();
  if (car.kind === 'cop') {
    ctx.fillStyle = COLORS.copDoor;
    ctx.fillRect(-8, -spec.wid / 2 + 1, 17, spec.wid - 2);
    const flash = Math.sin(G.time * 11) > 0;
    ctx.fillStyle = flash ? '#ff4040' : '#701616';
    ctx.fillRect(-3, -spec.wid / 2 + 2, 6, 5);
    ctx.fillStyle = flash ? '#16407a' : '#3a7bd5';
    ctx.fillRect(-3, spec.wid / 2 - 7, 6, 5);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-4, -4, 8, 8);
  }
  // Windshield and rear glass.
  ctx.fillStyle = 'rgba(18,26,34,0.85)';
  ctx.fillRect(spec.len * 0.08, -spec.wid / 2 + 3.4, spec.len * 0.2, spec.wid - 6.8);
  ctx.fillRect(-spec.len * 0.3, -spec.wid / 2 + 3.4, spec.len * 0.14, spec.wid - 6.8);
  // Roof.
  ctx.fillStyle = car.wrecked ? '#555350' : car.color;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(-spec.len * 0.14, -spec.wid / 2 + 2.6, spec.len * 0.2, spec.wid - 5.2);
  ctx.globalAlpha = 1;
  // Wheels.
  ctx.fillStyle = '#17181a';
  const wx = spec.len / 2 - 9;
  const wy = spec.wid / 2 - 1;
  ctx.fillRect(wx - 5, -wy - 2, 10, 4.4);
  ctx.fillRect(wx - 5, wy - 2.4, 10, 4.4);
  ctx.fillRect(-wx - 5, -wy - 2, 10, 4.4);
  ctx.fillRect(-wx - 5, wy - 2.4, 10, 4.4);
  // Headlights.
  ctx.fillStyle = '#fdf6c8';
  ctx.fillRect(spec.len / 2 - 2.4, -spec.wid / 2 + 2.6, 2.6, 4.4);
  ctx.fillRect(spec.len / 2 - 2.4, spec.wid / 2 - 7, 2.6, 4.4);
  ctx.restore();

  // Damage smoke curls off a hurt engine.
  if (car.smoke > 0.15) {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const ph = (G.time * 0.9 + i / n + car.id * 0.37) % 1;
      const sx = car.x + Math.cos(car.angle) * (spec.len / 2) + Math.sin(ph * 9 + car.id) * 5;
      const sy = car.y + Math.sin(car.angle) * (spec.len / 2) - ph * 26;
      ctx.fillStyle = `rgba(52,50,50,${0.4 * (1 - ph) * car.smoke})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + ph * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPed(ctx, G, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(25,22,20,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.roundRect(-13, -4.6, 21, 9.2, 4); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(12, 0, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.bob) * 1.4;
  ctx.fillStyle = 'rgba(25,22,20,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#31435c';
  ctx.fillRect(-4.6, 0, 3.6, 7 + bob * 0.4);
  ctx.fillRect(1, 0, 3.6, 7 - bob * 0.4);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, -1.6, 6.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(0, -2.4, 3.9, 0, Math.PI * 2); ctx.fill();
  // A fare or a story passenger gets a marker ring so the player finds them.
  if (ped.job) {
    ctx.strokeStyle = ped.job.role === 'fare' ? COLORS.sideBeacon : COLORS.beacon;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -2, 11 + Math.sin(G.time * 4.2) * 1.6, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(25,22,20,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 4.6, 9, 4.4, 0, 0, Math.PI * 2); ctx.fill();
  const bob = Math.sin(p.bob) * 1.8;
  ctx.fillStyle = COLORS.playerPants;
  ctx.fillRect(-5, 0, 4, 8 + bob * 0.4);
  ctx.fillRect(1.2, 0, 4, 8 - bob * 0.4);
  ctx.fillStyle = COLORS.playerShirt;
  ctx.beginPath(); ctx.arc(0, -1.6, 7.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLORS.playerSkin;
  ctx.beginPath(); ctx.arc(0, -2.6, 4.3, 0, Math.PI * 2); ctx.fill();
  // The way he's facing.
  ctx.strokeStyle = COLORS.playerSkin;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.angle) * 4, -1 + Math.sin(p.angle) * 4);
  ctx.lineTo(Math.cos(p.angle) * 10, -1 + Math.sin(p.angle) * 10);
  ctx.stroke();
  ctx.restore();
}

function drawParticles(ctx, G, v) {
  for (const pt of G.particles) {
    if (!inView(v, pt.x, pt.y, 20)) continue;
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
