// Rio Vega, the player: on foot and behind the wheel.
import { CFG } from './config.js';
import { resolveCircle } from './world.js';
import { nearestCar, stepCarDrive, collideCars, damagePlayer } from './vehicles.js';
import { moveAxis, keyPressed, keyDown } from './input.js';
import { sfx } from './audio.js';
import { punch } from './combat.js';
import { addWanted } from './police.js';

export function makePlayer(G) {
  return {
    x: 690,
    y: 1150, // outside Mara's Garage, on the street
    angle: -Math.PI / 2,
    hp: 100,
    onFoot: true,
    car: null,
    aimAngle: 0,
    gun: { ammo: CFG.PISTOL_MAG, reloading: 0, cd: 0 },
    punchCd: 0,
    invuln: 0,
    walkPhase: 0,
  };
}

export function stepPlayer(G, dt) {
  const P = G.player;
  const input = G.input;
  if (P.invuln > 0) P.invuln -= dt;
  if (P.gun.cd > 0) P.gun.cd -= dt;
  if (P.punchCd > 0) P.punchCd -= dt;
  if (P.gun.reloading > 0) {
    P.gun.reloading -= dt;
    if (P.gun.reloading <= 0) {
      P.gun.ammo = CFG.PISTOL_MAG;
      sfx(G.audio, 'reload');
    }
  }

  if (P.car) {
    stepPlayerCar(G, dt);
    return;
  }

  // On foot: WASD moves, mouse aims when the pistol is out.
  const axis = moveAxis(input);
  const len = Math.hypot(axis.x, axis.y);
  if (len > 0) {
    const nx = axis.x / len;
    const ny = axis.y / len;
    const nx2 = P.x + nx * CFG.WALK_SPEED * dt;
    const ny2 = P.y + ny * CFG.WALK_SPEED * dt;
    const res = resolveCircle(G.world, nx2, ny2, 14);
    P.x = res.x;
    P.y = res.y;
    P.walkPhase += dt * 9;
    P.angle = Math.atan2(ny, nx);
  }
  // Aim follows the mouse.
  const mw = G.mouseWorld;
  P.aimAngle = Math.atan2(mw.y - P.y, mw.x - P.x);

  // E: get into the nearest car.
  if (keyPressed(input, 'KeyE')) {
    const car = nearestCar(G, P.x, P.y, 62);
    if (car) enterCar(G, car);
  }
  // F: punch. Mouse click: shoot (handled in combat.js via tryShoot).
  if (keyPressed(input, 'KeyF') && P.punchCd <= 0) {
    P.punchCd = 0.45;
    punch(G);
  }
  // R: reload the pistol.
  if (keyPressed(input, 'KeyR') && P.gun.reloading <= 0 && P.gun.ammo < CFG.PISTOL_MAG) {
    P.gun.reloading = CFG.RELOAD_TIME;
  }
}

function stepPlayerCar(G, dt) {
  const P = G.player;
  const car = P.car;
  const input = G.input;
  const axis = moveAxis(input);
  // W/S (or Up/Down) is throttle, A/D is steering.
  const throttle = -axis.y;
  const steer = axis.x;
  const handbrake = keyDown(input, 'Space');
  stepCarDrive(G, car, dt, throttle, steer, handbrake);
  // Car vs car bumps.
  collideCars(G, car, dt);
  // Hitting pedestrians while driving is a crime (and hurts them).
  for (const ped of G.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 26 && Math.abs(car.speed) > 60) {
      ped.down = true;
      ped.downTimer = 4;
      addWanted(G, 1);
      sfx(G.audio, 'crash');
      G.cam.shake = 7;
    }
  }
  // Sync the player to the car.
  P.x = car.x;
  P.y = car.y;
  P.angle = car.angle;
  P.aimAngle = car.angle;
  // E: get out (leave the car parked where it stops).
  if (keyPressed(input, 'KeyE')) {
    exitCar(G);
  }
}

export function enterCar(G, car) {
  const P = G.player;
  const stolen = car.kind === 'parked' || car.kind === 'traffic';
  if (stolen) addWanted(G, 1);
  car.kind = 'player';
  car.driver = 'player';
  P.car = car;
  P.onFoot = false;
  G.stats.carsStolen++;
}

export function exitCar(G) {
  const P = G.player;
  const car = P.car;
  if (!car) return;
  car.kind = 'parked';
  car.driver = null;
  car.speed = 0;
  // Step out to the car's left side.
  const side = car.angle - Math.PI / 2;
  const ox = car.x + Math.cos(side) * 34;
  const oy = car.y + Math.sin(side) * 34;
  const res = resolveCircle(G.world, ox, oy, 14);
  P.x = res.x;
  P.y = res.y;
  P.car = null;
  P.onFoot = true;
}

// Back on your feet at Plaza del Sol after a game over, poorer but alive.
export function respawnPlayer(G) {
  const P = G.player;
  G.money = Math.max(0, G.money - 100);
  P.hp = 100;
  P.x = 1700;
  P.y = 1360;
  P.angle = -Math.PI / 2;
  P.car = null;
  P.onFoot = true;
  P.gun.ammo = CFG.PISTOL_MAG;
  P.gun.reloading = 0;
  G.cam.x = P.x;
  G.cam.y = P.y;
  G.mode = 'playing';
}

export function healPlayer(G, amount) {
  const P = G.player;
  P.hp = Math.min(100, P.hp + amount);
}
