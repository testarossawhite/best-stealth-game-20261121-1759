// GLOAMING ARCHIVE — shared tuning and palette.
// Everything visual and numeric that more than one module needs lives here so
// the chambers, the engine and the renderer never disagree about the world.

export const VIEW_W = 1280;
export const VIEW_H = 720;

/** The chamber floor: a 32 x 20 tile room under a 64 px parchment HUD bar. */
export const TILE = 32;
export const COLS = 32;
export const ROWS = 20;
export const FIELD_X = 0;
export const FIELD_Y = 64;
export const FIELD_W = COLS * TILE; // 1024
export const FIELD_H = ROWS * TILE; // 640

/** The right-hand intel panel starts here. */
export const PANEL_X = FIELD_X + FIELD_W; // 1024
export const PANEL_W = VIEW_W - PANEL_X; // 256

export const STEP = 1 / 60;

/** Ink-navy night, warm amber lantern light, parchment UI. One identity. */
export const INK = {
  deep: '#070a18',
  floorA: '#10142a',
  floorB: '#0c1023',
  floorLine: '#1a2040',
  shelfWood: '#2a1d12',
  shelfEdge: '#4a3420',
  parchment: '#e8d9ae',
  parchmentDim: '#b8a678',
  panelBg: '#141126',
  panelEdge: '#3d3358',
  amber: '#ffb84d',
  amberHot: '#ffd98a',
  amberDeep: '#c47b21',
  crimson: '#c0392b',
  blood: '#e74c3c',
  teal: '#2e6f6a',
  grass: '#1d4d3f',
  novice: '#7fb2d9',
  noviceDeep: '#3d6a94',
  pageGlow: '#ffe9a8',
  exitGlow: '#8affc1',
  eyeWhite: '#f4ecd8',
};

/** Book-spine colours cycled deterministically across shelf tiles. */
export const SPINES = ['#7a3b2e', '#2e5a7a', '#6b7a2e', '#7a2e5a', '#2e7a5f', '#8a6a2e', '#4a2e7a', '#93502f'];

/** Difficulty knobs. Candle forgives, Gloaming does not. */
export const DIFFICULTIES = {
  candle: { name: 'CANDLE', detectMul: 0.72, guardSpeedMul: 0.92, pebbleBonus: 1, grace: 1.35 },
  lantern: { name: 'LANTERN', detectMul: 1.0, guardSpeedMul: 1.0, pebbleBonus: 0, grace: 1.0 },
  gloaming: { name: 'GLOAMING', detectMul: 1.32, guardSpeedMul: 1.09, pebbleBonus: -1, grace: 0.75 },
};

export const PLAYER = {
  radius: 0.34,
  walkSpeed: 3.55,
  sneakSpeed: 1.95,
};

export const WARDEN = {
  patrol: { range: 6.4, fov: 1.15, speed: 1.55, pause: 1.4 },
  sentry: { range: 7.2, fov: 1.0, speed: 0, pause: 0 },
  hound: { range: 5.6, fov: 1.5, speed: 1.85, pause: 0.9, scent: 3.1 },
};

/** Vision-cone fan resolution: rays cast per warden cone each frame. */
export const CONE_RAYS = 22;

export const STORAGE_BEST = 'gloaming-archive-best-v1';
export const STORAGE_ENDLESS = 'gloaming-archive-endless-v1';
