// Solmar City — the wanted system and the police.
// Stars rise with crime and cool off when the player lays low. Cruisers
// spawn on the roads, chase, ram, and bust a player caught on foot.
import { TUNE, PALETTE } from './config.js';
import { makeCar, driveToward } from './vehicles.js';

export function addWanted(G, stars, reason) {
  if (G.wanted >= 5) return;
  G.wanted = Math.min(5, G.wanted + stars);
  G.lastCrimeAt = G.time;
  if (G.wanted > 0) G.audio.startSiren(true);
  if (reason) G.toast(`Wanted level ${G.wanted} — ${reason}.`);
}

export function stepWanted(G, dt) {
  if (G.wanted === 0) return;
  if (G.time - G.lastCrimeAt > TUNE.heatDecayDelay) {
    G.heatTimer += dt;
    if (G.heatTimer >= TUNE.heatDecayStep) {
      G.heatTimer = 0;
      G.wanted = Math.max(0, G.wanted - 1);
      if (G.wanted === 0) {
        G.audio.startSiren(false);
        G.toast('The heat died down. You are clean — for now.');
      }
    }
  }
}

function cruiserCount(wanted) {
  if (wanted <= 0) return 0;
  return Math.min(wanted + 1, 6);
}

export function stepPolice(G, dt) {
  const want = cruiserCount(G.wanted);
  const cruisers = G.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  if (cruisers.length < want) {
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    for (let n = cruisers.length; n < want; n++) {
      // Spawn on a road some distance away, so they drive in.
      let sx = px;
      let sy = py;
      for (let tries = 0; tries < 12; tries++) {
        const spot = G.world.randomRoadPoint(G.rng);
        const d = Math.hypot(spot.x - px, spot.y - py);
        if (d > 480 && d < 900) {
          sx = spot.x;
          sy = spot.y;
          break;
        }
      }
      const cruiser = makeCar({
        x: sx,
        y: sy,
        angle: Math.atan2(py - sy, px - sx),
        color: PALETTE.police,
        name: 'Cruiser',
        kind: 'police',
        driver: 'police',
      });
      cruiser.health = 120;
      G.cars.push(cruiser);
    }
  }
  if (G.wanted === 0) {
    // Heat is gone: cruisers give up, drive off and leave the city.
    for (const c of G.cars) {
      if (c.kind === 'police' && !c.wrecked) {
        c.speed = Math.max(c.speed, 200);
        c.angle += 0.4 * dt;
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
        const d = Math.hypot(c.x - G.player.x, c.y - G.player.y);
        if (d > 1400) c.gone = true;
      }
    }
    G.cars = G.cars.filter((c) => !c.gone);
    return;
  }
  const p = G.player;
  const tx = p.inCar ? p.inCar.x : p.x;
  const ty = p.inCar ? p.inCar.y : p.y;
  for (const c of G.cars) {
    if (c.kind !== 'police' || c.wrecked) continue;
    const d = driveToward(c, tx, ty, TUNE.policeMax, dt, G.world);
    if (p.inCar && d < 46) {
      // Ram: shove the player's car and dent it.
      const push = 160;
      p.inCar.x += Math.cos(c.angle) * push * dt * 4;
      p.inCar.y += Math.sin(c.angle) * push * dt * 4;
      p.inCar.health -= 6 * dt;
      G.camera.shake = Math.max(G.camera.shake, 5);
      if (p.inCar.health <= 0) {
        G.audio.crash();
        p.inCar.wrecked = true;
        p.inCar.speed = 0;
        p.inCar = null;
        p.x = tx + 50;
        p.y = ty + 50;
      }
    } else if (!p.inCar && d < 40) {
      // Caught on foot: the bust meter fills.
      G.bustedT += dt;
      if (G.bustedT > TUNE.bustedTime) {
        G.bustedT = 0;
        const fine = Math.min(p.money, TUNE.bustedFine);
        p.money -= fine;
        G.wanted = 0;
        G.audio.startSiren(false);
        for (const cc of G.cars) if (cc.kind === 'police') cc.wrecked = true;
        const garage = G.world.landmarks[0];
        p.x = garage.marker.x;
        p.y = garage.marker.y;
        p.health = TUNE.playerHealth;
        G.toast(`Busted! The police took $${fine} and dropped you at the garage.`);
        G.saveDirty = true;
      }
    } else {
      G.bustedT = Math.max(0, G.bustedT - dt * 2);
    }
  }
}
