// Deterministic screenshot mode: ?shot=start|play|mission|chase&seed=N
// sets up a fixed scene so the screenshots are reproducible.
import { CFG, AVE_X, ST_Y, LANDMARKS } from './config.js';
import { makeRng, hashSeed } from './rng.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { spawnCop, addWanted } from './police.js';

export function parseShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  const seedRaw = q.get('seed');
  const seed = seedRaw ? (Number(seedRaw) || hashSeed(seedRaw)) : 20261120;
  return { kind: shot, seed };
}

// Set up the scene for one screenshot kind. Called after the world,
// player, traffic and parked cars exist.
export function applyShot(G, kind, seed) {
  G.shot = { kind, seed };
  G.rng = makeRng(seed);
  const P = G.player;
  if (kind === 'start') {
    G.mode = 'start';
    G.clockHours = 16.5;
    return;
  }
  G.mode = 'playing';
  if (kind === 'play') {
    // Rio on foot at the Plaza del Sol crossing, rush hour around him.
    P.x = AVE_X(4) + 30;
    P.y = ST_Y(3) + 30;
    P.angle = Math.PI / 4;
    P.onFoot = true;
    P.car = null;
    G.clockHours = 16.0;
    G.objective = 'Explore Solmar — steal a car, run a fare, find packages';
    G.dialogue = { name: 'Mara', text: 'Welcome back to Solmar, Rio. The city missed you.', t: 99 };
  } else if (kind === 'mission') {
    // Mission 1 in progress: Rio in a car, Mara's Garage marked.
    const car = makeCar(G, 690, 1300, -Math.PI / 2, '#c0392b', 'player');
    car.driver = 'player';
    G.cars.push(car);
    P.car = car;
    P.onFoot = false;
    P.x = car.x;
    P.y = car.y;
    P.angle = car.angle;
    startMission(G, 0);
    G.mission.stage = 1;
    G.mission.target = { x: LANDMARKS[0].frontX, y: LANDMARKS[0].frontY, label: "Mara's Garage" };
    G.objective = "Drive the car to Mara's Garage";
    G.clockHours = 17.4;
  } else if (kind === 'chase') {
    // Dusk chase: Rio speeding down 3rd Street, three cruisers on him.
    const car = makeCar(G, 1200, ST_Y(3) + 17, 0, '#e67e22', 'player');
    car.driver = 'player';
    car.speed = 380;
    G.cars.push(car);
    P.car = car;
    P.onFoot = false;
    P.x = car.x;
    P.y = car.y;
    P.angle = 0;
    G.wanted = 3;
    G.lastCrimeT = G.time;
    for (let i = 0; i < 3; i++) {
      const cop = spawnCop(G);
      cop.x = 1200 - 180 - i * 130;
      cop.y = ST_Y(3) + (i % 2 === 0 ? -17 : 17);
      cop.angle = 0;
      cop.speed = 340;
    }
    G.objective = 'Lose the police — lay low until the heat dies down';
    G.clockHours = 18.6;
  }
  // Camera snaps in shot mode (see render.js updateCamera).
  G.cam.x = P.x;
  G.cam.y = P.y;
}

// The four screenshot scenes, with what each one shows.
export const SHOT_KINDS = {
  start: 'Title screen over the city',
  play: 'Rio on foot at the Plaza del Sol crossing, rush hour',
  mission: 'Mission 1: drive the borrowed car to Mara\'s Garage',
  chase: 'Dusk police chase down 3rd Street, wanted level 3',
};

export function isShotMode(G) {
  return !!G.shot;
}
