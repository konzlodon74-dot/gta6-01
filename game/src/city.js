// Palmera City itself: a seeded grid of avenues and streets with three
// districts (Old Town, Downtown, the Marina), a beach along the south edge,
// buildings to collide with, parking lots full of stealable cars, and the
// intersection graph that traffic, police and the GPS all drive on.

import { BLOCK, ROAD, COLS, ROWS, WORLD_W, WORLD_H, COLORS, DISTRICTS } from './config.js';
import { makeRandom } from './random.js';

/** Centre line x of the vertical road beside column i (i in 0..COLS). */
export function roadCenterX(i) { return i * (BLOCK + ROAD) + ROAD / 2; }
/** Centre line y of the horizontal road beside row j (j in 0..ROWS). */
export function roadCenterY(j) { return j * (BLOCK + ROAD) + ROAD / 2; }
/** Left edge of block column i. */
export function blockX(i) { return i * (BLOCK + ROAD) + ROAD; }
/** Top edge of block row j. */
export function blockY(j) { return j * (BLOCK + ROAD) + ROAD; }

/** Which district a world x falls in. */
export function districtAt(x) {
  const col = Math.min(COLS - 1, Math.max(0, Math.floor(x / (BLOCK + ROAD))));
  for (const d of DISTRICTS) if (col < d.until) return d.name;
  return DISTRICTS[DISTRICTS.length - 1].name;
}

/** True when the point sits on asphalt. */
export function isOnRoad(x, y) {
  const lx = x % (BLOCK + ROAD);
  const ly = y % (BLOCK + ROAD);
  return lx < ROAD || ly < ROAD;
}

/**
 * Builds the whole city from a seed. Returns buildings (solid AABBs with a
 * height and a roof colour), trees, parking spots, the named story locations
 * and the intersection graph.
 */
export function buildCity(seed) {
  const rng = makeRandom(seed);
  const buildings = [];
  const trees = [];
  const parkingSpots = [];
  const blocks = [];

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const x = blockX(i);
      const y = blockY(j);
      const isBeach = j === ROWS - 1;
      const roll = rng.next();
      let kind = 'buildings';
      if (isBeach) kind = 'beach';
      else if (roll < 0.12) kind = 'lot';
      else if (roll < 0.2) kind = 'park';
      if (i === 5 && j === 3) kind = 'lot'; // Downtown Parking, the repo job's stage
      blocks.push({ i, j, x, y, kind });

      if (kind === 'beach') {
        for (let t = 0; t < 7; t++) trees.push({ x: x + 24 + rng.range(0, BLOCK - 48), y: y + 30 + rng.range(0, BLOCK - 60), palm: true });
        continue;
      }
      if (kind === 'park') {
        for (let t = 0; t < 10; t++) trees.push({ x: x + 20 + rng.range(0, BLOCK - 40), y: y + 20 + rng.range(0, BLOCK - 40), palm: rng.chance(0.4) });
        continue;
      }
      if (kind === 'lot') {
        // Two rows of marked bays along the lot's north and south edges.
        for (let s = 0; s < 6; s++) {
          parkingSpots.push({ x: x + 34 + s * 34, y: y + 40, angle: Math.PI / 2 });
          parkingSpots.push({ x: x + 34 + s * 34, y: y + BLOCK - 40, angle: -Math.PI / 2 });
        }
        continue;
      }
      // Building blocks: one slab, two halves, or four quarters.
      const layout = rng.pick([1, 2, 2, 4]);
      const district = i < 3 ? 0 : i < 7 ? 1 : 2;
      const palette = [COLORS.roofOld, COLORS.roofDown, COLORS.roofMarina][district];
      const floors = district === 1 ? [6, 16] : district === 0 ? [2, 5] : [3, 8];
      const cells = [];
      if (layout === 1) cells.push([x + 16, y + 16, BLOCK - 32, BLOCK - 32]);
      if (layout === 2) {
        cells.push([x + 14, y + 16, BLOCK / 2 - 22, BLOCK - 32]);
        cells.push([x + BLOCK / 2 + 8, y + 16, BLOCK / 2 - 22, BLOCK - 32]);
      }
      if (layout === 4) {
        for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          cells.push([x + 12 + cx * (BLOCK / 2), y + 12 + cy * (BLOCK / 2), BLOCK / 2 - 24, BLOCK / 2 - 24]);
        }
      }
      for (const [bx, by, bw, bh] of cells) {
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          floors: rng.int(floors[0], floors[1]),
          roof: rng.pick(palette),
          tower: rng.chance(0.3),
        });
      }
      // Sidewalk palms in the Marina, shade trees elsewhere.
      if (rng.chance(0.7)) trees.push({ x: x + 8, y: y + 8, palm: district === 2 });
      if (rng.chance(0.5)) trees.push({ x: x + BLOCK - 8, y: y + BLOCK - 8, palm: district === 2 });
    }
  }
  // A double row of palms along the promenade, the south edge road.
  for (let x = 60; x < WORLD_W - 40; x += 118) {
    trees.push({ x: x + rng.range(-8, 8), y: WORLD_H - ROAD - 12, palm: true });
  }

  /** Named places the story and the respawn rules use, each on open ground. */
  const place = (i, j, dx, dy) => ({ x: blockX(i) + dx, y: blockY(j) + dy });
  const locations = {
    apartment: { name: 'Rico’s Apartment', ...place(0, 1, 40, BLOCK - 30) },
    cantina: { name: 'Sol’s Cantina', ...place(1, 2, BLOCK - 40, BLOCK - 30) },
    chopShop: { name: 'Tito’s Chop Shop', ...place(0, 5, 40, 30) },
    police: { name: 'Palmera PD — Central', x: roadCenterX(5), y: blockY(1) + BLOCK + 14 },
    hospital: { name: 'St. Coral Hospital', ...place(6, 2, BLOCK - 40, 30) },
    marina: { name: 'Marina Docks', ...place(9, 6, BLOCK - 50, BLOCK - 40) },
    gym: { name: 'Beach Gym', ...place(5, ROWS - 1, BLOCK / 2, 90) },
    repoLot: { name: 'Downtown Parking', ...place(5, 3, BLOCK / 2, BLOCK / 2) },
    warehouse: { name: 'Vargas Warehouse', ...place(10, 1, BLOCK - 40, BLOCK - 30) },
    hideout: { name: 'Cliffside Hideout', ...place(10, 5, BLOCK - 40, BLOCK - 30) },
  };

  // Story locations get a cleared plaza pocket: slabs are trimmed back from
  // the spot where a mission marker, a pickup or a respawn must be reachable
  // on foot, and dropped only when nothing worth keeping remains.
  for (const loc of Object.values(locations)) {
    for (let k = buildings.length - 1; k >= 0; k--) {
      const b = buildings[k];
      const nx = Math.min(b.x + b.w, Math.max(b.x, loc.x));
      const ny = Math.min(b.y + b.h, Math.max(b.y, loc.y));
      if (Math.hypot(nx - loc.x, ny - loc.y) >= 40) continue;
      const right = b.x + b.w;
      const bottom = b.y + b.h;
      const edges = [
        { d: loc.x - b.x, cut: () => { b.x = loc.x + 40; b.w = right - b.x; } },
        { d: right - loc.x, cut: () => { b.w = loc.x - 40 - b.x; } },
        { d: loc.y - b.y, cut: () => { b.y = loc.y + 40; b.h = bottom - b.y; } },
        { d: bottom - loc.y, cut: () => { b.h = loc.y - 40 - b.y; } },
      ];
      edges.sort((a, c) => a.d - c.d);
      edges[0].cut();
      if (b.w < 36 || b.h < 36) buildings.splice(k, 1);
    }
  }

  // Intersection graph: nodes (i, j) at every road crossing, edges to neighbours.
  const nodes = [];
  for (let j = 0; j <= ROWS; j++) {
    for (let i = 0; i <= COLS; i++) nodes.push({ i, j, x: roadCenterX(i), y: roadCenterY(j) });
  }
  const nodeAt = (i, j) => nodes[j * (COLS + 1) + i];

  return { buildings, trees, parkingSpots, blocks, locations, nodes, nodeAt, width: WORLD_W, height: WORLD_H };
}

/** The intersection nearest to a point. */
export function nearestNode(city, x, y) {
  const i = Math.round((x - ROAD / 2) / (BLOCK + ROAD));
  const j = Math.round((y - ROAD / 2) / (BLOCK + ROAD));
  return city.nodeAt(
    Math.min(COLS, Math.max(0, i)),
    Math.min(ROWS, Math.max(0, j)),
  );
}

/**
 * Breadth-first route over the intersection graph from (x0, y0) to (x1, y1),
 * returned as world-space waypoints ending at the target itself. Traffic,
 * police and the GPS share this.
 */
export function findPath(city, x0, y0, x1, y1) {
  const start = nearestNode(city, x0, y0);
  const goal = nearestNode(city, x1, y1);
  const key = (n) => n.j * (COLS + 1) + n.i;
  const prev = new Map([[key(start), null]]);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === goal) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = node.i + di;
      const nj = node.j + dj;
      if (ni < 0 || nj < 0 || ni > COLS || nj > ROWS) continue;
      const next = city.nodeAt(ni, nj);
      if (prev.has(key(next))) continue;
      prev.set(key(next), node);
      queue.push(next);
    }
  }
  const points = [];
  let node = goal;
  while (node !== null && node !== undefined) {
    points.unshift({ x: node.x, y: node.y });
    node = prev.get(key(node));
  }
  points.push({ x: x1, y: y1 });
  return points;
}

/**
 * Pushes a circle out of every building it overlaps and clamps it to the
 * world. Mutates and returns the {x, y} object — the one collision rule that
 * the player, pedestrians and cars all share.
 */
export function collideCircle(city, pos, radius) {
  for (const b of city.buildings) {
    const nx = Math.min(b.x + b.w, Math.max(b.x, pos.x));
    const ny = Math.min(b.y + b.h, Math.max(b.y, pos.y));
    const dx = pos.x - nx;
    const dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.y = ny + (dy / d) * radius;
    } else {
      // Centre inside the slab: leave by the nearest face.
      const left = pos.x - b.x;
      const right = b.x + b.w - pos.x;
      const top = pos.y - b.y;
      const bottom = b.y + b.h - pos.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) pos.x = b.x - radius;
      else if (min === right) pos.x = b.x + b.w + radius;
      else if (min === top) pos.y = b.y - radius;
      else pos.y = b.y + b.h + radius;
    }
  }
  pos.x = Math.min(city.width - radius, Math.max(radius, pos.x));
  pos.y = Math.min(city.height - radius, Math.max(radius, pos.y));
  return pos;
}

/** A random point on a random road, for spawning traffic and police. */
export function randomRoadPoint(city, rng) {
  if (rng.chance(0.5)) {
    const i = rng.int(0, COLS);
    return { x: roadCenterX(i), y: rng.range(0, city.height) };
  }
  const j = rng.int(0, ROWS);
  return { x: rng.range(0, city.width), y: roadCenterY(j) };
}
