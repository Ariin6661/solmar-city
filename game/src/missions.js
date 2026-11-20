// Story missions, taxi fares and the ten hidden packages.
import { CFG, ST_Y, LANDMARKS } from './config.js';
import { spawnEnemy } from './combat.js';
import { sfx } from './audio.js';
import { syncSaveToGame, storeSave } from './save.js';

export const MISSION_DEFS = [
  {
    id: 0,
    name: 'Borrowed Wheels',
    reward: 500,
    intro: "Mara: Rio! You're back. I need wheels — borrow any car and bring it to my garage.",
    brief: 'Steal any car',
  },
  {
    id: 1,
    name: 'The Pickup',
    reward: 800,
    intro: "Mara: Dario is waiting by The Meridian. Pick him up and bring him to the garage. Don't keep him waiting.",
    brief: 'Pick up Dario at The Meridian',
  },
  {
    id: 2,
    name: 'Beat the Clock',
    reward: 1200,
    intro: 'Mara: A package for the docks, and the buyer leaves in 90 seconds. Drive like you mean it.',
    brief: 'Deliver the package to Dockside Yards in 90 seconds',
  },
  {
    id: 3,
    name: 'Dockside Standoff',
    reward: 2000,
    intro: "Mara: The Vultures took the docks. Four of them, armed. End it, Rio — then Solmar is ours again.",
    brief: 'Clear the Dockside Yards of the Vulture crew',
  },
];

const GARAGE = LANDMARKS[0];
const MERIDIAN = LANDMARKS[2];
const DOCKS = LANDMARKS[4];

export function makeMissionState() {
  return {
    idx: -1, // -1: no story mission active
    stage: 0,
    target: null, // {x, y, label}
    timer: 0,
    killsNeeded: 0,
    kills: 0,
    passenger: false,
    active: false,
  };
}

export function makeTaxiState() {
  return {
    state: 'none', // none | waiting | riding
    ped: null, // the fare, standing at the kerb
    dest: null, // {x, y}
    fare: 0,
    waitT: 0,
    cooldown: 6,
  };
}

export function setDialogue(G, name, text, seconds) {
  G.dialogue = { name, text, t: seconds || 5 };
}

export function startMission(G, idx) {
  const def = MISSION_DEFS[idx];
  if (!def) return;
  const M = G.mission;
  M.idx = idx;
  M.stage = 0;
  M.kills = 0;
  M.killsNeeded = 0;
  M.passenger = false;
  M.active = true;
  if (idx === 0) {
    M.target = null; // stage 0: just steal a car
  } else if (idx === 1) {
    M.target = { x: MERIDIAN.frontX, y: MERIDIAN.frontY, label: 'Pick up Dario' };
  } else if (idx === 2) {
    M.timer = 90;
    M.target = { x: DOCKS.frontX, y: DOCKS.frontY, label: 'Dockside delivery' };
  } else if (idx === 3) {
    M.target = { x: DOCKS.frontX, y: DOCKS.frontY, label: 'Dockside Yards' };
  }
  setDialogue(G, 'Mara', def.intro, 6);
  G.objective = def.brief;
}

function arriveAt(G, target, radius) {
  const P = G.player;
  const r = radius || 75;
  return Math.hypot(P.x - target.x, P.y - target.y) < r;
}

export function updateMission(G, dt) {
  const M = G.mission;
  if (!M.active || G.mode !== 'playing') return;
  const def = MISSION_DEFS[M.idx];

  if (M.idx === 0) {
    if (M.stage === 0) {
      if (G.player.car) {
        M.stage = 1;
        M.target = { x: GARAGE.frontX, y: GARAGE.frontY, label: "Mara's Garage" };
        G.objective = "Drive the car to Mara's Garage";
        setDialogue(G, 'Mara', 'Good. Now bring it home — my garage, north side.', 4);
      }
    } else if (M.target && arriveAt(G, M.target)) {
      completeMission(G);
    }
  } else if (M.idx === 1) {
    if (M.stage === 0 && M.target && arriveAt(G, M.target)) {
      M.stage = 1;
      M.passenger = true;
      M.target = { x: GARAGE.frontX, y: GARAGE.frontY, label: "Mara's Garage" };
      G.objective = "Bring Dario back to Mara's Garage";
      setDialogue(G, 'Dario', 'Finally. Mara owes me for this. Drive, Rio.', 4);
      sfx(G.audio, 'pickup');
    } else if (M.stage === 1 && M.target && arriveAt(G, M.target)) {
      completeMission(G);
    }
  } else if (M.idx === 2) {
    M.timer -= dt;
    if (M.timer <= 0) {
      failMission(G, 'Out of time — the buyer left without the package.');
      return;
    }
    if (M.target && arriveAt(G, M.target)) {
      completeMission(G);
    }
  } else if (M.idx === 3) {
    if (M.stage === 0 && M.target && arriveAt(G, M.target)) {
      M.stage = 1;
      M.killsNeeded = 4;
      M.kills = 0;
      const d = DOCKS;
      // Four Vultures on open ground: two on 6th Street, two in the
      // yard gaps — never inside a container (bullets can't reach there).
      const spots = [
        { x: d.x + 50, y: ST_Y(6) - 10 },
        { x: d.x + 176, y: ST_Y(6) + 10 },
        { x: d.x + 50, y: d.y + d.h - 160 },
        { x: d.x + 176, y: d.y + 160 },
      ];
      for (const s of spots) spawnEnemy(G, s.x, s.y);
      G.objective = 'Defeat the Vulture crew (0/4)';
      setDialogue(G, 'Vulture', 'Rio Vega! The boss wants you gone. Open fire!', 4);
    } else if (M.stage === 1) {
      M.kills = M.killsNeeded - G.enemies.length;
      G.objective = `Defeat the Vulture crew (${M.kills}/${M.killsNeeded})`;
      if (G.enemies.length === 0) completeMission(G);
    }
  }
}

export function completeMission(G) {
  const M = G.mission;
  const def = MISSION_DEFS[M.idx];
  G.money += def.reward;
  G.stats.earned += def.reward;
  G.missionDone[M.idx] = true;
  M.active = false;
  M.target = null;
  G.objective = '';
  sfx(G.audio, 'missionPass');
  setDialogue(G, 'Mara', `Mission passed — $${def.reward}. Solmar remembers, Rio.`, 5);
  G.mode = 'passed';
  G.passedMission = def;
  saveProgress(G);
}

export function failMission(G, reason) {
  const M = G.mission;
  M.active = false;
  M.target = null;
  G.objective = '';
  sfx(G.audio, 'missionFail');
  G.mode = 'failed';
  G.failReason = reason;
  G.failedMission = M.idx;
}

export function saveProgress(G) {
  syncSaveToGame(G.save, G);
  storeSave(G.save);
}

// --- Taxi fares: pick up a waving fare, drop them off, get paid. ---

export function updateTaxi(G, dt) {
  const T = G.taxi;
  const P = G.player;
  T.cooldown -= dt;
  if (T.state === 'none') {
    // A fare appears when you're driving and no mission needs the road.
    if (P.car && T.cooldown <= 0 && G.rng.chance(dt * 0.08)) {
      const spot = { x: P.x + G.rng.range(-320, 320), y: P.y + G.rng.range(-320, 320) };
      const res = { x: Math.max(90, Math.min(spot.x, CFG.WORLD_W - 90)), y: Math.max(90, Math.min(spot.y, CFG.BEACH_Y - 90)) };
      const ped = { x: res.x, y: res.y, angle: 0, state: 'fare', color: '#7ee787', walkPhase: 0, down: false, tx: res.x, ty: res.y, retarget: 99, fleeT: 0, downTimer: 0 };
      T.ped = ped;
      T.state = 'waiting';
      T.waitT = 25;
      G.peds.push(ped);
      setDialogue(G, 'Fare', 'Taxi! Over here — I need a ride across town.', 4);
    }
    return;
  }
  if (T.state === 'waiting') {
    T.waitT -= dt;
    if (T.waitT <= 0) {
      // The fare gave up and walked off.
      removeFarePed(G);
      T.state = 'none';
      T.cooldown = 12;
      return;
    }
    if (P.car && Math.hypot(P.x - T.ped.x, P.y - T.ped.y) < 56 && Math.abs(P.car.speed) < 40) {
      // They hop in: pick a destination on the far side of town.
      removeFarePed(G);
      const dest = { x: G.rng.range(300, CFG.WORLD_W - 300), y: G.rng.range(300, CFG.BEACH_Y - 200) };
      T.dest = dest;
      T.fare = Math.round(60 + Math.hypot(dest.x - P.x, dest.y - P.y) / 12);
      T.state = 'riding';
      setDialogue(G, 'Fare', 'Thanks! Take me to the marker — and step on it.', 4);
      sfx(G.audio, 'pickup');
    }
  } else if (T.state === 'riding') {
    if (Math.hypot(P.x - T.dest.x, P.y - T.dest.y) < 70) {
      G.money += T.fare;
      G.stats.earned += T.fare;
      G.stats.fares++;
      setDialogue(G, 'Fare', `Perfect stop. Keep the change — $${T.fare}.`, 4);
      sfx(G.audio, 'cash');
      T.state = 'none';
      T.dest = null;
      T.cooldown = CFG.TAXI_COOLDOWN_S;
      saveProgress(G);
    }
  }
}

function removeFarePed(G) {
  const T = G.taxi;
  if (!T.ped) return;
  const i = G.peds.indexOf(T.ped);
  if (i >= 0) G.peds.splice(i, 1);
  T.ped = null;
}

// --- Hidden packages: walk or drive over one to collect it. ---

export function checkPackages(G) {
  const P = G.player;
  for (const pkg of G.world.pkgSpots) {
    if (pkg.taken) continue;
    if (Math.hypot(P.x - pkg.x, P.y - pkg.y) < 30) {
      pkg.taken = true;
      G.money += 150;
      G.stats.earned += 150;
      G.stats.packages = (G.stats.packages || 0) + 1;
      setDialogue(G, 'Rio', 'A hidden package — $150. The old crew stashed these everywhere.', 4);
      sfx(G.audio, 'pickup');
      saveProgress(G);
    }
  }
}

// One-line objective for the HUD, from whatever is active.
export function objectiveText(G) {
  if (G.mission.active) return G.objective;
  if (G.taxi.state === 'riding') return 'Drop the fare at the green marker';
  if (G.taxi.state === 'waiting') return 'A fare is waving — pick them up';
  const next = G.missionDone.findIndex((d) => !d);
  if (next >= 0) return 'Press N to start the next story mission';
  return 'Free roam — Solmar is yours. Find packages, drive fares, stay out of trouble.';
}
