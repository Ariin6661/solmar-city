// Solmar City — traffic cars and pedestrians.
// Traffic follows the road grid and turns at intersections; pedestrians
// stroll the sidewalks and run when the player threatens them.
import { WORLD, TUNE, PALETTE } from './config.js';
import { makeCar } from './vehicles.js';

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = world.randomRoadPoint(rng);
    const car = makeCar({
      x: p.x,
      y: p.y,
      angle: p.angle,
      color: rng.pick(PALETTE.car),
      name: rng.pick(['Sedan', 'Hatch', 'Coupe', 'Van']),
      kind: 'civil',
      driver: 'traffic',
    });
    car.speed = TUNE.trafficSpeed * rng.range(0.8, 1.15);
    car.route = { vertical: Math.abs(Math.sin(p.angle)) > 0.5, dir: p.angle };
    cars.push(car);
  }
  return cars;
}

export function stepTraffic(cars, dt, world, rng) {
  for (const car of cars) {
    if (car.wrecked) continue;
    // At an intersection, sometimes turn onto the crossing road.
    const nearV = Math.min(Math.abs(car.x % WORLD.pitch), WORLD.pitch - Math.abs(car.x % WORLD.pitch));
    const nearH = Math.min(Math.abs(car.y % WORLD.pitch), WORLD.pitch - Math.abs(car.y % WORLD.pitch));
    if (nearV < 26 && nearH < 26 && rng.chance(dt * 0.25)) {
      const vertical = rng.chance(0.5);
      const dir = rng.chance(0.5) ? 1 : -1;
      car.angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    }
    // Keep inside the road network: bounce off the edges.
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (nx < 20 || nx > (WORLD.avenues - 1) * WORLD.pitch + 20 || ny < 20 || ny > (WORLD.streets - 1) * WORLD.pitch + 20) {
      car.angle += Math.PI;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    } else if (!world.blockedAt(nx, ny, 14)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.angle += Math.PI / 2;
    }
  }
}

export function spawnPeds(world, rng, count) {
  const peds = [];
  const shirts = ['#d84a3a', '#3a7bd8', '#e8c33a', '#4aa86b', '#e8e8e8', '#7a4aa8', '#e07a3a'];
  for (let i = 0; i < count; i++) {
    const p = world.sidewalkPoint(rng);
    peds.push({
      x: p.x,
      y: p.y,
      angle: rng.range(0, Math.PI * 2),
      speed: TUNE.pedSpeed * rng.range(0.8, 1.3),
      color: rng.pick(shirts),
      state: 'walk',
      tx: p.x,
      ty: p.y,
      wait: rng.range(0, 4),
      down: 0,
      taxi: false,
    });
  }
  return peds;
}

export function stepPeds(peds, dt, world, rng, threat) {
  for (const ped of peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    const dx = ped.x - threat.x;
    const dy = ped.y - threat.y;
    const dist = Math.hypot(dx, dy);
    const scared = threat.active && dist < threat.radius;
    if (scared) {
      ped.state = 'flee';
      ped.angle = Math.atan2(dy, dx);
      ped.speed = TUNE.pedFleeSpeed;
    } else if (ped.state === 'flee' && dist > threat.radius * 1.6) {
      ped.state = 'walk';
      ped.speed = TUNE.pedSpeed;
    }
    if (ped.state === 'walk') {
      const tdx = ped.tx - ped.x;
      const tdy = ped.ty - ped.y;
      if (Math.hypot(tdx, tdy) < 12) {
        if (ped.wait > 0) {
          ped.wait -= dt;
          continue;
        }
        const p = world.sidewalkPoint(rng);
        ped.tx = p.x;
        ped.ty = p.y;
        ped.wait = rng.range(0, 5);
      } else {
        ped.angle = Math.atan2(tdy, tdx);
      }
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!world.blockedAt(nx, ped.y, 8)) ped.x = nx;
    if (!world.blockedAt(ped.x, ny, 8)) ped.y = ny;
  }
}
