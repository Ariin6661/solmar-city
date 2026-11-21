// Solmar City — cars: physics, collisions and skid marks.
// One car shape for everything: the player's ride, traffic, taxis and
// police cruisers. Only the driver differs.
import { WORLD, TUNE, PALETTE } from './config.js';

export const CAR_LEN = 46;
export const CAR_WID = 22;

let carSeq = 0;

export function makeCar(opts) {
  carSeq++;
  return {
    id: carSeq,
    x: opts.x,
    y: opts.y,
    angle: opts.angle || 0,
    speed: 0,
    color: opts.color || PALETTE.car[carSeq % PALETTE.car.length],
    name: opts.name || 'Sedan',
    kind: opts.kind || 'civil',
    health: 100,
    wrecked: false,
    parked: !!opts.parked,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | null
    steer: 0,
  };
}

// Move a car the player drives. Returns an impact speed when it hits
// something hard, so the caller can shake the camera and play a sound.
export function drivePlayer(car, ix, iy, handbrake, dt, world, skids) {
  const forward = Math.cos(car.angle);
  const side = Math.sin(car.angle);
  const along = ix * forward + iy * side;
  if (along > 0.1) car.speed += TUNE.carAccel * dt;
  else if (along < -0.1) car.speed -= (car.speed > 5 ? TUNE.carAccel * 0.7 : TUNE.carReverse) * dt;
  else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 220 * dt);
  }
  car.speed = Math.max(-140, Math.min(TUNE.carMax, car.speed));
  const turn = ix * side - iy * forward; // steering input, -1..1
  const grip = handbrake ? TUNE.handbrakeGrip : TUNE.carGrip;
  const steerRate = TUNE.carTurn * Math.min(1, Math.abs(car.speed) / 120) * (handbrake ? 1.5 : 1);
  car.angle += turn * steerRate * Math.sign(car.speed) * dt;
  const slide = (handbrake && Math.abs(car.speed) > 120) || (Math.abs(turn) > 0.6 && Math.abs(car.speed) > 300);
  const moveAngle = slide ? car.angle + turn * 0.35 : car.angle;
  const nx = car.x + Math.cos(moveAngle) * car.speed * dt;
  const ny = car.y + Math.sin(moveAngle) * car.speed * dt;
  let impact = 0;
  if (!world.blockedAt(nx, car.y, 15)) car.x = nx;
  else impact = Math.abs(car.speed);
  if (!world.blockedAt(car.x, ny, 15)) car.y = ny;
  else impact = Math.max(impact, Math.abs(car.speed));
  if (impact > 60) car.speed *= 0.35;
  if (slide && skids) {
    skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
    if (skids.length > 220) skids.shift();
  }
  car.speed *= Math.pow(handbrake ? 0.4 : 0.92, dt * 4);
  return impact;
}

// Drive a car toward a point (police chase, scripted moves).
export function driveToward(car, tx, ty, maxSpeed, dt, world) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.speed = Math.min(maxSpeed, car.speed + TUNE.policeAccel * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!world.blockedAt(nx, car.y, 15)) car.x = nx;
  else car.speed *= 0.5;
  if (!world.blockedAt(car.x, ny, 15)) car.y = ny;
  else car.speed *= 0.5;
  return dist;
}

// Push overlapping cars apart and trade a little speed. Returns the
// hardest impact this frame, for sound and shake.
export function collideCars(cars) {
  let hardest = 0;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 34) {
        const push = (34 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const hit = Math.abs(a.speed - b.speed) + 40;
        if (hit > hardest) hardest = hit;
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.6;
        b.speed = avg * 0.6;
      }
    }
  }
  return hardest;
}
