// The story of Palmera Heat, as data: six jobs for fixer Sol Duarte that
// take Rico Vega from a borrowed sedan to the score of his life, plus the
// repeatable stash runs that keep cash flowing after the credits. The
// runner walks the current mission's steps, plants its markers, spawns its
// cars and muscle, and pays out at the end.

import { BLOCK, ROAD, COLS, COLORS } from './config.js';
import { roadCenterX } from './city.js';
import { createCar } from './vehicles.js';
import { createPed } from './people.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    intro: 'Sol: “Rico. You walk everywhere in this heat? Come see me at the Cantina. I got you wheels.”',
    reward: 150,
    outro: 'Sol: “Wheels, a roof, and work when you want it. Don’t scratch her.”',
    steps: [
      { type: 'goto', at: 'cantina', radius: 52, label: 'Meet Sol at Sol’s Cantina' },
      { type: 'enterCar', at: 'cantina', radius: 90, label: 'Get into Sol’s sedan', spawnCar: { kind: 'sedan', color: '#2e86de', name: 'Sol’s Sedan' } },
      { type: 'drive', at: 'apartment', radius: 62, label: 'Drive home to Rico’s Apartment' },
    ],
  },
  {
    id: 'hot-delivery',
    title: 'Hot Delivery',
    intro: 'Sol: “A package waits at the Marina Docks. The Vargas crew wants it at their warehouse. No questions, quick wheels.”',
    reward: 400,
    outro: 'Sol: “Clean work. The Vargas people pay on time — that’s rare and dangerous.”',
    steps: [
      { type: 'pickup', at: 'marina', radius: 40, label: 'Pick up the package at the Marina Docks', wanted: 2 },
      { type: 'drive', at: 'warehouse', radius: 66, label: 'Deliver the package to the Vargas Warehouse', time: 240 },
    ],
  },
  {
    id: 'dockside',
    title: 'Dockside Pickup',
    intro: 'Sol: “A case came in on the night boat. Grab it, shake the law, bring it to me. And Rico — now you carry. Check the glovebox.”',
    reward: 650,
    unlock: 'pistol',
    outro: 'Sol: “You’re not a courier anymore. You’re a professional.”',
    steps: [
      { type: 'drive', at: 'marina', radius: 66, label: 'Get to the Marina Docks' },
      { type: 'pickup', at: 'marina', radius: 40, label: 'Grab the case from the docks', wanted: 3 },
      { type: 'escape', label: 'Lose the heat' },
      { type: 'drive', at: 'cantina', radius: 62, label: 'Bring the case to Sol’s Cantina' },
    ],
  },
  {
    id: 'neon-repo',
    title: 'Neon Repo',
    intro: 'Sol: “A pink Neon Comet sits in Downtown Parking. Its owner owes Tito money. Tito would like his car now.”',
    reward: 800,
    outro: 'Sol: “Tito says the paint alone is worth the debt. Beautiful work.”',
    steps: [
      { type: 'enterCar', at: 'repoLot', radius: 110, label: 'Steal the Neon Comet from Downtown Parking', spawnCar: { kind: 'sport', color: '#f368e0', name: 'Neon Comet' } },
      { type: 'drive', at: 'chopShop', radius: 66, label: 'Deliver the Comet to Tito’s Chop Shop', bonus: 'Keep her above half health for a $250 bonus' },
    ],
  },
  {
    id: 'beach-muscle',
    title: 'Beachfront Muscle',
    intro: 'Sol: “Three gym rats at the Beach Gym owe me for a boat they sank. Go collect. With interest.”',
    reward: 700,
    outro: 'Sol: “They paid in full and apologised to the boat. Palmera respects you now.”',
    steps: [
      { type: 'goto', at: 'gym', radius: 70, label: 'Head to the Beach Gym' },
      { type: 'fight', at: 'gym', radius: 130, label: 'Collect from the three debtors', thugs: 3 },
    ],
  },
  {
    id: 'palmera-job',
    title: 'The Palmera Job',
    intro: 'Sol: “Last one, Rico. The Vargas warehouse holds the take from every crew in the city. We empty it tonight.”',
    reward: 2000,
    outro: 'Sol: “We did it. Palmera City is ours — every avenue, every dock, every neon mile.”',
    steps: [
      { type: 'drive', at: 'warehouse', radius: 66, label: 'Go to the Vargas Warehouse' },
      { type: 'pickup', at: 'warehouse', radius: 44, label: 'Grab the loot (watch the guards)', wanted: 4, guards: 2 },
      { type: 'drive', at: 'hideout', radius: 70, label: 'Get the loot to the Cliffside Hideout', time: 300 },
    ],
  },
];

/** A repeatable free-roam job: lift a stash, run it across town, get paid. */
export function makeStashRun(city, rng) {
  const keys = Object.keys(city.locations);
  const from = keys[rng.int(0, keys.length - 1)];
  let to = from;
  while (to === from) to = keys[rng.int(0, keys.length - 1)];
  const a = city.locations[from];
  const b = city.locations[to];
  const pay = Math.round(140 + Math.hypot(a.x - b.x, a.y - b.y) * 0.09);
  return {
    id: 'stash-run',
    title: 'Stash Run',
    intro: `Sol (text): “Stash at ${a.name}. Run it to ${b.name}. $${pay} in it for you.”`,
    reward: pay,
    outro: 'Sol (text): “Received. You’re a Palmera institution.”',
    steps: [
      { type: 'pickup', at: from, radius: 44, label: `Pick up the stash at ${a.name}`, wanted: 1 },
      { type: 'drive', at: to, radius: 66, label: `Run the stash to ${b.name}` },
    ],
  };
}

/**
 * Walks one mission at a time. G is the game state; the runner writes the
 * current objective into G.objective and the marker into G.marker, spawns
 * what steps need, and calls G.missionDone / G.missionFailed.
 */
export function createMissionRunner() {
  return {
    active: null,
    stepIndex: 0,
    stepTime: 0,
    missionCar: null,
    thugs: [],

    get step() {
      return this.active ? this.active.steps[this.stepIndex] : null;
    },

    start(G, mission) {
      this.active = mission;
      this.stepIndex = 0;
      this.missionCar = null;
      this.thugs = [];
      G.banner(mission.title, mission.intro);
      this.enterStep(G);
    },

    enterStep(G) {
      const step = this.step;
      this.stepTime = 0;
      if (!step) return;
      if (step.wanted) G.police.setWanted(step.wanted);
      if (step.spawnCar) {
        const at = G.city.locations[step.at];
        // Mission cars wait on the avenue beside the location, never inside a slab.
        const laneX = roadCenterX(Math.min(COLS, Math.max(0, Math.round((at.x - ROAD / 2) / (BLOCK + ROAD)))));
        const car = createCar(laneX + 10, at.y, Math.PI / 2, {
          kind: step.spawnCar.kind, color: step.spawnCar.color, name: step.spawnCar.name, mission: true,
        });
        G.cars.push(car);
        this.missionCar = car;
      }
      const fighters = step.thugs || step.guards || 0;
      if (fighters > 0) {
        const at = G.city.locations[step.at];
        for (let n = 0; n < fighters; n++) {
          const thug = createPed(at.x + (n - 1) * 30, at.y + 26 + (n % 2) * 22, G.rng, 'thug');
          thug.state = step.guards ? 'fight' : 'wander';
          if (step.guards) thug.state = 'fight';
          G.peds.push(thug);
          this.thugs.push(thug);
        }
      }
      this.refreshObjective(G);
    },

    refreshObjective(G) {
      const step = this.step;
      if (!step) { G.objective = null; G.marker = null; return; }
      G.objective = step.label;
      if (step.type === 'escape') { G.marker = null; return; }
      const at = step.type === 'enterCar' && this.missionCar
        ? this.missionCar
        : G.city.locations[step.at];
      G.marker = { x: at.x, y: at.y, label: step.label };
    },

    /** Per-step check; returns nothing, advances the machine as steps complete. */
    update(G, dt) {
      if (!this.active) return;
      const step = this.step;
      if (!step) return;
      this.stepTime += dt;
      if (step.time) {
        const left = step.time - this.stepTime;
        G.objective = `${step.label} — ${Math.max(0, Math.ceil(left))}s`;
        if (left <= 0) { G.missionFailed('Out of time. The job resets — try again.'); return; }
      }
      const player = G.player;
      const at = step.type === 'enterCar' && this.missionCar ? this.missionCar : G.city.locations[step.at];
      const dist = at ? Math.hypot(player.x - at.x, player.y - at.y) : Infinity;
      let done = false;

      if (step.type === 'goto') done = dist < step.radius;
      if (step.type === 'pickup') done = !player.inCar && dist < step.radius;
      if (step.type === 'drive') done = player.inCar && dist < step.radius;
      if (step.type === 'enterCar') done = player.inCar && player.car === this.missionCar;
      if (step.type === 'escape') done = G.police.stars === 0 && this.stepTime > 2;
      if (step.type === 'fight') done = this.thugs.every((t) => t.down);

      if (step.type === 'enterCar' && this.missionCar) this.refreshObjective(G);
      if (!done) return;

      this.stepIndex++;
      if (this.stepIndex >= this.active.steps.length) {
        const mission = this.active;
        this.active = null;
        G.missionDone(mission);
      } else {
        G.audio.pickup();
        this.enterStep(G);
      }
    },
  };
}
