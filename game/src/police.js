// police.js — the wanted system. Crimes feed a heat score; heat becomes
// stars; stars decide how many patrol cars Palmera sends and how hard
// they lean. Pin Nico down — on foot or in a crawling car, with a patrol
// car close — and the bust meter fills. Break away and it drains, and
// the heat itself cools once nobody is watching.

import {
  HEAT_THRESHOLDS, HEAT_DECAY_QUIET, HEAT_DECAY_WATCHED, CRIME_HEAT,
  COPS_PER_STAR, BUST_RANGE, BUST_FILL_TIME, BUST_DRAIN,
} from './config.js';
import { clamp } from './rng.js';
import { makeCar, carSpeed, driveToward } from './vehicles.js';

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i < HEAT_THRESHOLDS.length; i++) {
    if (heat >= HEAT_THRESHOLDS[i]) stars = i;
  }
  return stars;
}

export function reportCrime(G, kind, x, y) {
  const points = CRIME_HEAT[kind] || 0;
  if (points <= 0) return;
  G.heat = Math.min(HEAT_THRESHOLDS[HEAT_THRESHOLDS.length - 1] + 60, G.heat + points);
  G.lastCrimeAt = G.time;
  G.lastCrimePos = { x, y };
}

function spawnPoint(city, player) {
  let best = null;
  let bestScore = -Infinity;
  for (const n of city.graph.nodes) {
    const d = Math.hypot(n.x - player.x, n.y - player.y);
    if (d < 560 || d > 1150) continue;
    const score = -Math.abs(d - 820) + Math.random() * 30;
    if (score > bestScore) { bestScore = score; best = n; }
  }
  if (!best) {
    let far = 0;
    city.graph.nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - player.x, n.y - player.y);
      if (d > far) { far = d; best = city.graph.nodes[i]; }
    });
  }
  return best;
}

export function updatePolice(G, dt) {
  const { city, player } = G;
  const stars = starsForHeat(G.heat);
  G.stars = stars;

  // Heat cools: fast when unseen, slowly under a patrol car's nose, and
  // never below a floor a mission has set (a marked run stays marked).
  const anyCopNear = G.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 540);
  const sinceCrime = G.time - G.lastCrimeAt;
  const rate = !anyCopNear && sinceCrime > 4 ? HEAT_DECAY_QUIET : HEAT_DECAY_WATCHED;
  if (stars > 0 || G.heat > 0) {
    G.heat = Math.max(G.heatFloor || 0, G.heat - rate * dt);
  }

  const wanted = COPS_PER_STAR[stars] || 0;

  // Send more patrols while the count is short.
  if (G.cops.length < wanted) {
    G.copSpawnTimer -= dt;
    if (G.copSpawnTimer <= 0) {
      G.copSpawnTimer = 1.4;
      const pt = spawnPoint(city, player);
      if (pt) {
        const cop = makeCar('cop', pt.x, pt.y, Math.atan2(player.y - pt.y, player.x - pt.x), 'cop', G.rng);
        G.cars.push(cop);
        G.cops.push(cop);
      }
    }
  }

  // Surplus or distant patrols peel off and leave the world.
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const cop = G.cops[i];
    const d = Math.hypot(cop.x - player.x, cop.y - player.y);
    if ((G.cops.length > wanted && d > 620) || d > 1600) {
      G.cops.splice(i, 1);
      const at = G.cars.indexOf(cop);
      if (at >= 0) G.cars.splice(at, 1);
    }
  }

  // The pursuit itself: aim where Nico is going, not where he is, and
  // box him in rather than ram at full speed when alongside.
  const pvx = player.inCar ? player.inCar.vx : player.vx;
  const pvy = player.inCar ? player.inCar.vy : player.vy;
  let nearest = Infinity;
  for (const cop of G.cops) {
    const lead = clamp(Math.hypot(player.x - cop.x, player.y - cop.y) / 320, 0, 0.85);
    const tx = player.x + pvx * lead;
    const ty = player.y + pvy * lead;
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    nearest = Math.min(nearest, d);
    const top = d > 300 ? 330 : d > 130 ? 215 : 120;
    driveToward(city, cop, tx, ty, top, dt, 26);
  }

  // The bust meter: a pinned Nico is a caught Nico.
  const pSpeed = player.inCar ? carSpeed(player.inCar) : Math.hypot(player.vx, player.vy);
  if (stars > 0 && nearest < BUST_RANGE && pSpeed < 46) {
    G.bust = Math.min(1, G.bust + dt / BUST_FILL_TIME);
    if (G.bust >= 1) G.bustedNow = true;
  } else {
    G.bust = Math.max(0, G.bust - BUST_DRAIN * dt);
  }
  G.nearestCop = nearest;
}
