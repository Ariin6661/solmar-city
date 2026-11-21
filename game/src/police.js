// Solmar City — wanted level and police.
//
// Heat is a number from 0 to 5. Crimes raise it; laying low lets it cool
// after a delay. Each star puts one cruiser on the road, and cruisers
// chase Rio's car and ram it — or, on foot, close in until they can bust
// him. The module owns the cruisers and the busted check; the main loop
// owns the consequences (fine, respawn).

import { CFG, PAL } from './config.js';
import { makeCar, driveCar } from './vehicles.js';
import { nearestRoadPoint, randomRoadPoint } from './world.js';
import { range, pick } from './rng.js';

export function makePoliceState() {
  return {
    wanted: 0,
    heatTimer: 0,
    cruisers: [],
    spawnCooldown: 0,
    busted: false,
  };
}

export function addHeat(police, amount) {
  police.wanted = Math.min(CFG.maxWanted, police.wanted + amount);
  police.heatTimer = CFG.heatDecayDelay;
}

function spawnCruiser(rng, world, player) {
  // Appear on a road a little way from the player, already rolling.
  let p;
  for (let tries = 0; tries < 12; tries++) {
    p = randomRoadPoint(rng, world);
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d > 320 && d < 900) break;
  }
  // Face the player (with a little error) so the cruiser does not spawn
  // nose-first into a building and waste its first seconds turning.
  const face = Math.atan2(player.y - p.y, player.x - p.x) + range(rng, -0.4, 0.4);
  const car = makeCar(p.x, p.y, face, PAL.cruiser, 'cruiser');
  car.speed = CFG.cruiserSpeed * 0.5;
  return car;
}

export function updatePolice(police, dt, world, player, rng, audio) {
  // Cool down when no crime has happened lately.
  if (police.heatTimer > 0) {
    police.heatTimer -= dt;
  } else if (police.wanted > 0) {
    police.wanted = Math.max(0, police.wanted - dt * 0.22);
  }

  // Keep one cruiser per wanted star (rounded up).
  const wantCruisers = Math.ceil(police.wanted);
  police.spawnCooldown -= dt;
  while (police.cruisers.length < wantCruisers && police.spawnCooldown <= 0) {
    police.cruisers.push(spawnCruiser(rng, world, player));
    police.spawnCooldown = 1.4;
  }
  while (police.cruisers.length > wantCruisers) {
    police.cruisers.pop();
  }

  // Chase: steer at the player, ram on contact.
  const target = player.inCar || player;
  for (const cruiser of police.cruisers) {
    const dx = target.x - cruiser.x;
    const dy = target.y - cruiser.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - cruiser.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    const throttle = dist > 60 ? 1 : 0.4;
    driveCar(cruiser, { throttle, steer, brake: false, handbrake: false }, dt, world);
    // Ram: shove the player's car and slow the cruiser a touch.
    if (player.inCar && dist < 52) {
      player.inCar.speed *= 0.86;
      cruiser.speed *= 0.92;
      if (Math.random() < dt * 2) addHeat(police, 0);
    }
    // Busted: on foot, a cruiser right on top of a slow Rio.
    if (!player.inCar && dist < CFG.bustedRadius) {
      police.busted = true;
    }
  }

  if (audio) audio.siren(police.wanted >= 1);
  return police.busted;
}

export function clearBusted(police, player, world) {
  police.busted = false;
  police.wanted = 0;
  police.cruisers = [];
  const garage = world.landmarks.find((l) => l.kind === 'garage');
  player.x = garage ? garage.x : 370;
  player.y = garage ? garage.y + 40 : 370;
  player.inCar = null;
  player.hp = CFG.playerHp;
}
