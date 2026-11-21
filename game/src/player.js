// Solmar City — Rio on foot.
//
// Rio walks, runs, steals cars and gets out of them. On foot he is a
// circle with a facing angle (toward the mouse when aiming, toward
// movement otherwise); in a car the car module owns the motion. Getting
// into a car is a small state machine: near a door, press E, and the
// player object hands control to the car — and back out again on E.

import { CFG } from './config.js';
import { hitsBuilding, clampToWorld } from './world.js';
import { nearCarDoor } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    hp: CFG.playerHp,
    inCar: null,
    walkPhase: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    reloading: 0,
    ammo: CFG.pistolMag,
    money: 0,
    hurtFlash: 0,
  };
}

// Move on foot. Returns nothing; mutates the player.
export function updateOnFoot(player, input, dt, world) {
  let mx = 0;
  let my = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) my -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) my += 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? CFG.runSpeed : CFG.walkSpeed;
    const nx = player.x + mx * speed * dt;
    const ny = player.y + my * speed * dt;
    // Slide along buildings: try x and y separately.
    if (!hitsBuilding(world, nx, player.y, CFG.playerRadius)) player.x = nx;
    if (!hitsBuilding(world, player.x, ny, CFG.playerRadius)) player.y = ny;
    player.angle = Math.atan2(my, mx);
    player.walkPhase += dt * (sprint ? 13 : 9);
  }
  const clamped = clampToWorld(player.x, player.y, 16);
  player.x = clamped.x;
  player.y = clamped.y;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) player.ammo = CFG.pistolMag;
  }
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

// Try to step into a nearby car. Returns the car or null.
export function tryEnterCar(player, cars) {
  let best = null;
  let bestD = Infinity;
  for (const car of cars) {
    if (car.kind === 'cruiser') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (best && bestD < 62) {
    player.inCar = best;
    // A stolen parked car is no longer parked — it is the player's now.
    best.parked = false;
    player.x = best.x;
    player.y = best.y;
    return best;
  }
  return null;
}

// Step out of the car beside its driver door.
export function exitCar(player) {
  const car = player.inCar;
  if (!car) return;
  const side = { x: Math.cos(car.angle + Math.PI / 2), y: Math.sin(car.angle + Math.PI / 2) };
  player.x = car.x + side.x * 34;
  player.y = car.y + side.y * 34;
  player.angle = car.angle;
  player.inCar = null;
}

// Aim the pistol at the mouse (screen space -> world space via camera).
export function aimAngle(player, mouse, camera) {
  const wx = mouse.x + camera.x;
  const wy = mouse.y + camera.y;
  return Math.atan2(wy - player.y, wx - player.x);
}

export function hurtPlayer(player, dmg) {
  player.hp -= dmg;
  player.hurtFlash = 0.5;
  if (player.hp < 0) player.hp = 0;
}

export function healPlayer(player, amount) {
  player.hp = Math.min(CFG.playerHp, player.hp + amount);
}
