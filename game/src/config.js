// Palmera Heat — tuning, palette and city dimensions in one place.
// Every other module reads its numbers from here so the game's feel can be
// adjusted without hunting through the simulation.

/** City grid: blocks of BLOCK px separated by roads of ROAD px. */
export const BLOCK = 256;
export const ROAD = 76;
export const COLS = 11;
export const ROWS = 8;
/** World size in pixels, roads included on every edge. */
export const WORLD_W = COLS * (BLOCK + ROAD) + ROAD;
export const WORLD_H = ROWS * (BLOCK + ROAD) + ROAD;
/** The sandy band and the sea along the south edge of the map. */
export const BEACH_Y = WORLD_H - ROAD - 150;
export const SEA_Y = WORLD_H - 84;

/** Player on foot. */
export const WALK_SPEED = 148;
export const SPRINT_SPEED = 238;
export const PLAYER_RADIUS = 11;
export const PLAYER_HP = 100;

/** Arcade car physics. */
export const CAR_ACCEL = 340;
export const CAR_REVERSE = 150;
export const CAR_MAX_SPEED = 430;
export const CAR_GRIP = 7.5;
export const CAR_TURN = 2.6;
export const CAR_RADIUS = 15;

/** Police and the wanted meter. */
export const MAX_STARS = 5;
export const STAR_DECAY_SECONDS = 16;
export const COP_SPAWN_EVERY = 2.4;

/** Combat. */
export const PISTOL_RANGE = 430;
export const PISTOL_DAMAGE = 34;
export const PISTOL_COOLDOWN = 0.24;
export const FIST_RANGE = 30;
export const FIST_DAMAGE = 22;

/** Sun-soaked Palmera palette. */
export const COLORS = {
  sea: '#1d7f96',
  seaDeep: '#146a84',
  sand: '#ecd29a',
  sandWet: '#dfc084',
  grass: '#79b657',
  park: '#8cc168',
  sidewalk: '#cfc8b8',
  road: '#3c4149',
  roadEdge: '#2f333a',
  lane: '#e8e4d2',
  crosswalk: '#d9d5c6',
  plaza: '#ddd3ba',
  roofOld: ['#c96f4a', '#b85c48', '#d08355', '#a9503f'],
  roofDown: ['#5b7186', '#71879b', '#4d6379', '#8296a8'],
  roofMarina: ['#e8e2d2', '#d7e4e2', '#efe9da', '#cfe0da'],
  wallShade: 'rgba(30, 24, 18, 0.28)',
  palmTrunk: '#8a6844',
  palmLeaf: '#3f9e4d',
  playerShirt: '#ff7847',
  pedShirts: ['#e5e0d0', '#7fb3d5', '#f2c14e', '#e07a5f', '#81b29a', '#bc6c25', '#9b5de5', '#f1fa8c'],
  carPaint: ['#d64541', '#2e86de', '#f5f6fa', '#353b48', '#e1b12c', '#1dd1a1', '#ff6b81', '#8395a7', '#f368e0', '#48dbfb'],
  copPaint: '#20242c',
  copStripe: '#f5f6fa',
  taxiPaint: '#f7b731',
};

/** Named districts by column band, west to east. */
export const DISTRICTS = [
  { name: 'Old Town', until: 3 },
  { name: 'Downtown Palmera', until: 7 },
  { name: 'Marina District', until: COLS },
];

/** Street names: avenues run north-south, streets run east-west. */
export const AVENUES = ['Calle Sol', 'Avenida Palma', 'Coral Ave', 'Bulevar Reyes', 'Flamingo Ave', 'Calle Luna', 'Harbor Ave', 'Avenida Brisa', 'Calle Oro', 'Neon Ave', 'Paseo del Mar'];
export const STREETS = ['1st Street', 'Calle Hibisco', '3rd Street', 'Avenida Central', '5th Street', 'Calle Mango', '7th Street', 'Bulevar Azul'];

/** The fixed simulation step, so staged screenshots are deterministic. */
export const STEP = 1 / 60;
