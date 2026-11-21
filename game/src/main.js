// Solmar City — the game loop and the glue.
//
// main.js owns the game state object G and the frame: read input, update
// the world, draw it, and carry the state machine (title -> playing ->
// paused -> game over). Every module plugs in here: the world builds the
// city, the traffic fills it, the police chase through it, the missions
// give it purpose, and the HUD explains it. Nothing in here draws a
// building or fires a bullet — it only decides when those things happen.

import { CFG } from './config.js';
import { mulberry32, int, pick } from './rng.js';
import { buildWorld, randomRoadPoint } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { makeCar, driveCar, separateCars } from './vehicles.js';
import { spawnTrafficCar, updateTrafficCar, makePedestrian, updatePedestrian } from './traffic.js';
import { makePlayer, updateOnFoot, tryEnterCar, exitCar, aimAngle, hurtPlayer } from './player.js';
import { shootPistol, startReload, punch, updateBullets, enemyShoot } from './combat.js';
import { makePoliceState, addHeat, updatePolice, clearBusted } from './police.js';
import {
  makeMissionState, startMission, updateMissions, placePackages, checkPackages,
} from './missions.js';
import { drawHud } from './hud.js';
import { createCamera, updateCamera, drawGame } from './render.js';
import { readShotParams, applyShot, installErrorHook } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function newGame(seed) {
  const rng = mulberry32(seed);
  const world = buildWorld(seed);
  const save = loadSave();
  const garage = world.landmarks.find((l) => l.kind === 'garage');
  const player = makePlayer(garage.x, garage.y + 40);
  player.money = save.money;
  const g = {
    seed,
    rng,
    world,
    save,
    player,
    input: createInput(canvas),
    audio: createAudio(),
    camera: createCamera(),
    police: makePoliceState(),
    missions: makeMissionState(),
    cars: [],
    peds: [],
    enemies: [],
    bullets: [],
    particles: [],
    state: 'title',
    time: 0,
    timeOfDay: CFG.dayLength * 0.15,
    shotMode: null,
    missionKills: 0,
    shake: 0,
  };
  // Traffic and pedestrians fill the city.
  for (let i = 0; i < 14; i++) g.cars.push(spawnTrafficCar(rng, world));
  for (let i = 0; i < 18; i++) g.peds.push(makePedestrian(rng, world));
  // A few parked cars to steal.
  for (let i = 0; i < 5; i++) {
    const p = randomRoadPoint(rng, world);
    const parked = makeCar(p.x, p.y, (Math.PI / 2) * int(rng, 0, 3), pick(rng, ['#c94f43', '#3f6fb5', '#e0a83c', '#4fae6b']), 'civilian');
    parked.parked = true;
    g.cars.push(parked);
  }
  g.missions.packages = placePackages(rng, world, CFG.packageCount);
  return g;
}

const g = newGame(20261121);
installErrorHook();
// Exposed for the screenshot harness (and curious players): the live state.
window.__game = g;

// Screenshot staging: skip the title screen and place the scene.
const shot = readShotParams();
if (shot) applyShot(g, shot);

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  g.time += dt;
  update(dt);
  draw();
  g.input.endFrame();
  requestAnimationFrame(frame);
}

function update(dt) {
  const input = g.input;
  const player = g.player;

  // First gesture wakes the audio.
  if ((input.anyKey || input.mouse.down) && !g.audio.ctx) {
    g.audio.ensure();
    g.audio.startMusic();
  }

  if (g.state === 'title') {
    if (input.anyKey || input.mouse.clicked) {
      g.state = 'playing';
      g.audio.ensure();
      g.audio.startMusic();
    }
    return;
  }

  if (g.state === 'gameover') {
    if (input.anyKey || input.mouse.clicked) {
      const fresh = newGame(g.seed + 1);
      Object.assign(g, fresh);
      g.state = 'playing';
    }
    return;
  }

  if (input.wasPressed('KeyP') && g.state === 'playing') {
    g.state = 'paused';
    return;
  }
  if (g.state === 'paused') {
    if (input.wasPressed('KeyP')) g.state = 'playing';
    return;
  }

  // Clock: a full day every four minutes of play.
  g.timeOfDay = (g.timeOfDay + dt) % CFG.dayLength;

  // Global keys.
  if (input.wasPressed('KeyM')) {
    const on = g.audio.toggleMusic();
    g.missions.dialogue = { name: 'Rio', text: on ? 'Music on.' : 'Music off.' };
    g.missions.dialogueTimer = 2;
  }
  if (input.wasPressed('KeyN') && g.missions.active < 0) {
    const next = nextMissionId(g);
    if (next >= 0) startMission(g.missions, next, g);
    else {
      g.missions.dialogue = { name: 'Mara', text: 'All four jobs are done, Rio. The city is yours.' };
      g.missions.dialogueTimer = 4;
    }
  }

  updatePlayer(dt);
  updateWorld(dt);
  updateMissions(g.missions, g, dt);
  checkPackages(g.missions, g);
  updateCamera(g.camera, player.inCar || player, dt);

  // Busted: the police caught Rio on foot.
  if (g.police.busted) {
    player.money = Math.max(0, player.money - CFG.bustedFine);
    g.save.money = player.money;
    storeSave(g.save);
    clearBusted(g.police, player, g.world);
    g.state = 'gameover';
  }

  // Death: enemies or a crash finished Rio off.
  if (player.hp <= 0 && g.state === 'playing') {
    g.state = 'gameover';
  }

  // Autosave every few seconds.
  g.saveTimer = (g.saveTimer || 0) + dt;
  if (g.saveTimer > 5) {
    g.saveTimer = 0;
    g.save.money = player.money;
    g.save.bestMoney = Math.max(g.save.bestMoney, player.money);
    g.save.bestWanted = Math.max(g.save.bestWanted, Math.ceil(g.police.wanted));
    storeSave(g.save);
  }
}

function nextMissionId(g) {
  for (let i = 0; i < 4; i++) {
    if (!g.save.missionsDone.includes(i)) return i;
  }
  return -1;
}

function updatePlayer(dt) {
  const input = g.input;
  const player = g.player;

  if (player.inCar) {
    const car = player.inCar;
    const throttle = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) +
      (input.isDown('KeyS') || input.isDown('ArrowDown') ? -1 : 0);
    const steer = (input.isDown('KeyA') || input.isDown('ArrowLeft') ? -1 : 0) +
      (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
    const marks = driveCar(car, {
      throttle,
      steer,
      brake: false,
      handbrake: input.isDown('Space'),
    }, dt, g.world);
    for (const m of marks) {
      car.skid.push(m);
      if (car.skid.length > 60) car.skid.shift();
    }
    for (const s of car.skid) s.life -= dt;
    car.skid = car.skid.filter((s) => s.life > 0);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    g.audio.engine(Math.abs(car.speed) / CFG.carMaxSpeed);
    if (input.wasPressed('KeyE')) {
      exitCar(player);
      car.parked = true;
      g.cars.push(car);
    }
    return;
  }

  g.audio.engine(0);
  updateOnFoot(player, input, dt, g.world);

  // Aim with the mouse; click to shoot, F to punch, R to reload.
  player.angle = aimAngle(player, input.mouse, g.camera);
  if (input.mouse.clicked) {
    const b = shootPistol(player, player.angle);
    if (b) {
      g.bullets.push(b);
      g.audio.gunshot();
      g.camera.shake = 0.5;
      addHeat(g.police, 1);
      spawnParticles(b.x, b.y, 4, '#ffe9a0');
    }
  }
  if (input.wasPressed('KeyF') && player.punchCooldown <= 0) {
    player.punchCooldown = CFG.punchCooldown;
    const hit = punch(player, g.enemies, g.peds);
    g.audio.punch();
    if (hit) {
      spawnParticles(hit.x, hit.y, 5, '#ffffff');
      if (hit.hp <= 0 && g.enemies.includes(hit)) {
        hit.dead = true;
        g.missionKills += 1;
      }
    }
  }
  if (input.wasPressed('KeyR')) startReload(player);
  if (input.wasPressed('KeyE')) {
    const car = tryEnterCar(player, g.cars);
    if (car) {
      addHeat(g.police, 1);
      g.missions.dialogue = { name: 'Rio', text: 'Borrowed. They will not miss it.' };
      g.missions.dialogueTimer = 3;
      g.cars = g.cars.filter((c) => c !== car);
    }
  }
}

function updateWorld(dt) {
  const gRef = g;

  // Traffic.
  for (const car of gRef.cars) {
    updateTrafficCar(car, dt, gRef.world, gRef.rng);
  }
  for (let i = 0; i < gRef.cars.length; i++) {
    for (let j = i + 1; j < gRef.cars.length; j++) {
      separateCars(gRef.cars[i], gRef.cars[j]);
    }
  }
  // Keep the streets full: replace cars that wandered too far.
  if (gRef.cars.length < 12) {
    gRef.cars.push(spawnTrafficCar(gRef.rng, gRef.world));
  }

  // Pedestrians flee the player's car, gunfire and cruisers.
  const threats = [];
  if (gRef.player.inCar) threats.push(gRef.player.inCar);
  for (const c of gRef.police.cruisers) threats.push(c);
  for (const ped of gRef.peds) {
    updatePedestrian(ped, dt, gRef.world, threats, gRef.rng);
  }

  // Police.
  updatePolice(gRef.police, dt, gRef.world, gRef.player, gRef.rng, gRef.audio);

  // Enemies shoot back.
  for (const e of gRef.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - gRef.player.x, e.y - gRef.player.y);
    e.shootCooldown -= dt;
    if (d < 420 && e.shootCooldown <= 0) {
      gRef.bullets.push(enemyShoot(e, gRef.player, 0.4, gRef.rng));
      e.shootCooldown = 1.4 + gRef.rng() * 1.2;
      gRef.audio.gunshot();
    }
  }

  // Bullets fly and hit.
  const targets = [...gRef.enemies.filter((e) => !e.dead), gRef.player];
  const { hits, dead } = updateBullets(gRef.bullets, dt, gRef.world, targets);
  for (const h of hits) {
    spawnParticles(h.bullet.x, h.bullet.y, 4, '#ff8a70');
    if (h.target === gRef.player) {
      hurtPlayer(gRef.player, h.bullet.damage);
      gRef.camera.shake = 0.6;
    } else if (h.target.hp <= 0 && !h.target.dead) {
      h.target.dead = true;
      gRef.missionKills += 1;
      spawnParticles(h.target.x, h.target.y, 10, '#ff5a3c');
    }
  }
  gRef.bullets = gRef.bullets.filter((b) => !dead.includes(b));
  gRef.enemies = gRef.enemies.filter((e) => !e.dead || gRef.missions.active === 3);

  // Particles fade.
  for (const pt of gRef.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  gRef.particles = gRef.particles.filter((pt) => pt.life > 0);
}

function spawnParticles(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 140;
    g.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.3,
      max: 0.7,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, CFG.viewW, CFG.viewH);
  drawGame(ctx, g);
  drawHud(ctx, g);
}

requestAnimationFrame(frame);
