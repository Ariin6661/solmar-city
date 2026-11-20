// Solmar City — shared constants and city geometry.
// A sun-soaked coastal city: 9 avenues x 8 streets on a 340px pitch.
export const CFG = {
  WORLD_W: 3200,
  WORLD_H: 2900,
  ROAD_W: 68,
  PITCH: 340,
  AVE0: 170,
  ST0: 170,
  AVES: 9,
  STS: 8,
  BEACH_Y: 2720, // sand starts here (south edge)
  WATER_Y: 2830, // sea starts here; the pier walks out over it
  WALK_SPEED: 178,
  RUN_SPEED: 0, // no sprint: on-foot speed is one honest pace
  CAR_ACCEL: 430,
  CAR_MAX: 540,
  CAR_REV: 210,
  CAR_TURN: 2.6,
  CAR_GRIP: 3.2,
  HANDBRAKE_GRIP: 0.55,
  BULLET_SPEED: 920,
  ENEMY_BULLET_SPEED: 640,
  PISTOL_MAG: 12,
  RELOAD_TIME: 1.15,
  WANTED_DECAY_S: 14,
  TAXI_COOLDOWN_S: 22,
  SAVE_KEY: 'solmar-city-save-v1',
};

// Avenue / street centre lines (world pixels).
export const AVE_X = (i) => CFG.AVE0 + i * CFG.PITCH;
export const ST_Y = (j) => CFG.ST0 + j * CFG.PITCH;

// Right-hand lane offset for a vehicle travelling along a road.
export function laneOffset(dir) {
  return dir > 0 ? 17 : -17;
}

export const PAL = {
  grass: '#5d7a4a',
  grassDry: '#7d8a52',
  road: '#3b4048',
  roadLine: '#d8c95a',
  sidewalk: '#8d8578',
  sand: '#d9c08a',
  water: '#2e6f8e',
  waterDeep: '#1f4f68',
  park: '#4c7a3f',
  tree: '#2f5d2a',
  roofA: '#b5543c',
  roofB: '#4a6b8a',
  roofC: '#8a6b3f',
  roofD: '#6b4a6b',
  roofE: '#3f7a6b',
  wall: '#c9bda6',
  pier: '#8a6b4a',
  gold: '#f2c14e',
  white: '#f2efe6',
};

// Car paint jobs (body colours).
export const CAR_COLORS = [
  '#c0392b', '#2471a3', '#f1c40f', '#7d3c98', '#16a085',
  '#e67e22', '#95a5a6', '#2c3e50', '#d35400', '#27ae60',
];

export const PED_COLORS = [
  '#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c',
  '#ecf0f1', '#fd79a8', '#00cec9', '#ffeaa7', '#6c5ce7',
];

// Five named landmarks, placed on the map by hand.
export const LANDMARKS = [
  { name: "Mara's Garage", kind: 'garage', x: 590, y: 930, w: 200, h: 130, frontX: 690, frontY: 1085 },
  { name: 'Plaza del Sol', kind: 'plaza', x: 1564, y: 1224, w: 272, h: 272, frontX: 1700, frontY: 1360 },
  { name: 'The Meridian', kind: 'hotel', x: 2290, y: 590, w: 180, h: 180, frontX: 2380, frontY: 790 },
  { name: 'Solmar Pier', kind: 'pier', x: 1560, y: 2720, w: 80, h: 180, frontX: 1600, frontY: 2860 },
  { name: 'Dockside Yards', kind: 'docks', x: 2924, y: 1904, w: 242, h: 612, frontX: 3045, frontY: 2210 },
];

// Park blocks, as [block column, block row] between roads.
export const PARK_BLOCKS = [
  { c: 4, r: 3, name: 'Plaza del Sol' },
  { c: 2, r: 5, name: 'Jacaranda Park' },
  { c: 6, r: 4, name: 'Palm Court' },
];

// The rectangle of the city block between avenue i and i+1,
// street j and j+1 (roads excluded, sidewalk margin kept).
export function blockRect(i, j, margin) {
  const m = margin === undefined ? 14 : margin;
  const x0 = AVE_X(i) + CFG.ROAD_W / 2 + m;
  const y0 = ST_Y(j) + CFG.ROAD_W / 2 + m;
  const x1 = AVE_X(i + 1) - CFG.ROAD_W / 2 - m;
  const y1 = ST_Y(j + 1) - CFG.ROAD_W / 2 - m;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Is this block a park or a landmark block? (No buildings there.)
export function blockKind(i, j) {
  for (const p of PARK_BLOCKS) if (p.c === i && p.r === j) return { kind: 'park', name: p.name };
  if (i === 1 && j === 2) return { kind: 'landmark', name: "Mara's Garage" };
  if (i === 6 && j === 1) return { kind: 'landmark', name: 'The Meridian' };
  if (i === 8 && j === 5) return { kind: 'landmark', name: 'Dockside Yards' };
  if (i === 8 && j === 6) return { kind: 'landmark', name: 'Dockside Yards' };
  return { kind: 'buildings', name: '' };
}
