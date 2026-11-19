// people.js — Palmera's pedestrians. They stroll the sidewalks around
// their block, scatter when a car comes at them too fast, and fall when
// one actually reaches them. The fare passengers and story characters
// are peds with a job, flagged so the missions can find them.

import { clamp } from './rng.js';
import { pushOut, onRoad } from './city.js';

const SHIRTS = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#9d6bc2', '#4ea8de', '#e5989b', '#6a994e'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function makePed(x, y, rng, block = null) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    vx: 0, vy: 0,
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(SKINS),
    state: 'walk', // walk, flee, down, ride, stand
    block,
    corner: rng.int(0, 3),
    legT: rng.next(),
    speed: rng.range(38, 62),
    downFor: 0,
    fleeX: 0, fleeY: 0, fleeFor: 0,
    bob: rng.range(0, Math.PI * 2),
    job: null, // missions may tag a ped: { role: 'fare' | 'passenger', ... }
  };
}

// The sidewalk loop around a block: four corners, inset from the kerb.
function blockCorners(block) {
  const inset = 13;
  return [
    { x: block.x - inset, y: block.y - inset },
    { x: block.x + block.w + inset, y: block.y - inset },
    { x: block.x + block.w + inset, y: block.y + block.h + inset },
    { x: block.x - inset, y: block.y + block.h + inset },
  ];
}

export function spawnCrowd(city, rng, count) {
  const peds = [];
  const blocks = city.blocks.filter((b) => b.kind !== 'parking');
  for (let i = 0; i < count; i++) {
    const block = blocks[rng.int(0, blocks.length - 1)];
    const corners = blockCorners(block);
    const c = corners[rng.int(0, 3)];
    peds.push(makePed(c.x + rng.range(-8, 8), c.y + rng.range(-8, 8), rng, block));
  }
  return peds;
}

export function scarePed(ped, fromX, fromY, seconds = 2.2) {
  if (ped.state === 'down' || ped.state === 'ride') return;
  ped.state = 'flee';
  ped.fleeX = fromX;
  ped.fleeY = fromY;
  ped.fleeFor = seconds;
}

export function knockDown(ped, seconds = 3.2) {
  ped.state = 'down';
  ped.downFor = seconds;
  ped.vx = 0;
  ped.vy = 0;
}

export function updatePed(city, ped, dt, threats) {
  ped.bob += dt * (ped.state === 'walk' || ped.state === 'flee' ? 9 : 0);

  if (ped.state === 'down') {
    ped.downFor -= dt;
    if (ped.downFor <= 0) ped.state = 'walk';
    return;
  }
  if (ped.state === 'ride' || ped.state === 'stand') return;

  // A fast car nearby empties the sidewalk.
  for (const t of threats) {
    const d = Math.hypot(t.x - ped.x, t.y - ped.y);
    if (d < 74 && t.speed > 120) {
      scarePed(ped, t.x, t.y, 1.6);
      break;
    }
  }

  let tx;
  let ty;
  let speed = ped.speed;
  if (ped.state === 'flee') {
    ped.fleeFor -= dt;
    const dx = ped.x - ped.fleeX;
    const dy = ped.y - ped.fleeY;
    const d = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / d) * 90;
    ty = ped.y + (dy / d) * 90;
    speed = 168;
    if (ped.fleeFor <= 0) ped.state = 'walk';
  } else if (ped.block) {
    const corners = blockCorners(ped.block);
    const target = corners[ped.corner];
    tx = target.x;
    ty = target.y;
    if (Math.hypot(tx - ped.x, ty - ped.y) < 10) {
      ped.corner = (ped.corner + 1) % 4;
      return;
    }
  } else {
    return;
  }

  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy) || 1;
  const step = Math.min(d, speed * dt);
  ped.x += (dx / d) * step;
  ped.y += (dy / d) * step;
  ped.angle = Math.atan2(dy, dx);

  // Sidewalks only, unless fleeing across a road in a panic.
  if (ped.state === 'walk' && onRoad(ped.x, ped.y)) {
    ped.x -= (dx / d) * step;
    ped.y -= (dy / d) * step;
    ped.corner = (ped.corner + 1) % 4;
  }
  const pos = { x: ped.x, y: ped.y };
  pushOut(city, pos, 9);
  ped.x = pos.x;
  ped.y = pos.y;
}

export function pedDrawInfo(ped) {
  return {
    shirt: ped.shirt,
    skin: ped.skin,
    down: ped.state === 'down',
    bob: Math.sin(ped.bob) * (ped.state === 'down' ? 0 : 1.6),
  };
}

export { clamp };
