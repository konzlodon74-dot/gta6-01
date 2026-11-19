// Cars: arcade physics everyone shares, traffic that drives the road graph
// on the correct side, parked cars waiting to be stolen, and the damage and
// skid-mark dressing that sells speed.

import { ROAD, CAR_ACCEL, CAR_REVERSE, CAR_MAX_SPEED, CAR_GRIP, CAR_TURN, CAR_RADIUS, COLORS } from './config.js';
import { collideCircle, findPath, randomRoadPoint } from './city.js';
import { makeRandom } from './random.js';

let nextCarId = 1;

/** A car. `driver` is 'traffic', 'cop', 'player' or null (parked/empty). */
export function createCar(x, y, angle, opts = {}) {
  return {
    id: nextCarId++,
    x, y, angle,
    vx: 0, vy: 0,
    kind: opts.kind || 'sedan',
    color: opts.color || COLORS.carPaint[0],
    hp: opts.hp || 100,
    driver: opts.driver ?? null,
    parked: opts.driver == null,
    path: null,
    pathIndex: 0,
    cruise: opts.cruise || 165,
    panic: 0,
    honk: 0,
    smoke: 0,
    mission: opts.mission || false,
    name: opts.name || 'car',
  };
}

/** The paint and pace of each kind of car on Palmera's streets. */
const KIND_STYLE = {
  sedan: { cruise: 165, accel: 1 },
  hatch: { cruise: 150, accel: 0.9 },
  sport: { cruise: 215, accel: 1.45 },
  van: { cruise: 135, accel: 0.8 },
  taxi: { cruise: 175, accel: 1.05 },
  cop: { cruise: 300, accel: 1.3 },
};

/** Parked cars in the lots and a living traffic fleet, all stealable. */
export function spawnCars(city, rng, trafficCount) {
  const cars = [];
  for (const spot of city.parkingSpots) {
    if (!rng.chance(0.55)) continue;
    const kind = rng.pick(['sedan', 'hatch', 'van', 'sport']);
    cars.push(createCar(spot.x, spot.y, spot.angle, {
      kind,
      color: kind === 'sport' ? '#f368e0' : rng.pick(COLORS.carPaint),
      cruise: KIND_STYLE[kind].cruise,
    }));
  }
  for (let n = 0; n < trafficCount; n++) {
    const p = randomRoadPoint(city, rng);
    const kind = rng.pick(['sedan', 'sedan', 'hatch', 'taxi', 'van', 'sport']);
    const car = createCar(p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), {
      kind,
      driver: 'traffic',
      color: kind === 'taxi' ? COLORS.taxiPaint : rng.pick(COLORS.carPaint),
      cruise: KIND_STYLE[kind].cruise * rng.range(0.85, 1.1),
    });
    car.parked = false;
    cars.push(car);
  }
  return cars;
}

/**
 * One physics step for any car. throttle -1..1, steer -1..1 (left..right).
 * Velocity is split into forward and lateral parts and the lateral part is
 * mostly killed (grip), which is what makes the handling feel like a car
 * and the handbrake feel like a drift. Writes skid marks and smoke into G.
 */
export function stepCarPhysics(G, car, dt, throttle, steer, handbrake) {
  const style = KIND_STYLE[car.kind] || KIND_STYLE.sedan;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let forward = car.vx * fx + car.vy * fy;
  let lateral = car.vx * -fy + car.vy * fx;

  const power = throttle >= 0 ? CAR_ACCEL * style.accel : CAR_REVERSE * 1.6;
  forward += throttle * power * dt;
  const drag = handbrake ? 1.6 : 0.35;
  forward -= forward * drag * dt;
  const top = car.kind === 'cop' || car.driver === 'player' ? CAR_MAX_SPEED * (car.kind === 'sport' ? 1.18 : 1) : car.cruise * 1.6;
  forward = Math.max(-CAR_REVERSE, Math.min(top, forward));

  const grip = handbrake ? 1.4 : CAR_GRIP;
  lateral -= lateral * Math.min(1, grip * dt);
  if (Math.abs(forward) > 12) {
    car.angle += steer * CAR_TURN * dt * Math.min(1, Math.abs(forward) / 130) * Math.sign(forward);
  }
  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * forward - nfy * lateral;
  car.vy = nfy * forward + nfx * lateral;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Buildings: test the nose and tail as circles and share the push-out.
  // A real shove means a real crash: kill most of the speed, charge the paint.
  const preX = car.x;
  const preY = car.y;
  for (const off of [-11, 11]) {
    const anchor = { x: car.x, y: car.y };
    const p = { x: car.x + nfx * off, y: car.y + nfy * off };
    collideCircle(G.city, p, CAR_RADIUS);
    car.x += p.x - (anchor.x + nfx * off);
    car.y += p.y - (anchor.y + nfy * off);
  }
  const shove = Math.hypot(car.x - preX, car.y - preY);
  if (shove > 2.5) {
    if ((car._lastSpeed || 0) > 150) {
      car.hp -= 9;
      G.audio.crash();
      burst(G, car.x, car.y, 6, '#c9c9c9');
    }
    car.vx *= 0.35;
    car.vy *= 0.35;
  }
  const speedNow = Math.hypot(car.vx, car.vy);
  car._lastSpeed = speedNow;

  // Skid marks while drifting or launching, smoke when the car is dying.
  if ((Math.abs(lateral) > 55 || (Math.abs(forward) > 40 && throttle !== 0 && car._launch > 0)) && speedNow > 60) {
    G.skids.push({ x: car.x - nfx * 10 - nfy * 7, y: car.y - nfy * 10 + nfx * 7, a: car.angle, life: 14 });
    G.skids.push({ x: car.x - nfx * 10 + nfy * 7, y: car.y - nfy * 10 - nfx * 7, a: car.angle, life: 14 });
    if (G.skids.length > 420) G.skids.splice(0, G.skids.length - 420);
  }
  car._launch = throttle !== 0 && speedNow < 60 ? 0.4 : Math.max(0, (car._launch || 0) - dt);
  if (car.hp < 35 && Math.random() < dt * 8) {
    G.particles.push({ x: car.x + nfx * 16, y: car.y + nfy * 16, vx: 0, vy: -22, life: 0.9, maxLife: 0.9, size: 7, color: 'rgba(40,40,44,0.5)', grow: 12 });
  }
  return forward;
}

/** Small particle burst helper shared with the rest of the game. */
export function burst(G, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 30 + Math.random() * 90;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, maxLife: 0.4, size: 2.5, color, grow: 0 });
  }
}

/** Circle collision between two cars: push apart, trade a little damage. */
export function collideCars(G, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 30;
  if (d === 0 || d >= min) return;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  if (a.driver !== null || !a.parked) { a.x -= nx * push; a.y -= ny * push; }
  if (b.driver !== null || !b.parked) { b.x += nx * push; b.y += ny * push; }
  const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
  if (rel > 120) {
    a.hp -= 5;
    b.hp -= 5;
    G.audio.crash();
    burst(G, (a.x + b.x) / 2, (a.y + b.y) / 2, 5, '#e8e4d2');
    if (b.kind === 'cop' || a.kind === 'cop') G.police.hitCopCar();
  }
}

/** Offset a path point into the correct lane for the direction of travel. */
function laneTarget(car, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const off = ROAD * 0.22;
  return { x: to.x + (-dy / d) * off, y: to.y + (dx / d) * off };
}

/** Steering helper: throttle and steer that take a car toward a point. */
export function driveToward(G, car, dt, tx, ty, topSpeed, arriveRadius = 26) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const speed = Math.hypot(car.vx, car.vy);
  let throttle = 1;
  if (Math.abs(diff) > 2.2) throttle = speed > 40 ? -0.4 : 0.4;
  else if (Math.abs(diff) > 1.1) throttle = 0.45;
  if (dist < arriveRadius) throttle = Math.min(throttle, 0.25);
  if (speed > topSpeed) throttle = Math.min(throttle, 0);
  return stepCarPhysics(G, car, dt, throttle, steer, false);
}

/** One traffic car: follow its lane path, brake for trouble, flee gunfire. */
export function updateTrafficCar(G, car, dt) {
  if (car.panic > 0) car.panic -= dt;
  if (car.path === null || car.pathIndex >= car.path.length) {
    const rng = makeRandom(car.id * 7919 + Math.floor(G.time));
    const dest = randomRoadPoint(G.city, rng);
    car.path = findPath(G.city, car.x, car.y, dest.x, dest.y);
    car.pathIndex = 0;
  }
  const raw = car.path[Math.min(car.pathIndex, car.path.length - 1)];
  const prev = car.pathIndex > 0 ? car.path[car.pathIndex - 1] : car;
  const target = laneTarget(car, prev, raw);
  if (Math.hypot(raw.x - car.x, raw.y - car.y) < 44) car.pathIndex++;

  // Brake for anything solid ahead: another car, or the player on foot.
  let blocked = false;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of G.cars) {
    if (other === car) continue;
    const rx = other.x - car.x;
    const ry = other.y - car.y;
    const ahead = rx * fx + ry * fy;
    const side = Math.abs(rx * -fy + ry * fx);
    if (ahead > 0 && ahead < 52 && side < 15) { blocked = true; break; }
  }
  if (!blocked && !G.player.inCar) {
    const rx = G.player.x - car.x;
    const ry = G.player.y - car.y;
    const ahead = rx * fx + ry * fy;
    const side = Math.abs(rx * -fy + ry * fx);
    if (ahead > 0 && ahead < 46 && side < 14) blocked = true;
  }
  const speed = Math.hypot(car.vx, car.vy);
  if (blocked) {
    stepCarPhysics(G, car, dt, speed > 30 ? -0.7 : 0, 0, false);
    if (car.honk <= 0 && speed < 10 && Math.random() < dt * 0.4) { G.audio.horn(); car.honk = 3; }
  } else {
    const top = car.panic > 0 ? car.cruise * 2.1 : car.cruise;
    driveToward(G, car, dt, target.x, target.y, top, 30);
  }
  car.honk -= dt;
}

/** A traffic driver bails out and runs when their car is wrecked or jacked. */
export function ejectDriver(G, car) {
  if (car.driver !== 'traffic') return null;
  car.driver = null;
  car.parked = true;
  return { x: car.x + 20, y: car.y + 10 };
}
