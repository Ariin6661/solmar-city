// Solmar City — all tuning numbers in one place.
// Change a number here, change the feel of the game.

export const CONFIG = {
  // World
  worldSize: 3600,
  roadGap: 400, // distance between neighbouring avenues / streets
  roadWidth: 96,
  beachTop: 3220, // sand starts here
  waterTop: 3420, // the sea starts here

  // Camera + view
  viewWidth: 1280,
  viewHeight: 720,

  // Player on foot
  walkSpeed: 210,
  runSpeed: 300,
  playerRadius: 13,
  playerHealth: 100,

  // Cars
  carLength: 46,
  carWidth: 22,
  carAccel: 320,
  carBrake: 520,
  carReverseAccel: 200,
  carMaxSpeed: 560,
  carMaxReverse: 160,
  carTurn: 2.6, // radians per second at full lock, scaled by speed
  carGrip: 4.2, // how fast sideways velocity is killed (higher = less drift)
  carRadius: 18, // collision circle, slightly inside the body

  // Traffic
  trafficCars: 26,
  trafficSpeed: 150,
  pedestrians: 40,
  pedSpeed: 55,

  // Wanted / police
  maxWanted: 5,
  heatPerShot: 0.9,
  heatPerSteal: 0.7,
  heatPerPedHit: 1.4,
  heatPerCopHit: 0.6,
  heatDecay: 0.05, // per second while a cop can see the player
  heatDecayHidden: 0.22, // per second while no cop is near
  copSpawnInterval: 4.0,
  maxCops: 8,
  copSpeed: 500,
  copRamDamage: 8,
  sightRange: 520,

  // Combat
  pistolDamage: 34,
  pistolRange: 420,
  pistolAmmo: 12,
  pistolReload: 1.1,
  punchDamage: 18,
  punchRange: 34,
  bulletSpeed: 900,
  enemyHealth: 60,
  enemyShootRange: 380,
  enemyShootInterval: 1.4,

  // Missions
  missionRewards: [200, 400, 600, 1000],
  taxiFareBase: 60,
  packageValue: 100,
  packagesTotal: 10,

  // Clock
  clockStartMinutes: 10 * 60, // 10:00
  clockRate: 1.0, // game minutes per real second

  // Minimap
  minimapSize: 176,
  minimapRange: 900, // world units shown across the minimap
};

// Solmar City palette — one sun-soaked coastal city, drawn flat.
export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  water: '#2e7fa8',
  waterDeep: '#256b8f',
  asphalt: '#3a3f46',
  asphaltEdge: '#2c3036',
  lane: '#d8c95c',
  sidewalk: '#b9b3a4',
  building: ['#c96f4a', '#4a7a96', '#d9a441', '#8a6fae', '#5d8a6a', '#b0525e', '#6b7f8f'],
  roof: '#00000022',
  park: '#5d9b4a',
  tree: '#3f7a34',
  treeLight: '#5aa347',
  carColors: ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#e67e22', '#8e44ad', '#16a085'],
  police: '#1e3a5f',
  player: '#e74c3c',
  playerShirt: '#f39c12',
  pedShirts: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1'],
  marker: '#ffd23f',
  markerEdge: '#b8860b',
  hudBg: 'rgba(10, 14, 20, 0.62)',
  hudText: '#ffffff',
  star: '#ffd23f',
  starEmpty: 'rgba(255, 255, 255, 0.35)',
  health: '#2ecc71',
  healthLow: '#e74c3c',
};
