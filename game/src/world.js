// Solmar City — the map. One grid of avenues and streets, blocks of
// buildings and parks between them, a beach and the sea along the south
// edge, and named landmarks the missions drive to. Everything is built
// from the seeded RNG, so the same seed always builds the same city.

import { CONFIG, PALETTE } from './config.js';

export function createWorld(rng) {
  const size = CONFIG.worldSize;
  const gap = CONFIG.roadGap;
  const half = CONFIG.roadWidth / 2;

  // Road centrelines: avenues run north-south, streets east-west.
  const avenues = [];
  for (let x = 200; x <= size - 200; x += gap) avenues.push(x);
  const streets = [];
  for (let y = 200; y < CONFIG.beachTop - 200; y += gap) streets.push(y);

  const buildings = [];
  const parks = [];
  const trees = [];

  // Each block between four roads becomes buildings, a park or a plaza.
  for (let i = 0; i < avenues.length - 1; i++) {
    for (let j = 0; j < streets.length - 1; j++) {
      const bx = avenues[i] + half + 14;
      const by = streets[j] + half + 14;
      const bw = avenues[i + 1] - avenues[i] - CONFIG.roadWidth - 28;
      const bh = streets[j + 1] - streets[j] - CONFIG.roadWidth - 28;
      const roll = rng.next();
      if (roll < 0.16) {
        // Park: grass with scattered trees.
        const park = { x: bx, y: by, w: bw, h: bh, trees: [] };
        const count = rng.int(5, 9);
        for (let t = 0; t < count; t++) {
          park.trees.push({
            x: bx + rng.range(20, bw - 20),
            y: by + rng.range(20, bh - 20),
            r: rng.range(9, 15),
          });
        }
        parks.push(park);
        continue;
      }
      if (roll < 0.24) {
        // Empty plaza: open paved ground, a good place to fight or meet.
        continue;
      }
      // Buildings: split the block into a 2x2 of lots.
      const cols = rng.chance(0.5) ? 2 : 1;
      const rows = rng.chance(0.5) ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (!rng.chance(0.85)) continue;
          const lotW = bw / cols;
          const lotH = bh / rows;
          const pad = 12;
          const w = lotW * rng.range(0.55, 0.82);
          const h = lotH * rng.range(0.55, 0.82);
          buildings.push({
            x: bx + c * lotW + (lotW - w) / 2,
            y: by + r * lotH + (lotH - h) / 2,
            w,
            h,
            color: rng.pick(PALETTE.building),
            height: rng.int(1, 3),
          });
        }
      }
    }
  }

  // Palm trees along the beach.
  for (let x = 120; x < size - 120; x += 90) {
    if (rng.chance(0.7)) {
      trees.push({ x: x + rng.range(-20, 20), y: CONFIG.beachTop + rng.range(20, 90), r: 11, palm: true });
    }
  }

  // Named landmarks the missions and the minimap use.
  const landmarks = {
    garage: { x: avenues[1], y: streets[1], label: 'Mara\u2019s Garage' },
    docks: { x: avenues[7], y: streets[6], label: 'Solmar Docks' },
    marina: { x: avenues[4], y: CONFIG.beachTop - 60, label: 'Marina' },
    plaza: { x: avenues[4], y: streets[3], label: 'Plaza del Sol' },
    northGate: { x: avenues[4], y: streets[0], label: 'North Gate' },
  };

  return { size, avenues, streets, buildings, parks, trees, landmarks };
}

// ---- Queries other systems use every frame ----

export function isOnRoad(world, x, y) {
  const half = CONFIG.roadWidth / 2;
  for (const ax of world.avenues) if (Math.abs(x - ax) <= half) return true;
  for (const sy of world.streets) if (Math.abs(y - sy) <= half) return true;
  return false;
}

export function isWater(world, x, y) {
  return y >= CONFIG.waterTop;
}

export function isBeach(world, x, y) {
  return y >= CONFIG.beachTop && y < CONFIG.waterTop;
}

export function pointInBuilding(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle (x, y, radius) out of every building it overlaps.
// Returns true when it touched a building.
export function collideCircle(world, pos, radius) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.y = cy + (dy / d) * radius;
      } else {
        // Dead centre inside the building: shove it out the nearest side.
        const left = pos.x - b.x;
        const right = b.x + b.w - pos.x;
        const top = pos.y - b.y;
        const bottom = b.y + b.h - pos.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = b.x - radius;
        else if (m === right) pos.x = b.x + b.w + radius;
        else if (m === top) pos.y = b.y - radius;
        else pos.y = b.y + b.h + radius;
      }
    }
  }
  return hit;
}

export function clampToWorld(world, pos, margin) {
  pos.x = Math.max(margin, Math.min(world.size - margin, pos.x));
  pos.y = Math.max(margin, Math.min(world.size - margin, pos.y));
}

// A point on a random road, for spawning cars and pedestrians.
export function randomRoadPoint(world, rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(world.avenues) + rng.range(-20, 20), y: rng.range(120, CONFIG.beachTop - 120) };
  }
  return { x: rng.range(120, world.size - 120), y: rng.pick(world.streets) + rng.range(-20, 20) };
}

export function randomIntersection(world, rng) {
  return { x: rng.pick(world.avenues), y: rng.pick(world.streets) };
}

// Snap a point to the nearest road centreline (keeps traffic on roads).
export function nearestRoadPoint(world, x, y) {
  let bestX = world.avenues[0];
  let bestD = Infinity;
  for (const ax of world.avenues) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; bestX = ax; }
  }
  let bestY = world.streets[0];
  bestD = Infinity;
  for (const sy of world.streets) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; bestY = sy; }
  }
  return Math.abs(x - bestX) < Math.abs(y - bestY)
    ? { x: bestX, y, vertical: true }
    : { x, y: bestY, vertical: false };
}
