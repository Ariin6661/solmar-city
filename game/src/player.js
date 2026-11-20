// Rio Vega — the player. On foot he walks and runs, aims with the mouse,
// and steps into any car with E. In a car he IS the car: his position
// follows it and his health takes the bumps.

import { CONFIG } from './config.js';
import { collideCircle, clampToWorld, isWater } from './world.js';
import { nearestCar, enterCar, exitCar } from './vehicles.js';

export function createPlayer(x, y, saveData) {
  return {
    x, y,
    angle: -Math.PI / 2, // facing up (north)
    health: CONFIG.playerHealth,
    money: saveData ? saveData.money : 250,
    ammo: CONFIG.pistolAmmo,
    reloading: 0,
    inCar: null,
    punchCooldown: 0,
    hurtCooldown: 0,
    walkPhase: 0, // drives the walk-cycle bob in the renderer
    moving: false,
  };
}

export function updatePlayerOnFoot(G, dt) {
  const player = G.player;
  const input = G.input;
  const run = input.keys.ShiftLeft || input.keys.ShiftRight;
  const speed = run ? CONFIG.runSpeed : CONFIG.walkSpeed;

  let mx = 0;
  let my = 0;
  if (input.keys.KeyW || input.keys.ArrowUp) my -= 1;
  if (input.keys.KeyS || input.keys.ArrowDown) my += 1;
  if (input.keys.KeyA || input.keys.ArrowLeft) mx -= 1;
  if (input.keys.KeyD || input.keys.ArrowRight) mx += 1;

  player.moving = mx !== 0 || my !== 0;
  if (player.moving) {
    const len = Math.hypot(mx, my);
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.walkPhase += dt * (run ? 11 : 8);
  }

  // Aim at the mouse.
  player.angle = Math.atan2(G.input.aimY - player.y, G.input.aimX - player.x);

  // The sea is a wall; the beach is fine.
  if (isWater(G.world, player.x, player.y)) {
    player.y = CONFIG.waterTop - CONFIG.playerRadius - 1;
  }
  clampToWorld(G.world, player, CONFIG.playerRadius);
  const pos = { x: player.x, y: player.y };
  collideCircle(G.world, pos, CONFIG.playerRadius);
  player.x = pos.x;
  player.y = pos.y;

  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.hurtCooldown > 0) player.hurtCooldown -= dt;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) player.ammo = CONFIG.pistolAmmo;
  }
}

// ---- Getting in / out of cars, and getting hurt ----

export function tryEnterExitCar(G) {
  const player = G.player;
  if (player.inCar) {
    exitCar(G);
    return;
  }
  const car = nearestCar(G, player.x, player.y, 52);
  if (car) enterCar(G, car);
}

// Traffic that runs the player over hurts; the player is knocked clear.
export function checkPlayerCarHits(G) {
  const player = G.player;
  if (player.inCar || player.hurtCooldown > 0) return;
  for (const car of G.cars) {
    if (car.dead || car.driver === 'player') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < CONFIG.carRadius + CONFIG.playerRadius) {
      const speed = Math.hypot(car.vx, car.vy);
      if (speed > 60) {
        const dmg = Math.min(30, 6 + speed * 0.03);
        hurtPlayer(G, dmg);
        // Knock the player sideways out of the road.
        const dx = player.x - car.x;
        const dy = player.y - car.y;
        const len = Math.hypot(dx, dy) || 1;
        player.x += (dx / len) * 46;
        player.y += (dy / len) * 46;
        G.audio.sfx('crash');
        G.shake = Math.min(12, G.shake + 5);
      }
    }
  }
}

export function hurtPlayer(G, amount) {
  const player = G.player;
  if (player.hurtCooldown > 0 || G.state !== 'playing') return;
  player.health = Math.max(0, player.health - amount);
  player.hurtCooldown = 0.6;
  G.shake = Math.min(12, G.shake + 4);
  if (player.health <= 0) {
    G.state = 'dead';
    G.audio.sfx('missionFail');
    G.audio.engine(0, false);
    G.audio.siren(false);
  }
}

export function healPlayer(G, amount) {
  G.player.health = Math.min(CONFIG.playerHealth, G.player.health + amount);
}
