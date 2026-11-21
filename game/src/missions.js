// Solmar City — the four-mission story, taxi fares and the HUD's
// objective line. Missions are small state machines: each stage names
// a target point, and reaching it moves the story on.
import { MISSIONS, TUNE } from './config.js';
import { spawnEnemy } from './combat.js';

export function makeMissionState() {
  return {
    index: -1, // -1: no mission running
    stage: 0,
    timer: 0,
    target: null,
    targetLabel: '',
    checkpoints: [],
    checkpoint: 0,
    passenger: null,
    done: [],
  };
}

function landmark(G, name) {
  return G.world.landmarks.find((l) => l.name === name);
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  const m = G.mission;
  m.index = index;
  m.stage = 0;
  m.timer = 0;
  m.checkpoints = [];
  m.checkpoint = 0;
  m.passenger = null;
  if (index === 0) {
    m.target = landmark(G, "Mara's Garage").marker;
    m.targetLabel = "Go to Mara's Garage";
  } else if (index === 1) {
    m.target = landmark(G, 'The Meridian').marker;
    m.targetLabel = 'Pick up the guest at The Meridian';
  } else if (index === 2) {
    m.checkpoints = ['Plaza del Sol', 'The Meridian', 'Solmar Pier', 'Dockside Yards', "Mara's Garage"]
      .map((n) => landmark(G, n).marker);
    m.timer = 90;
    m.target = m.checkpoints[0];
    m.targetLabel = 'Checkpoint 1 of 5 — 90 seconds!';
  } else if (index === 3) {
    m.target = landmark(G, 'Dockside Yards').marker;
    m.targetLabel = 'Take back the Dockside Yards';
  }
  G.dialogue = { lines: def.briefing, i: 0, active: true };
  G.toast(`${def.title} — ${m.targetLabel}`);
}

export function completeMission(G) {
  const def = MISSIONS[G.mission.index];
  G.player.money += def.reward;
  G.mission.done.push(def.id);
  G.save.missionsDone = [...G.mission.done];
  G.save.money = G.player.money;
  G.save.bestMoney = Math.max(G.save.bestMoney, G.player.money);
  G.saveDirty = true;
  G.audio.missionDone();
  G.player.health = Math.min(TUNE.playerHealth, G.player.health + 25);
  G.mission.index = -1;
  G.mission.target = null;
  G.mission.targetLabel = '';
  G.state = 'passed';
  G.passedTitle = `${def.title} — complete!`;
  G.passedReward = def.reward;
}

function near(G, target, radius) {
  const p = G.player;
  const x = p.inCar ? p.inCar.x : p.x;
  const y = p.inCar ? p.inCar.y : p.y;
  return Math.hypot(target.x - x, target.y - y) < radius;
}

export function stepMissions(G, dt) {
  const m = G.mission;
  if (m.index < 0) {
    // No story mission: maybe a taxi fare is waiting.
    maybeTaxi(G, dt);
    return;
  }
  if (m.index === 0) {
    if (m.stage === 0 && near(G, m.target, 70)) {
      m.stage = 1;
      m.target = null;
      m.targetLabel = 'Steal a car — press E next to one';
      G.toast('MARA: Any car will do. Take one.');
    } else if (m.stage === 1 && G.player.inCar) {
      m.stage = 2;
      m.target = landmark(G, 'Plaza del Sol').marker;
      m.targetLabel = 'Drive to Plaza del Sol';
    } else if (m.stage === 2 && near(G, m.target, 80)) {
      completeMission(G);
    }
  } else if (m.index === 1) {
    if (m.stage === 0 && near(G, m.target, 70)) {
      if (!G.player.inCar) {
        m.targetLabel = 'You need a car for the pickup — press E';
      } else {
        m.stage = 1;
        m.passenger = true;
        m.target = landmark(G, 'Dockside Yards').marker;
        m.targetLabel = 'Take the guest to the Dockside Yards';
        G.toast('GUEST: The yards. And drive smoothly, please.');
      }
    } else if (m.stage === 1 && near(G, m.target, 80)) {
      m.passenger = null;
      completeMission(G);
    }
  } else if (m.index === 2) {
    m.timer -= dt;
    m.targetLabel = `Checkpoint ${m.checkpoint + 1} of 5 — ${Math.max(0, Math.ceil(m.timer))}s left`;
    if (m.timer <= 0) {
      G.mission.index = -1;
      G.mission.target = null;
      G.toast('Out of time. Mara is not impressed. Press N to retry.');
      return;
    }
    if (near(G, m.target, 70)) {
      m.checkpoint++;
      if (m.checkpoint >= m.checkpoints.length) {
        completeMission(G);
      } else {
        m.target = m.checkpoints[m.checkpoint];
        G.audio.pickup();
      }
    }
  } else if (m.index === 3) {
    if (m.stage === 0 && near(G, m.target, 90)) {
      m.stage = 1;
      const yard = landmark(G, 'Dockside Yards');
      const spots = [
        { x: yard.x - 120, y: yard.y - 60 },
        { x: yard.x + 100, y: yard.y - 80 },
        { x: yard.x - 60, y: yard.y + 90 },
        { x: yard.x + 140, y: yard.y + 60 },
      ];
      for (const s of spots) spawnEnemy(G, s.x, s.y);
      m.targetLabel = 'Take down all four gunmen';
      G.toast('Four gunmen. Make it count, Rio.');
    } else if (m.stage === 1 && G.enemies.every((e) => e.dead)) {
      m.stage = 2;
      m.target = landmark(G, "Mara's Garage").marker;
      m.targetLabel = 'Yard is yours — head home to the garage';
    } else if (m.stage === 2 && near(G, m.target, 80)) {
      completeMission(G);
    }
  }
}

function maybeTaxi(G, dt) {
  const t = G.taxi;
  if (t.offer && !t.rider) {
    // A pedestrian flagged a ride: drive up to them.
    const inCar = G.player.inCar;
    const cd = inCar ? Math.hypot(t.offer.x - inCar.x, t.offer.y - inCar.y) : Infinity;
    if (inCar && cd < 60) {
      t.rider = t.offer;
      t.offer = null;
      t.dest = G.world.landmarks[Math.floor(Math.random() * G.world.landmarks.length)].marker;
      t.fare = Math.floor(TUNE.taxiFareMin + Math.random() * (TUNE.taxiFareMax - TUNE.taxiFareMin));
      G.peds = G.peds.filter((p) => p !== t.rider);
      G.toast(`Passenger aboard — take them to the marker. Fare $${t.fare}.`);
    } else if (Math.hypot(t.offer.x - G.player.x, t.offer.y - G.player.y) > 700) {
      t.offer.taxi = false;
      t.offer = null;
    }
    return;
  }
  if (t.rider) {
    if (near(G, t.dest, 70)) {
      G.player.money += t.fare;
      G.stats.fares++;
      G.save.fares = G.stats.fares;
      G.save.money = G.player.money;
      G.saveDirty = true;
      G.audio.pickup();
      G.toast(`Fare complete! +$${t.fare}`);
      t.rider = null;
      t.dest = null;
    }
    return;
  }
  // Offer a fare now and then while driving around with nothing to do.
  if (G.player.inCar && Math.random() < dt * 0.02) {
    const close = G.peds.filter((p) => {
      const d = Math.hypot(p.x - G.player.x, p.y - G.player.y);
      return d > 60 && d < 320 && p.down <= 0;
    });
    if (close.length > 0) {
      t.offer = close[0];
      t.offer.taxi = true;
      G.toast('Someone is flagging a taxi — drive up to them.');
    }
  }
}
