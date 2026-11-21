// Solmar City — screenshot staging (?shot=...).
//
// The screenshots are real renders of the game, staged through the URL
// the same way a player would reach the scene: ?shot=chase|play|mission
// with a seed. The staging skips the title screen, places Rio, the cars
// and the wanted level, and sets the time of day — then the normal game
// loop runs and the shot is taken a few seconds in, once the scene has
// settled. Deterministic: the same shot and seed always stage the same
// scene.

import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';

export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seed = parseInt(q.get('seed') || '1', 10);
  if (!shot) return null;
  if (!['chase', 'play', 'mission'].includes(shot)) return null;
  return { shot, seed: Number.isFinite(seed) ? seed : 1 };
}

// Stage the game for a screenshot. Called once, before the first frame.
export function applyShot(g, params) {
  const { shot, seed } = params;
  g.rngSeed = seed;
  g.shotMode = shot;
  g.state = 'playing';
  const world = g.world;
  const plaza = world.landmarks.find((l) => l.kind === 'plaza');
  const pier = world.landmarks.find((l) => l.kind === 'pier');

  if (shot === 'chase') {
    // Dusk chase: Rio in a car, three stars, three cruisers closing in.
    g.timeOfDay = CFG.dayLength * 0.5;
    const car = makeCar(1300, 1000, 0, '#c94f43', 'civilian');
    car.speed = 320;
    g.player.inCar = car;
    g.player.x = car.x;
    g.player.y = car.y;
    // A couple of traffic cars nearby so the street reads as alive.
    g.cars = [
      makeCar(1150, 860, 0, '#3f6fb5', 'civilian'),
      makeCar(1480, 1140, Math.PI, '#e0a83c', 'civilian'),
    ];
    g.cars[0].speed = 130;
    g.cars[1].speed = 130;
    g.police.wanted = 3;
    g.police.cruisers = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const cruiser = makeCar(
        car.x + Math.cos(a) * 260,
        car.y + Math.sin(a) * 260,
        a + Math.PI,
        '#20304a',
        'cruiser',
      );
      cruiser.speed = 380;
      g.police.cruisers.push(cruiser);
    }
    g.camera.x = car.x - CFG.viewW / 2;
    g.camera.y = car.y - CFG.viewH / 2;
  } else if (shot === 'play') {
    // Rio on foot at Plaza del Sol, rush hour around him.
    g.timeOfDay = CFG.dayLength * 0.18;
    g.player.x = plaza.x - 40;
    g.player.y = plaza.y + 60;
    g.player.angle = -Math.PI / 2;
    g.camera.x = g.player.x - CFG.viewW / 2;
    g.camera.y = g.player.y - CFG.viewH / 2;
  } else if (shot === 'mission') {
    // Mission 1 in progress: driving east along 1080 Street toward the
    // Plaza, gold beacon ahead. Starts far enough out that the run to
    // the Plaza is still in progress when the shot is taken.
    g.timeOfDay = CFG.dayLength * 0.3;
    const car = makeCar(600, 1080, 0, '#3f6fb5', 'civilian');
    car.speed = 300;
    g.player.inCar = car;
    g.player.x = car.x;
    g.player.y = car.y;
    g.cars = [makeCar(1150, 860, 0, '#c94f43', 'civilian')];
    g.cars[0].speed = 130;
    startMission(g.missions, 0, g);
    g.missions.stage = 1;
    g.camera.x = car.x - CFG.viewW / 2;
    g.camera.y = car.y - CFG.viewH / 2;
  }

  // Keep the frame clean for the shot: no intro dialogue.
  g.missions.dialogue = null;
  g.missions.dialogueTimer = 0;
}

// Error hook for the screenshot run: the harness reads this to confirm
// a shot rendered without runtime errors.
export function installErrorHook() {
  window.__gameErrors = [];
  window.addEventListener('error', (e) => {
    window.__gameErrors.push(String(e.message || e.error || 'error'));
  });
  window.addEventListener('unhandledrejection', (e) => {
    window.__gameErrors.push(String(e.reason || 'rejection'));
  });
}
