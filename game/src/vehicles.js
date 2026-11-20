// Cars — creation, arcade driving physics, stealing and exiting.
// Traffic cars and police cars share the body; their brains live in
// traffic.js and police.js. Only the player-driven car uses this physics.

import { CONFIG, PALETTE } from './config.js';
import { collideCircle, clampToWorld, isWater } from './world.js';

let carId = 0;

export function createCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    id: ++carId,
    x, y,
    angle,
    vx: 0,
    vy: 0,
    color: o.color || PALETTE.carColors[0],
    type: o.type || 'sedan',
    police: !!o.police,
    taxi: !!o.taxi,
    // driver: 'parked' | 'traffic' | 'player' | 'cop' | null
    driver: o.driver || 'parked',
    // traffic brain (set by traffic.js)
    route: null,
    routeIndex: 0,
    speed: 0,
    stopped: false,
    // police brain (set by police.js)
    target: null,
    stuckTime: 0,
    skidding: false,
    health: 100,
    dead: false,
  };
}

// Forward speed along the car's heading (negative = reversing).
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

export function carCorners(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hl = CONFIG.carLength / 2;
  const hw = CONFIG.carWidth / 2;
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
  ];
}

// One physics step for the car the player drives.
export function updatePlayerCar(G, car, dt) {
  const input = G.input;
  const up = input.keys.KeyW || input.keys.ArrowUp;
  const down = input.keys.KeyS || input.keys.ArrowDown;
  const left = input.keys.KeyA || input.keys.ArrowLeft;
  const right = input.keys.KeyD || input.keys.ArrowRight;
  const handbrake = input.keys.Space;

  const fwd = forwardSpeed(car);
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);

  if (up) {
    car.vx += fx * CONFIG.carAccel * dt;
    car.vy += fy * CONFIG.carAccel * dt;
  }
  if (down) {
    if (fwd > 20) {
      // Braking while moving forward.
      car.vx -= fx * CONFIG.carBrake * dt;
      car.vy -= fy * CONFIG.carBrake * dt;
    } else {
      car.vx -= fx * CONFIG.carReverseAccel * dt;
      car.vy -= fy * CONFIG.carReverseAccel * dt;
    }
  }
  if (!up && !down) {
    // Engine drag and rolling resistance.
    const drag = Math.exp(-0.6 * dt);
    car.vx *= drag;
    car.vy *= drag;
  }

  // Steering: only bites while moving, and reverses when reversing.
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(fwd) / 140);
  if (steer !== 0 && Math.abs(fwd) > 5) {
    car.angle += steer * CONFIG.carTurn * speedFactor * Math.sign(fwd) * dt;
  }

  // Grip: kill sideways velocity so the car follows its nose; the
  // handbrake loosens the grip and lets the tail slide.
  const grip = handbrake ? 1.1 : CONFIG.carGrip;
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  const fwdNow = car.vx * nx + car.vy * ny;
  const latNow = -car.vx * ny + car.vy * nx;
  const latAfter = latNow * Math.exp(-grip * dt);
  car.vx = nx * fwdNow - ny * latAfter;
  car.vy = ny * fwdNow + nx * latAfter;
  car.skidding = (handbrake && Math.abs(fwdNow) > 120) || Math.abs(latNow) > 130;

  // Cap the speed.
  const sp = Math.hypot(car.vx, car.vy);
  const maxSp = fwd >= 0 ? CONFIG.carMaxSpeed : CONFIG.carMaxReverse;
  if (sp > maxSp) {
    car.vx *= maxSp / sp;
    car.vy *= maxSp / sp;
  }

  moveCar(G, car, dt);
}

// Shared movement + collision step (player, traffic and police all end here).
export function moveCar(G, car, dt) {
  const world = G.world;
  const oldX = car.x;
  const oldY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // The sea stops cars; the beach is driveable.
  if (isWater(world, car.x, car.y)) {
    car.x = oldX;
    car.y = oldY;
    car.vx *= -0.3;
    car.vy *= -0.3;
  }
  clampToWorld(world, car, CONFIG.carRadius);

  // Buildings: slide along them, lose speed on impact.
  const pos = { x: car.x, y: car.y };
  if (collideCircle(world, pos, CONFIG.carRadius)) {
    const hitHard = Math.hypot(car.vx, car.vy) > 220;
    car.x = pos.x;
    car.y = pos.y;
    car.vx *= 0.35;
    car.vy *= 0.35;
    if (hitHard && car.driver === 'player') {
      G.audio.sfx('crash');
      G.shake = Math.min(14, G.shake + 6);
      G.player.health = Math.max(0, G.player.health - 4);
    }
  }

  // Car vs car: push apart, trade a little speed.
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const d = Math.hypot(dx, dy);
    const min = CONFIG.carRadius * 2 - 4;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      car.x += ux * push;
      car.y += uy * push;
      other.x -= ux * push;
      other.y -= uy * push;
      // A crash slows both cars down; it never launches either of them.
      car.vx *= 0.55;
      car.vy *= 0.55;
      other.vx *= 0.55;
      other.vy *= 0.55;
      if (car.driver === 'player' && Math.hypot(car.vx, car.vy) > 200) {
        G.audio.sfx('crash');
      }
    }
  }
}

// ---- Getting in and out ----

export function nearestCar(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.dead || car.driver === 'player') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const player = G.player;
  const wasOccupied = car.driver === 'traffic';
  if (wasOccupied) {
    // Yank the driver out onto the sidewalk.
    spawnPedFromCar(G, car);
    G.stats.carsStolen++;
    G.addHeat(CONFIG.heatPerSteal, 'stole a car');
  }
  if (car.driver === 'cop') return false; // police cars cannot be stolen
  car.driver = 'player';
  car.vx = 0;
  car.vy = 0;
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  G.audio.sfx('click');
  return true;
}

export function exitCar(G) {
  const player = G.player;
  const car = player.inCar;
  if (!car) return;
  car.driver = 'parked';
  car.vx = 0;
  car.vy = 0;
  // Step out to the side of the car.
  const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
  if (!pointInBuildingSafe(G, side.x, side.y)) {
    player.x = side.x;
    player.y = side.y;
  } else {
    player.x = car.x + Math.sin(car.angle) * 34;
    player.y = car.y - Math.cos(car.angle) * 34;
  }
  player.inCar = null;
  G.audio.engine(0, false);
}

function pointInBuildingSafe(G, x, y) {
  return G.world.buildings.some((b) => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4);
}

function spawnPedFromCar(G, car) {
  const ped = {
    x: car.x - Math.sin(car.angle) * 30,
    y: car.y + Math.cos(car.angle) * 30,
    angle: car.angle + Math.PI / 2,
    speed: 0,
    color: G.rng.pick(PALETTE.pedShirts),
    flee: 0,
    state: 'walk',
    target: null,
    wait: 0,
  };
  ped.flee = 3;
  G.peds.push(ped);
}

// Parked cars along the avenues and streets, for the player to find.
export function spawnParkedCars(G, count) {
  for (let i = 0; i < count; i++) {
    const onAvenue = G.rng.chance(0.5);
    const p = onAvenue
      ? { x: G.rng.pick(G.world.avenues) + (G.rng.chance(0.5) ? 62 : -62), y: G.rng.range(140, CONFIG.beachTop - 140) }
      : { x: G.rng.range(140, G.world.size - 140), y: G.rng.pick(G.world.streets) + (G.rng.chance(0.5) ? 62 : -62) };
    const angle = onAvenue
      ? (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (G.rng.chance(0.5) ? 0 : Math.PI);
    const car = createCar(p.x, p.y, angle, {
      color: G.rng.pick(PALETTE.carColors),
      driver: 'parked',
      type: G.rng.pick(['sedan', 'sedan', 'hatch', 'coupe', 'van']),
    });
    G.cars.push(car);
  }
  // One taxi waits by the plaza for side fares.
  const plaza = G.world.landmarks.plaza;
  const taxi = createCar(plaza.x + 70, plaza.y + 30, 0, { color: '#f7c948', driver: 'parked', taxi: true, type: 'sedan' });
  G.cars.push(taxi);
}
