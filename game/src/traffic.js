// Solmar City — traffic cars and pedestrians.
//
// The city feels alive because of these two populations. Traffic cars
// cruise the road grid, stopping politely (well, mostly) at each
// intersection before turning. Pedestrians stroll the sidewalks and, when
// a car or a gunshot threatens them, run for the nearest quiet block.
// Both are cheap: a few dozen entities, updated with plain steering.

import { CFG, PAL } from './config.js';
import { makeCar, driveCar, separateCars } from './vehicles.js';
import { nearestRoadPoint, randomRoadPoint, hitsBuilding } from './world.js';
import { range, int, pick, chance } from './rng.js';

export function spawnTrafficCar(rng, world) {
  const p = randomRoadPoint(rng, world);
  const onAvenue = Math.abs(p.x - Math.round(p.x)) < 1;
  const angle = chance(rng, 0.5) ? 0 : Math.PI;
  const car = makeCar(p.x, p.y, angle, pick(rng, PAL.carColors), 'civilian');
  car.speed = range(rng, CFG.trafficSpeed * 0.6, CFG.trafficSpeed);
  car.target = pickNextTarget(rng, world, car);
  return car;
}

function pickNextTarget(rng, world, car) {
  // Pick the next intersection along the road the car is on.
  const near = nearestRoadPoint(world, car.x, car.y);
  const vertical = Math.abs(car.x - near.x) < 2;
  if (vertical) {
    const dir = car.angle > -Math.PI / 2 && car.angle < Math.PI / 2 ? 1 : -1;
    const streets = world.streets.filter((sy) => (dir > 0 ? sy > car.y + 30 : sy < car.y - 30));
    const sy = streets.length ? streets[0] : world.streets[world.streets.length - 1];
    return { x: car.x, y: sy };
  }
  const dir = car.angle > 0 && car.angle < Math.PI ? 1 : -1;
  const avenues = world.avenues.filter((ax) => (dir > 0 ? ax > car.x + 30 : ax < car.x - 30));
  const ax = avenues.length ? avenues[0] : world.avenues[world.avenues.length - 1];
  return { x: ax, y: car.y };
}

export function updateTrafficCar(car, dt, world, rng) {
  // Parked cars stay put (they still draw and can be stolen).
  if (car.parked) return [];
  // A car with no target yet picks one first.
  if (!car.target) car.target = pickNextTarget(rng, world, car);
  // Steer toward the current target intersection.
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    car.target = pickNextTarget(rng, world, car);
    // Sometimes turn at the intersection.
    if (chance(rng, 0.45)) {
      const vertical = Math.abs(car.x - car.target.x) < 2;
      car.angle = vertical ? (dy > 0 ? Math.PI / 2 : -Math.PI / 2) : (dx > 0 ? 0 : Math.PI);
    }
  }
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const marks = driveCar(car, { throttle: 0.55, steer, brake: false, handbrake: false }, dt, world);
  car.speed = Math.min(car.speed, CFG.trafficSpeed);
  return marks;
}

export function makePedestrian(rng, world) {
  const p = randomRoadPoint(rng, world);
  return {
    x: p.x + range(rng, -50, 50),
    y: p.y + range(rng, -50, 50),
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 28, 52),
    color: pick(rng, PAL.pedColors),
    fleeing: 0,
    walkPhase: range(rng, 0, Math.PI * 2),
  };
}

export function updatePedestrian(ped, dt, world, threats, rng) {
  // Threats: the player's car, gunfire, or a nearby cruiser.
  let fleeX = 0;
  let fleeY = 0;
  for (const t of threats) {
    const dx = ped.x - t.x;
    const dy = ped.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d < 170 && d > 1) {
      fleeX += (dx / d) * (1 - d / 170);
      fleeY += (dy / d) * (1 - d / 170);
    }
  }
  const fleeing = Math.hypot(fleeX, fleeY) > 0.15;
  if (fleeing) ped.fleeing = 0.9;
  else ped.fleeing = Math.max(0, ped.fleeing - dt);

  let tx;
  let ty;
  let speed = ped.speed;
  if (ped.fleeing > 0) {
    tx = ped.x + fleeX * 100;
    ty = ped.y + fleeY * 100;
    speed = ped.speed * 3.1;
  } else {
    // Wander along the sidewalk: keep the current heading, turn rarely.
    if (chance(rng, dt * 0.12)) ped.angle += range(rng, -1.4, 1.4);
    tx = ped.x + Math.cos(ped.angle) * 60;
    ty = ped.y + Math.sin(ped.angle) * 60;
  }
  const want = Math.atan2(ty - ped.y, tx - ped.x);
  let diff = want - ped.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ped.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.walkPhase += dt * (fleeing ? 14 : 7);

  // Stay out of buildings and inside the world.
  const hit = hitsBuilding(world, ped.x, ped.y, 10);
  if (hit) {
    ped.x -= Math.cos(ped.angle) * speed * dt * 2;
    ped.y -= Math.sin(ped.angle) * speed * dt * 2;
    ped.angle += Math.PI / 2;
  }
  ped.x = Math.max(20, Math.min(CFG.worldW - 20, ped.x));
  ped.y = Math.max(20, Math.min(CFG.worldH - 20, ped.y));
}
