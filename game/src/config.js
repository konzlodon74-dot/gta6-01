// config.js — the shape of Palmera and the numbers everything else tunes by.
//
// Palmera is a grid city on a coast. Six avenues run north-south, four
// streets run east-west, and the eastern edge gives up to sand and open
// water. All coordinates are world pixels; the world is 3840 by 2700.

export const WORLD = { w: 3840, h: 2700 };

export const AVENUES = [300, 900, 1500, 2100, 2700, 3300];
export const STREETS = [300, 900, 1500, 2100];
export const ROAD_HALF = 58; // half the width of a road, in pixels

export const SAND_X = 3400; // east of the coast road the asphalt ends
export const WATER_X = 3610; // and east of the sand, the sea begins

export const CITY_SEED = 20261117; // the city is the same on every visit

// The player, Nico Ferreira, on foot and behind the wheel.
export const WALK_SPEED = 128;
export const RUN_SPEED = 232;
export const PLAYER_RADIUS = 11;
export const PLAYER_MAX_HP = 100;

// Wanted heat: crimes add points, stars fall out of the thresholds, and
// heat cools when the police lose the trail.
export const HEAT_THRESHOLDS = [0, 12, 32, 62, 102, 152];
export const HEAT_DECAY_QUIET = 1.5; // per second, nobody watching
export const HEAT_DECAY_WATCHED = 0.3; // per second, police in sight

export const CRIME_HEAT = {
  carjack: 14,
  shove: 8,
  runOver: 26,
  hitCop: 16,
  hitCar: 4,
  hitProp: 2,
};

// Cop presence per star level, and how the bust meter behaves.
export const COPS_PER_STAR = [0, 2, 3, 5, 7, 9];
export const BUST_RANGE = 120;
export const BUST_FILL_TIME = 1.6; // seconds of being pinned to be busted
export const BUST_DRAIN = 0.55; // meter lost per second while escaping

// The palette: late-afternoon sun over a coastal city.
export const COLORS = {
  land: '#b3a284',
  landAlt: '#ab9a7a',
  sidewalk: '#c9bb9d',
  asphalt: '#43454a',
  asphaltEdge: '#d8d2c0',
  laneMark: '#e8e2c8',
  sand: '#ecd096',
  sandWet: '#dfc084',
  water: '#2e7ea6',
  waterDeep: '#1f6f9b',
  waterFoam: '#bfe6ef',
  grass: '#7fae5c',
  palmTrunk: '#7a5c3e',
  palmLeaf: '#3e8e4f',
  playerShirt: '#0f7d8c',
  playerSkin: '#c98d5f',
  playerPants: '#2c3550',
  copBody: '#20242c',
  copDoor: '#e8e9eb',
  beacon: '#ffc845',
  sideBeacon: '#59d6ff',
  danger: '#e5484d',
  cash: '#7dd069',
};

export const DISTRICTS = [
  { name: 'Hillside', x0: 0, y0: 0, x1: 1560, y1: 960 },
  { name: 'Farallon Point', x0: 3240, y0: 0, x1: 3840, y1: 960 },
  { name: 'Old Town', x0: 0, y0: 960, x1: 1560, y1: 2160 },
  { name: 'Downtown Palmera', x0: 1560, y0: 0, x1: 3240, y1: 2160 },
  { name: 'Palm Beach', x0: 3240, y0: 960, x1: 3840, y1: 2160 },
  { name: 'Portside', x0: 0, y0: 2160, x1: 2100, y1: 2700 },
  { name: 'The Mercado', x0: 2100, y0: 2160, x1: 3240, y1: 2700 },
  { name: 'The Marina', x0: 3240, y0: 2160, x1: 3840, y1: 2700 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Palmera';
}
