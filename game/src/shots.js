// Solmar City — screenshot staging.
// ?shot=start|play|mission|chase&seed=N puts the game straight into a
// composed scene, so the four screenshots are reproducible renders of
// the game itself. Nothing here changes how the game plays.
import { TUNE } from './config.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = params.get('seed') || 'solmar-20261120';
  const known = ['start', 'play', 'mission', 'chase'];
  return { shot: known.includes(shot) ? shot : null, seed };
}

function parkNear(G, x, y, color, name) {
  const car = makeCar({ x, y, angle: 0, color, name, kind: 'civil', parked: true });
  G.cars.push(car);
  return car;
}

export function stageShot(G, name) {
  const world = G.world;
  const plaza = world.landmarks.find((l) => l.name === 'Plaza del Sol');
  const garage = world.landmarks.find((l) => l.name === "Mara's Garage");
  G.shot = name;
  if (name === 'start') {
    G.state = 'title';
    G.clock = 10 * 60;
    G.camera.x = plaza.x;
    G.camera.y = plaza.y;
    parkNear(G, plaza.x - 90, plaza.y + 60, '#d84a3a', 'Coupe');
    parkNear(G, plaza.x + 110, plaza.y - 40, '#3a7bd8', 'Sedan');
    parkNear(G, plaza.x + 40, plaza.y + 120, '#e8c33a', 'Taxi');
    return;
  }
  if (name === 'play') {
    G.state = 'playing';
    G.clock = 11 * 60;
    G.player.x = plaza.x;
    G.player.y = plaza.y + 30;
    G.player.angle = -Math.PI / 2;
    G.camera.x = plaza.x;
    G.camera.y = plaza.y;
    parkNear(G, plaza.x - 140, plaza.y - 60, '#4aa86b', 'Hatch');
    parkNear(G, plaza.x + 160, plaza.y + 80, '#7a4aa8', 'Coupe');
    return;
  }
  if (name === 'mission') {
    G.state = 'playing';
    G.clock = 15 * 60;
    startMission(G, 0);
    // Jump the story to its driving stage, with the Plaza in frame:
    // the car rolls north up 4th avenue toward the marker.
    G.mission.stage = 2;
    G.mission.target = plaza.marker;
    G.mission.targetLabel = 'Drive to Plaza del Sol';
    G.dialogue.active = false;
    G.toastT = 0;
    G.toastText = '';
    const car = makeCar({
      x: 1120,
      y: 1260,
      angle: -Math.PI / 2,
      color: '#d84a3a',
      name: 'Coupe',
      kind: 'civil',
    });
    car.driver = 'player';
    car.owned = true;
    car.speed = 200;
    G.cars.push(car);
    G.player.inCar = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.camera.x = car.x;
    G.camera.y = car.y;
    return;
  }
  if (name === 'chase') {
    G.state = 'playing';
    G.clock = 18 * 60 + 30; // dusk
    G.mission.targetLabel = 'Lose the police!';
    const car = makeCar({
      x: 1400,
      y: 1120,
      angle: -Math.PI / 2,
      color: '#d84a3a',
      name: 'Coupe',
      kind: 'civil',
    });
    car.driver = 'player';
    car.owned = true;
    car.speed = 320;
    G.cars.push(car);
    G.player.inCar = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.wanted = 3;
    G.lastCrimeAt = G.time;
    G.audio.startSiren(true);
    const spots = [
      { x: 1180, y: 900, angle: -0.4 },
      { x: 1620, y: 900, angle: Math.PI + 0.4 },
      { x: 1400, y: 1400, angle: Math.PI / 2 },
    ];
    for (const s of spots) {
      const cruiser = makeCar({ x: s.x, y: s.y, angle: s.angle, color: '#24344d', name: 'Cruiser', kind: 'police', driver: 'police' });
      cruiser.health = 120;
      cruiser.speed = 380;
      G.cars.push(cruiser);
    }
    for (let i = 0; i < 8; i++) {
      G.skids.push({ x: 1400 - i * 18, y: 1120 + i * 8, angle: -Math.PI / 2 + 0.2, life: 5 });
    }
    G.camera.x = car.x;
    G.camera.y = car.y;
    return;
  }
}
