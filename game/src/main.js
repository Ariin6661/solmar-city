// Solmar City — the game loop and the wiring between the systems.
// One shared state object (G) is handed to every system; main.js owns
// the frame: read input, update the world, draw the world, draw the HUD.

import { CONFIG } from './config.js';
import { makeRng, hashSeed } from './rng.js';
import { createWorld } from './world.js';
import { createInput, wasPressed, endFrame } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, tryEnterExitCar, checkPlayerCarHits } from './player.js';
import { updatePlayerCar, spawnParkedCars, nearestCar } from './vehicles.js';
import { spawnTraffic, updateTrafficCar, spawnPedestrians, updatePedestrian, checkPedCarHits } from './traffic.js';
import { playerShoot, playerPunch, updateBullets, updateEnemies } from './combat.js';
import { wantedStars, addHeat, updateWanted, updatePolice } from './police.js';
import { startMission, updateMission, missionMarker, spawnPackages, updatePackages, maybeStartFare, updateTaxi, taxiMarker, failMission } from './missions.js';
import { render, updateCamera } from './render.js';
import { drawHud, drawTitle, drawPaused, drawDead, drawMissionPassed } from './hud.js';
import { setupShot } from './shots.js';
import { loadSave, writeSave, defaultSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function readParams() {
  const q = new URLSearchParams(window.location.search);
  const seedText = q.get('seed') || 'solmar';
  const seed = /^\d+$/.test(seedText) ? Number(seedText) : hashSeed(seedText);
  return { seed, shot: q.get('shot') || null };
}

export function createGame() {
  const { seed, shot } = readParams();
  const rng = makeRng(seed);
  const world = createWorld(rng);
  const saveData = loadSave();

  const G = {
    ctx,
    canvas,
    rng,
    world,
    seed,
    shot,
    shotMode: !!shot,
    saveData,
    input: createInput(canvas),
    audio: createAudio(),
    state: 'title',
    elapsed: 0,
    clockMinutes: saveData ? saveData.clockMinutes : CONFIG.clockStartMinutes,
    camera: { x: 0, y: 0 },
    shake: 0,
    heat: 0,
    lastCrimeAt: -100,
    copSpawnTimer: 0,
    cars: [],
    cops: [],
    peds: [],
    enemies: [],
    bullets: [],
    particles: [],
    skids: [],
    muzzles: [],
    packages: [],
    packagesFound: saveData ? saveData.packagesFound.slice() : [],
    missionsDone: saveData ? saveData.missionsDone.slice() : [],
    stats: saveData ? { ...saveData.stats } : defaultSave().stats,
    mission: null,
    taxiFare: null,
    dialogue: '',
    dialogueTime: 0,
    passedTitle: '',
    passedReward: 0,
    fireCooldown: 0,
    activeMarker: null,
    nearestCarHere: null,
    scaleX: 1,
    scaleY: 1,
    musicWanted: true,
  };

  // Rio starts on the street outside Mara's garage.
  const garage = world.landmarks.garage;
  G.player = createPlayer(garage.x + 30, garage.y + 60, saveData);
  G.camera.x = G.player.x - CONFIG.viewWidth / 2;
  G.camera.y = G.player.y - CONFIG.viewHeight / 2;

  spawnParkedCars(G, 22);
  spawnTraffic(G, CONFIG.trafficCars);
  spawnPedestrians(G, CONFIG.pedestrians);
  spawnPackages(G);

  // ---- Helpers the systems call back into ----
  G.say = function say(text) {
    G.dialogue = text;
    G.dialogueTime = 5;
  };
  G.addHeat = function addHeatAmount(amount, reason) {
    addHeat(G, amount, reason);
  };
  G.save = function save() {
    writeSave(G);
  };
  G.addMuzzle = function addMuzzle(x, y) {
    G.muzzles.push({ x, y, life: 0.08 });
  };
  G.addSpark = function addSpark(x, y) {
    G.addBurst(x, y, '#ffd23f', 5);
  };
  G.addBlood = function addBlood(x, y) {
    G.addBurst(x, y, '#c0392b', 8);
  };
  G.addBurst = function addBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = G.rng.range(0, Math.PI * 2);
      const sp = G.rng.range(40, 180);
      G.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: G.rng.range(0.3, 0.7),
        maxLife: 0.7,
        color,
        size: G.rng.range(3, 6),
      });
    }
  };

  window.__solmar = G;
  return G;
}

// ---- Per-frame updates ----

function updateAim(G) {
  const rect = G.canvas.getBoundingClientRect();
  G.scaleX = CONFIG.viewWidth / rect.width;
  G.scaleY = CONFIG.viewHeight / rect.height;
  G.input.aimX = G.camera.x + G.input.mouseX * G.scaleX;
  G.input.aimY = G.camera.y + G.input.mouseY * G.scaleY;
}

function updatePlaying(G, dt) {
  const player = G.player;
  const input = G.input;

  G.clockMinutes += CONFIG.clockRate * dt;
  G.stats.playSeconds += dt;
  updateAim(G);

  // Pause.
  if (wasPressed(input, 'KeyP', 'Escape')) {
    G.state = 'paused';
    G.audio.engine(0, false);
    G.audio.siren(false);
    return;
  }
  // Music toggle.
  if (wasPressed(input, 'KeyM')) {
    G.musicWanted = !G.musicWanted;
    G.audio.setMuted(!G.musicWanted);
    G.audio.music(G.musicWanted);
  }

  // Enter / exit cars.
  if (wasPressed(input, 'KeyE')) {
    tryEnterExitCar(G);
    if (player.inCar && player.inCar.taxi) maybeStartFare(G);
  }

  if (player.inCar) {
    updatePlayerCar(G, player.inCar, dt);
    player.x = player.inCar.x;
    player.y = player.inCar.y;
    player.angle = player.inCar.angle;
    // Skid marks from the rear wheels while sliding.
    if (player.inCar.skidding) {
      const back = { x: player.inCar.x - Math.cos(player.inCar.angle) * 18, y: player.inCar.y - Math.sin(player.inCar.angle) * 18 };
      const prev = G.skids.length ? G.skids[G.skids.length - 1] : null;
      if (prev) {
        G.skids.push({ x1: prev.x2, y1: prev.y2, x2: back.x, y2: back.y, life: 6, maxLife: 6 });
      } else {
        G.skids.push({ x1: back.x, y1: back.y, x2: back.x + 1, y2: back.y + 1, life: 6, maxLife: 6 });
      }
      if (G.skids.length > 500) G.skids.splice(0, G.skids.length - 500);
    }
    const speed01 = Math.min(1, Math.hypot(player.inCar.vx, player.inCar.vy) / CONFIG.carMaxSpeed);
    G.audio.engine(speed01, true);
  } else {
    updatePlayerOnFoot(G, dt);
    G.audio.engine(0, false);
    // Shooting: hold to fire, with a fire-rate cap.
    G.fireCooldown -= dt;
    if (input.mouseDown && G.fireCooldown <= 0) {
      playerShoot(G);
      G.fireCooldown = 0.22;
    }
    if (wasPressed(input, 'Space')) playerPunch(G);
    if (wasPressed(input, 'KeyR') && player.ammo < CONFIG.pistolAmmo && player.reloading <= 0) {
      player.reloading = CONFIG.pistolReload;
    }
  }

  // The street: traffic, pedestrians, and the things cars hit.
  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
  }
  for (const ped of G.peds) updatePedestrian(G, ped, dt);
  checkPedCarHits(G);
  checkPlayerCarHits(G);

  // The law.
  updateWanted(G, dt);
  updatePolice(G, dt);
  G.audio.siren(wantedStars(G) >= 1);

  // Fights and jobs.
  updateBullets(G, dt);
  updateEnemies(G, dt);
  updateMission(G, dt);
  updatePackages(G);
  updateTaxi(G, dt);

  // Markers and hints for the HUD.
  G.activeMarker = missionMarker(G) || taxiMarker(G);
  G.nearestCarHere = player.inCar ? null : nearestCar(G, player.x, player.y, 52);

  // Effects decay.
  for (const pt of G.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.exp(-2 * dt);
    pt.vy *= Math.exp(-2 * dt);
    pt.life -= dt;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);
  for (const mz of G.muzzles) mz.life -= dt;
  G.muzzles = G.muzzles.filter((m) => m.life > 0);
  if (G.dialogueTime > 0) G.dialogueTime -= dt;

  updateCamera(G, dt);
}

function respawn(G) {
  const garage = G.world.landmarks.garage;
  if (G.player.inCar) {
    G.player.inCar.driver = 'parked';
    G.player.inCar = null;
  }
  G.player.x = garage.x + 30;
  G.player.y = garage.y + 60;
  G.player.health = CONFIG.playerHealth;
  G.player.ammo = CONFIG.pistolAmmo;
  G.player.money = Math.max(0, G.player.money - 100);
  G.heat = 0;
  for (const cop of G.cops) cop.dead = true;
  G.cops = [];
  G.enemies = [];
  G.bullets = [];
  if (G.mission) failMission(G, 'Mara: "You are alive, that is what matters. The job is off — come back when you are ready."');
  G.state = 'playing';
  G.say('Mara: "Easy, Rio. The medics took $100. Get back out there."');
  G.save();
}

function restartMission(G) {
  if (!G.mission) return;
  const id = G.mission.id;
  G.mission = null;
  G.enemies = [];
  G.bullets = [];
  startMission(G, id);
  G.state = 'playing';
}

// ---- Menus, the frame loop, and boot ----

function updateMenus(G, dt) {
  const input = G.input;
  if (G.state === 'title') {
    updateCamera(G, dt);
    if (wasPressed(input, 'Enter')) {
      G.state = 'playing';
      G.audio.ensure();
      G.audio.music(G.musicWanted);
      G.say('Mara: "Rio! Drive to my garage when you are ready for work."');
    }
    return;
  }
  if (G.state === 'paused') {
    if (wasPressed(input, 'Enter', 'KeyP', 'Escape')) {
      G.state = 'playing';
    } else if (wasPressed(input, 'KeyR')) {
      restartMission(G);
    } else if (wasPressed(input, 'KeyQ')) {
      G.save();
      G.state = 'title';
    }
    return;
  }
  if (G.state === 'dead') {
    if (wasPressed(input, 'Enter')) respawn(G);
    return;
  }
  if (G.state === 'mission-passed') {
    if (wasPressed(input, 'Enter')) {
      G.state = 'playing';
      G.save();
    }
  }
}

function frame(G, now) {
  const dt = Math.min(0.05, Math.max(0, (now - (G.lastNow || now)) / 1000));
  G.lastNow = now;
  G.elapsed += dt;

  // First gesture wakes the audio (browsers block sound before that).
  if (G.input.mousePressed || Object.keys(G.input.pressed).length > 0) {
    G.audio.ensure();
  }

  if (G.state === 'playing') {
    updatePlaying(G, dt);
    // A mission can flip the state mid-update (passed / dead).
    if (G.state === 'playing') {
      render(G);
      drawHud(G);
    } else {
      render(G);
      drawHud(G);
      if (G.state === 'dead') drawDead(G);
      else if (G.state === 'mission-passed') drawMissionPassed(G);
    }
  } else if (G.state === 'title') {
    updateMenus(G, dt);
    render(G);
    drawTitle(G);
  } else {
    updateMenus(G, dt);
    render(G);
    drawHud(G);
    if (G.state === 'paused') drawPaused(G);
    else if (G.state === 'dead') drawDead(G);
    else if (G.state === 'mission-passed') drawMissionPassed(G);
  }

  endFrame(G.input);
  requestAnimationFrame((t) => frame(G, t));
}

function fitCanvas() {
  const scale = Math.min(window.innerWidth / CONFIG.viewWidth, window.innerHeight / CONFIG.viewHeight);
  canvas.style.width = `${Math.floor(CONFIG.viewWidth * scale)}px`;
  canvas.style.height = `${Math.floor(CONFIG.viewHeight * scale)}px`;
}

const G = createGame();
canvas.width = CONFIG.viewWidth;
canvas.height = CONFIG.viewHeight;
fitCanvas();
window.addEventListener('resize', fitCanvas);

// Screenshot mode: jump straight into a staged scene.
if (G.shot) {
  setupShot(G, G.shot);
  G.audio.ensure();
}

requestAnimationFrame((t) => frame(G, t));
