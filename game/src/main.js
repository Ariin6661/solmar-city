// Solmar City — the game loop and the state machine.
// Wires every system together: input, world, cars, traffic, police,
// combat, missions, HUD, rendering and saving. No network, no files
// beyond this folder.
import { WORLD, TUNE, KEYS } from './config.js';
import { Rng } from './rng.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { makeCar, drivePlayer, collideCars } from './vehicles.js';
import { spawnTraffic, stepTraffic, spawnPeds, stepPeds } from './traffic.js';
import { makePlayer, stepOnFoot, nearestCar, enterCar, exitCar, collectPackages } from './player.js';
import { fireBullet, stepBullets, stepEnemies, punchHit } from './combat.js';
import { addWanted, stepWanted, stepPolice } from './police.js';
import { makeMissionState, startMission, stepMissions } from './missions.js';
import { drawHud } from './hud.js';
import { drawGame, drawTitleScreen, drawPauseScreen, drawGameOverScreen, drawPassedScreen } from './render.js';
import { parseShot, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Any runtime error is recorded here and in the page title, so a
// headless run can prove the game played clean.
window.__gameErrors = [];
window.addEventListener('error', (e) => {
  const msg = String(e.message || e.error);
  window.__gameErrors.push(msg);
  document.title = 'ERR: ' + msg;
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

const shot = parseShot();
const world = buildWorld(shot.seed);
const rng = new Rng(String(Math.floor(Math.random() * 1000000000)));
const input = new Input(canvas);
const audio = new SoundEngine();
const save = loadSave();

const garage = world.landmarks[0];
const G = {
  world,
  rng,
  input,
  audio,
  save,
  saveDirty: false,
  state: 'title',
  time: 0,
  clock: TUNE.clockStart,
  view: { w: window.innerWidth, h: window.innerHeight, zoom: 1 },
  camera: { x: garage.marker.x, y: garage.marker.y, shake: 0 },
  player: makePlayer(garage.marker.x, garage.marker.y + 40),
  cars: [],
  peds: [],
  enemies: [],
  bullets: [],
  particles: [],
  skids: [],
  wanted: 0,
  lastCrimeAt: -999,
  heatTimer: 0,
  bustedT: 0,
  lastShotCrime: -999,
  mission: makeMissionState(),
  taxi: { offer: null, rider: null, dest: null, fare: 0 },
  dialogue: { lines: [], i: 0, active: false },
  toastText: '',
  toastT: 0,
  stats: { kills: save.kills || 0, fares: save.fares || 0 },
  passedTitle: '',
  passedReward: 0,
  shot: null,
};
G.player.money = save.money || 0;
G.mission.done = [...(save.missionsDone || [])];
for (const key of save.packagesFound || []) {
  const [x, y] = key.split(',').map(Number);
  const pack = world.packages.find((p) => Math.round(p.x) === x && Math.round(p.y) === y);
  if (pack) pack.found = true;
}

G.toast = (text) => {
  G.toastText = text;
  G.toastT = 3.5;
};
G.addWanted = (stars, reason) => addWanted(G, stars, reason);

// Parked cars and street life.
for (let i = 0; i < 6; i++) {
  const spot = world.randomRoadPoint(rng);
  const car = makeCar({ x: spot.x, y: spot.y, angle: spot.angle, kind: 'civil', parked: true });
  G.cars.push(car);
}
G.cars.push(...spawnTraffic(world, rng, 8));
G.peds = spawnPeds(world, rng, 16);

if (shot.shot) stageShot(G, shot.shot);

window.addEventListener('resize', () => {
  resize();
  G.view.w = canvas.width;
  G.view.h = canvas.height;
});
window.addEventListener('keydown', () => audio.unlock());
canvas.addEventListener('mousedown', () => audio.unlock());
resize();

function respawn() {
  const p = G.player;
  p.health = TUNE.playerHealth;
  p.dead = false;
  p.inCar = null;
  p.x = garage.marker.x;
  p.y = garage.marker.y + 40;
  p.ammo = TUNE.pistolAmmo;
  G.wanted = 0;
  G.bustedT = 0;
  audio.startSiren(false);
  for (const c of G.cars) if (c.kind === 'police') c.wrecked = true;
  G.state = 'playing';
}

function shoot() {
  const p = G.player;
  if (p.inCar || p.reloading || p.shootT > 0 || p.ammo <= 0) return;
  p.shootT = 0.22;
  p.ammo--;
  fireBullet(G, p.x + Math.cos(p.aim) * 16, p.y + Math.sin(p.aim) * 16, p.aim, 'player');
  audio.gunshot();
  G.camera.shake = Math.max(G.camera.shake, 3);
  if (G.time - G.lastShotCrime > 8 && G.mission.index !== 3) {
    G.lastShotCrime = G.time;
    G.addWanted(1, 'gunfire');
  }
  if (p.ammo === 0) {
    p.reloading = true;
    p.reloadT = TUNE.reloadTime;
  }
}

function update(dt) {
  const p = G.player;
  if (input.pressed(KEYS.music)) {
    const on = audio.toggleMusic();
    G.toast(on ? 'Music on' : 'Music off');
  }
  if (G.dialogue.active) {
    // consumePressed so the same E does not also enter a car below.
    if (input.consumePressed(KEYS.enterCar) || input.consumeClick()) {
      G.dialogue.i++;
      if (G.dialogue.i >= G.dialogue.lines.length) G.dialogue.active = false;
    }
  }
  if (input.pressed(KEYS.pause)) {
    G.state = G.state === 'paused' ? 'playing' : 'paused';
    return;
  }
  if (G.state !== 'playing') return;
  G.time += dt;
  G.clock += dt * TUNE.clockRate;
  G.toastT = Math.max(0, G.toastT - dt);
  G.camera.shake = Math.max(0, G.camera.shake - dt * 26);
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);

  if (input.pressed(KEYS.nextMission)) {
    const next = G.mission.done.length;
    if (G.mission.index < 0 && next < 4) {
      startMission(G, next);
    } else if (G.mission.index >= 0) {
      G.toast('Finish the current mission first.');
    } else {
      G.toast('All four missions are done — Solmar is yours, Rio.');
    }
  }

  if (p.inCar) {
    const car = p.inCar;
    let ix = 0;
    let iy = 0;
    if (input.downAny(KEYS.up)) iy -= 1;
    if (input.downAny(KEYS.down)) iy += 1;
    if (input.downAny(KEYS.left)) ix -= 1;
    if (input.downAny(KEYS.right)) ix += 1;
    const len = Math.hypot(ix, iy) || 1;
    const impact = drivePlayer(car, ix / len, iy / len, input.down(KEYS.handbrake), dt, world, G.skids);
    if (impact > 120) {
      audio.crash();
      G.camera.shake = Math.max(G.camera.shake, 7);
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    audio.setEngine(Math.abs(car.speed) / TUNE.carMax, true);
    if (input.pressed(KEYS.enterCar)) exitCar(G);
    // Running over a pedestrian is a crime.
    for (const ped of G.peds) {
      if (ped.down > 0 || ped.counted) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
        ped.down = 6;
        ped.counted = true;
        G.addWanted(1, 'hit a pedestrian');
        audio.punch();
        G.camera.shake = Math.max(G.camera.shake, 6);
      }
    }
  } else {
    stepOnFoot(G, dt);
    audio.setEngine(0, false);
    if (input.pressed(KEYS.enterCar)) {
      const car = nearestCar(G, 58);
      if (car) enterCar(G, car);
    }
    if (input.pressed(KEYS.punch)) punchHit(G);
    if (input.mouse.down) shoot();
    if (input.pressed(KEYS.reload) && p.ammo < TUNE.pistolAmmo && !p.reloading) {
      p.reloading = true;
      p.reloadT = TUNE.reloadTime;
    }
    collectPackages(G);
  }

  stepTraffic(G.cars.filter((c) => c.driver === 'traffic'), dt, world, rng);
  const threat = {
    x: p.inCar ? p.inCar.x : p.x,
    y: p.inCar ? p.inCar.y : p.y,
    active: (p.inCar && Math.abs(p.inCar.speed) > 150) || G.time - G.lastShotCrime < 2,
    radius: 220,
  };
  stepPeds(G.peds, dt, world, rng, threat);
  stepWanted(G, dt);
  stepPolice(G, dt);
  const hardest = collideCars(G.cars);
  if (hardest > 220) {
    audio.crash();
    G.camera.shake = Math.max(G.camera.shake, 6);
  }
  stepBullets(G, dt);
  stepEnemies(G, dt);
  stepMissions(G, dt);

  // Camera follows the player, clamped inside the city.
  const tx = p.inCar ? p.inCar.x : p.x;
  const ty = p.inCar ? p.inCar.y : p.y;
  const k = 1 - Math.pow(0.001, dt);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
  G.camera.x = Math.max(G.view.w / 2 - 80, Math.min(WORLD.w - G.view.w / 2 + 80, G.camera.x));
  G.camera.y = Math.max(G.view.h / 2 - 80, Math.min(WORLD.h - G.view.h / 2 + 80, G.camera.y));

  if (G.saveDirty) {
    G.save.money = p.money;
    writeSave(G.save);
    G.saveDirty = false;
  }
  input.endFrame();
}

function render(dt) {
  drawGame(ctx, G, dt);
  if (G.state === 'title') drawTitleScreen(ctx, G);
  else if (G.state === 'paused') drawPauseScreen(ctx, G);
  else if (G.state === 'over') drawGameOverScreen(ctx, G);
  else if (G.state === 'passed') drawPassedScreen(ctx, G);
  else drawHud(ctx, G);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'title') {
    if (input.pressed('Enter') || input.consumeClick()) {
      G.state = 'playing';
      audio.unlock();
      G.toast('Welcome to Solmar City — press N to start a mission');
    }
    G.time += dt;
    input.endFrame();
  } else if (G.state === 'over') {
    if (input.pressed('Enter') || input.consumeClick()) respawn();
    input.endFrame();
  } else if (G.state === 'passed') {
    if (input.pressed(KEYS.nextMission)) {
      const next = G.mission.done.length;
      if (next < 4) startMission(G, next);
      G.state = 'playing';
    } else if (input.pressed('Enter') || input.consumeClick()) {
      G.state = 'playing';
    }
    G.time += dt;
    input.endFrame();
  } else {
    update(dt);
  }
  render(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
