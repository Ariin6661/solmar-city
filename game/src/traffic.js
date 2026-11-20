// Traffic cars and pedestrians — the life of the streets.
// Traffic follows the road grid intersection to intersection, keeps its
// lane, and stops for the car ahead. Pedestrians stroll the sidewalks
// and run when things get loud or fast.

import { CONFIG, PALETTE } from './config.js';
import { createCar, moveCar } from './vehicles.js';
import { randomIntersection, collideCircle, clampToWorld } from './world.js';

function randomRoute(world, rng, start) {
  const route = [start];
  let cur = start;
  for (let i = 0; i < 6; i++) {
    const next = { x: cur.x, y: cur.y };
    const vertical = rng.chance(0.5);
    if (vertical) {
      const options = world.avenues.filter((a) => a !== cur.x);
      next.x = rng.pick(options);
    } else {
      const options = world.streets.filter((s) => s !== cur.y);
      next.y = rng.pick(options);
    }
    route.push(next);
    cur = next;
  }
  return route;
}

export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i++) {
    const start = randomIntersection(G.world, G.rng);
    const car = createCar(start.x, start.y, 0, {
      color: G.rng.pick(PALETTE.carColors),
      driver: 'traffic',
      type: G.rng.pick(['sedan', 'sedan', 'hatch', 'coupe', 'van']),
    });
    car.route = randomRoute(G.world, G.rng, start);
    car.routeIndex = 1;
    car.speed = CONFIG.trafficSpeed * G.rng.range(0.85, 1.15);
    G.cars.push(car);
  }
}

// Steer a traffic car toward its next waypoint, right-hand lane.
export function updateTrafficCar(G, car, dt) {
  if (car.routeIndex >= car.route.length) {
    car.route = randomRoute(G.world, G.rng, { x: car.x, y: car.y });
    car.routeIndex = 1;
  }
  const wp = car.route[car.routeIndex];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const dist = Math.hypot(dx, dy);

  // Lane offset: right-hand side of the direction of travel.
  const ux = dx / (dist || 1);
  const uy = dy / (dist || 1);
  const laneX = wp.x + -uy * 24;
  const laneY = wp.y + ux * 24;
  const tx = laneX - car.x;
  const ty = laneY - car.y;
  const targetAngle = Math.atan2(ty, tx);

  // Turn toward the target angle, limited turn rate.
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turnRate = 2.2;
  car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));

  // Stop for the car ahead.
  car.stopped = false;
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 26) {
      car.stopped = true;
      break;
    }
  }

  if (!car.stopped) {
    car.vx = Math.cos(car.angle) * car.speed;
    car.vy = Math.sin(car.angle) * car.speed;
  } else {
    car.vx *= Math.exp(-6 * dt);
    car.vy *= Math.exp(-6 * dt);
  }

  moveCar(G, car, dt);

  if (dist < 36) car.routeIndex++;
}

// ---- Pedestrians ----

export function spawnPedestrians(G, count) {
  for (let i = 0; i < count; i++) {
    const p = randomIntersection(G.world, G.rng);
    G.peds.push({
      x: p.x + G.rng.range(-70, 70),
      y: p.y + G.rng.range(-70, 70),
      angle: G.rng.range(0, Math.PI * 2),
      speed: CONFIG.pedSpeed * G.rng.range(0.8, 1.3),
      color: G.rng.pick(PALETTE.pedShirts),
      state: 'walk',
      target: null,
      wait: G.rng.range(0, 2),
      downTime: 0,
      fleeTime: 0,
    });
  }
}

function pickWalkTarget(G, ped) {
  const p = randomIntersection(G.world, G.rng);
  ped.target = {
    x: p.x + G.rng.range(-80, 80),
    y: p.y + G.rng.range(-80, 80),
  };
}

export function updatePedestrian(G, ped, dt) {
  if (ped.state === 'down') {
    ped.downTime -= dt;
    if (ped.downTime <= 0) {
      ped.state = 'flee';
      ped.fleeTime = 3;
    }
    return;
  }

  if (ped.state === 'flee') {
    ped.fleeTime -= dt;
    if (ped.fleeTime <= 0) ped.state = 'walk';
    // Run away from the nearest threat (player or loud bang).
    const tx = G.player.x;
    const ty = G.player.y;
    const dx = ped.x - tx;
    const dy = ped.y - ty;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * 2.2 * dt;
    ped.y += (dy / d) * ped.speed * 2.2 * dt;
    const pos = { x: ped.x, y: ped.y };
    collideCircle(G.world, pos, 10);
    ped.x = pos.x;
    ped.y = pos.y;
    clampToWorld(G.world, ped, 12);
    return;
  }

  // Strolling: walk to a target, pause, pick a new one.
  if (ped.wait > 0) {
    ped.wait -= dt;
    if (ped.wait <= 0) pickWalkTarget(G, ped);
    return;
  }
  if (!ped.target) pickWalkTarget(G, ped);
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    ped.wait = G.rng.range(1, 5);
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / d) * ped.speed * dt;
  ped.y += (dy / d) * ped.speed * dt;
  const pos = { x: ped.x, y: ped.y };
  collideCircle(G.world, pos, 10);
  ped.x = pos.x;
  ped.y = pos.y;
  clampToWorld(G.world, ped, 12);
}

// A car hitting a pedestrian: knock them down, and if it was the player's
// car at speed, the city notices.
export function checkPedCarHits(G) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    for (const car of G.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d < CONFIG.carRadius + 8) {
        const speed = Math.hypot(car.vx, car.vy);
        ped.state = 'down';
        ped.downTime = 4;
        if (car.driver === 'player') {
          if (speed > 120) {
            G.addHeat(CONFIG.heatPerPedHit, 'hit a pedestrian');
            G.audio.sfx('crash');
            G.shake = Math.min(12, G.shake + 5);
          } else {
            ped.fleeTime = 0;
            G.audio.sfx('punch');
          }
        } else if (car.driver === 'traffic' || car.driver === 'cop') {
          // Traffic knocks peds over too, but nobody blames the player.
          ped.downTime = 2;
        }
        break;
      }
    }
  }
}

// Every pedestrian in earshot runs when a shot is fired.
export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.fleeTime = 4;
    }
  }
}
