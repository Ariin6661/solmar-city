// Traffic cars that follow the roads, and pedestrians on the sidewalks.
import { CFG, AVE_X, ST_Y, PED_COLORS } from './config.js';
import { resolveCircle, randomRoadPoint, onRoad } from './world.js';
import { makeCar, stepCarDrive, collideCars, carFront } from './vehicles.js';

export function makePed(G, x, y) {
  return {
    x, y,
    angle: G.rng.range(0, Math.PI * 2),
    speed: 0,
    tx: x, ty: y, // stroll target
    state: 'stroll', // stroll | flee
    fleeT: 0,
    down: false,
    downTimer: 0,
    color: G.rng.pick(PED_COLORS),
    walkPhase: G.rng.range(0, 6),
    retarget: 0,
  };
}

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(G.rng);
    // Step off the asphalt onto the sidewalk.
    const px = p.road === 'ave' ? p.x + (p.dir > 0 ? 34 : -34) : p.x;
    const py = p.road === 'ave' ? p.y : p.y + (p.dir > 0 ? -34 : 34);
    const ped = makePed(G, px, py);
    pickStrollTarget(G, ped);
    G.peds.push(ped);
  }
}

function pickStrollTarget(G, ped) {
  const p = randomRoadPoint(G.rng);
  ped.tx = p.road === 'ave' ? p.x + 40 : p.x;
  ped.ty = p.road === 'ave' ? p.y : p.y + 40;
  ped.retarget = G.rng.range(6, 14);
}

// A threat is the player's speeding car or a recent gunshot.
function threatNear(G, ped) {
  const P = G.player;
  if (P.car && Math.abs(P.car.speed) > 120) {
    const d = Math.hypot(ped.x - P.car.x, ped.y - P.car.y);
    if (d < 130) return { x: P.car.x, y: P.car.y };
  }
  if (G.lastShot && G.time - G.lastShot.t < 1.2) {
    const d = Math.hypot(ped.x - G.lastShot.x, ped.y - G.lastShot.y);
    if (d < 220) return { x: G.lastShot.x, y: G.lastShot.y };
  }
  return null;
}

export function stepPeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.state = 'flee';
        ped.fleeT = 2.5;
      }
      continue;
    }
    const threat = threatNear(G, ped);
    if (threat && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeT = G.rng.range(1.5, 2.5);
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      // Keep running the same way once the threat is out of sight.
      const away = threat ? Math.atan2(ped.y - threat.y, ped.x - threat.x) : ped.angle;
      ped.angle = away;
      const nx = ped.x + Math.cos(away) * 250 * dt;
      const ny = ped.y + Math.sin(away) * 250 * dt;
      const res = resolveCircle(G.world, nx, ny, 12);
      ped.x = res.x;
      ped.y = res.y;
      ped.walkPhase += dt * 14;
      if (ped.fleeT <= 0) {
        ped.state = 'stroll';
        pickStrollTarget(G, ped);
      }
      continue;
    }
    // Stroll: walk to the target, pick a new one on arrival or timeout.
    ped.retarget -= dt;
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 24 || ped.retarget <= 0) {
      pickStrollTarget(G, ped);
      continue;
    }
    const sp = 52 + Math.sin(ped.walkPhase) * 6;
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + (dx / d) * sp * dt;
    const ny = ped.y + (dy / d) * sp * dt;
    const res = resolveCircle(G.world, nx, ny, 12);
    ped.x = res.x;
    ped.y = res.y;
    ped.walkPhase += dt * 7;
  }
  // Keep the streets busy: top the crowd back up near the player.
  if (G.peds.length < 16 && G.time - (G.lastPedSpawn || 0) > 3) {
    G.lastPedSpawn = G.time;
    const p = randomRoadPoint(G.rng);
    const ped = makePed(G, p.x + 40, p.y + 40);
    pickStrollTarget(G, ped);
    G.peds.push(ped);
  }
}

// --- Traffic cars ---

export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(G.rng);
    const car = makeCar(G, p.x, p.y, p.road === 'ave' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI), null, 'traffic');
    car.road = p.road;
    car.idx = p.idx;
    car.dir = p.dir;
    car.cruise = G.rng.range(140, 195);
    car.targetSpeed = car.cruise;
    car.turnCd = 1;
    G.cars.push(car);
  }
}

// Keep an angle difference in [-PI, PI].
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function stepTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    if (car.turnCd > 0) car.turnCd -= dt;
    // Lane centre for this road and direction.
    let aheadX;
    let aheadY;
    if (car.road === 'ave') {
      const laneX = AVE_X(car.idx) + (car.dir > 0 ? -17 : 17);
      aheadX = laneX;
      aheadY = car.y + car.dir * 90;
    } else {
      aheadX = car.x + car.dir * 90;
      aheadY = ST_Y(car.idx) + (car.dir > 0 ? 17 : -17);
    }
    // Car-following: ease off for the car ahead in the same lane.
    let targetSpeed = car.cruise;
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = car.road === 'ave' ? dy * car.dir : dx * car.dir;
      const across = car.road === 'ave' ? Math.abs(dx) : Math.abs(dy);
      if (along > 0 && along < 95 && across < 34) {
        targetSpeed = along < 46 ? 0 : Math.min(targetSpeed, Math.max(0, other.speed));
      }
    }
    car.targetSpeed = targetSpeed;
    // Steer toward a point ahead on the lane.
    const desired = Math.atan2(aheadY - car.y, aheadX - car.x);
    const steer = Math.max(-1, Math.min(1, angleDiff(desired, car.angle) * 2.4));
    const throttle = car.speed < targetSpeed ? 1 : 0;
    stepCarDrive(G, car, dt, throttle, steer, false);
    collideCars(G, car, dt);
    // At an intersection, sometimes turn onto the crossing road.
    const onCross = car.road === 'ave'
      ? [...Array(CFG.STS)].findIndex((_, j) => Math.abs(car.y - ST_Y(j)) < 26)
      : [...Array(CFG.AVES)].findIndex((_, i) => Math.abs(car.x - AVE_X(i)) < 26);
    if (onCross >= 0 && car.turnCd <= 0 && G.rng.chance(0.3)) {
      car.turnCd = 2.5;
      if (car.road === 'ave') {
        car.road = 'st';
        car.idx = onCross;
        car.dir = G.rng.chance(0.5) ? 1 : -1;
        car.y = ST_Y(onCross) + (car.dir > 0 ? 17 : -17);
      } else {
        car.road = 'ave';
        car.idx = onCross;
        car.dir = G.rng.chance(0.5) ? 1 : -1;
        car.x = AVE_X(onCross) + (car.dir > 0 ? -17 : 17);
      }
    }
    // End of the road: turn around instead of driving into the sea.
    if (car.road === 'ave' && (car.y < 110 || car.y > CFG.BEACH_Y - 90)) car.dir *= -1;
    if (car.road === 'st' && (car.x < 110 || car.x > CFG.WORLD_W - 110)) car.dir *= -1;
  }
}
