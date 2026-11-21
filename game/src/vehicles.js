// Solmar City — cars: physics, stealing and driving.
//
// A car is a small physics body: position, heading, speed and steering.
// The same code drives the player's stolen rides and the traffic, with
// different inputs. Driving is deliberately simple and readable: forward
// accel, reverse, brake, handbrake for slides, and steering that bites
// harder the slower you go. Buildings stop cars dead; other cars nudge.

import { CFG } from './config.js';
import { hitsBuilding, clampToWorld } from './world.js';

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle,
    speed: 0,
    steer: 0,
    color,
    kind: kind || 'civilian',
    length: CFG.carLength,
    width: CFG.carWidth,
    skid: [],
    honkCooldown: 0,
  };
}

// Drive the car one step. `drive` is { throttle: -1..1, steer: -1..1,
// brake: bool, handbrake: bool }. Returns a list of skid marks made.
export function driveCar(car, drive, dt, world) {
  const marks = [];
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };

  if (drive.throttle > 0) {
    car.speed += CFG.carAccel * drive.throttle * dt;
  } else if (drive.throttle < 0) {
    if (car.speed > 5) {
      car.speed -= CFG.carBrake * dt;
    } else {
      car.speed -= CFG.carReverse * dt * -drive.throttle;
    }
  }
  if (drive.brake) {
    // The brake always works against the motion: plain subtraction would
    // speed the car up while it is reversing.
    const s = Math.sign(car.speed);
    car.speed -= s * CFG.carBrake * dt;
    if (Math.sign(car.speed) !== s) car.speed = 0;
  }

  // Drag and rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (drive.handbrake) {
    car.speed -= car.speed * 2.2 * dt;
    if (Math.abs(car.speed) > 120) {
      marks.push({ x: car.x, y: car.y, angle: car.angle, life: 1.6 });
    }
  }

  // Clamp speed both ways.
  const maxFwd = car.kind === 'cruiser' ? CFG.cruiserSpeed : CFG.carMaxSpeed;
  if (car.speed > maxFwd) car.speed = maxFwd;
  if (car.speed < -CFG.carReverse) car.speed = -CFG.carReverse;
  if (Math.abs(car.speed) < 4 && drive.throttle === 0) car.speed = 0;

  // Steering: sharper at low speed, looser at high speed, and reversed
  // when backing up. Handbrake lets the tail step out.
  const grip = Math.min(1, Math.abs(car.speed) / 140 + 0.25);
  const turnRate = CFG.carTurn * grip * (drive.handbrake ? 1.7 : 1);
  car.angle += drive.steer * turnRate * dt * (car.speed >= 0 ? 1 : -1) *
    Math.min(1, Math.abs(car.speed) / 60 + 0.2);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;

  // Buildings are solid: stop and lose a little speed on impact.
  const hit = hitsBuilding(world, nx, ny, car.length * 0.42);
  if (hit) {
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  const clamped = clampToWorld(car.x, car.y, 30);
  car.x = clamped.x;
  car.y = clamped.y;

  return marks;
}

// Soft push between two cars so traffic does not overlap.
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = (a.length + b.length) * 0.42;
  if (d > 0.01 && d < min) {
    const push = (min - d) / 2;
    const nx = dx / d;
    const ny = dy / d;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    a.speed *= 0.94;
    b.speed *= 0.94;
  }
}

// Is the point close enough to a car door to steal it?
export function nearCarDoor(car, x, y) {
  return Math.hypot(car.x - x, car.y - y) < 62;
}
