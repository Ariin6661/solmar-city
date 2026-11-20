// Missions and side work — the story of Solmar City.
// Rio Vega, a driver-for-hire, is pulled back into the Solmar underworld
// by Mara, who runs a garage on the north side. Four story missions in
// order, plus taxi fares and hidden packages for cash between them.

import { CONFIG } from './config.js';
import { spawnEnemy } from './combat.js';
import { nearestCar } from './vehicles.js';
import { randomIntersection } from './world.js';

export const MISSION_DEFS = [
  {
    id: 0,
    title: 'Borrowed Wheels',
    giver: 'Mara',
    intro: 'Mara: "Rio. You owe me a favour. Take any car off the street and bring it to my garage."',
    outro: 'Mara: "Not bad. The old Rio is still in there somewhere."',
  },
  {
    id: 1,
    title: 'The Pickup',
    giver: 'Mara',
    intro: 'Mara: "A package is waiting at the docks. Walk in, grab it, and bring it to the plaza. The cops will be watching."',
    outro: 'Mara: "Clean. The client is happy, and so am I."',
  },
  {
    id: 2,
    title: 'Beat the Clock',
    giver: 'Mara',
    intro: 'Mara: "Ninety seconds, marina to North Gate. Miss it and the deal is dead. Drive like you mean it."',
    outro: 'Mara: "Ninety seconds! I knew you still had it."',
  },
  {
    id: 3,
    title: 'Dockside Standoff',
    giver: 'Mara',
    intro: 'Mara: "The dock crew turned on us. Four of them at the docks, all armed. End it, then come home."',
    outro: 'Mara: "It is done. Solmar is yours again, Rio."',
  },
];

export function nextMissionId(G) {
  for (let i = 0; i < 4; i++) {
    if (!G.missionsDone.includes(i)) return i;
  }
  return null;
}

export function startMission(G, id) {
  const def = MISSION_DEFS[id];
  G.mission = {
    id,
    def,
    step: 0,
    timer: 0,
    marker: null,
    failed: false,
  };
  G.say(def.intro);
  enterStep(G);
  return G.mission;
}

function enterStep(G) {
  const m = G.mission;
  if (!m) return;
  const L = G.world.landmarks;
  if (m.id === 0) {
    if (m.step === 0) {
      m.objective = 'Steal a car — walk up to one and press E';
      m.marker = null; // marker follows the nearest car, drawn live
    } else {
      m.objective = 'Drive the car to Mara\u2019s Garage';
      m.marker = { x: L.garage.x, y: L.garage.y };
    }
  } else if (m.id === 1) {
    if (m.step === 0) {
      m.objective = 'Drive to the Solmar Docks';
      m.marker = { x: L.docks.x, y: L.docks.y };
    } else if (m.step === 1) {
      m.objective = 'Get out and grab the package on foot';
      m.marker = { x: L.docks.x + 60, y: L.docks.y + 40 };
    } else {
      m.objective = 'Deliver the package to Plaza del Sol';
      m.marker = { x: L.plaza.x, y: L.plaza.y };
    }
  } else if (m.id === 2) {
    if (m.step === 0) {
      m.objective = 'Pick up the parcel at the Marina';
      m.marker = { x: L.marina.x, y: L.marina.y };
    } else {
      m.objective = 'Deliver to North Gate — beat the clock!';
      m.marker = { x: L.northGate.x, y: L.northGate.y };
      m.timer = 90;
    }
  } else if (m.id === 3) {
    if (m.step === 0) {
      m.objective = 'Head to the Solmar Docks';
      m.marker = { x: L.docks.x, y: L.docks.y };
    } else if (m.step === 1) {
      m.objective = 'Take down the dock crew (4 left)';
      m.marker = { x: L.docks.x, y: L.docks.y };
    } else {
      m.objective = 'Get back to Mara\u2019s Garage';
      m.marker = { x: L.garage.x, y: L.garage.y };
    }
  }
}

export function missionMarker(G) {
  const m = G.mission;
  if (!m) return null;
  // Mission 1, step 0: the marker chases the nearest stealable car.
  if (m.id === 0 && m.step === 0) {
    const car = nearestCar(G, G.player.x, G.player.y, 100000);
    return car ? { x: car.x, y: car.y } : null;
  }
  return m.marker;
}

// ---- Mission progress, checked every frame ----

function atPoint(G, point, radius) {
  if (!point) return false;
  return Math.hypot(G.player.x - point.x, G.player.y - point.y) < radius;
}

function completeMission(G) {
  const m = G.mission;
  const reward = CONFIG.missionRewards[m.id];
  G.player.money += reward;
  G.missionsDone.push(m.id);
  G.stats.missionsDone++;
  G.say(m.def.outro);
  G.audio.sfx('missionPass');
  G.mission = null;
  G.state = 'mission-passed';
  G.passedReward = reward;
  G.passedTitle = m.def.title;
  G.save();
}

export function failMission(G, reason) {
  G.mission = null;
  G.say(reason || 'Mission failed. Talk to Mara at the garage to try again.');
  G.audio.sfx('missionFail');
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) {
    // No job running: walk into Mara's garage marker to start the next one.
    const next = nextMissionId(G);
    if (next !== null) {
      const L = G.world.landmarks.garage;
      if (Math.hypot(G.player.x - L.x, G.player.y - L.y) < 90) {
        startMission(G, next);
      }
    }
    return;
  }

  if (m.id === 0) {
    if (m.step === 0 && G.player.inCar) {
      m.step = 1;
      enterStep(G);
      G.say('Mara: "Good. Now bring it to the garage."');
    } else if (m.step === 1 && atPoint(G, m.marker, 70)) {
      completeMission(G);
    }
    return;
  }

  if (m.id === 1) {
    if (m.step === 0 && atPoint(G, m.marker, 80)) {
      m.step = 1;
      enterStep(G);
      G.say('Mara: "The package is by the crates. On foot, quick."');
    } else if (m.step === 1 && !G.player.inCar && atPoint(G, m.marker, 46)) {
      m.step = 2;
      enterStep(G);
      G.addHeat(1, 'the docks are watched');
      G.say('Mara: "Got it. Now the plaza — and keep your head down."');
    } else if (m.step === 2 && atPoint(G, m.marker, 80)) {
      completeMission(G);
    }
    return;
  }

  if (m.id === 2) {
    if (m.step === 0 && atPoint(G, m.marker, 80)) {
      m.step = 1;
      enterStep(G);
      G.say('Mara: "Go! Ninety seconds!"');
    } else if (m.step === 1) {
      m.timer -= dt;
      if (atPoint(G, m.marker, 80)) {
        completeMission(G);
      } else if (m.timer <= 0) {
        failMission(G, 'Mara: "Too slow. The deal is dead — come back when you are ready."');
      }
    }
    return;
  }

  if (m.id === 3) {
    if (m.step === 0 && atPoint(G, m.marker, 90)) {
      m.step = 1;
      enterStep(G);
      const L = G.world.landmarks.docks;
      const spots = [
        { x: L.x - 90, y: L.y - 60 },
        { x: L.x + 100, y: L.y - 40 },
        { x: L.x - 60, y: L.y + 90 },
        { x: L.x + 80, y: L.y + 100 },
      ];
      for (const s of spots) spawnEnemy(G, s.x, s.y);
      G.say('Crew: "Vega! Finish him!"');
    } else if (m.step === 1) {
      const left = G.enemies.filter((e) => !e.dead).length;
      m.objective = `Take down the dock crew (${left} left)`;
      if (left === 0) {
        m.step = 2;
        enterStep(G);
        G.say('Mara: "All of them. Now come home."');
      }
    } else if (m.step === 2 && atPoint(G, m.marker, 70)) {
      completeMission(G);
    }
  }
}

// ---- Side work: taxi fares and hidden packages ----

export function spawnPackages(G) {
  G.packages = [];
  for (let i = 0; i < CONFIG.packagesTotal; i++) {
    const p = randomIntersection(G.world, G.rng);
    G.packages.push({
      x: p.x + G.rng.range(-90, 90),
      y: p.y + G.rng.range(-90, 90),
      found: G.packagesFound.includes(i),
      index: i,
    });
  }
}

export function updatePackages(G) {
  if (G.player.inCar) return;
  for (const pkg of G.packages) {
    if (pkg.found) continue;
    if (Math.hypot(G.player.x - pkg.x, G.player.y - pkg.y) < 34) {
      pkg.found = true;
      G.packagesFound.push(pkg.index);
      G.player.money += CONFIG.packageValue;
      G.audio.sfx('coin');
      G.say(`Found a hidden package! +$${CONFIG.packageValue} (${G.packagesFound.length}/${CONFIG.packagesTotal})`);
      G.save();
    }
  }
}

export function maybeStartFare(G) {
  if (G.taxiFare || !G.player.inCar || !G.player.inCar.taxi) return;
  const pickup = randomIntersection(G.world, G.rng);
  G.taxiFare = {
    state: 'toPassenger',
    passenger: pickup,
    dest: null,
    reward: 0,
  };
  G.say('Dispatch: "Fare waiting — pick them up at the marker."');
}

export function updateTaxi(G, dt) {
  const fare = G.taxiFare;
  if (!fare) return;
  if (!G.player.inCar || !G.player.inCar.taxi) {
    G.taxiFare = null;
    G.say('Dispatch: "Fare cancelled — you left the cab."');
    return;
  }
  if (fare.state === 'toPassenger' && atPoint(G, fare.passenger, 60)) {
    fare.state = 'toDestination';
    fare.dest = randomIntersection(G.world, G.rng);
    const dist = Math.hypot(fare.dest.x - fare.passenger.x, fare.dest.y - fare.passenger.y);
    fare.reward = CONFIG.taxiFareBase + Math.round(dist / 20);
    G.say(`Passenger: "Take me to the marker, quick — I will pay $${fare.reward}."`);
    G.audio.sfx('pickup');
  } else if (fare.state === 'toDestination' && atPoint(G, fare.dest, 60)) {
    G.player.money += fare.reward;
    G.stats.faresDone++;
    G.audio.sfx('coin');
    G.say(`Fare complete! +$${fare.reward}`);
    G.taxiFare = null;
    G.save();
  }
}

export function taxiMarker(G) {
  const fare = G.taxiFare;
  if (!fare) return null;
  return fare.state === 'toPassenger' ? fare.passenger : fare.dest;
}
