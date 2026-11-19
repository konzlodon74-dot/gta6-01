// The people of Palmera City: pedestrians strolling the sidewalks and the
// beach, who flee from gunfire and reckless driving, drop a little cash when
// they go down, and — in a few marked cases — fight back as mission muscle.

import { BLOCK, ROAD, COLORS } from './config.js';
import { collideCircle, blockX, blockY } from './city.js';

let nextPedId = 1;

/** A pedestrian. role: 'walker', 'thug' (mission muscle) or 'cop' (on foot). */
export function createPed(x, y, rng, role = 'walker') {
  return {
    id: nextPedId++,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    hp: role === 'thug' ? 80 : 40,
    role,
    shirt: role === 'cop' ? '#26324e' : role === 'thug' ? '#3a3f4a' : rng.pick(COLORS.pedShirts),
    skin: rng.pick(['#f2c9a0', '#c68863', '#8d5a3b', '#6e4530', '#ffd9b3']),
    state: 'wander',
    tx: x, ty: y,
    think: rng.range(0, 2),
    punchCd: 0,
    down: false,
    downTime: 0,
    cashDropped: false,
  };
}

/** A crowd spread over the sidewalks, plazas and the beach. */
export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let n = 0; n < count; n++) {
    const i = rng.int(0, 10);
    const j = rng.int(0, 7);
    const x = blockX(i) + rng.range(6, BLOCK - 6);
    const y = blockY(j) + rng.range(6, BLOCK - 6);
    peds.push(createPed(x, y, rng));
  }
  return peds;
}

/** Damage a person; returns true when this blow puts them down. */
export function hurtPed(G, ped, damage, fromAngle) {
  if (ped.down) return false;
  ped.hp -= damage;
  ped.state = 'flee';
  ped.fleeX = ped.x - Math.cos(fromAngle) * 100;
  ped.fleeY = ped.y - Math.sin(fromAngle) * 100;
  if (ped.role === 'thug') ped.state = 'fight';
  if (ped.hp <= 0) {
    ped.down = true;
    ped.downTime = 9;
    return true;
  }
  return false;
}

function movePed(G, ped, dt, tx, ty, speed) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return true;
  ped.angle = Math.atan2(dy, dx);
  ped.x += Math.cos(ped.angle) * Math.min(speed * dt, d);
  ped.y += Math.sin(ped.angle) * Math.min(speed * dt, d);
  collideCircle(G.city, ped, 10);
  return d < 16;
}

/** One pedestrian's step: wander, flee danger, or (for thugs) close and swing. */
export function updatePed(G, ped, dt) {
  if (ped.down) {
    ped.downTime -= dt;
    return ped.downTime > 0;
  }
  ped.think -= dt;
  ped.punchCd -= dt;
  const playerDist = Math.hypot(G.player.x - ped.x, G.player.y - ped.y);

  if (ped.role === 'thug' && ped.state === 'fight') {
    if (playerDist > 30) {
      movePed(G, ped, dt, G.player.x, G.player.y, 178);
    } else if (ped.punchCd <= 0 && !G.player.inCar) {
      ped.punchCd = 0.9;
      G.audio.punch();
      G.hurtPlayer(9, ped.angle);
    }
    return true;
  }

  // Danger — gunfire, a scream, a car mounting the kerb — empties the street.
  const danger = G.danger;
  const nearDanger = danger && G.time - danger.t < 2.5 && Math.hypot(danger.x - ped.x, danger.y - ped.y) < 190;
  const carThreat = G.player.inCar && playerDist < 60 && Math.hypot(G.player.car.vx, G.player.car.vy) > 160;
  if (nearDanger || carThreat || ped.state === 'flee' && ped.think > 0) {
    if (ped.state !== 'flee' || ped.think <= 0) {
      const from = nearDanger ? danger : G.player;
      ped.state = 'flee';
      ped.think = 1.6;
      ped.fleeX = ped.x + (ped.x - from.x) * 2 + (Math.random() - 0.5) * 80;
      ped.fleeY = ped.y + (ped.y - from.y) * 2 + (Math.random() - 0.5) * 80;
    }
    movePed(G, ped, dt, ped.fleeX, ped.fleeY, 215);
    return true;
  }

  ped.state = 'wander';
  if (ped.think <= 0) {
    ped.think = 2 + Math.random() * 4;
    // Stroll to another point near the block edge: sidewalks, plazas, sand.
    ped.tx = ped.x + (Math.random() - 0.5) * 260;
    ped.ty = ped.y + (Math.random() - 0.5) * 260;
  }
  movePed(G, ped, dt, ped.tx, ped.ty, 62);
  return true;
}

/** A downed walker sometimes drops the cash in their pocket, once. */
export function dropCash(G, ped) {
  if (ped.cashDropped || ped.role !== 'walker') return;
  ped.cashDropped = true;
  if (Math.random() < 0.55) {
    G.pickups.push({ x: ped.x + 8, y: ped.y, kind: 'cash', amount: 5 + Math.floor(Math.random() * 26), t: 0 });
  }
}
