// The Palmera PD: a five-star wanted meter that rises when crimes are seen
// and cools when the player breaks line of sight, squad cars that route
// across the city after the player, and foot officers who make the arrest
// when they can hold the player at arm's length.

import { MAX_STARS, STAR_DECAY_SECONDS, COP_SPAWN_EVERY, COLORS } from './config.js';
import { findPath } from './city.js';
import { createCar, driveToward } from './vehicles.js';
import { createPed } from './people.js';
import { makeRandom } from './random.js';

export function createPolice() {
  return {
    stars: 0,
    heat: 0,
    hideTime: 0,
    spawnTimer: 0,
    bust: 0,
    rng: makeRandom(4242),

    /** A crime went in: severity 1 is a theft, 3 a shooting, 5 a downed officer. */
    commitCrime(points, seen = true) {
      if (!seen && this.stars === 0) points *= 0.4;
      this.heat += points;
      this.hideTime = 0;
      while (this.heat >= 3 && this.stars < MAX_STARS) {
        this.stars += 1;
        this.heat -= 3;
      }
      if (this.stars === 0 && this.heat > 1.2) this.stars = 1;
    },

    /** One of the player's bullets or bumpers met a police car. */
    hitCopCar() {
      this.commitCrime(1.2);
    },

    setWanted(level) {
      this.stars = Math.max(this.stars, level);
      this.hideTime = 0;
    },

    clear() {
      this.stars = 0;
      this.heat = 0;
      this.bust = 0;
    },

    copCars(G) {
      return G.cars.filter((c) => c.kind === 'cop' && c.driver === 'cop');
    },

    /** Spawn and steer the response; run the arrest meter. Called per step. */
    update(G, dt) {
      if (this.stars === 0) { this.bust = 0; return; }
      const player = G.player;
      const px = player.inCar ? player.car.x : player.x;
      const py = player.inCar ? player.car.y : player.y;
      const cops = this.copCars(G);
      const nearest = cops.reduce((best, c) => Math.min(best, Math.hypot(c.x - px, c.y - py)), Infinity);
      const footNear = G.peds.some((p) => p.role === 'cop' && !p.down && Math.hypot(p.x - player.x, p.y - player.y) < 300);

      // Cooling off: stay unseen and the stars drain one by one.
      if (nearest > 430 && !footNear) {
        this.hideTime += dt;
        if (this.hideTime > STAR_DECAY_SECONDS) {
          this.stars -= 1;
          this.hideTime = 0;
          if (this.stars === 0) this.heat = 0;
        }
      } else {
        this.hideTime = 0;
      }

      // Reinforcements roll in from a few blocks away, never on top of the
      // player: pick an intersection in the ring around the chase.
      this.spawnTimer -= dt;
      const wanted = Math.min(2 + this.stars * 2, 9);
      if (this.spawnTimer <= 0 && cops.length < wanted) {
        this.spawnTimer = COP_SPAWN_EVERY;
        const ring = G.city.nodes.filter((n) => {
          const d = Math.hypot(n.x - px, n.y - py);
          return d > 470 && d < 920;
        });
        if (ring.length > 0) {
          const node = ring[this.rng.int(0, ring.length - 1)];
          const car = createCar(node.x + this.rng.range(-8, 8), node.y + this.rng.range(-8, 8), 0, { kind: 'cop', driver: 'cop', color: COLORS.copPaint, name: 'Police Interceptor' });
          car.parked = false;
          G.cars.push(car);
        }
      }

      // Far-off units give up the chase and go back on patrol (despawn).
      for (const car of cops) {
        if (Math.hypot(car.x - px, car.y - py) > 1500 && this.stars <= 2) {
          car.driver = null;
          car.kind = 'sedan';
          car.color = COLORS.carPaint[3];
        }
      }

      this.updateCopCar(G, dt, px, py);
      this.updateFootCops(G, dt);
    },

    /** Squad cars route over the road graph, then ram when they have eyes on. */
    updateCopCar(G, dt, px, py) {
      for (const car of this.copCars(G)) {
        car.repath = (car.repath || 0) - dt;
        const direct = Math.hypot(px - car.x, py - car.y) < 210;
        if (direct) {
          driveToward(G, car, dt, px, py, 395, 8);
        } else {
          if (car.repath <= 0 || !car.path) {
            car.repath = 1.1;
            car.path = findPath(G.city, car.x, car.y, px, py);
            car.pathIndex = 0;
          }
          const wp = car.path[Math.min(car.pathIndex, car.path.length - 1)];
          if (Math.hypot(wp.x - car.x, wp.y - car.y) < 52) car.pathIndex++;
          driveToward(G, car, dt, wp.x, wp.y, 385, 30);
        }
        // Officers pile out when the chase parks itself next to the player.
        const speed = Math.hypot(car.vx, car.vy);
        const dist = Math.hypot(px - car.x, py - car.y);
        if (dist < 92 && speed < 60 && !car.emptied && !G.player.inCar) {
          car.emptied = true;
          for (let n = 0; n < 2; n++) {
            const cop = createPed(car.x + 22 + n * 12, car.y + 14 - n * 10, this.rng, 'cop');
            G.peds.push(cop);
          }
        }
        if (dist > 200) car.emptied = false;
      }
    },

    /** Foot officers chase on foot; holding position beside the player busts them. */
    updateFootCops(G, dt) {
      const player = G.player;
      let holding = false;
      for (const cop of G.peds) {
        if (cop.role !== 'cop' || cop.down) continue;
        const d = Math.hypot(player.x - cop.x, player.y - cop.y);
        if (d > 700) { cop.gone = true; continue; }
        if (player.inCar) continue;
        if (d > 24) {
          cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
          cop.x += Math.cos(cop.angle) * 196 * dt;
          cop.y += Math.sin(cop.angle) * 196 * dt;
        } else {
          holding = true;
        }
      }
      G.peds = G.peds.filter((p) => !p.gone);
      if (holding && !player.inCar) {
        this.bust += dt;
        if (this.bust > 1.5) G.busted();
      } else {
        this.bust = Math.max(0, this.bust - dt * 1.6);
      }
    },
  };
}
