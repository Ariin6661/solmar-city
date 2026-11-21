// Solmar City — tuning, palette and static data.
// One place for every number the rest of the game shares, so a balance
// change never means hunting through a dozen files.
export const WORLD = {
  w: 3000,
  h: 2480,
  pitch: 280, // distance between neighbouring road centrelines
  road: 72, // road width
  avenues: 9, // north-south roads
  streets: 8, // east-west roads
  beachX: 2520, // sand starts here
  waterX: 2840, // sea starts here
};

export const PALETTE = {
  grass: '#8fae62',
  grassAlt: '#86a45c',
  sand: '#e6d29a',
  water: '#3f7fb8',
  waterDeep: '#2f6a9e',
  road: '#3c4048',
  roadLine: '#d8c95a',
  sidewalk: '#b9b3a4',
  plaza: '#cbb98d',
  park: '#6f9e4e',
  building: ['#e8dcc3', '#d9a06b', '#7fb3a8', '#c96f5a', '#a8b8c8', '#e0b45c'],
  roof: ['#b0553f', '#4e6e8e', '#7a5a3a', '#5e7d4f', '#8e6f9e'],
  pier: '#8a6a48',
  car: ['#d84a3a', '#3a7bd8', '#e8c33a', '#4aa86b', '#e8e8e8', '#7a4aa8', '#2b2b2b'],
  police: '#24344d',
  taxi: '#f2c230',
};

export const TUNE = {
  walkSpeed: 195,
  walkAccel: 1400,
  carAccel: 260,
  carReverse: 160,
  carMax: 430,
  carTurn: 2.6,
  carGrip: 3.2,
  handbrakeGrip: 0.6,
  trafficSpeed: 135,
  pedSpeed: 42,
  pedFleeSpeed: 95,
  policeAccel: 300,
  policeMax: 470,
  bulletSpeed: 720,
  pistolAmmo: 12,
  reloadTime: 1.1,
  punchRange: 34,
  punchDamage: 25,
  bulletDamage: 34,
  enemyHealth: 50,
  playerHealth: 100,
  heatDecayDelay: 20,
  heatDecayStep: 10,
  bustedTime: 1.2, // seconds a cruiser must sit on a player on foot
  bustedFine: 120,
  packageReward: 50,
  taxiFareMin: 40,
  taxiFareMax: 85,
  clockStart: 8 * 60, // 08:00 in minutes
  clockRate: 0.5, // game minutes per real second
};

export const LANDMARKS = [
  { name: "Mara's Garage", x: 420, y: 1680, kind: 'garage' },
  { name: 'Plaza del Sol', x: 1260, y: 980, kind: 'plaza' },
  { name: 'The Meridian', x: 1820, y: 420, kind: 'hotel' },
  { name: 'Solmar Pier', x: 2660, y: 980, kind: 'pier' },
  { name: 'Dockside Yards', x: 1260, y: 2240, kind: 'docks' },
];

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Borrowed Wheels',
    reward: 150,
    briefing: [
      'MARA: Rio. You came back. Good.',
      'MARA: My crew needs wheels. Borrow a car and bring it to the Plaza.',
    ],
  },
  {
    id: 'pickup',
    title: 'The Pickup',
    reward: 250,
    briefing: [
      'MARA: A guest is waiting at The Meridian.',
      'MARA: Pick them up and take them to the Dockside Yards. No questions.',
    ],
  },
  {
    id: 'clock',
    title: 'Beat the Clock',
    reward: 400,
    briefing: [
      'MARA: Ninety seconds. Five checkpoints. The whole city.',
      'MARA: Drive like the tide is coming in, Rio.',
    ],
  },
  {
    id: 'standoff',
    title: 'Dockside Standoff',
    reward: 600,
    briefing: [
      'MARA: They took the yard. Four of them, armed.',
      'MARA: Take it back, then come home to the garage.',
    ],
  },
];

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  enterCar: 'KeyE',
  handbrake: 'Space',
  punch: 'KeyF',
  reload: 'KeyR',
  pause: 'KeyP',
  music: 'KeyM',
  nextMission: 'KeyN',
};
