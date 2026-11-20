// Screenshot scenes — deterministic setups for ?shot=…&seed=1, so the
// four screenshots are reproducible: the same seed always stages the
// same street, the same chase, the same job.

import { CONFIG } from './config.js';
import { createCar } from './vehicles.js';
import { startMission } from './missions.js';

// Place a traffic car at a fixed spot, heading along the road.
function stageTrafficCar(G, x, y, angle, color) {
  const car = createCar(x, y, angle, { color, driver: 'traffic', type: 'sedan' });
  car.route = [{ x, y }, { x: x + Math.cos(angle) * 800, y: y + Math.sin(angle) * 800 }];
  car.routeIndex = 1;
  car.speed = 0; // staged, not moving, so the shot is stable
  G.cars.push(car);
  return car;
}

function stageCopCar(G, x, y, angle, chaseSpeed) {
  const car = createCar(x, y, angle, { color: '#1e3a5f', driver: 'cop', police: true, type: 'sedan' });
  car.speed = 0;
  car.chaseSpeed = chaseSpeed || CONFIG.copSpeed;
  G.cars.push(car);
  G.cops.push(car);
  return car;
}

// A police car that sits parked with its lights flashing — for scenes
// where a chase would shove the staged player car around.
function stageParkedCopCar(G, x, y, angle) {
  const car = createCar(x, y, angle, { color: '#1e3a5f', driver: 'cop', police: true, type: 'sedan' });
  car.speed = 0;
  G.cars.push(car);
  return car;
}

// Snap the camera onto the player at once: the scenes are staged, so
// there is no cross-map pan to wait out before the screenshot.
function snapCamera(G) {
  G.camera.x = Math.max(0, Math.min(G.world.size - CONFIG.viewWidth, G.player.x - CONFIG.viewWidth / 2));
  G.camera.y = Math.max(0, Math.min(G.world.size - CONFIG.viewHeight, G.player.y - CONFIG.viewHeight / 2));
}

export function setupShot(G, shot) {
  const L = G.world.landmarks;
  const plaza = L.plaza;

  if (shot === 'start') {
    // Title screen over a busy downtown corner.
    G.state = 'title';
    G.player.x = plaza.x;
    G.player.y = plaza.y;
    G.camera.x = plaza.x - CONFIG.viewWidth / 2;
    G.camera.y = plaza.y - CONFIG.viewHeight / 2;
    stageTrafficCar(G, plaza.x - 120, plaza.y - 40, 0, '#c0392b');
    stageTrafficCar(G, plaza.x + 60, plaza.y + 50, Math.PI, '#2980b9');
    stageTrafficCar(G, plaza.x + 200, plaza.y - 40, 0, '#f1c40f');
    snapCamera(G);
    return;
  }

  if (shot === 'play') {
    // On foot in a busy street, mid-morning, no heat.
    G.state = 'playing';
    G.player.x = plaza.x - 40;
    G.player.y = plaza.y + 30;
    G.player.angle = -0.4;
    G.clockMinutes = 10 * 60 + 24;
    // Park the mouse where the crosshair reads well (not the corner).
    G.input.mouseX = 950;
    G.input.mouseY = 300;
    stageTrafficCar(G, plaza.x - 180, plaza.y - 40, 0, '#c0392b');
    stageTrafficCar(G, plaza.x - 40, plaza.y - 40, 0, '#2980b9');
    stageTrafficCar(G, plaza.x + 120, plaza.y + 48, Math.PI, '#16a085');
    stageTrafficCar(G, plaza.x + 260, plaza.y - 40, 0, '#e67e22');
    snapCamera(G);
    return;
  }

  if (shot === 'chase') {
    // Driving fast with three stars and police on the tail.
    G.state = 'playing';
    const car = createCar(plaza.x, plaza.y, 0, { color: '#c0392b', driver: 'player', type: 'coupe' });
    car.vx = 500;
    G.cars.push(car);
    G.player.inCar = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.heat = 3;
    G.lastCrimeAt = G.elapsed;
    stageCopCar(G, plaza.x - 520, plaza.y - 30, 0, 300);
    stageCopCar(G, plaza.x - 640, plaza.y + 46, 0, 300);
    stageCopCar(G, plaza.x - 430, plaza.y + 90, 0.3, 300);
    stageTrafficCar(G, plaza.x + 200, plaza.y - 40, 0, '#f1c40f');
    startMission(G, 0);
    G.mission.step = 1;
    G.mission.objective = 'Drive the car to Mara\u2019s Garage';
    G.mission.marker = { x: L.garage.x, y: L.garage.y };
    G.clockMinutes = 17 * 60 + 40; // late afternoon light
    snapCamera(G);
    return;
  }

  if (shot === 'mission') {
    // Mid-job: the pickup run, package in hand, heading for the plaza.
    G.state = 'playing';
    // Staged a little west of the docks landmark so the camera (which
    // clamps at the world's east edge) can centre on the car.
    const car = createCar(L.docks.x - 160, L.docks.y + 60, -Math.PI / 2, { color: '#2980b9', driver: 'player', type: 'sedan' });
    G.cars.push(car);
    G.player.inCar = car;
    G.player.x = car.x;
    G.player.y = car.y;
    startMission(G, 1);
    G.mission.step = 2;
    G.mission.objective = 'Deliver the package to Plaza del Sol';
    G.mission.marker = { x: L.plaza.x, y: L.plaza.y };
    G.heat = 1;
    G.lastCrimeAt = G.elapsed;
    stageParkedCopCar(G, L.docks.x + 40, L.docks.y + 180, -Math.PI / 2);
    stageTrafficCar(G, L.docks.x + 240, L.docks.y - 40, Math.PI, '#8e44ad');
    G.clockMinutes = 12 * 60 + 10;
    snapCamera(G);
    return;
  }

  // Unknown ?shot=: just play.
  G.state = 'playing';
  snapCamera(G);
}
