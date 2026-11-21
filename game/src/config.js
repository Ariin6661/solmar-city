// Solmar City — central tuning table.
//
// Every number the game balances on lives here, so a single look tells
// you how the city feels: how wide the roads are, how fast Rio runs and
// drives, how hot the police get, and what each job pays. Nothing in here
// is code that runs the game; it is the dials the rest of the modules read.

export const CFG = {
  // World geometry (pixels). The city is a grid of avenues and streets.
  tile: 48,
  worldW: 2600,
  worldH: 2000,
  roadW: 84,
  avenueCount: 9,
  streetCount: 8,
  avenueGap: 260,
  streetGap: 220,
  marginX: 240,
  marginY: 200,
  beachTop: 1780,

  // View.
  viewW: 1280,
  viewH: 720,

  // Rio on foot.
  walkSpeed: 175,
  runSpeed: 245,
  playerRadius: 13,

  // Cars.
  carAccel: 540,
  carReverse: 200,
  carMaxSpeed: 470,
  carBrake: 760,
  carHandbrake: 980,
  carTurn: 2.6,
  carLength: 46,
  carWidth: 22,
  trafficSpeed: 130,
  cruiserSpeed: 430,

  // Wanted system.
  maxWanted: 5,
  heatDecayDelay: 12,
  bustedFine: 150,
  bustedRadius: 42,

  // Combat.
  punchRange: 34,
  punchDamage: 30,
  punchCooldown: 0.38,
  pistolMag: 12,
  pistolDamage: 25,
  pistolCooldown: 0.16,
  reloadTime: 1.2,
  bulletSpeed: 720,
  enemyHp: 100,
  playerHp: 100,

  // Money.
  missionPay: 500,
  taxiFare: 80,
  packagePay: 100,
  packageCount: 10,

  // Missions.
  clockMissionTime: 90,
  standoffEnemies: 4,

  // Timing.
  dayLength: 240,
  // Bump the suffix when the save shape changes, so an old save never
  // loads into a layout it was not written for.
  saveKey: 'solmar-city-save-v3',
};

// Palette: one place for every colour the renderer uses, so the city's
// look stays coherent (sun-bleached plaster, terracotta roofs, teal sea).
export const PAL = {
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  sand: '#e8d29a',
  sea: '#2e7f9e',
  seaDeep: '#256b87',
  road: '#3c3f46',
  roadLine: '#e8e4c8',
  sidewalk: '#b9b3a4',
  building: ['#e8c9a0', '#d9a06b', '#c97e5a', '#e0b184', '#b98a68', '#dfc08e'],
  roof: ['#b4552d', '#8f4a3a', '#a85f35', '#7d5a41'],
  park: '#5d9248',
  tree: '#3f7a34',
  plaza: '#d8cdb2',
  pier: '#8a6b4a',
  carColors: ['#c94f43', '#3f6fb5', '#e0a83c', '#4fae6b', '#8e6fb5', '#d8d8d8', '#2b2b2e'],
  cruiser: '#20304a',
  player: '#e8b23a',
  pedColors: ['#d96b6b', '#6b9ed9', '#7ed96b', '#d9b36b', '#b56bd9', '#6bd9c9'],
};

// Landmark names and where they sit, in world coordinates. The missions
// and the minimap both read from this table.
export const LANDMARKS = [
  { name: "Mara's Garage", x: 370, y: 330, kind: 'garage' },
  { name: 'Plaza del Sol', x: 1300, y: 1000, kind: 'plaza' },
  { name: 'The Meridian', x: 1900, y: 560, kind: 'hotel' },
  { name: 'Solmar Pier', x: 1300, y: 1900, kind: 'pier' },
  { name: 'Dockside Yards', x: 2150, y: 1650, kind: 'docks' },
];
