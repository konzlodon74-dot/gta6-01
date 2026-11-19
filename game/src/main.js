// main.js — Palmera Heat's heartbeat. It builds the city, deals the
// traffic and the crowds, runs the loop, and moves Nico through the
// states of a day in his life: title, playing, paused, busted, wasted.
// Every other module owns one system; this one owns the order they run.

import { WORLD, PLAYER_RADIUS, RUN_SPEED, WALK_SPEED, PLAYER_MAX_HP } from './config.js';
import { makeRng, clamp, angleDelta } from './rng.js';
import { buildCity, pushOut } from './city.js';
import { initInput, isDown, wasTapped, moveAxes, endFrame } from './input.js';
import { initAudio, updateAudio, sfx } from './audio.js';
import {
  spawnTraffic, spawnParked, stepCar, collideCars, updateTraffic, carSpeed, CAR_KINDS,
} from './vehicles.js';
import { spawnCrowd, updatePed, knockDown, scarePed, makePed } from './people.js';
import { updatePolice, reportCrime } from './police.js';
import { startStoryMission, updateMissions, say } from './missions.js';
import { drawWorld } from './render.js';
import { drawHud, drawTitle, drawPause, drawBusted, drawWasted } from './hud.js';
import { loadSave, storeSave, wipeSave } from './save.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  state: 'title',
  frozen: false,
  time: 0,
  viewW: 1280,
  viewH: 720,
  camera: { x: 0, y: 0 },
  city: null,
  rng: makeRng(987123),
  cars: [],
  cops: [],
  peds: [],
  skids: [],
  particles: [],
  player: null,
  cash: 60,
  earned: 0,
  heat: 0,
  heatFloor: 0,
  stars: 0,
  bust: 0,
  bustedNow: false,
  lastCrimeAt: -99,
  lastCrimePos: null,
  copSpawnTimer: 0,
  nearestCop: Infinity,
  playerSpeed: 0,
  job: null,
  sideJob: null,
  nextSideAt: 0,
  storyStep: 0,
  storyDone: false,
  objective: null,
  sideObjective: null,
  dialogue: [],
  banner: null,
  hint: null,
  lastFine: 0,
  hasSave: false,
  sfxObjective: () => sfx.objective(),
  sfxCash: () => sfx.cash(),
  onProgress: () => {},
};

function freshPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, vx: 0, vy: 0,
    hp: PLAYER_MAX_HP, inCar: null, bob: 0, lastHurtAt: -99,
  };
}

function buildWorld() {
  G.city = buildCity();
  const traffic = spawnTraffic(G.city, 26, G.rng);
  const parked = spawnParked(G.city, G.rng);
  G.cars = [...traffic, ...parked];
  G.cops = [];
  G.peds = spawnCrowd(G.city, G.rng, 46);
  G.player = freshPlayer(3222, 2062);
  G.camera.x = clamp(G.player.x - G.viewW / 2, 0, WORLD.w - G.viewW);
  G.camera.y = clamp(G.player.y - G.viewH / 2, 0, WORLD.h - G.viewH);
}

function snapshot() {
  return {
    cash: G.cash,
    earned: G.earned,
    storyStep: G.storyStep,
    storyDone: G.storyDone,
    x: Math.round(G.player.x),
    y: Math.round(G.player.y),
  };
}

function beginRun(fromSave) {
  buildWorld();
  G.heat = 0;
  G.heatFloor = 0;
  G.bust = 0;
  G.job = null;
  G.sideJob = null;
  G.dialogue = [];
  if (fromSave) {
    G.cash = fromSave.cash;
    G.earned = fromSave.earned || 0;
    G.storyStep = fromSave.storyStep;
    G.storyDone = !!fromSave.storyDone;
    if (typeof fromSave.x === 'number') {
      G.player.x = fromSave.x;
      G.player.y = fromSave.y;
    }
  } else {
    G.cash = 60;
    G.earned = 0;
    G.storyStep = 0;
    G.storyDone = false;
  }
  G.onProgress = () => storeSave(snapshot());
  G.state = 'playing';
  if (!G.storyDone && G.storyStep < 6) {
    startStoryMission(G, G.storyStep);
  } else {
    say(G, 'Nico', 'Palmera is open. Side work pays, and the coast road is calling.', 5);
  }
}

// --- the player ----------------------------------------------------------

function updatePlayerOnFoot(dt) {
  const p = G.player;
  const axes = moveAxes();
  const running = isDown('ShiftLeft') || isDown('ShiftRight');
  const speed = running ? RUN_SPEED : WALK_SPEED;
  const moving = axes.x !== 0 || axes.y !== 0;
  if (moving) {
    const len = Math.hypot(axes.x, axes.y);
    p.vx = (axes.x / len) * speed;
    p.vy = (axes.y / len) * speed;
    const want = Math.atan2(axes.y, axes.x);
    p.angle += angleDelta(p.angle, want) * Math.min(1, dt * 14);
    p.bob += dt * (running ? 13 : 9.5);
  } else {
    p.vx = 0;
    p.vy = 0;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const pos = { x: p.x, y: p.y };
  pushOut(G.city, pos, PLAYER_RADIUS);
  p.x = pos.x;
  p.y = pos.y;
  G.playerSpeed = moving ? speed : 0;

  // A shove: rude, occasionally profitable for nobody, and a crime when
  // it lands.
  if (wasTapped('Space')) {
    for (const ped of G.peds) {
      if (ped.state === 'down' || ped.state === 'ride') continue;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 34) {
        knockDown(ped);
        reportCrime(G, 'shove', ped.x, ped.y);
        burst(ped.x, ped.y, '#e8e2c8', 5, 60);
        for (const other of G.peds) {
          if (Math.hypot(other.x - ped.x, other.y - ped.y) < 120) scarePed(other, p.x, p.y);
        }
        break;
      }
    }
  }
}

function nearestCarTo(x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function tryEnterCar() {
  const p = G.player;
  const car = nearestCarTo(p.x, p.y, 54);
  if (!car || car.wrecked) return;
  if (car.driver === 'traffic') {
    // The driver gets out in a hurry and runs. The law calls it theft.
    const driver = makePed(car.x + 22, car.y + 14, G.rng, null);
    driver.state = 'flee';
    driver.fleeX = p.x;
    driver.fleeY = p.y;
    driver.fleeFor = 3;
    G.peds.push(driver);
    reportCrime(G, 'carjack', car.x, car.y);
  } else if (car.kind === 'cop') {
    reportCrime(G, 'carjack', car.x, car.y);
    reportCrime(G, 'hitCop', car.x, car.y);
  }
  car.driver = 'player';
  p.inCar = car;
  sfx.door();
}

function exitCar() {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  p.inCar = null;
  // Step out on whichever side is not a wall or the sea.
  for (const [ox, oy] of [[0, 30], [0, -30], [30, 0], [-30, 0]]) {
    const pos = { x: car.x + ox, y: car.y + oy };
    const res = pushOut(G.city, pos, PLAYER_RADIUS);
    if (!res.hit) {
      p.x = pos.x;
      p.y = pos.y;
      break;
    }
    p.x = pos.x;
    p.y = pos.y;
  }
  p.angle = car.angle;
  sfx.door();
}

function updatePlayerInCar(dt) {
  const p = G.player;
  const car = p.inCar;
  const axes = moveAxes();
  const control = {
    throttle: axes.y !== 0 ? -axes.y : 0,
    steer: axes.x,
    brake: isDown('Space'),
  };
  const impact = stepCar(G.city, car, control, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  G.playerSpeed = carSpeed(car);

  if (impact > 140) {
    hurtPlayer((impact - 130) * 0.055, car.x, car.y);
    sfx.thud(impact / 30);
    burst(car.x + Math.cos(car.angle) * 20, car.y + Math.sin(car.angle) * 20, '#c9c9c9', 7, 90);
  }

  // Tyre marks while the back end steps out.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const lat = car.vx * -fy + car.vy * fx;
  if (Math.abs(lat) > 58 && G.playerSpeed > 85) {
    for (const side of [-1, 1]) {
      G.skids.push({
        x: car.x - fx * 13 - fy * side * 8,
        y: car.y - fy * 13 + fx * side * 8,
        angle: car.angle, life: 1,
      });
    }
    if (G.skids.length > 460) G.skids.splice(0, G.skids.length - 460);
  }
}

function hurtPlayer(amount, x, y) {
  const p = G.player;
  if (G.time - p.lastHurtAt < 0.25) return;
  p.lastHurtAt = G.time;
  p.hp -= amount;
  burst(x, y, '#e5484d', 4, 70);
  if (p.hp <= 0) {
    p.hp = 0;
    G.lastFine = Math.min(G.cash, 150);
    G.state = 'wasted';
    sfx.wasted();
  }
}

// --- the world around him ------------------------------------------------

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = G.rng.range(0, Math.PI * 2);
    const s = G.rng.range(speed * 0.3, speed);
    G.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: G.rng.range(0.3, 0.7), maxLife: 0.7,
      size: G.rng.range(1.6, 3.4), color,
    });
  }
}

function updateWorld(dt) {
  const p = G.player;

  // Traffic, with the player on foot counted as an obstacle to brake for.
  const obstacles = p.inCar ? G.cars : [...G.cars, { x: p.x, y: p.y }];
  for (const car of G.cars) {
    if (car.driver === 'traffic' && !car.wrecked) {
      if (updateTraffic(G.city, car, dt, obstacles) === 'honk') sfx.horn();
    }
  }

  // Cars meeting cars.
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i];
      const b = G.cars[j];
      if (Math.abs(a.x - b.x) > 60 || Math.abs(a.y - b.y) > 60) continue;
      const closing = collideCars(a, b);
      if (closing > 120) {
        const playerInvolved = a === p.inCar || b === p.inCar;
        const other = a === p.inCar ? b : a;
        if (playerInvolved) {
          reportCrime(G, other.kind === 'cop' ? 'hitCop' : 'hitCar', p.x, p.y);
          if (closing > 175) hurtPlayer((closing - 165) * 0.05, p.x, p.y);
          sfx.thud(closing / 28);
        }
      }
    }
  }

  // Cars meeting people, and cars meeting Nico.
  const threats = G.cars.map((c) => ({ x: c.x, y: c.y, speed: carSpeed(c) }));
  for (const car of G.cars) {
    const speed = carSpeed(car);
    if (speed < 12) continue;
    for (const ped of G.peds) {
      if (ped.state === 'down' || ped.state === 'ride') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 27) {
        knockDown(ped);
        if (car === p.inCar || car.driver === 'player') {
          reportCrime(G, 'runOver', ped.x, ped.y);
          sfx.thud(4);
        }
      }
    }
    if (!p.inCar && speed > 64 && Math.hypot(p.x - car.x, p.y - car.y) < 27) {
      hurtPlayer(9 + speed * 0.03, p.x, p.y);
      p.x += car.vx * 0.14;
      p.y += car.vy * 0.14;
    }
  }

  for (const ped of G.peds) updatePed(G.city, ped, dt, threats);

  // Skid marks fade; particles fall.
  for (let i = G.skids.length - 1; i >= 0; i--) {
    G.skids[i].life -= dt / 13;
    if (G.skids[i].life <= 0) G.skids.splice(i, 1);
  }
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 130 * dt;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
}

function updateServices() {
  const p = G.player;
  G.hint = null;
  if (!p.inCar) {
    const car = nearestCarTo(p.x, p.y, 54);
    if (car && !car.wrecked) {
      G.hint = car.driver === 'traffic'
        ? `F — take the ${CAR_KINDS[car.kind].label} (the driver will object)`
        : `F — drive the ${CAR_KINDS[car.kind].label}`;
    }
    return;
  }
  // Venn's Garage: new plates, and the law forgets your face.
  const pad = G.city.spots.garagePad;
  const car = p.inCar;
  const onPad = car.x > pad.x && car.x < pad.x + pad.w && car.y > pad.y && car.y < pad.y + pad.h;
  if (onPad && G.stars > 0) {
    if (G.cash >= 150 && G.playerSpeed < 16) {
      G.hint = 'E — new plates, $150, and the heat is gone';
      if (wasTapped('KeyE')) {
        G.cash -= 150;
        G.heat = 0;
        G.heatFloor = 0;
        G.bust = 0;
        sfx.cash();
        say(G, 'Dario', 'New plates, clean hands. Do not waste them, Nico.', 3.6);
      }
    } else if (G.cash < 150) {
      G.hint = 'New plates cost $150 — you are short';
    }
  }
}

function updateCamera(dt) {
  const p = G.player;
  const look = p.inCar ? 0.32 : 0.1;
  const tx = p.x + (p.inCar ? p.inCar.vx : p.vx) * look - G.viewW / 2;
  const ty = p.y + (p.inCar ? p.inCar.vy : p.vy) * look - G.viewH / 2;
  const k = Math.min(1, dt * 5.5);
  G.camera.x += (clamp(tx, 0, Math.max(0, WORLD.w - G.viewW)) - G.camera.x) * k;
  G.camera.y += (clamp(ty, 0, Math.max(0, WORLD.h - G.viewH)) - G.camera.y) * k;
}

function updateAudioFrame() {
  const p = G.player;
  let engine = { on: false, load: 0 };
  if (p.inCar) {
    const spec = CAR_KINDS[p.inCar.kind];
    engine = { on: true, load: clamp(carSpeed(p.inCar) / spec.top, 0, 1) };
  }
  const siren = {
    on: G.stars > 0 && G.nearestCop < 760,
    level: clamp(1 - G.nearestCop / 760, 0, 1),
  };
  updateAudio(1 / 60, engine, siren);
}

function clearPolice() {
  for (const cop of G.cops) {
    const at = G.cars.indexOf(cop);
    if (at >= 0) G.cars.splice(at, 1);
  }
  G.cops = [];
  G.heat = 0;
  G.heatFloor = 0;
  G.bust = 0;
}

function respawnAt(spotKey) {
  const spot = G.city.spots[spotKey];
  if (G.player.inCar) {
    G.player.inCar.driver = null;
    G.player.inCar = null;
  }
  G.player.x = spot.x;
  G.player.y = spot.y + 26;
  G.player.hp = PLAYER_MAX_HP;
  clearPolice();
  G.state = 'playing';
  G.onProgress();
}

// --- the loop --------------------------------------------------------------

function update(dt) {
  G.time += dt;
  if (G.player.inCar) updatePlayerInCar(dt);
  else updatePlayerOnFoot(dt);

  if (wasTapped('KeyF')) {
    if (G.player.inCar) exitCar();
    else tryEnterCar();
  }

  updateWorld(dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateServices();

  // Health creeps back when the day calms down.
  if (G.time - G.player.lastHurtAt > 6 && G.player.hp > 0) {
    G.player.hp = Math.min(PLAYER_MAX_HP, G.player.hp + 2.4 * dt);
  }

  if (G.bustedNow) {
    G.bustedNow = false;
    G.lastFine = Math.min(G.cash, 100 + G.stars * 40);
    G.cash -= G.lastFine;
    G.state = 'busted';
    sfx.busted();
  }

  updateCamera(dt);
  updateAudioFrame();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#191d24';
  ctx.fillRect(0, 0, G.viewW, G.viewH);
  if (G.state === 'title') {
    drawTitle(ctx, G);
    return;
  }
  ctx.save();
  ctx.translate(-Math.round(G.camera.x), -Math.round(G.camera.y));
  drawWorld(ctx, G);
  ctx.restore();
  drawHud(ctx, G);
  if (G.state === 'paused') drawPause(ctx, G);
  if (G.state === 'busted') drawBusted(ctx, G);
  if (G.state === 'wasted') drawWasted(ctx, G);
}

let lastStamp = 0;
function frame(stamp) {
  requestAnimationFrame(frame);
  const dt = Math.min(1 / 30, (stamp - lastStamp) / 1000 || 0.016);
  lastStamp = stamp;

  if (G.state === 'title') {
    if (wasTapped('KeyN')) {
      wipeSave();
      G.hasSave = false;
      beginRun(null);
    } else if (wasTapped('Enter')) {
      beginRun(G.hasSave ? loadSave() : null);
    }
  } else if (G.state === 'paused') {
    if (wasTapped('KeyP') || wasTapped('Escape')) G.state = 'playing';
  } else if (G.state === 'busted') {
    if (wasTapped('Enter')) respawnAt('police');
  } else if (G.state === 'wasted') {
    if (wasTapped('Enter')) respawnAt('hospital');
  } else if (!G.frozen) {
    if (wasTapped('KeyP') || wasTapped('Escape')) {
      G.state = 'paused';
      G.onProgress();
    } else {
      update(dt);
    }
  }
  render();
  endFrame();
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  G.viewW = canvas.width;
  G.viewH = canvas.height;
}

function boot() {
  initInput();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', () => initAudio());
  resize();
  buildWorld();
  G.hasSave = !!loadSave();

  const shot = new URLSearchParams(window.location.search).get('shot');
  if (shot && setupShot(G, shot)) {
    G.frozen = true;
    G.state = 'playing';
    let frames = 0;
    const ready = () => {
      frames++;
      if (frames > 24) {
        window.__shotReady = true;
        document.title = 'Palmera Heat — shot ready';
      } else {
        requestAnimationFrame(ready);
      }
    };
    requestAnimationFrame(ready);
  }

  window.__palmera = G;
  requestAnimationFrame(frame);
}

boot();
