// vehicles.js — every car in Palmera: the kinds that drive here, the
// arcade physics they all share, and the traffic mind that follows the
// road graph from intersection to intersection.

import { ROAD_HALF } from './config.js';
import { makeRng, clamp, angleDelta } from './rng.js';
import { nearestNode, pushOut } from './city.js';

export const CAR_KINDS = {
  sedan: { len: 44, wid: 21, top: 252, accel: 300, grip: 9.5, label: 'Sedan' },
  hatch: { len: 39, wid: 20, top: 232, accel: 285, grip: 10, label: 'Hatchback' },
  coupe: { len: 46, wid: 21, top: 348, accel: 430, grip: 11, label: 'Sports Coupe' },
  van: { len: 52, wid: 24, top: 205, accel: 240, grip: 8, label: 'Van' },
  taxi: { len: 44, wid: 21, top: 246, accel: 295, grip: 9.5, label: 'Taxi' },
  cop: { len: 46, wid: 22, top: 318, accel: 395, grip: 10.5, label: 'Patrol Car' },
};

const PAINTS = ['#c8553d', '#588157', '#4361ee', '#e0a458', '#8d6e63', '#5e60ce', '#bc6c25', '#6c757d', '#dda448', '#7fb5b5'];

let nextCarId = 1;

export function makeCar(kind, x, y, angle, driver, rng) {
  return {
    id: nextCarId++,
    kind, x, y, angle,
    vx: 0, vy: 0,
    driver, // 'traffic', 'cop', 'player', or null when parked and empty
    color: kind === 'taxi' ? '#f2b035' : kind === 'cop' ? '#20242c' : rng.pick(PAINTS),
    hp: 100,
    node: -1, // traffic: the intersection it is heading for
    honkAt: 0,
    smoke: 0,
    wrecked: false,
  };
}

export function spawnTraffic(city, count, rng) {
  const cars = [];
  const kinds = ['sedan', 'sedan', 'hatch', 'taxi', 'van', 'coupe'];
  for (let i = 0; i < count; i++) {
    const node = city.graph.nodes[rng.int(0, city.graph.nodes.length - 1)];
    const car = makeCar(rng.pick(kinds), node.x + rng.range(-16, 16), node.y + rng.range(-16, 16), rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'traffic', rng);
    car.node = nearestNode(city, car.x, car.y);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, rng) {
  const cars = [];
  const kinds = ['sedan', 'hatch', 'hatch', 'van', 'coupe', 'taxi'];
  for (const spot of city.parkingSpots) {
    if (!rng.chance(0.52)) continue;
    cars.push(makeCar(rng.pick(kinds), spot.x, spot.y, spot.angle, null, rng));
  }
  return cars;
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

// One physics step for any car. control is {throttle -1..1, steer -1..1,
// brake bool}. Velocity is split along the car's nose: the forward part
// obeys the engine, the sideways part is eaten by grip — less of it while
// the handbrake is held, which is what makes the car drift.
export function stepCar(city, car, control, dt) {
  const spec = CAR_KINDS[car.kind];
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let fwd = car.vx * fx + car.vy * fy;
  let lat = car.vx * -fy + car.vy * fx;

  if (car.wrecked) {
    fwd -= fwd * 2.4 * dt;
    lat -= lat * 4 * dt;
  } else if (control.brake && fwd > 12) {
    fwd -= 480 * dt;
  } else {
    const power = control.throttle >= 0 ? spec.accel : spec.accel * 0.55;
    fwd += control.throttle * power * dt;
    const drag = control.brake ? 1.9 : 0.32;
    fwd -= fwd * drag * dt;
    const top = control.throttle >= 0 ? spec.top : 108;
    fwd = clamp(fwd, -108, top);
  }

  const grip = control.brake && Math.abs(fwd) > 60 ? 2.1 : spec.grip;
  lat -= lat * Math.min(1, grip * dt);

  if (Math.abs(fwd) > 8 && !car.wrecked) {
    const turn = 2.35 * clamp(Math.abs(fwd) / 130, 0.25, 1) * Math.sign(fwd);
    car.angle += control.steer * turn * dt;
  }

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * fwd - nfy * lat;
  car.vy = nfy * fwd + nfx * lat;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Buildings and the sea: test the nose and the tail, share the push.
  let impact = 0;
  for (const off of [-spec.len / 2 + 6, spec.len / 2 - 6]) {
    const probe = { x: car.x + nfx * off, y: car.y + nfy * off };
    const res = pushOut(city, probe, spec.wid / 2);
    if (res.hit) {
      car.x += probe.x - (car.x + nfx * off);
      car.y += probe.y - (car.y + nfy * off);
      const into = -(car.vx * res.nx + car.vy * res.ny);
      if (res.depth > 2 && into > 0) impact = Math.max(impact, into);
    }
  }
  if (impact > 90) {
    car.hp -= (impact - 80) * 0.14;
    car.vx *= 0.42;
    car.vy *= 0.42;
    if (car.hp <= 0) { car.hp = 0; car.wrecked = true; }
  }
  car.smoke = car.hp < 45 ? Math.min(1, car.smoke + dt * 2) : Math.max(0, car.smoke - dt);
  return impact;
}

// Two cars trading paint: push them apart and charge both for the speed
// they met at. Returns the closing speed so the caller can report crimes.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 34;
  if (d === 0 || d >= min) return 0;
  const push = (min - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push; a.y -= uy * push;
  b.x += ux * push; b.y += uy * push;
  const closing = Math.abs((a.vx - b.vx) * ux + (a.vy - b.vy) * uy);
  if (closing > 95) {
    const dmg = (closing - 85) * 0.09;
    a.hp -= dmg;
    b.hp -= dmg;
    if (a.hp <= 0) { a.hp = 0; a.wrecked = true; }
    if (b.hp <= 0) { b.hp = 0; b.wrecked = true; }
    const swap = closing * 0.22;
    a.vx -= ux * swap; a.vy -= uy * swap;
    b.vx += ux * swap; b.vy += uy * swap;
  }
  return closing;
}

// Steer a car toward a point at a target speed; shared by traffic,
// police and the occasional fleeing driver.
export function driveToward(city, car, tx, ty, topSpeed, dt, arrive = 30) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const distPt = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  const diff = angleDelta(car.angle, want);
  const steer = clamp(diff * 2.4, -1, 1);
  let throttle = 1;
  if (Math.abs(diff) > 2.3) throttle = carSpeed(car) > 46 ? -0.5 : 0.35;
  else if (Math.abs(diff) > 1.15) throttle = 0.4;
  const speed = carSpeed(car);
  if (speed > topSpeed) throttle = Math.min(throttle, 0);
  if (distPt < arrive) throttle = Math.min(throttle, 0.3);
  return stepCar(city, car, { throttle, steer, brake: false }, dt);
}

// The traffic mind: follow the graph, braking for whatever is ahead.
// At each intersection it picks a neighbouring one, favouring going
// straight, and aims at the correct side of the road between them.
export function updateTraffic(city, car, dt, obstacles) {
  const nodes = city.graph.nodes;
  if (car.node < 0 || car.node >= nodes.length) car.node = nearestNode(city, car.x, car.y);
  const target = nodes[car.node];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  if (Math.hypot(dx, dy) < 52) {
    const options = city.graph.neighbours[car.node];
    car.wander = (car.wander || 0) + 1;
    const rng = makeRng(car.id * 7919 + car.wander * 131);
    car.node = options[rng.int(0, options.length - 1)];
    return;
  }
  // Lane offset: keep to the right of the road's centre line.
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const laneX = target.x + -uy * (ROAD_HALF * 0.38);
  const laneY = target.y + ux * (ROAD_HALF * 0.38);

  // Anything solid in the next stretch of lane means brakes and, if it
  // lasts, a honk.
  let blocked = false;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const o of obstacles) {
    if (o === car) continue;
    const rx = o.x - car.x;
    const ry = o.y - car.y;
    const ahead = rx * fx + ry * fy;
    const side = Math.abs(rx * -fy + ry * fx);
    if (ahead > 4 && ahead < 58 && side < 17) { blocked = true; break; }
  }
  if (blocked) {
    const speed = carSpeed(car);
    stepCar(city, car, { throttle: speed > 26 ? -0.6 : 0, steer: 0, brake: speed > 26 }, dt);
    car.honkAt -= dt;
    if (car.honkAt <= 0 && speed < 12) {
      car.honkAt = 2.6;
      return 'honk';
    }
    return null;
  }
  driveToward(city, car, laneX, laneY, CAR_KINDS[car.kind].top * 0.52, dt, 44);
  return null;
}
