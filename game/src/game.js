// Palmera Heat's core: the game state, the per-step simulation (player on
// foot and behind the wheel, traffic, crowds, police, missions, pickups),
// crime and punishment, saving, and the camera. Rendering lives in
// render.js and hud.js; this file is the rules of the world.

import {
  STEP, WALK_SPEED, SPRINT_SPEED, PLAYER_RADIUS, PISTOL_RANGE, PISTOL_DAMAGE,
  PISTOL_COOLDOWN, FIST_RANGE, FIST_DAMAGE, COLORS,
} from './config.js';
import { buildCity, collideCircle, districtAt } from './city.js';
import { makeRandom } from './random.js';
import { spawnCars, stepCarPhysics, updateTrafficCar, collideCars, burst } from './vehicles.js';
import { spawnPeds, updatePed, hurtPed, dropCash, createPed } from './people.js';
import { createPolice } from './police.js';
import { MISSIONS, makeStashRun, createMissionRunner } from './missions.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';

const SAVE_KEY = 'palmera-heat-save-v1';
const CITY_SEED = 20261119;
const KIND_NAMES = { sedan: 'Palmera Sedan', hatch: 'City Hatch', sport: 'Comet Sport', van: 'Cargo Van', taxi: 'Palmera Cab', cop: 'Police Interceptor' };

export function carName(car) {
  return car.name && car.name !== 'car' ? car.name : (KIND_NAMES[car.kind] || 'car');
}

/** Builds a fresh game around the given canvas. */
export function createGame(canvas) {
  const G = {
    time: 0,
    state: 'title',
    city: buildCity(CITY_SEED),
    rng: makeRandom(777),
    cars: [],
    peds: [],
    pickups: [],
    particles: [],
    skids: [],
    tracers: [],
    player: null,
    police: createPolice(),
    runner: createMissionRunner(),
    cash: 120,
    missionIndex: 0,
    storyDone: false,
    weapons: ['fists'],
    camera: { x: 0, y: 0 },
    danger: null,
    objective: null,
    marker: null,
    prompt: null,
    bannerTitle: '',
    bannerText: '',
    bannerAt: -10,
    bannerUntil: -10,
    hurtFlash: 0,
    lastFine: 0,
    district: 'Old Town',
    hasSave: false,
    frozen: false,
    audio: createAudio(),
    input: createInput(canvas),
    _pendingNext: 0,
    _healthSpots: [],
  };

  // ---- world setup -------------------------------------------------------

  function resetWorld() {
    G.cars = spawnCars(G.city, makeRandom(31337), 26);
    G.peds = spawnPeds(G.city, makeRandom(999), 46);
    G.pickups = [];
    G.particles = [];
    G.skids = [];
    G.tracers = [];
    G.police.clear();
    G.runner.active = null;
    const home = G.city.locations.apartment;
    G.player = {
      x: home.x, y: home.y, angle: -Math.PI / 2, hp: 100,
      inCar: false, car: null, weapon: 'fists', fireCd: 0, punchCd: 0,
    };
    G._healthSpots = ['hospital', 'gym', 'cantina', 'marina'].map((key) => ({
      x: G.city.locations[key].x + 18, y: G.city.locations[key].y, nextAt: 0,
    }));
    G.camera.x = home.x;
    G.camera.y = home.y;
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: G.cash, missionIndex: G.missionIndex, storyDone: G.storyDone,
        weapons: G.weapons, x: G.player.x, y: G.player.y,
      }));
      G.hasSave = true;
    } catch { /* private mode: play on without saving */ }
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      G.cash = data.cash ?? 120;
      G.missionIndex = data.missionIndex ?? 0;
      G.storyDone = !!data.storyDone;
      G.weapons = data.weapons ?? ['fists'];
      if (G.weapons.includes('pistol')) G.player.weapon = 'pistol';
      G.player.x = data.x ?? G.player.x;
      G.player.y = data.y ?? G.player.y;
      return true;
    } catch { return false; }
  }

  // ---- public hooks used by the systems ---------------------------------

  G.banner = (title, text) => {
    G.bannerTitle = title;
    G.bannerText = text;
    G.bannerAt = G.time;
    G.bannerUntil = G.time + 6.5;
  };

  G.hurtPlayer = (damage, angle) => {
    if (G.state !== 'playing' || G.player.inCar) return;
    G.player.hp -= damage;
    G.hurtFlash = 1;
    G.player.x += Math.cos(angle) * 6;
    G.player.y += Math.sin(angle) * 6;
    if (G.player.hp <= 0) wasted();
  };

  G.busted = () => {
    if (G.state !== 'playing') return;
    G.lastFine = Math.min(G.cash, 150 + G.police.stars * 60);
    G.cash -= G.lastFine;
    G.state = 'busted';
    G.police.clear();
  };

  G.missionDone = (mission) => {
    let pay = mission.reward;
    let note = '';
    if (mission.id === 'neon-repo' && G.runner.missionCar && G.runner.missionCar.hp >= 55) {
      pay += 250;
      note = ' Bonus $250 for a clean Comet.';
    }
    if (mission.unlock === 'pistol' && !G.weapons.includes('pistol')) {
      G.weapons.push('pistol');
      G.player.weapon = 'pistol';
      note += ' You now carry a pistol.';
    }
    G.cash += pay;
    G.audio.mission();
    G.audio.cash();
    G.banner(mission.title + ' — complete', mission.outro + ` +$${pay}.` + note);
    if (mission.id !== 'stash-run') {
      G.missionIndex = Math.min(MISSIONS.length, G.missionIndex + 1);
      if (G.missionIndex >= MISSIONS.length && !G.storyDone) {
        G.storyDone = true;
        G.state = 'complete';
      } else {
        G._pendingNext = G.time + 4;
      }
    }
    G.objective = null;
    G.marker = null;
    save();
  };

  G.missionFailed = (reason) => {
    G.banner('Job blown', reason);
    const mission = G.runner.active;
    G.runner.active = null;
    G.objective = null;
    G.marker = null;
    if (mission) G._retry = { at: G.time + 2.5, mission };
  };

  function wasted() {
    G.lastFine = Math.min(G.cash, 220);
    G.cash -= G.lastFine;
    G.state = 'wasted';
    G.police.clear();
  }

  function respawn(atKey, heal = true) {
    const at = G.city.locations[atKey];
    if (G.player.inCar) {
      G.player.car.driver = null;
      G.player.car.parked = true;
      G.player.inCar = false;
      G.player.car = null;
    }
    G.player.x = at.x;
    G.player.y = at.y;
    if (heal) G.player.hp = 100;
    G.state = 'playing';
  }

  // ---- crime -------------------------------------------------------------

  function seenByCop(x, y) {
    for (const car of G.cars) {
      if (car.kind === 'cop' && Math.hypot(car.x - x, car.y - y) < 480) return true;
    }
    for (const ped of G.peds) {
      if (ped.role === 'cop' && !ped.down && Math.hypot(ped.x - x, ped.y - y) < 380) return true;
    }
    return false;
  }

  function crime(points, x, y) {
    G.police.commitCrime(points, seenByCop(x, y));
    G.danger = { x, y, t: G.time };
  }

  // ---- player ------------------------------------------------------------

  function enterCar(car) {
    const wasTraffic = car.driver === 'traffic';
    if (wasTraffic) {
      const ped = createPed(car.x + 22, car.y + 12, G.rng);
      ped.state = 'flee';
      ped.think = 2;
      ped.fleeX = ped.x + 160;
      ped.fleeY = ped.y + 60;
      G.peds.push(ped);
    }
    if (car.driver !== 'player') crime(car.parked && !wasTraffic ? 0.7 : 1.1, car.x, car.y);
    car.driver = 'player';
    car.parked = false;
    G.player.inCar = true;
    G.player.car = car;
    G.audio.pickup();
  }

  function exitCar() {
    const car = G.player.car;
    car.driver = null;
    car.parked = true;
    car.vx = 0;
    car.vy = 0;
    G.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 24;
    G.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 24;
    collideCircle(G.city, G.player, PLAYER_RADIUS);
    G.player.inCar = false;
    G.player.car = null;
  }

  function shoot(tx, ty) {
    const p = G.player;
    const angle = Math.atan2(ty - p.y, tx - p.x);
    p.angle = angle;
    p.fireCd = PISTOL_COOLDOWN;
    G.audio.shoot();
    crime(2.6, p.x, p.y);
    let best = null;
    let bestDist = PISTOL_RANGE;
    const consider = (obj, radius, kind) => {
      const dx = obj.x - p.x;
      const dy = obj.y - p.y;
      const along = dx * Math.cos(angle) + dy * Math.sin(angle);
      const side = Math.abs(dx * -Math.sin(angle) + dy * Math.cos(angle));
      if (along > 0 && along < bestDist && side < radius) { best = { obj, kind, along }; bestDist = along; }
    };
    for (const ped of G.peds) if (!ped.down) consider(ped, 13, 'ped');
    for (const car of G.cars) consider(car, 21, 'car');
    const hx = best ? p.x + Math.cos(angle) * bestDist : p.x + Math.cos(angle) * PISTOL_RANGE;
    const hy = best ? p.y + Math.sin(angle) * bestDist : p.y + Math.sin(angle) * PISTOL_RANGE;
    G.tracers.push({ x0: p.x + Math.cos(angle) * 14, y0: p.y + Math.sin(angle) * 14, x1: hx, y1: hy, life: 0.09 });
    burst(G, p.x + Math.cos(angle) * 16, p.y + Math.sin(angle) * 16, 2, '#ffd76a');
    if (!best) return;
    if (best.kind === 'ped') {
      const ped = best.obj;
      const wasCop = ped.role === 'cop';
      if (hurtPed(G, ped, PISTOL_DAMAGE, angle)) {
        dropCash(G, ped);
        crime(wasCop ? 5 : 1.6, ped.x, ped.y);
        burst(G, ped.x, ped.y, 7, '#c9c9c9');
      }
    } else {
      best.obj.hp -= 13;
      if (best.obj.driver === 'traffic') best.obj.panic = 4;
      if (best.obj.kind === 'cop') G.police.hitCopCar();
      burst(G, hx, hy, 3, '#ffe9a0');
    }
  }

  function punch() {
    const p = G.player;
    p.punchCd = 0.38;
    G.audio.punch();
    for (const ped of G.peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d > FIST_RANGE + 12) continue;
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      let diff = Math.abs(a - p.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 1.2) continue;
      if (hurtPed(G, ped, FIST_DAMAGE, a)) {
        dropCash(G, ped);
        crime(ped.role === 'cop' ? 4 : 1.6, ped.x, ped.y);
      } else {
        crime(1.1, ped.x, ped.y);
        if (ped.role === 'walker') { ped.state = 'flee'; ped.think = 1.6; }
      }
      return;
    }
  }

  function updatePlayerFoot(dt, mouseWorld) {
    const p = G.player;
    const input = G.input;
    let mx = 0;
    let my = 0;
    if (input.down('KeyW', 'ArrowUp')) my -= 1;
    if (input.down('KeyS', 'ArrowDown')) my += 1;
    if (input.down('KeyA', 'ArrowLeft')) mx -= 1;
    if (input.down('KeyD', 'ArrowRight')) mx += 1;
    const moving = mx !== 0 || my !== 0;
    const speed = input.down('ShiftLeft', 'ShiftRight') ? SPRINT_SPEED : WALK_SPEED;
    if (moving) {
      const len = Math.hypot(mx, my);
      p.x += (mx / len) * speed * dt;
      p.y += (my / len) * speed * dt;
      if (p.weapon === 'fists') p.angle = Math.atan2(my, mx);
    }
    if (p.weapon === 'pistol') p.angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
    collideCircle(G.city, p, PLAYER_RADIUS);
    p.fireCd -= dt;
    p.punchCd -= dt;
    if (input.mouse.down || input.mouse.clicked) {
      if (p.weapon === 'pistol' && p.fireCd <= 0) shoot(mouseWorld.x, mouseWorld.y);
      if (p.weapon === 'fists' && p.punchCd <= 0) {
        p.angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
        punch();
      }
    }
    if (input.take('Digit1')) p.weapon = 'fists';
    if (input.take('Digit2') && G.weapons.includes('pistol')) p.weapon = 'pistol';
  }

  function updatePlayerCar(dt) {
    const car = G.player.car;
    const input = G.input;
    let throttle = 0;
    let steer = 0;
    if (input.down('KeyW', 'ArrowUp')) throttle = 1;
    if (input.down('KeyS', 'ArrowDown')) throttle = -1;
    if (input.down('KeyA', 'ArrowLeft')) steer = -1;
    if (input.down('KeyD', 'ArrowRight')) steer = 1;
    if (car.hp <= 0) throttle = 0;
    car._brake = throttle < 0;
    stepCarPhysics(G, car, dt, throttle, steer, input.down('Space'));
    G.player.x = car.x;
    G.player.y = car.y;
    G.player.angle = car.angle;
    // Running someone down is fast, loud and very illegal.
    const speed = Math.hypot(car.vx, car.vy);
    if (speed > 120) {
      for (const ped of G.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 19) {
          if (hurtPed(G, ped, 100, car.angle)) dropCash(G, ped);
          crime(ped.role === 'cop' ? 5 : 2.4, ped.x, ped.y);
          car.vx *= 0.82;
          car.vy *= 0.82;
        }
      }
    }
  }

  // ---- the step ------------------------------------------------------------

  function startStoryMission() {
    if (G.missionIndex < MISSIONS.length) G.runner.start(G, MISSIONS[G.missionIndex]);
  }

  function update(dt) {
    G.time += dt;
    const input = G.input;
    if (input.take('KeyM')) G.audio.toggleMute();

    if (G.state === 'title') {
      // A slow aerial drift over downtown while the world lives its life.
      G.camera.x = G.city.width / 2 + Math.sin(G.time * 0.07) * 620;
      G.camera.y = G.city.height / 2 + Math.cos(G.time * 0.05) * 380;
      for (const car of G.cars) if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
      for (const ped of G.peds) updatePed(G, ped, dt);
      if (input.take('Enter')) {
        G.audio.unlock();
        resetWorld();
        if (G.hasSave) loadSave();
        G.state = 'playing';
        startStoryMission();
      }
      if (input.take('KeyN')) {
        try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
        G.hasSave = false;
        G.cash = 120;
        G.missionIndex = 0;
        G.storyDone = false;
        G.weapons = ['fists'];
      }
      input.endStep();
      return;
    }

    if (G.state === 'busted' || G.state === 'wasted' || G.state === 'complete') {
      if (input.take('Enter')) {
        if (G.state === 'busted') respawn('police');
        else if (G.state === 'wasted') respawn('hospital');
        else { G.state = 'playing'; G._pendingNext = 0; }
      }
      input.endStep();
      return;
    }

    if (G.state === 'paused') {
      if (input.take('KeyP', 'Escape')) G.state = 'playing';
      input.endStep();
      return;
    }
    if (input.take('KeyP', 'Escape')) { G.state = 'paused'; input.endStep(); return; }

    // Playing.
    const view = G.viewSize || { w: 1280, h: 800 };
    const mouseWorld = {
      x: G.camera.x + (input.mouse.x - view.w / 2),
      y: G.camera.y + (input.mouse.y - view.h / 2),
    };
    if (G.player.inCar) {
      updatePlayerCar(dt);
      if (input.take('KeyF', 'Enter')) { exitCar(); }
    } else {
      updatePlayerFoot(dt, mouseWorld);
      // Context actions: get in a car, or rest and save at a safehouse.
      let nearestCar = null;
      let nearestDist = 40;
      for (const car of G.cars) {
        const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
        if (d < nearestDist) { nearestDist = d; nearestCar = car; }
      }
      const nearHome = ['apartment', 'cantina'].some((key) => {
        const at = G.city.locations[key];
        return Math.hypot(at.x - G.player.x, at.y - G.player.y) < 48;
      });
      G.prompt = nearestCar ? `F — get in the ${carName(nearestCar)}` : nearHome ? 'E — rest, heal & save' : null;
      if (nearestCar && input.take('KeyF', 'Enter')) enterCar(nearestCar);
      if (nearHome && input.take('KeyE')) {
        G.player.hp = 100;
        save();
        G.banner('Rested', 'Game saved at home base. Sol’s next job lands soon.');
        G.audio.mission();
      }
    }
    if (G.player.inCar) G.prompt = G.player.car.hp <= 0 ? 'This car is wrecked — F to get out' : 'F — get out';

    // Mission flow: retries, the next story job, stash runs on demand.
    if (G._retry && G.time >= G._retry.at) {
      const mission = G._retry.mission;
      G._retry = null;
      G.runner.start(G, mission);
    }
    if (!G.runner.active && !G._retry && G._pendingNext && G.time >= G._pendingNext) {
      G._pendingNext = 0;
      startStoryMission();
    }
    if (!G.runner.active && !G._retry && input.take('KeyQ')) {
      G.runner.start(G, makeStashRun(G.city, G.rng));
    }
    G.runner.update(G, dt);
    // Mission muscle wakes up when Rico gets close.
    for (const thug of G.runner.thugs) {
      if (!thug.down && thug.state !== 'fight' && Math.hypot(thug.x - G.player.x, thug.y - G.player.y) < 130) thug.state = 'fight';
    }

    G.police.update(G, dt);

    // The living city, culled to the neighbourhood that matters.
    const px = G.player.x;
    const py = G.player.y;
    for (const car of G.cars) {
      if (car.driver === 'traffic' && Math.hypot(car.x - px, car.y - py) < 1300) updateTrafficCar(G, car, dt);
    }
    for (let i = 0; i < G.cars.length; i++) {
      for (let j = i + 1; j < G.cars.length; j++) {
        const a = G.cars[i];
        const b = G.cars[j];
        if (Math.abs(a.x - b.x) > 60 || Math.abs(a.y - b.y) > 60) continue;
        if (a.parked && b.parked) continue;
        collideCars(G, a, b);
      }
    }
    G.peds = G.peds.filter((ped) => {
      if (ped.role === 'cop') {
        if (ped.down) { ped.downTime -= dt; return ped.downTime > 0; }
        return true; // foot officers are steered by the police system
      }
      if (Math.hypot(ped.x - px, ped.y - py) > 1000 && !ped.down) return true;
      return updatePed(G, ped, dt);
    });

    // Pickups.
    for (const spot of G._healthSpots) {
      if (G.time >= spot.nextAt && !G.pickups.some((p) => p.kind === 'health' && Math.hypot(p.x - spot.x, p.y - spot.y) < 4)) {
        G.pickups.push({ x: spot.x, y: spot.y, kind: 'health', t: 0 });
      }
    }
    G.pickups = G.pickups.filter((p) => {
      p.t += dt;
      if (p.kind === 'cash' && p.t > 25) return false;
      const d = Math.hypot(p.x - G.player.x, p.y - G.player.y);
      if (d < 22 && !G.player.inCar) {
        if (p.kind === 'cash') { G.cash += p.amount; G.audio.cash(); }
        if (p.kind === 'health') {
          G.player.hp = Math.min(100, G.player.hp + 50);
          G.audio.pickup();
          const spot = G._healthSpots.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < 4);
          if (spot) spot.nextAt = G.time + 30;
        }
        return false;
      }
      return true;
    });

    // Dressing: particles, tracers, fading skid marks.
    for (const p of G.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += (p.grow || 0) * dt;
    }
    G.particles = G.particles.filter((p) => p.life > 0);
    for (const t of G.tracers) t.life -= dt;
    G.tracers = G.tracers.filter((t) => t.life > 0);
    for (const s of G.skids) s.life -= dt;
    G.skids = G.skids.filter((s) => s.life > 0);
    G.hurtFlash = Math.max(0, G.hurtFlash - dt * 2.4);

    // Camera: follow with a look-ahead toward motion, sea visible at the beach.
    const focus = G.player.inCar ? G.player.car : G.player;
    const look = G.player.inCar ? 0.42 : 0.12;
    const tx = focus.x + (focus.vx || 0) * look;
    const ty = focus.y + (focus.vy || 0) * look;
    G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
    G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);
    clampCamera(view);
    G.district = districtAt(G.player.x);

    // Sound: engine from the player's car, sirens from the nearest unit.
    let siren = 0;
    if (G.police.stars > 0) {
      let nearest = Infinity;
      for (const car of G.cars) if (car.kind === 'cop') nearest = Math.min(nearest, Math.hypot(car.x - px, car.y - py));
      siren = Math.max(0, 1 - nearest / 700);
    }
    const engine = G.player.inCar ? Math.min(1, Math.hypot(G.player.car.vx, G.player.car.vy) / 380) : 0;
    G.audio.update(engine, siren, G.time);
    input.endStep();
  }

  function clampCamera(view) {
    const hw = view.w / 2;
    const hh = view.h / 2;
    G.camera.x = WORLD_clamp(G.camera.x, hw, G.city.width);
    G.camera.y = WORLD_clamp(G.camera.y, hh, G.city.height + 190);
  }
  function WORLD_clamp(v, half, size) {
    if (half * 2 >= size) return size / 2;
    return Math.min(size - half + 60, Math.max(half - 60, v));
  }

  resetWorld();
  try { G.hasSave = !!localStorage.getItem(SAVE_KEY); } catch { G.hasSave = false; }
  G.step = (dt) => update(dt);
  G.STEP = STEP;
  return G;
}
