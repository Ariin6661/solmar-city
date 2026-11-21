// Solmar City — Rio Vega on foot.
// Walking, aiming, punching, shooting, stealing cars and picking up
// packages. Driving itself lives in vehicles.js.
import { TUNE, KEYS } from './config.js';

export function makePlayer(x, y) {
  return {
    x,
    y,
    angle: 0,
    aim: 0,
    vx: 0,
    vy: 0,
    health: TUNE.playerHealth,
    ammo: TUNE.pistolAmmo,
    reloading: false,
    reloadT: 0,
    punchT: 0,
    shootT: 0,
    inCar: null,
    dead: false,
  };
}

export function stepOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  let ix = 0;
  let iy = 0;
  if (input.downAny(KEYS.up)) iy -= 1;
  if (input.downAny(KEYS.down)) iy += 1;
  if (input.downAny(KEYS.left)) ix -= 1;
  if (input.downAny(KEYS.right)) ix += 1;
  const len = Math.hypot(ix, iy) || 1;
  ix /= len;
  iy /= len;
  p.vx += ix * TUNE.walkAccel * dt;
  p.vy += iy * TUNE.walkAccel * dt;
  const sp = Math.hypot(p.vx, p.vy);
  const max = TUNE.walkSpeed;
  if (sp > max) {
    p.vx = (p.vx / sp) * max;
    p.vy = (p.vy / sp) * max;
  }
  if (ix === 0 && iy === 0) {
    p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), 900 * dt);
    p.vy -= Math.sign(p.vy) * Math.min(Math.abs(p.vy), 900 * dt);
  }
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  if (!G.world.blockedAt(nx, p.y, 12)) p.x = nx;
  else p.vx = 0;
  if (!G.world.blockedAt(p.x, ny, 12)) p.y = ny;
  else p.vy = 0;
  if (sp > 20) p.angle = Math.atan2(p.vy, p.vx);
  if (sp > 170 && Math.random() < dt * 6) {
    G.particles.push({ x: p.x, y: p.y + 8, kind: 'puff', life: 0.3, max: 0.3 });
  }
  // Aim follows the mouse: screen point -> world point via the camera.
  const wx = G.camera.x + (input.mouse.x - G.view.w / 2) / G.view.zoom;
  const wy = G.camera.y + (input.mouse.y - G.view.h / 2) / G.view.zoom;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  p.punchT = Math.max(0, p.punchT - dt);
  p.shootT = Math.max(0, p.shootT - dt);
  if (p.reloading) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      p.reloading = false;
      p.ammo = TUNE.pistolAmmo;
    }
  }
}

export function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  const stolen = car.driver !== 'player' && !car.owned;
  p.inCar = car;
  car.driver = 'player';
  car.parked = false;
  p.x = car.x;
  p.y = car.y;
  if (stolen) {
    car.owned = true;
    G.addWanted(1, 'stole a car');
    G.toast(`You took the ${car.name}. The city noticed.`);
  } else {
    G.toast(`Back in the ${car.name}.`);
  }
}

export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  let px = car.x + Math.cos(side) * 30;
  let py = car.y + Math.sin(side) * 30;
  if (G.world.blockedAt(px, py, 12)) {
    px = car.x - Math.cos(side) * 30;
    py = car.y - Math.sin(side) * 30;
  }
  p.x = px;
  p.y = py;
  p.inCar = null;
}

export function collectPackages(G) {
  const p = G.player;
  for (const pack of G.world.packages) {
    if (pack.found) continue;
    const d = Math.hypot(pack.x - p.x, pack.y - p.y);
    if (d < 30) {
      pack.found = true;
      G.save.packagesFound.push(`${Math.round(pack.x)},${Math.round(pack.y)}`);
      G.player.money += TUNE.packageReward;
      G.audio.pickup();
      G.toast(`Hidden package found! +$${TUNE.packageReward}`);
      G.saveDirty = true;
    }
  }
}
