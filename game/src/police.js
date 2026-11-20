// The wanted level — heat that rises with crime and falls when the
// player lays low, and the police cars that answer it. Heat is a float
// from 0 to 5; the stars the HUD shows are its ceiling.

import { CONFIG, PALETTE } from './config.js';
import { createCar, moveCar } from './vehicles.js';
import { randomRoadPoint } from './world.js';
import { hurtPlayer } from './player.js';

export function wantedStars(G) {
  if (G.heat <= 0.05) return 0;
  return Math.min(CONFIG.maxWanted, Math.ceil(G.heat));
}

export function addHeat(G, amount, reason) {
  if (G.state !== 'playing') return;
  const before = wantedStars(G);
  G.heat = Math.min(CONFIG.maxWanted, G.heat + amount);
  G.lastCrimeAt = G.elapsed;
  const after = wantedStars(G);
  if (after > before) {
    G.audio.sfx('wantedUp');
    G.say(`Wanted level ${after} star${after > 1 ? 's' : ''} — ${reason}.`);
  }
  if (after > G.stats.bestWanted) G.stats.bestWanted = after;
}

function spawnCopCar(G) {
  // Appear on a road a little way off, never on top of the player.
  let point = randomRoadPoint(G.world, G.rng);
  let tries = 0;
  while (Math.hypot(point.x - G.player.x, point.y - G.player.y) < 600 && tries < 12) {
    point = randomRoadPoint(G.world, G.rng);
    tries++;
  }
  const angle = Math.atan2(G.player.y - point.y, G.player.x - point.x);
  const car = createCar(point.x, point.y, angle, {
    color: PALETTE.police,
    driver: 'cop',
    police: true,
    type: 'sedan',
  });
  car.speed = CONFIG.copSpeed;
  car.stuckTime = 0;
  G.cars.push(car);
  G.cops.push(car);
  return car;
}

export function updateWanted(G, dt) {
  const stars = wantedStars(G);
  // Heat falls slowly while police are near, faster while hidden.
  const anyCopNear = G.cops.some((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < CONFIG.sightRange);
  const recentCrime = G.elapsed - G.lastCrimeAt < 6;
  if (!recentCrime) {
    G.heat = Math.max(0, G.heat - (anyCopNear ? CONFIG.heatDecay : CONFIG.heatDecayHidden) * dt);
  }
  // Spawn police to match the heat (not in a staged screenshot scene).
  G.copSpawnTimer -= dt;
  const want = Math.min(CONFIG.maxCops, stars * 2);
  if (stars >= 1 && G.cops.length < want && G.copSpawnTimer <= 0 && !G.shotMode) {
    spawnCopCar(G);
    G.copSpawnTimer = CONFIG.copSpawnInterval;
  }
  // When the heat is gone, the cops leave.
  if (stars === 0) {
    for (const cop of G.cops) cop.leaving = true;
  }
}

// ---- Police driving ----

export function updatePolice(G, dt) {
  const player = G.player;
  for (const cop of G.cops) {
    if (cop.leaving) {
      // Drive away from the player and despawn at distance.
      const dx = cop.x - player.x;
      const dy = cop.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      steerCarToward(G, cop, cop.x + (dx / d) * 400, cop.y + (dy / d) * 400, dt, CONFIG.copSpeed * 0.8);
      if (d > 1200) {
        cop.dead = true;
      }
      continue;
    }

    // Chase the player — by car, or on foot.
    steerCarToward(G, cop, player.x, player.y, dt, CONFIG.copSpeed);

    // Ramming the player's car hurts the player.
    if (player.inCar) {
      const d = Math.hypot(cop.x - player.inCar.x, cop.y - player.inCar.y);
      const closing = Math.hypot(cop.vx - player.inCar.vx, cop.vy - player.inCar.vy);
      if (d < CONFIG.carRadius * 2 + 6 && closing > 180 && player.hurtCooldown <= 0) {
        hurtPlayer(G, CONFIG.copRamDamage);
        player.hurtCooldown = 0.8;
        G.shake = Math.min(14, G.shake + 7);
        G.audio.sfx('crash');
      }
    }

    // Stuck against a wall? Reverse out, then try again.
    const speed = Math.hypot(cop.vx, cop.vy);
    if (speed < 30) {
      cop.stuckTime += dt;
      if (cop.stuckTime > 2.5) {
        cop.x -= Math.cos(cop.angle) * 40;
        cop.y -= Math.sin(cop.angle) * 40;
        cop.angle += Math.PI * 0.6;
        cop.stuckTime = 0;
      }
    } else {
      cop.stuckTime = 0;
    }
  }
  G.cops = G.cops.filter((c) => !c.dead);
  G.cars = G.cars.filter((c) => !c.dead);
}

// Steer a car toward a point with a limited turn rate, at a target speed
// (a staged chase can cap the speed with car.chaseSpeed).
export function steerCarToward(G, car, tx, ty, dt, speed) {
  const topSpeed = car.chaseSpeed || speed;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turnRate = 3.0;
  car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
  const align = Math.cos(diff);
  const targetSpeed = align > 0.2 ? topSpeed : topSpeed * 0.4;
  car.vx = Math.cos(car.angle) * targetSpeed;
  car.vy = Math.sin(car.angle) * targetSpeed;
  moveCar(G, car, dt);
}
