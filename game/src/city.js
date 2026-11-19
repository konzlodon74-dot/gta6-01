// city.js — Palmera itself: the road grid, the blocks and buildings on it,
// the palms and lamps, the marina piers, and the road graph that traffic
// and the GPS both follow. Everything is dealt from one seed, so the city
// never rearranges itself between visits.

import {
  WORLD, AVENUES, STREETS, ROAD_HALF, SAND_X, WATER_X, CITY_SEED,
} from './config.js';
import { makeRng, clamp } from './rng.js';

const ROOF_TONES = ['#d9c6a5', '#cbb890', '#e2d3b3', '#c7b299', '#d5bd9a', '#bfae94'];
const BODY_TONES = ['#a98f6f', '#96785a', '#b59a78', '#8f7a63', '#ac8f6b'];

// Block bands: the land between one road's edge and the next one's.
function bands(centres, limit) {
  const out = [];
  let start = 14;
  for (const c of centres) {
    out.push([start, c - ROAD_HALF - 6]);
    start = c + ROAD_HALF + 6;
  }
  out.push([start, limit - 14]);
  return out;
}

export function buildCity() {
  const rng = makeRng(CITY_SEED);
  const cols = bands(AVENUES, SAND_X - 40);
  const rows = bands(STREETS, WORLD.h);

  const buildings = [];
  const blocks = [];
  const props = [];
  const parkingSpots = [];

  const addBuilding = (x, y, w, h, name = null, tone = null) => {
    const b = {
      x, y, w, h, name,
      roof: tone ?? rng.pick(ROOF_TONES),
      body: rng.pick(BODY_TONES),
      floors: Math.max(1, Math.round((w * h) / 26000)),
    };
    buildings.push(b);
    return b;
  };

  // Landmarks sit in fixed blocks so the story always finds its places.
  const landmarkBlocks = new Map([
    ['2,2', { name: 'Palmera Police HQ', tone: '#9fb4c7' }],
    ['1,3', { name: 'St. Serena Hospital', tone: '#e8e4da' }],
    ['0,2', { name: 'Cantina Rosa', tone: '#d98e6a' }],
    ['5,4', { name: "Venn's Garage", tone: '#8a97a5' }],
    ['5,2', { name: 'Hotel Azul', tone: '#e6d3ae' }],
    ['0,5', { name: 'Portside Cold Storage', tone: '#b0a89a' }],
  ]);
  const parkBlocks = new Set(['1,0', '4,3']);
  const lotBlocks = new Set(['2,5', '5,5']);

  for (let ci = 0; ci < cols.length; ci++) {
    for (let ri = 0; ri < rows.length; ri++) {
      const [x0, x1] = cols[ci];
      const [y0, y1] = rows[ri];
      const key = `${ci},${ri}`;
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'built', ci, ri };
      blocks.push(block);

      if (parkBlocks.has(key)) {
        block.kind = 'park';
        for (let i = 0; i < 9; i++) {
          props.push({ kind: 'palm', x: rng.range(x0 + 26, x1 - 26), y: rng.range(y0 + 26, y1 - 26) });
        }
        for (let i = 0; i < 4; i++) {
          props.push({ kind: 'bench', x: rng.range(x0 + 30, x1 - 30), y: rng.range(y0 + 30, y1 - 30) });
        }
        continue;
      }

      if (lotBlocks.has(key)) {
        block.kind = 'parking';
        for (let px = x0 + 42; px < x1 - 30; px += 62) {
          for (let py = y0 + 40; py < y1 - 26; py += 74) {
            parkingSpots.push({ x: px, y: py, angle: Math.PI / 2 });
          }
        }
        continue;
      }

      const landmark = landmarkBlocks.get(key);
      if (landmark) {
        const w = (x1 - x0) * 0.62;
        const h = (y1 - y0) * 0.55;
        addBuilding(x0 + (x1 - x0 - w) / 2, y0 + (y1 - y0 - h) / 2, w, h, landmark.name, landmark.tone);
        continue;
      }

      // Ordinary blocks: a loose grid of buildings with alleys between.
      const nCols = rng.int(1, 3);
      const nRows = rng.int(1, 2);
      const cellW = (x1 - x0) / nCols;
      const cellH = (y1 - y0) / nRows;
      for (let a = 0; a < nCols; a++) {
        for (let b = 0; b < nRows; b++) {
          if (rng.chance(0.14)) continue; // an empty lot or a plaza corner
          const w = cellW * rng.range(0.52, 0.8);
          const h = cellH * rng.range(0.52, 0.8);
          const x = x0 + a * cellW + (cellW - w) / 2;
          const y = y0 + b * cellH + (cellH - h) / 2;
          addBuilding(x, y, w, h);
        }
      }
    }
  }

  // Kerbside parking along the avenues: a spot every so often, facing
  // the road it sits beside.
  for (const [x0, x1] of cols) {
    for (let y = 120; y < WORLD.h - 120; y += 118) {
      if (rng.chance(0.45)) parkingSpots.push({ x: x0 + 16, y, angle: Math.PI / 2 });
      if (rng.chance(0.45)) parkingSpots.push({ x: x1 - 16, y, angle: Math.PI / 2 });
    }
  }

  // Palms lean over the coast road and the beach; lamps guard corners.
  for (let y = 90; y < WORLD.h - 60; y += 150) {
    props.push({ kind: 'palm', x: SAND_X + 26 + rng.range(-8, 8), y });
    if (rng.chance(0.6)) props.push({ kind: 'palm', x: rng.range(SAND_X + 60, WATER_X - 40), y: y + rng.range(-30, 30) });
  }
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      props.push({ kind: 'lamp', x: ax - ROAD_HALF - 10, y: sy - ROAD_HALF - 10 });
      props.push({ kind: 'lamp', x: ax + ROAD_HALF + 10, y: sy + ROAD_HALF + 10 });
    }
  }

  // The marina pier and the lighthouse jetty: decks over the water that
  // count as land, with moored boats alongside.
  const piers = [
    { x: WATER_X, y: 1900, w: 220, h: 84 },
    { x: WATER_X, y: 2240, w: 170, h: 70 },
  ];
  const jetty = { x: 3560, y: 170, w: 230, h: 220 };
  const boats = [];
  for (let i = 0; i < 7; i++) {
    boats.push({ x: WATER_X + 30 + rng.range(0, 150), y: 2020 + i * 58 + rng.range(-8, 8), angle: rng.range(-0.2, 0.2), tone: rng.pick(['#e8e4da', '#c8553d', '#588157', '#4361ee']) });
  }

  // Named places the story and the services use, each a point on a kerb
  // or a deck where a car can actually stop.
  const spots = {
    marina: { x: 3340, y: 1942, label: 'Venn Marina Office' },
    garage: { x: 3000, y: 2408, label: "Venn's Garage" },
    garagePad: { x: 2922, y: 2322, w: 150, h: 96 },
    cantina: { x: 268, y: 1200, label: 'Cantina Rosa' },
    hotel: { x: 3268, y: 1200, label: 'Hotel Azul' },
    police: { x: 1800, y: 1572, label: 'Palmera Police HQ' },
    hospital: { x: 1200, y: 1532, label: 'St. Serena Hospital' },
    warehouse: { x: 150, y: 2400, label: 'Portside Cold Storage' },
    lighthouse: { x: 3592, y: 280, label: 'Farallon Lighthouse' },
    beach: { x: 3500, y: 1250, label: 'Palm Beach' },
  };

  // The road graph: one node per intersection, edges along the roads.
  const nodes = [];
  const nodeIndex = new Map();
  STREETS.forEach((sy, ri) => {
    AVENUES.forEach((ax, ci) => {
      nodeIndex.set(`${ci},${ri}`, nodes.length);
      nodes.push({ x: ax, y: sy, ci, ri });
    });
  });
  const neighbours = nodes.map((n) => {
    const out = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${n.ci + dc},${n.ri + dr}`;
      if (nodeIndex.has(k)) out.push(nodeIndex.get(k));
    }
    return out;
  });

  return { buildings, blocks, props, parkingSpots, piers, jetty, boats, spots, graph: { nodes, neighbours } };
}

export function nearestNode(city, x, y) {
  let best = 0;
  let bestD = Infinity;
  city.graph.nodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

// Breadth-first route between two intersections, as a list of node ids.
export function findRoute(city, fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = new Map([[fromId, -1]]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === toId) break;
    for (const nb of city.graph.neighbours[cur]) {
      if (!prev.has(nb)) {
        prev.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  if (!prev.has(toId)) return [fromId];
  const path = [];
  for (let cur = toId; cur !== -1; cur = prev.get(cur)) path.push(cur);
  return path.reverse();
}

// The GPS line from a point to a point: in at the nearest intersection,
// along the graph, and out again.
export function gpsRoute(city, fromX, fromY, toX, toY) {
  const a = nearestNode(city, fromX, fromY);
  const b = nearestNode(city, toX, toY);
  const ids = findRoute(city, a, b);
  const pts = [{ x: fromX, y: fromY }];
  for (const id of ids) pts.push({ x: city.graph.nodes[id].x, y: city.graph.nodes[id].y });
  pts.push({ x: toX, y: toY });
  return pts;
}

export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_HALF) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_HALF) return true;
  return false;
}

function onDeck(city, x, y) {
  for (const p of [...city.piers, city.jetty]) {
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
  }
  return false;
}

export function landAt(city, x, y) {
  if (x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return false;
  if (x < WATER_X) return true;
  return onDeck(city, x, y);
}

// Push a circle out of every building, the sea and the world's edge.
// Returns how hard the push was, so callers can charge damage for it.
export function pushOut(city, pos, r) {
  let hardest = 0;
  let nx = 0;
  let ny = 0;
  const tryPush = (cx, cy, depth, ux, uy) => {
    pos.x = cx;
    pos.y = cy;
    if (depth > hardest) { hardest = depth; nx = ux; ny = uy; }
  };

  for (const b of city.buildings) {
    const left = b.x - r;
    const right = b.x + b.w + r;
    const top = b.y - r;
    const bottom = b.y + b.h + r;
    if (pos.x <= left || pos.x >= right || pos.y <= top || pos.y >= bottom) continue;
    const dLeft = pos.x - left;
    const dRight = right - pos.x;
    const dTop = pos.y - top;
    const dBottom = bottom - pos.y;
    const m = Math.min(dLeft, dRight, dTop, dBottom);
    if (m === dLeft) tryPush(left, pos.y, m, -1, 0);
    else if (m === dRight) tryPush(right, pos.y, m, 1, 0);
    else if (m === dTop) tryPush(pos.x, top, m, 0, -1);
    else tryPush(pos.x, bottom, m, 0, 1);
  }

  if (pos.x + r > WATER_X && !onDeck(city, pos.x, pos.y)) {
    tryPush(WATER_X - r, pos.y, pos.x + r - WATER_X, -1, 0);
  }
  if (pos.x < r) tryPush(r, pos.y, r - pos.x, 1, 0);
  if (pos.y < r) tryPush(pos.x, r, r - pos.y, 0, 1);
  if (pos.x > WORLD.w - r) tryPush(WORLD.w - r, pos.y, pos.x + r - (WORLD.w - r), -1, 0);
  if (pos.y > WORLD.h - r) tryPush(pos.x, WORLD.h - r, pos.y + r - (WORLD.h - r), 0, -1);

  return { hit: hardest > 0, depth: hardest, nx, ny };
}

// A random point on a random road, for traffic to aim at.
export function randomRoadPoint(city, rng) {
  const n = city.graph.nodes[rng.int(0, city.graph.nodes.length - 1)];
  return { x: n.x + rng.range(-20, 20), y: n.y + rng.range(-20, 20) };
}

export { clamp };
