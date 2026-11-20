// Solmar City — boot, game loop and mode handling.
// Wires every system together: world, player, traffic, police,
// missions, combat, HUD, rendering, audio, input and saving.
import { CFG } from './config.js';
import { makeRng, hashSeed } from './rng.js';
import { buildWorld } from './world.js';
import { makePlayer, stepPlayer, respawnPlayer } from './player.js';
import { spawnParkedCars } from './vehicles.js';
import { spawnTraffic, spawnPeds, stepTraffic, stepPeds } from './traffic.js';
import { stepPolice, clearCops } from './police.js';
import {
  makeMissionState, makeTaxiState, startMission, updateMission,
  updateTaxi, checkPackages, saveProgress, objectiveText, setDialogue,
} from './missions.js';
import { tryShoot, stepEnemies, stepBullets, stepParticles } from './combat.js';
import {
  drawHUD, drawStartScreen, drawPauseScreen, drawGameOverScreen,
  drawPassedScreen, drawFailedScreen,
} from './hud.js';
import { drawWorld, updateCamera } from './render.js';
import { makeAudio, initAudio, resumeAudio, updateAudio } from './audio.js';
import { makeInput, bindInput, endFrameInput, keyPressed, mouseWorld } from './input.js';
import { loadSave, applySaveToGame } from './save.js';
import { parseShotParams, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function createGame() {
  const shot = parseShotParams();
  const seed = shot ? shot.seed : (Date.now() % 2147483647);
  const G = {
    mode: 'start',
    time: 0,
    clockHours: 16.5,
    cam: { x: 1700, y: 1360, shake: 0 },
    rng: makeRng(seed),
    world: null,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    enemies: [],
    particles: [],
    skids: [],
    wanted: 0,
    lastCrimeT: -999,
    wantedDecayT: 0,
    crimeCd: 0,
    money: 250,
    missionDone: [false, false, false, false],
    mission: makeMissionState(),
    taxi: makeTaxiState(),
    dialogue: null,
    objective: '',
    stats: { earned: 0, fares: 0, kills: 0, carsStolen: 0, packages: 0, best: { earned: 0, fares: 0, kills: 0 } },
    save: loadSave(),
    input: makeInput(),
    audio: makeAudio(),
    mouseWorld: { x: 0, y: 0 },
    shot: null,
    deathCause: '',
    passedMission: null,
    failedMission: -1,
    failReason: '',
    lastShot: null,
    lastPedSpawn: 0,
    lastCopSpawn: 0,
    saveTimer: 0,
  };
  G.world = buildWorld(seed);
  G.player = makePlayer(G);
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
  applySaveToGame(G, G.save);
  // Repay the saved money count into the live stats display.
  G.stats.best = { ...G.save.best };
  spawnParkedCars(G, 26);
  spawnTraffic(G, 14);
  spawnPeds(G, 22);
  if (shot) applyShot(G, shot.kind, shot.seed);
  return G;
}

const G = createGame();
bindInput(G.input, canvas);
// Live handle for play-testing and debugging (harmless in the shipped game).
window.__solmar = G;

function startStory() {
  const next = G.missionDone.findIndex((d) => !d);
  if (next >= 0) {
    startMission(G, next);
  } else {
    G.objective = objectiveText(G);
    setDialogue(G, 'Mara', 'Solmar is yours, Rio. No more jobs — just the city.', 5);
  }
  G.mode = 'playing';
}

function togglePause() {
  if (G.mode === 'playing') G.mode = 'paused';
  else if (G.mode === 'paused') G.mode = 'playing';
}

function handleMenuKeys() {
  const input = G.input;
  if (G.mode === 'start' && keyPressed(input, 'Enter')) {
    startStory();
  } else if (G.mode === 'passed' && keyPressed(input, 'Enter')) {
    const next = G.missionDone.findIndex((d) => !d);
    if (next >= 0) startMission(G, next);
    else G.objective = objectiveText(G);
    G.mode = 'playing';
  } else if (G.mode === 'failed' && keyPressed(input, 'Enter')) {
    startMission(G, G.failedMission);
    G.mode = 'playing';
  } else if (G.mode === 'gameover' && keyPressed(input, 'Enter')) {
    clearCops(G);
    respawnPlayer(G);
  }
  if (keyPressed(input, 'KeyP') && (G.mode === 'playing' || G.mode === 'paused')) {
    togglePause();
  }
  if (keyPressed(input, 'KeyM')) {
    G.audio.musicOn = !G.audio.musicOn;
  }
}

function update(dt) {
  const input = G.input;
  // First gesture unlocks audio.
  if (input.anyKey) {
    initAudio(G.audio);
    resumeAudio(G.audio);
  }
  G.mouseWorld = mouseWorld(input, G.cam, canvas);
  handleMenuKeys();
  if (G.mode !== 'playing') return;
  // The clock runs: one game hour every 150 seconds.
  G.clockHours = (G.clockHours + dt / 150) % 24;
  G.time += dt;
  if (G.crimeCd > 0) G.crimeCd -= dt;
  if (G.dialogue && G.dialogue.t > 0) G.dialogue.t -= dt;
  // N: start the next story mission when none is active.
  if (keyPressed(input, 'KeyN') && !G.mission.active) {
    const next = G.missionDone.findIndex((d) => !d);
    if (next >= 0) startMission(G, next);
  }
  // In screenshot mode the scene's objective stays as the shot set it.
  if (!G.shot) G.objective = objectiveText(G);
  stepPlayer(G, dt);
  tryShoot(G);
  stepTraffic(G, dt);
  stepPeds(G, dt);
  stepPolice(G, dt);
  updateMission(G, dt);
  updateTaxi(G, dt);
  checkPackages(G);
  stepEnemies(G, dt);
  stepBullets(G, dt);
  stepParticles(G, dt);
  updateCamera(G, dt);
  updateAudio(G.audio, G, dt);
  // Autosave every few seconds while playing.
  G.saveTimer += dt;
  if (G.saveTimer > 5) {
    G.saveTimer = 0;
    saveProgress(G);
  }
}

function render() {
  // The world draws behind every screen, so menus sit over the city.
  drawWorld(G, ctx, canvas);
  if (G.mode === 'start') {
    drawStartScreen(G, ctx, canvas);
  } else if (G.mode === 'paused') {
    drawHUD(G, ctx, canvas);
    drawPauseScreen(G, ctx, canvas);
  } else if (G.mode === 'gameover') {
    drawHUD(G, ctx, canvas);
    drawGameOverScreen(G, ctx, canvas);
  } else if (G.mode === 'passed') {
    drawHUD(G, ctx, canvas);
    drawPassedScreen(G, ctx, canvas);
  } else if (G.mode === 'failed') {
    drawHUD(G, ctx, canvas);
    drawFailedScreen(G, ctx, canvas);
  } else {
    drawHUD(G, ctx, canvas);
  }
}

let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  update(dt);
  render();
  endFrameInput(G.input);
  requestAnimationFrame(frame);
}

// In shot mode the scene is set and the first frame is the screenshot;
// the loop still runs so traffic and the clock move naturally.
requestAnimationFrame(frame);
