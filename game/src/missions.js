// Solmar City — story missions, taxi fares and hidden packages.
//
// Four story jobs from Mara, each a small state machine with stages,
// a map marker and dialogue lines. Between jobs, Rio can run taxi fares
// (pick someone up, drop them off, get paid) and hunt the ten hidden
// packages glowing around the city. The module only tracks objectives
// and payouts; the main loop draws the markers and the dialogue.

import { CFG } from './config.js';
import { randomRoadPoint } from './world.js';
import { pick, range } from './rng.js';

export const MISSION_DEFS = [
  {
    id: 0,
    name: 'Borrowed Wheels',
    giver: 'Mara',
    intro: 'Rio, I need wheels. Borrow a car — any car — and bring it to Plaza del Sol. Try not to scratch it.',
    stages: [
      { text: 'Steal a car (walk up and press E)', done: (g) => !!g.player.inCar },
      { text: 'Drive to Plaza del Sol', done: (g) => nearMarker(g, 'plaza', 90) },
    ],
  },
  {
    id: 1,
    name: 'The Pickup',
    giver: 'Mara',
    intro: 'A friend waits at The Meridian. Pick him up and take him to Solmar Pier. He tips well if you are quick.',
    stages: [
      { text: 'Drive to The Meridian', done: (g) => nearMarker(g, 'hotel', 90) },
      { text: 'Take the passenger to Solmar Pier', done: (g) => nearMarker(g, 'pier', 90) },
    ],
  },
  {
    id: 2,
    name: 'Beat the Clock',
    giver: 'Mara',
    intro: 'Ninety seconds to Dockside Yards. The cargo does not wait, and neither do I. Go.',
    timer: CFG.clockMissionTime,
    stages: [
      { text: 'Reach Dockside Yards before time runs out', done: (g) => nearMarker(g, 'docks', 110) },
    ],
  },
  {
    id: 3,
    name: 'Dockside Standoff',
    giver: 'Mara',
    intro: 'Four of them guarding the yard. Take them down, Rio. Watch your back — they shoot first.',
    stages: [
      { text: 'Eliminate the four guards at Dockside Yards', done: (g) => g.missionKills >= CFG.standoffEnemies },
    ],
  },
];

function landmark(g, kind) {
  return g.world.landmarks.find((l) => l.kind === kind);
}

function nearMarker(g, kind, radius) {
  const lm = landmark(g, kind);
  if (!lm) return false;
  const p = g.player.inCar || g.player;
  return Math.hypot(p.x - lm.x, p.y - lm.y) < radius;
}

export function makeMissionState() {
  return {
    active: -1,
    stage: 0,
    timer: 0,
    kills: 0,
    dialogue: null,
    dialogueTimer: 0,
    taxi: null,
    taxiTimer: 0,
    packages: [],
    passedFlash: 0,
  };
}

export function startMission(ms, id, g) {
  const def = MISSION_DEFS[id];
  if (!def) return false;
  ms.active = id;
  ms.stage = 0;
  ms.kills = 0;
  ms.timer = def.timer || 0;
  // A previous job's "MISSION PASSED" flash must not linger into the new one.
  ms.passedFlash = 0;
  ms.dialogue = { name: def.giver, text: def.intro };
  ms.dialogueTimer = 5;
  if (id === 3) spawnStandoff(g);
  return true;
}

export function spawnStandoff(g) {
  const lm = landmark(g, 'docks');
  g.enemies = [];
  for (let i = 0; i < CFG.standoffEnemies; i++) {
    const a = (i / CFG.standoffEnemies) * Math.PI * 2;
    g.enemies.push({
      x: lm.x + Math.cos(a) * 90,
      y: lm.y + Math.sin(a) * 90,
      hp: CFG.enemyHp,
      radius: 14,
      shootCooldown: range(g.rng, 0.5, 1.6),
      dead: false,
    });
  }
}

export function updateMissions(ms, g, dt) {
  if (ms.dialogueTimer > 0) {
    ms.dialogueTimer -= dt;
    if (ms.dialogueTimer <= 0) ms.dialogue = null;
  }
  if (ms.passedFlash > 0) ms.passedFlash -= dt;

  if (ms.active >= 0) {
    const def = MISSION_DEFS[ms.active];
    if (def.timer) {
      ms.timer -= dt;
      if (ms.timer <= 0) {
        ms.dialogue = { name: 'Mara', text: 'Too slow, Rio. We will try again later.' };
        ms.dialogueTimer = 4;
        ms.active = -1;
        return;
      }
    }
    const stage = def.stages[ms.stage];
    if (stage && stage.done(g)) {
      ms.stage++;
      if (ms.stage >= def.stages.length) {
        g.player.money += CFG.missionPay;
        g.save.money = g.player.money;
        g.save.missionsDone.push(def.id);
        ms.passedFlash = 3;
        ms.dialogue = { name: 'Mara', text: `${def.name} — done. $${CFG.missionPay} is yours.` };
        ms.dialogueTimer = 4;
        ms.active = -1;
      }
    }
  }

  // Taxi fares: a fare appears, Rio drives to the pickup, then the drop.
  if (!ms.taxi && ms.active < 0 && Math.random() < dt * 0.03) {
    const from = randomRoadPoint(g.rng, g.world);
    const to = randomRoadPoint(g.rng, g.world);
    ms.taxi = { from, to, phase: 'pickup' };
    ms.dialogue = { name: 'Dispatch', text: 'Taxi fare nearby. Pick them up.' };
    ms.dialogueTimer = 3;
  }
  if (ms.taxi) {
    const p = g.player.inCar || g.player;
    const target = ms.taxi.phase === 'pickup' ? ms.taxi.from : ms.taxi.to;
    if (Math.hypot(p.x - target.x, p.y - target.y) < 70) {
      if (ms.taxi.phase === 'pickup') {
        ms.taxi.phase = 'dropoff';
        ms.dialogue = { name: 'Passenger', text: 'Thanks! Take me across town, please.' };
        ms.dialogueTimer = 3;
      } else {
        g.player.money += CFG.taxiFare;
        g.save.money = g.player.money;
        g.save.taxiDone += 1;
        ms.taxi = null;
        ms.dialogue = { name: 'Dispatch', text: `Fare paid: $${CFG.taxiFare}.` };
        ms.dialogueTimer = 3;
      }
    }
  }
}

export function placePackages(rng, world, count) {
  const pkgs = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rng, world);
    pkgs.push({ x: p.x, y: p.y, taken: false, bob: rng() * Math.PI * 2 });
  }
  return pkgs;
}

export function checkPackages(ms, g) {
  const p = g.player.inCar || g.player;
  for (const pkg of ms.packages) {
    if (pkg.taken) continue;
    if (Math.hypot(p.x - pkg.x, p.y - pkg.y) < 46) {
      pkg.taken = true;
      g.player.money += CFG.packagePay;
      g.save.money = g.player.money;
      g.save.packages.push(ms.packages.indexOf(pkg));
      ms.dialogue = { name: 'Rio', text: `Hidden package! +$${CFG.packagePay}.` };
      ms.dialogueTimer = 3;
    }
  }
}

export function currentObjective(ms) {
  if (ms.active >= 0) {
    const def = MISSION_DEFS[ms.active];
    const stage = def.stages[ms.stage];
    return stage ? `${def.name}: ${stage.text}` : def.name;
  }
  if (ms.taxi) {
    return ms.taxi.phase === 'pickup' ? 'Taxi: pick up the passenger' : 'Taxi: drop the passenger off';
  }
  return 'Press N for the next job — or explore Solmar City';
}
