// Cars: creation, parking, player driving physics and collisions.
import { CFG, AVE_X, ST_Y, CAR_COLORS } from './config.js';
import { resolveCircle } from './world.js';
import { sfx } from './audio.js';

let nextCarId = 1;

export function makeCar(G, x, y, angle, color, kind) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    steer: 0,
    len: 48,
    wid: 24,
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    kind: kind || 'parked', // parked | traffic | player | police
    driver: null,
    crashed: 0, // cooldown before the next crash sound
  };
}

export function carFront(car) {
  return {
    x: car.x + Math.cos(car.angle) * (car.len / 2),
    y: car.y + Math.sin(car.angle) * (car.len / 2),
  };
}

export function carRear(car) {
  return {
    x: car.x - Math.cos(car.angle) * (car.len / 2),
    y: car.y - Math.sin(car.angle) * (car.len / 2),
  };
}

// Parked cars along road edges, clear of intersections and landmarks.
export function spawnParkedCars(G, count) {
  const rng = G.rng;
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 400) {
    const vertical = rng.chance(0.5);
    const idx = vertical ? rng.int(0, CFG.AVES - 1) : rng.int(0, CFG.STS - 1);
    const along = rng.range(120, vertical ? CFG.WORLD_H - 420 : CFG.WORLD_W - 120);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = vertical ? AVE_X(idx) + side * 26 : along;
    const y = vertical ? along : ST_Y(idx) + side * 26;
    if (y > CFG.BEACH_Y - 60) continue; // keep the beach clear
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    // Keep clear of intersections.
    const nearCross = vertical
      ? [...Array(CFG.STS)].some((_, j) => Math.abs(y - ST_Y(j)) < 90)
      : [...Array(CFG.AVES)].some((_, i) => Math.abs(x - AVE_X(i)) < 90);
    if (nearCross) continue;
    if (G.cars.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) continue;
    G.cars.push(makeCar(G, x, y, angle, null, 'parked'));
    placed++;
  }
}

// Nearest car to a point within radius r (any kind, or one kind).
export function nearestCar(G, x, y, r, kind) {
  let best = null;
  let bestD = r;
  for (const c of G.cars) {
    if (kind && c.kind !== kind) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// One driving step for a car driven by the player (input axes) or by
// an autopilot (traffic/police pass their own throttle/steer).
// throttle: -1..1, steer: -1..1, handbrake: bool.
export function stepCarDrive(G, car, dt, throttle, steer, handbrake) {
  const prevSpeed = car.speed;
  // Steering: sharper at low speed, reversed when reversing.
  const speedFactor = Math.min(1, Math.abs(car.speed) / 140);
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CFG.CAR_TURN * speedFactor * dirSign * dt * (handbrake ? 1.5 : 1);
  // Throttle and drag.
  if (throttle > 0) car.speed += CFG.CAR_ACCEL * throttle * dt;
  else if (throttle < 0) car.speed += CFG.CAR_ACCEL * throttle * 0.55 * dt;
  else car.speed -= car.speed * (handbrake ? 2.6 : 0.9) * dt;
  if (handbrake) car.speed -= car.speed * 2.2 * dt;
  // Rolling drag.
  car.speed -= car.speed * 0.25 * dt;
  if (car.speed > CFG.CAR_MAX) car.speed = CFG.CAR_MAX;
  if (car.speed < -CFG.CAR_REV) car.speed = -CFG.CAR_REV;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  // Move.
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Buildings and map edge.
  const res = resolveCircle(G.world, car.x, car.y, 22);
  if (res.hit) {
    const impact = Math.abs(car.speed);
    car.x = res.x;
    car.y = res.y;
    car.speed *= 0.45;
    if (impact > 200 && car.crashed <= 0) {
      car.crashed = 0.6;
      sfx(G.audio, 'crash');
      G.cam.shake = Math.min(10, impact / 60);
      if (car.kind === 'player') damagePlayerCar(G, impact);
    }
  }
  if (car.crashed > 0) car.crashed -= dt;
  // Skid marks while handbraking at speed.
  if (handbrake && Math.abs(car.speed) > 120) {
    const rear = carRear(car);
    G.skids.push({ x: rear.x, y: rear.y, angle: car.angle, life: 5 });
    if (G.skids.length > 220) G.skids.splice(0, G.skids.length - 220);
  }
  return prevSpeed;
}

// Hard impacts hurt the driver.
export function damagePlayerCar(G, impact) {
  const dmg = Math.round((impact - 180) / 40);
  if (dmg > 0) damagePlayer(G, dmg, 'crash');
}

export function damagePlayer(G, dmg, src) {
  if (G.mode !== 'playing' || G.player.invuln > 0) return;
  G.player.hp -= dmg;
  G.player.invuln = 0.25;
  G.cam.shake = Math.max(G.cam.shake, 6);
  if (G.player.hp <= 0) {
    G.player.hp = 0;
    gameOver(G, src);
  }
}

export function gameOver(G, src) {
  G.mode = 'gameover';
  G.deathCause = src || 'unknown';
  if (G.player.car) {
    G.player.car.kind = 'parked';
    G.player.car.speed = 0;
    G.player.car = null;
  }
  G.wanted = 0;
  G.cops.length = 0;
}

// Car-vs-car bumps: push apart, trade speed, thud on hard hits.
export function collideCars(G, car, dt) {
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = 36;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      car.x -= nx * push;
      car.y -= ny * push;
      other.x += nx * push;
      other.y += ny * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 140 && car.crashed <= 0) {
        car.crashed = 0.5;
        sfx(G.audio, 'crash');
        G.cam.shake = Math.min(9, rel / 50);
        if (car.kind === 'player') damagePlayerCar(G, rel);
      }
      // Trade a little speed so shunts feel physical.
      const avg = (car.speed + other.speed) / 2;
      car.speed += (avg - car.speed) * 0.4;
      if (other.kind !== 'player') other.speed += (avg - other.speed) * 0.4;
    }
  }
}

// All cars the player could drive, nearest first.
export function drivableCars(G, x, y) {
  return G.cars
    .filter((c) => c.kind === 'parked' || c.kind === 'traffic')
    .map((c) => ({ car: c, d: Math.hypot(c.x - x, c.y - y) }))
    .sort((a, b) => a.d - b.d)
    .map((e) => e.car);
}
