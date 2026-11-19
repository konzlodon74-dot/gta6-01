// Staged screenshot scenes, reached with ?shot=<name>&seed=<n>. Each one
// builds a real moment of play — a chase, a beachfront fight, a delivery
// run, an arrest — by placing the cast and running the actual simulation
// forward a fixed number of steps, then freezing the frame. What the camera
// captures is the game itself, HUD and all, never a mock-up.

import { STEP } from './config.js';
import { roadCenterX, roadCenterY } from './city.js';
import { createCar, stepCarPhysics, updateTrafficCar } from './vehicles.js';
import { updatePed, createPed } from './people.js';
import { MISSIONS } from './missions.js';

/** Advance the ambient world (traffic, crowds, police) without player input. */
function ambientSteps(G, steps) {
  for (let s = 0; s < steps; s++) {
    G.time += STEP;
    const px = G.player.x;
    const py = G.player.y;
    for (const car of G.cars) {
      if (car.driver === 'traffic' && Math.hypot(car.x - px, car.y - py) < 1200) updateTrafficCar(G, car, STEP);
    }
    G.peds = G.peds.filter((ped) => (ped.role === 'cop' ? true : updatePed(G, ped, STEP)));
    G.police.update(G, STEP);
    for (const t of G.tracers) t.life -= STEP;
    G.tracers = G.tracers.filter((t) => t.life > 0);
    for (const p of G.particles) { p.life -= STEP; p.x += p.vx * STEP; p.y += p.vy * STEP; }
    G.particles = G.particles.filter((p) => p.life > 0);
  }
}

function putPlayerInCar(G, car) {
  car.driver = 'player';
  car.parked = false;
  G.player.inCar = true;
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
  G.cars.push(car);
}

/** Cover: a three-star chase down a downtown avenue, GPS lit, sirens behind. */
function stageCover(G) {
  G.missionIndex = 1;
  G.runner.start(G, MISSIONS[1]);
  G.cash = 2450;
  G.player.hp = 82;
  G.player.weapon = 'pistol';
  G.weapons = ['fists', 'pistol'];
  const car = createCar(roadCenterX(4) + 10, roadCenterY(1) + 60, Math.PI / 2, { kind: 'sport', color: '#f368e0', name: 'Neon Comet' });
  putPlayerInCar(G, car);
  G.police.setWanted(3);
  for (const [dy, dx] of [[-132, -13], [-198, 15]]) {
    const cop = createCar(car.x + dx, car.y + dy, Math.PI / 2, { kind: 'cop', driver: 'cop', color: '#20242c', name: 'Police Interceptor' });
    cop.parked = false;
    cop.vy = 300;
    G.cars.push(cop);
  }
  G.camera.x = car.x;
  G.camera.y = car.y + 40;
  for (let s = 0; s < 46; s++) {
    G.time += STEP;
    stepCarPhysics(G, car, STEP, 0.95, Math.sin(s * 0.11) * 0.16, false);
    G.player.x = car.x;
    G.player.y = car.y;
    G.police.update(G, STEP);
    for (const c of G.cars) if (c.driver === 'traffic' && Math.hypot(c.x - car.x, c.y - car.y) < 1100) updateTrafficCar(G, c, STEP);
    G.camera.x = car.x;
    G.camera.y = car.y + 40;
  }
}

/** Beach: Rico squares up to Sol's debtors at the Beach Gym, sea behind. */
function stageBeach(G) {
  G.missionIndex = 4;
  G.runner.start(G, MISSIONS[4]);
  G.cash = 3320;
  const gym = G.city.locations.gym;
  G.player.x = gym.x + 24;
  G.player.y = gym.y + 30;
  G.player.angle = Math.PI / 4;
  G.camera.x = gym.x;
  G.camera.y = gym.y - 30;
  ambientSteps(G, 30);
  // The goto step completes as the scene settles, spawning the three debtors,
  // who square up as Rico steps onto their turf.
  G.runner.update(G, STEP);
  for (const thug of G.runner.thugs) thug.state = 'fight';
  ambientSteps(G, 55);
  // The debtors landed a few swings while the scene settled; present the
  // fight mid-action, not through the red hurt flash it left behind.
  G.hurtFlash = 0;
  G.player.hp = 76;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y - 46;
}

/** Marina: a package run east along the shore road, the docks marker ahead. */
function stageMarina(G) {
  G.missionIndex = 1;
  G.runner.start(G, MISSIONS[1]);
  G.cash = 640;
  const marina = G.city.locations.marina;
  const car = createCar(marina.x - 540, roadCenterY(7) - 8, 0.06, { kind: 'sedan', color: '#2e86de', name: 'Sol’s Sedan' });
  putPlayerInCar(G, car);
  G.camera.x = car.x;
  G.camera.y = car.y;
  for (let s = 0; s < 52; s++) {
    G.time += STEP;
    stepCarPhysics(G, car, STEP, 0.85, Math.sin(s * 0.09) * 0.1, false);
    G.player.x = car.x;
    G.player.y = car.y;
    for (const c of G.cars) if (c.driver === 'traffic' && Math.hypot(c.x - car.x, c.y - car.y) < 1100) updateTrafficCar(G, c, STEP);
    G.camera.x = car.x - 10;
    G.camera.y = car.y - 6;
  }
}

/** Arrest: four stars, two units, and the cuffs almost on, downtown. */
function stageArrest(G) {
  G.cash = 5110;
  G.player.hp = 47;
  G.player.weapon = 'pistol';
  G.weapons = ['fists', 'pistol'];
  G.objective = 'Lose the heat';
  const x = roadCenterX(6);
  const y = roadCenterY(3);
  G.player.x = x + 6;
  G.player.y = y + 4;
  G.player.angle = -2.2;
  G.police.setWanted(4);
  for (const [dx, dy, a] of [[-58, -34, 0.7], [66, 40, -2.4]]) {
    const cop = createCar(x + dx, y + dy, a, { kind: 'cop', driver: 'cop', color: '#20242c', name: 'Police Interceptor' });
    cop.parked = false;
    cop.emptied = true;
    G.cars.push(cop);
  }
  for (const [dx, dy] of [[17, -9], [-15, 13]]) {
    const foot = createPed(x + dx, y + dy, G.rng, 'cop');
    G.peds.push(foot);
  }
  G.police.bust = 0.92;
  G.camera.x = x;
  G.camera.y = y;
  ambientSteps(G, 12);
  G.police.bust = 0.98;
  G.camera.x = x;
  G.camera.y = y;
}

const SCENES = { cover: stageCover, beach: stageBeach, marina: stageMarina, arrest: stageArrest };

/** Stage the named scene on a fresh game and freeze it for the camera. */
export function stageShot(G, name) {
  const scene = SCENES[name] || stageCover;
  G.state = 'playing';
  scene(G);
  G.frozen = true;
}
