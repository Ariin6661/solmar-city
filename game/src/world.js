// The city of Solmar: roads, blocks, buildings, parks, beach, pier,
// docks and the ten hidden packages. All generated from a seed.
import { CFG, AVE_X, ST_Y, PAL, blockRect, blockKind, LANDMARKS } from './config.js';
import { makeRng, shuffle } from './rng.js';

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    seed,
    buildings: [], // {x,y,w,h,color,h} — solid, collidable
    parks: [], // {x,y,w,h,name,trees:[{x,y,r}]}
    pkgSpots: [], // {x,y,taken}
    containers: [], // dockside boxes, also collidable (in buildings)
  };

  // Buildings fill every plain block; parks and landmarks stay open.
  const roofColors = [PAL.roofA, PAL.roofB, PAL.roofC, PAL.roofD, PAL.roofE];
  for (let i = 0; i < CFG.AVES - 1; i++) {
    for (let j = 0; j < CFG.STS - 1; j++) {
      const kind = blockKind(i, j);
      const cell = blockRect(i, j, 14);
      if (kind.kind === 'park') {
        const trees = [];
        const n = rng.int(4, 7);
        for (let t = 0; t < n; t++) {
          trees.push({
            x: cell.x + rng.range(24, cell.w - 24),
            y: cell.y + rng.range(24, cell.h - 24),
            r: rng.range(9, 15),
          });
        }
        world.parks.push({ ...cell, name: kind.name, trees });
        continue;
      }
      if (kind.kind === 'landmark') continue; // handled below
      const two = rng.chance(0.55);
      if (two) {
        // Two buildings side by side along the block's long side.
        const horizontal = cell.w >= cell.h;
        const gap = 18;
        if (horizontal) {
          const w1 = cell.w * rng.range(0.42, 0.55);
          world.buildings.push({
            x: cell.x, y: cell.y, w: w1, h: cell.h,
            color: rng.pick(roofColors), h: rng.range(10, 26),
          });
          world.buildings.push({
            x: cell.x + w1 + gap, y: cell.y, w: cell.w - w1 - gap, h: cell.h,
            color: rng.pick(roofColors), h: rng.range(10, 26),
          });
        } else {
          const h1 = cell.h * rng.range(0.42, 0.55);
          world.buildings.push({
            x: cell.x, y: cell.y, w: cell.w, h: h1,
            color: rng.pick(roofColors), h: rng.range(10, 26),
          });
          world.buildings.push({
            x: cell.x, y: cell.y + h1 + gap, w: cell.w, h: cell.h - h1 - gap,
            color: rng.pick(roofColors), h: rng.range(10, 26),
          });
        }
      } else {
        world.buildings.push({
          x: cell.x + rng.range(0, cell.w * 0.15),
          y: cell.y + rng.range(0, cell.h * 0.15),
          w: cell.w * rng.range(0.7, 0.85),
          h: cell.h * rng.range(0.7, 0.85),
          color: rng.pick(roofColors),
          h: rng.range(10, 26),
        });
      }
    }
  }

  // Landmark buildings.
  const garage = LANDMARKS[0];
  world.buildings.push({ x: garage.x, y: garage.y, w: garage.w, h: garage.h, color: '#8a4a2b', h: 12 });
  const hotel = LANDMARKS[2];
  world.buildings.push({ x: hotel.x, y: hotel.y, w: hotel.w, h: hotel.h, color: '#4a6b8a', h: 34 });
  // Dockside: a yard of shipping containers, in loose rows with room
  // to walk between them — and 6th Street kept clear right through
  // the yard, so cars can reach the dockside front.
  const docks = LANDMARKS[4];
  const contColors = ['#b5543c', '#4a6b8a', '#8a6b3f', '#3f7a6b'];
  for (let cy = docks.y + 16; cy + 40 < docks.y + docks.h - 16; cy += 90) {
    if (cy + 40 > ST_Y(6) - CFG.ROAD_W / 2 - 6 && cy < ST_Y(6) + CFG.ROAD_W / 2 + 6) continue;
    for (let cx = docks.x + 16; cx + 88 < docks.x + docks.w - 8; cx += 130) {
      if (rng.chance(0.25)) continue;
      const c = { x: cx, y: cy, w: 88, h: 40, color: rng.pick(contColors), h: 8 };
      world.containers.push(c);
      world.buildings.push(c);
    }
  }

  // Ten hidden packages: parks, beach, pier end, docks, block corners.
  const spots = [];
  for (const p of world.parks) {
    spots.push({ x: p.x + 26, y: p.y + 26 });
    spots.push({ x: p.x + p.w - 26, y: p.y + p.h - 26 });
  }
  spots.push({ x: 1600, y: 2878 }); // pier end
  spots.push({ x: 700, y: 2780 }); // beach, west
  spots.push({ x: 2500, y: 2780 }); // beach, east
  spots.push({ x: docks.x + 40, y: docks.y + 30 }); // docks
  spots.push({ x: docks.x + docks.w - 40, y: docks.y + docks.h - 40 });
  const corners = [];
  for (let i = 0; i < CFG.AVES - 1; i++) {
    for (let j = 0; j < CFG.STS - 1; j++) {
      const cell = blockRect(i, j, 14);
      corners.push({ x: cell.x + 20, y: cell.y + cell.h - 20 });
      corners.push({ x: cell.x + cell.w - 20, y: cell.y + 20 });
    }
  }
  shuffle(rng, corners);
  for (const c of corners) spots.push(c);
  shuffle(rng, spots);
  world.pkgSpots = spots.slice(0, 10).map((s) => ({ x: s.x, y: s.y, taken: false }));

  return world;
}

// --- Collision and road queries (pure functions on the world) ---

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// Push a circle (x, y, radius) out of every building and the map edge.
// Returns the corrected position and whether anything was hit.
export function resolveCircle(world, x, y, radius) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        y = cy + (dy / d) * radius;
      } else {
        // Centre inside the rect: push out along the smallest side.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - radius;
        else if (m === right) x = b.x + b.w + radius;
        else if (m === top) y = b.y - radius;
        else y = b.y + b.h + radius;
      }
    }
  }
  // Map edge.
  if (x < radius) { x = radius; hit = true; }
  if (x > CFG.WORLD_W - radius) { x = CFG.WORLD_W - radius; hit = true; }
  if (y < radius) { y = radius; hit = true; }
  // Water: blocked, except on the pier walkway (x 1560..1640).
  const onPier = x > 1552 && x < 1648;
  const waterLine = onPier ? CFG.WORLD_H - 12 : CFG.WATER_Y;
  if (y > waterLine - radius) { y = waterLine - radius; hit = true; }
  return { x, y, hit };
}

// Is this point on a road (within the asphalt)?
export function onRoad(x, y) {
  for (let i = 0; i < CFG.AVES; i++) {
    if (Math.abs(x - AVE_X(i)) < CFG.ROAD_W / 2) return true;
  }
  for (let j = 0; j < CFG.STS; j++) {
    if (Math.abs(y - ST_Y(j)) < CFG.ROAD_W / 2) return true;
  }
  return false;
}

// A random point on a random road, with its road and direction.
export function randomRoadPoint(rng) {
  const vertical = rng.chance(0.5);
  const dir = rng.chance(0.5) ? 1 : -1;
  if (vertical) {
    const idx = rng.int(0, CFG.AVES - 1);
    return {
      x: AVE_X(idx) + (dir > 0 ? -17 : 17),
      y: rng.range(120, CFG.BEACH_Y - 80),
      road: 'ave', idx, dir,
    };
  }
  const idx = rng.int(0, CFG.STS - 1);
  return {
    x: rng.range(120, CFG.WORLD_W - 120),
    y: ST_Y(idx) + (dir > 0 ? 17 : -17),
    road: 'st', idx, dir,
  };
}

// The nearest road point to (x, y): used to drop traffic near the player.
export function nearestRoadPoint(rng, x, y) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < CFG.AVES; i++) {
    const d = Math.abs(x - AVE_X(i));
    if (d < bestD) {
      bestD = d;
      best = { x: AVE_X(i), y: Math.max(120, Math.min(y, CFG.BEACH_Y - 80)), road: 'ave', idx: i, dir: 1 };
    }
  }
  for (let j = 0; j < CFG.STS; j++) {
    const d = Math.abs(y - ST_Y(j));
    if (d < bestD) {
      bestD = d;
      best = { x: Math.max(120, Math.min(x, CFG.WORLD_W - 120)), y: ST_Y(j), road: 'st', idx: j, dir: 1 };
    }
  }
  return best;
}

// Is the point on the sand (between the last street and the water)?
export function isOnBeach(x, y) {
  return y >= CFG.BEACH_Y && y < CFG.WATER_Y;
}
