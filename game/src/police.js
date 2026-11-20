// Wanted level (0-5 stars) and the police cars that answer it.
import { CFG, AVE_X, ST_Y } from './config.js';
import { nearestRoadPoint } from './world.js';
import { makeCar, stepCarDrive, collideCars, damagePlayer } from './vehicles.js';
import { sfx } from './audio.js';

export function addWanted(G, n) {
  const before = G.wanted;
  G.wanted = Math.min(5, G.wanted + n);
  G.lastCrimeT = G.time;
  G.wantedDecayT = 0;
  if (G.wanted > before) sfx(G.audio, 'wantedUp');
}

export function spawnCop(G) {
  const P = G.player;
  // Spawn on a road a little way from the player, out of sight if possible.
  const spot = nearestRoadPoint(G.rng, P.x + G.rng.range(-500, 500), P.y + G.rng.range(-500, 500));
  const cop = makeCar(G, spot.x, spot.y, G.rng.range(0, Math.PI * 2), '#22395e', 'police');
  cop.driver = 'police';
  cop.ramCd = 0;
  cop.sirenPhase = G.rng.range(0, 1);
  G.cars.push(cop);
  G.cops.push(cop);
  return cop;
}

// Remove every cruiser (used on respawn and on mission reset).
export function clearCops(G) {
  for (const cop of G.cops) {
    const ci = G.cars.indexOf(cop);
    if (ci >= 0) G.cars.splice(ci, 1);
  }
  G.cops.length = 0;
}

// Stars as a string for the HUD: filled and empty.
export function wantedStars(G) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < G.wanted ? '★' : '☆';
  return s;
}

export function stepPolice(G, dt) {
  const P = G.player;
  // Reinforcements: up to two cruisers per star, eight at most.
  const want = Math.min(G.wanted * 2, 8);
  if (G.cops.length < want && G.time - (G.lastCopSpawn || 0) > 1.2) {
    G.lastCopSpawn = G.time;
    spawnCop(G);
  }
  // No wanted level: the cruisers drift off and despawn.
  if (G.wanted === 0) {
    for (const cop of G.cops.slice()) {
      const d = Math.hypot(cop.x - P.x, cop.y - P.y);
      if (d > 800) {
        G.cops.splice(G.cops.indexOf(cop), 1);
        const ci = G.cars.indexOf(cop);
        if (ci >= 0) G.cars.splice(ci, 1);
      }
    }
  }
  for (const cop of G.cops) {
    if (cop.ramCd > 0) cop.ramCd -= dt;
    const dx = P.x - cop.x;
    const dy = P.y - cop.y;
    const dist = Math.hypot(dx, dy);
    const desired = Math.atan2(dy, dx);
    let diff = desired - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    // Cops drive flat out; they ease off only when right on top of you.
    const throttle = dist > 60 ? 1 : 0.4;
    stepCarDrive(G, cop, dt, throttle, steer, false);
    collideCars(G, cop, dt);
    // Ram: a close cop bumps you and hurts.
    if (dist < 52 && cop.ramCd <= 0) {
      cop.ramCd = 0.9;
      cop.speed *= 0.4;
      G.cam.shake = Math.max(G.cam.shake, 8);
      sfx(G.audio, 'crash');
      if (P.car) {
        damagePlayer(G, 5, 'rammed');
      } else {
        damagePlayer(G, 9, 'rammed');
      }
    }
  }
  // Wanted decays when you lay low: no crime lately, no cop close.
  if (G.wanted > 0) {
    const copNear = G.cops.some((c) => Math.hypot(c.x - P.x, c.y - P.y) < 340);
    if (G.time - G.lastCrimeT > 8 && !copNear) {
      G.wantedDecayT += dt;
      if (G.wantedDecayT >= CFG.WANTED_DECAY_S) {
        G.wantedDecayT = 0;
        G.wanted = Math.max(0, G.wanted - 1);
      }
    } else {
      G.wantedDecayT = 0;
    }
  }
}
