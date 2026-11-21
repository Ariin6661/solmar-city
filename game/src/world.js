// Solmar City — the city itself.
//
// The city is a grid: nine avenues running north-south, eight streets
// running east-west, and the blocks between them. Each block holds either
// a row of buildings or a park. The south edge is a beach and the sea,
// with a pier reaching out at Solmar Pier. Everything here is pure data
// built once from a seed: roads, buildings, parks and landmarks, plus the
// queries the physics and the AI need (am I on a road? am I inside a
// building? where can a car drive?).

import { CFG, PAL, LANDMARKS } from './config.js';
import { mulberry32, range, int, pick, chance } from './rng.js';

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const avenues = [];
  for (let i = 0; i < CFG.avenueCount; i++) {
    avenues.push(CFG.marginX + i * CFG.avenueGap);
  }
  const streets = [];
  for (let j = 0; j < CFG.streetCount; j++) {
    streets.push(CFG.marginY + j * CFG.streetGap);
  }

  // Blocks: the rectangles between neighbouring roads.
  const blocks = [];
  for (let i = 0; i < avenues.length - 1; i++) {
    for (let j = 0; j < streets.length - 1; j++) {
      const x0 = avenues[i] + CFG.roadW / 2 + 10;
      const x1 = avenues[i + 1] - CFG.roadW / 2 - 10;
      const y0 = streets[j] + CFG.roadW / 2 + 10;
      const y1 = streets[j + 1] - CFG.roadW / 2 - 10;
      if (x1 - x0 < 40 || y1 - y0 < 40) continue;
      blocks.push({ x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
  }

  // Two blocks become parks, one becomes the plaza, the rest get buildings.
  const parkBlocks = [];
  const plazaBlock = blocks.reduce((best, b) => {
    const d = Math.hypot(b.cx - 1300, b.cy - 1000);
    return !best || d < best.d ? { b, d } : best;
  }, null).b;
  const shuffledBlocks = blocks.slice();
  for (let i = shuffledBlocks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledBlocks[i], shuffledBlocks[j]] = [shuffledBlocks[j], shuffledBlocks[i]];
  }
  for (const b of shuffledBlocks) {
    if (parkBlocks.length >= 2) break;
    if (b === plazaBlock) continue;
    if (b.cy > CFG.beachTop - 120) continue;
    parkBlocks.push(b);
  }

  const buildings = [];
  const parks = [];
  const trees = [];
  for (const b of blocks) {
    if (b === plazaBlock) continue;
    if (parkBlocks.includes(b)) {
      parks.push(b);
      const treeCount = int(rng, 5, 9);
      for (let t = 0; t < treeCount; t++) {
        trees.push({
          x: range(rng, b.x0 + 14, b.x1 - 14),
          y: range(rng, b.y0 + 14, b.y1 - 14),
          r: range(rng, 7, 12),
        });
      }
      continue;
    }
    if (b.cy > CFG.beachTop - 60) continue; // beachfront stays open
    const count = chance(rng, 0.55) ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const w = range(rng, 60, Math.min(120, (b.x1 - b.x0) / count - 8));
      const h = range(rng, 50, Math.min(110, b.y1 - b.y0 - 8));
      const x = b.x0 + 6 + k * ((b.x1 - b.x0) / count) + range(rng, 0, 8);
      const y = b.y0 + 6 + range(rng, 0, Math.max(0, (b.y1 - b.y0) - h - 12));
      buildings.push({
        x, y, w, h,
        color: pick(rng, PAL.building),
        roof: pick(rng, PAL.roof),
        tall: chance(rng, 0.18),
      });
    }
  }

  // Landmarks: fixed named places the missions and minimap use.
  const landmarks = LANDMARKS.map((lm) => ({ ...lm }));

  return {
    seed,
    avenues,
    streets,
    blocks,
    buildings,
    parks,
    trees,
    plaza: plazaBlock,
    landmarks,
    beachTop: CFG.beachTop,
    width: CFG.worldW,
    height: CFG.worldH,
  };
}

// True when the point is on a road surface (avenue or street).
export function isOnRoad(world, x, y) {
  const half = CFG.roadW / 2;
  for (const ax of world.avenues) {
    if (Math.abs(x - ax) <= half && y >= 0 && y <= CFG.worldH) return true;
  }
  for (const sy of world.streets) {
    if (Math.abs(y - sy) <= half && x >= 0 && x <= CFG.worldW) return true;
  }
  return false;
}

// True when the circle at (x, y) with radius r overlaps any building.
export function hitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
      return b;
    }
  }
  return null;
}

// Clamp a point inside the world, keeping a margin from the edge.
export function clampToWorld(x, y, margin) {
  return {
    x: Math.max(margin, Math.min(CFG.worldW - margin, x)),
    y: Math.max(margin, Math.min(CFG.worldH - margin, y)),
  };
}

// A random point on a road (used for traffic spawns and packages).
export function randomRoadPoint(rng, world) {
  if (rng() < 0.5) {
    const ax = world.avenues[Math.floor(rng() * world.avenues.length)];
    // Keep traffic in the city: the avenues run on into the beach and sea.
    return { x: ax + range(rng, -20, 20), y: range(rng, 100, Math.min(CFG.worldH - 100, CFG.beachTop - 40)) };
  }
  const sy = world.streets[Math.floor(rng() * world.streets.length)];
  return { x: range(rng, 100, CFG.worldW - 100), y: sy + range(rng, -20, 20) };
}

// The closest point on any road centre line.
export function nearestRoadPoint(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of world.avenues) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y }; }
  }
  for (const sy of world.streets) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy }; }
  }
  return best;
}
