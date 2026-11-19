// missions.js — the work Nico does. A six-job story for Dario Venn of
// the marina, told in pickups, passengers and one borrowed coupe, plus
// the repeatable courier runs and cab fares that keep cash moving
// between story beats. Every step names a place, a marker finds it, and
// the GPS draws the way.

import { dist } from './rng.js';
import { makePed } from './people.js';
import { makeCar } from './vehicles.js';

export function say(G, who, text, seconds = 4.4) {
  G.dialogue.push({ who, text, until: G.time + seconds });
}

function spotOf(city, at) {
  if (typeof at === 'string') return city.spots[at];
  return at;
}

// The story. Steps run in order; each is a place to reach, a thing to
// carry, a person to drive, or a car to bring home.
export const STORY = [
  {
    title: 'The Man at the Marina',
    pay: 0,
    intro: [
      ['Nico', 'Dario Venn holds my marker for two grand. Time to talk terms.'],
      ['Dario', 'Nico Ferreira. You swim like a stone, but you drive like rent is due. Work for me, the debt shrinks.'],
    ],
    steps: [
      { kind: 'meet', at: 'marina', label: 'Meet Dario at the marina office' },
    ],
    outro: [['Dario', 'Good. Jobs come to you now. Do them clean, do them quick.']],
  },
  {
    title: 'Still Warm',
    pay: 180,
    intro: [
      ['Dario', 'A cooler at Portside Cold Storage needs to reach the Hotel Azul kitchen. Still cold, still sealed.'],
      ['Dario', 'Do not open it. Do not ask. Four minutes.'],
    ],
    steps: [
      { kind: 'pickup', at: 'warehouse', label: 'Collect the cooler at Portside Cold Storage' },
      { kind: 'deliver', at: 'hotel', label: 'Deliver the cooler to Hotel Azul', timer: 240 },
    ],
    outro: [['Dario', 'Cold and sealed. $180 off your marker.']],
  },
  {
    title: "Rosa's Night Out",
    pay: 150,
    intro: [
      ['Rosa', 'Nico! My feet are done with the cantina floor. Take me to see the lighthouse beam, like when we were kids.'],
    ],
    steps: [
      { kind: 'passenger', at: 'cantina', who: 'Rosa', label: 'Pick up Rosa at Cantina Rosa' },
      { kind: 'dropoff', at: 'lighthouse', label: 'Take Rosa to Farallon Lighthouse' },
    ],
    outro: [['Rosa', 'Still the best view on the coast. You are a good boy, Nico.']],
  },
  {
    title: 'Borrowed Wheels',
    pay: 260,
    intro: [
      ['Dario', 'A vermillion coupe sits downtown, keys in, owner behind on payments. Bring it to my garage.'],
      ['Dario', 'Borrowing, Nico. We are not thieves. The paperwork just travels slower than the car.'],
    ],
    steps: [
      { kind: 'steal', label: 'Take the vermillion coupe downtown' },
      { kind: 'deliverCar', at: 'garage', label: "Bring the coupe to Venn's Garage" },
    ],
    outro: [['Dario', 'Clean lines, full tank. $260. The marker is almost paper now.']],
  },
  {
    title: 'Crosswind Run',
    pay: 340,
    intro: [
      ['Dario', 'Last errand with teeth. A case waits in Old Town, Calle Serena. The moment you lift it, every patrol in Palmera will smell it.'],
      ['Dario', 'Get it to the cold storage dock. Lose them or outrun them, I do not care which.'],
    ],
    steps: [
      { kind: 'pickup', at: { x: 700, y: 1204, label: 'Calle Serena, Old Town' }, label: 'Lift the case in Old Town' },
      { kind: 'deliver', at: 'warehouse', label: 'Reach Portside Cold Storage with the case', heatOnStart: 3 },
    ],
    outro: [['Dario', 'You smell of brakes and sea wind. $340, and my respect, which spends worse.']],
  },
  {
    title: 'One Light Day',
    pay: 600,
    intro: [
      ['Dario', 'Meet me at the lighthouse, Nico. Tonight I leave Palmera, and the whole police force wants to wave me off.'],
      ['Dario', 'Drive me to my boat at the marina. Get me there and your marker is ash.'],
    ],
    steps: [
      { kind: 'passenger', at: 'lighthouse', who: 'Dario', label: 'Pick up Dario at Farallon Lighthouse' },
      { kind: 'dropoff', at: 'marina', label: 'Get Dario to his boat at the marina', heat: 3, heatOnStart: 3 },
    ],
    outro: [
      ['Dario', 'One light day from anywhere, that lighthouse. You are free of me, Ferreira.'],
      ['Nico', 'Free. Now the city pays me because I ask, not because I owe.'],
    ],
  },
];

export function startStoryMission(G, index) {
  const def = STORY[index];
  if (!def) return;
  G.job = {
    type: 'story',
    index,
    def,
    stepIndex: 0,
    timer: null,
    passenger: null,
    car: null,
    startedAt: G.time,
  };
  for (const [who, text] of def.intro) say(G, who, text, 5);
  beginStep(G);
}

function beginStep(G) {
  const job = G.job;
  if (!job) return;
  const step = job.def.steps[job.stepIndex];
  if (!step) return;
  job.timer = step.timer ?? null;
  if (step.heatOnStart) {
    const floorHeat = [0, 12, 32, 62, 102, 152][step.heatOnStart] || 0;
    G.heatFloor = Math.max(G.heatFloor || 0, floorHeat);
    if (G.heat < floorHeat) G.heat = floorHeat;
    G.lastCrimeAt = G.time;
  }
  if (step.kind === 'steal') {
    spawnStoryCar(G);
  }
  if (step.kind === 'passenger') {
    const at = spotOf(G.city, step.at);
    const ped = makePed(at.x + 14, at.y + 10, G.rng, null);
    ped.state = 'stand';
    ped.job = { role: 'storyPassenger', who: step.who };
    G.peds.push(ped);
    job.passenger = ped;
  }
}

// The borrowed coupe: vermillion, parked among Downtown's kerbs where
// the marker can find it.
function spawnStoryCar(G) {
  const candidates = G.cars.filter((c) => c.driver === null && c.x > 1440 && c.x < 2160 && c.y > 840 && c.y < 1560);
  let car = candidates[0];
  if (!car) {
    car = makeCar('coupe', 1800, 1250, Math.PI / 2, null, G.rng);
    G.cars.push(car);
  }
  car.kind = 'coupe';
  car.color = '#d90429';
  car.hp = 100;
  car.wrecked = false;
  G.job.car = car;
}

function finishStep(G) {
  const job = G.job;
  job.stepIndex += 1;
  job.timer = null;
  if (job.stepIndex >= job.def.steps.length) {
    completeStoryMission(G);
  } else {
    G.sfxObjective();
    beginStep(G);
  }
}

function completeStoryMission(G) {
  const job = G.job;
  const pay = job.def.pay;
  if (job.passenger) {
    job.passenger.job = null;
    job.passenger.state = 'walk';
  }
  G.job = null;
  G.heatFloor = 0;
  if (pay > 0) {
    G.cash += pay;
    G.earned += pay;
    G.sfxCash();
    G.banner = { text: `${job.def.title} — $${pay}`, until: G.time + 3.4 };
  } else {
    G.banner = { text: job.def.title, until: G.time + 3 };
  }
  for (const [who, text] of job.def.outro) say(G, who, text, 5);
  G.storyStep = job.index + 1;
  if (G.storyStep >= STORY.length) {
    G.storyDone = true;
    say(G, 'Nico', 'The marker is paid. Palmera is mine to earn from now.', 6);
  }
  G.onProgress();
}

// --- side work -----------------------------------------------------------

const SIDE_SPOTS = ['warehouse', 'hotel', 'cantina', 'marina', 'garage', 'beach', 'police', 'hospital'];

export function makeSideJob(G) {
  const rng = G.rng;
  const type = rng.chance(0.5) ? 'courier' : 'fare';
  const fromKey = rng.pick(SIDE_SPOTS);
  let toKey = rng.pick(SIDE_SPOTS);
  if (toKey === fromKey) toKey = rng.pick(SIDE_SPOTS);
  const from = G.city.spots[fromKey];
  const to = G.city.spots[toKey];
  const d = dist(from.x, from.y, to.x, to.y);
  const job = {
    type,
    stage: 'pickup',
    from: { x: from.x, y: from.y, label: from.label },
    to: { x: to.x, y: to.y, label: to.label },
    pay: Math.round(46 + d * 0.085),
    timer: null,
    ped: null,
  };
  if (type === 'fare') {
    const ped = makePed(from.x + 12, from.y + 12, rng, null);
    ped.state = 'stand';
    ped.job = { role: 'fare' };
    G.peds.push(ped);
    job.ped = ped;
  }
  return job;
}

function completeSideJob(G) {
  const job = G.sideJob;
  G.cash += job.pay;
  G.earned += job.pay;
  G.sfxCash();
  G.banner = { text: `${job.type === 'fare' ? 'Fare' : 'Courier run'} — $${job.pay}`, until: G.time + 3 };
  if (job.ped) {
    job.ped.job = null;
    job.ped.state = 'walk';
  }
  G.sideJob = null;
  G.nextSideAt = G.time + 14;
  G.onProgress();
}

// --- per-frame checks ----------------------------------------------------

function near(pos, x, y, r) {
  return dist(pos.x, pos.y, x, y) < r;
}

export function updateMissions(G, dt) {
  const playerPos = G.player.inCar ?? G.player;

  // Story job.
  const job = G.job;
  if (job) {
    const step = job.def.steps[job.stepIndex];
    if (step) {
      const at = step.at ? spotOf(G.city, step.at) : null;
      if (job.timer !== null) {
        job.timer -= dt;
        if (job.timer <= 0) {
          job.timer = step.timer;
          say(G, 'Nico', 'Too slow. The run starts again — move!', 3.4);
        }
      }
      switch (step.kind) {
        case 'meet':
        case 'pickup':
        case 'deliver':
          if (at && near(playerPos, at.x, at.y, 64)) finishStep(G);
          break;
        case 'passenger': {
          const ped = job.passenger;
          if (ped && G.player.inCar && near(playerPos, ped.x, ped.y, 72) && G.playerSpeed < 30) {
            ped.state = 'ride';
            G.sfxObjective();
            finishStep(G);
          }
          break;
        }
        case 'dropoff': {
          const ped = job.passenger;
          if (at && ped && ped.state === 'ride' && near(playerPos, at.x, at.y, 78) && G.playerSpeed < 30) {
            ped.state = 'walk';
            ped.x = at.x + 16;
            ped.y = at.y + 12;
            if (step.heat) G.heatFloor = 0;
            finishStep(G);
          }
          break;
        }
        case 'steal':
          if (job.car && G.player.inCar === job.car) finishStep(G);
          break;
        case 'deliverCar':
          if (at && G.player.inCar === job.car && near(playerPos, at.x, at.y, 84)) finishStep(G);
          break;
        default:
          break;
      }
      // A passenger rides where the car goes.
      if (job.passenger && job.passenger.state === 'ride' && G.player.inCar) {
        job.passenger.x = G.player.inCar.x;
        job.passenger.y = G.player.inCar.y;
      }
    }
  }

  // Side job.
  if (!G.sideJob && G.storyStep > 0 && G.time > (G.nextSideAt || 0)) {
    G.sideJob = makeSideJob(G);
  }
  const side = G.sideJob;
  if (side) {
    if (side.stage === 'pickup') {
      if (side.type === 'courier') {
        if (near(playerPos, side.from.x, side.from.y, 64)) {
          side.stage = 'deliver';
          side.timer = Math.max(50, dist(side.from.x, side.from.y, side.to.x, side.to.y) / 9);
          G.sfxObjective();
        }
      } else if (side.ped && G.player.inCar && near(playerPos, side.ped.x, side.ped.y, 72) && G.playerSpeed < 30) {
        side.ped.state = 'ride';
        side.stage = 'deliver';
        side.timer = Math.max(55, dist(side.from.x, side.from.y, side.to.x, side.to.y) / 8.5);
        G.sfxObjective();
      }
    } else {
      side.timer -= dt;
      if (side.timer <= 0) {
        // The customer gives up; the job simply goes away.
        if (side.ped) { side.ped.job = null; side.ped.state = 'walk'; }
        G.sideJob = null;
        G.nextSideAt = G.time + 10;
        say(G, 'Nico', 'Lost that one. Work dries up if I keep people waiting.', 3.6);
      } else if (near(playerPos, side.to.x, side.to.y, 72) && (side.type === 'courier' || G.playerSpeed < 40)) {
        completeSideJob(G);
      }
    }
    if (side && side.ped && side.ped.state === 'ride' && G.player.inCar) {
      side.ped.x = G.player.inCar.x;
      side.ped.y = G.player.inCar.y;
    }
  }

  // What the HUD and GPS should point at right now.
  G.objective = null;
  if (G.job) {
    const step = G.job.def.steps[G.job.stepIndex];
    if (step) {
      if (step.kind === 'steal' && G.job.car) {
        G.objective = { x: G.job.car.x, y: G.job.car.y, label: step.label, timer: G.job.timer };
      } else if (step.kind === 'passenger' && G.job.passenger && G.job.passenger.state !== 'ride') {
        G.objective = { x: G.job.passenger.x, y: G.job.passenger.y, label: step.label, timer: null };
      } else if (step.at) {
        const at = spotOf(G.city, step.at);
        G.objective = { x: at.x, y: at.y, label: step.label, timer: G.job.timer };
      }
    }
  }
  G.sideObjective = null;
  if (G.sideJob) {
    const s = G.sideJob;
    const target = s.stage === 'pickup' ? s.from : s.to;
    G.sideObjective = {
      x: target.x, y: target.y,
      label: s.stage === 'pickup'
        ? (s.type === 'fare' ? 'Pick up your fare' : 'Collect the package')
        : (s.type === 'fare' ? `Take your fare to ${s.to.label}` : `Deliver to ${s.to.label}`),
      timer: s.stage === 'deliver' ? s.timer : null,
    };
  }
}
