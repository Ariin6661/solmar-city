// Solmar City — the city itself.
// Builds the road grid, blocks, buildings, parks, beach and pier from a
// seed, and answers the questions the rest of the game asks about it:
// where the roads are, what blocks movement, where to spawn things.
import { WORLD, PALETTE, LANDMARKS } from './config.js';
import { Rng } from './rng.js';

export function roadRects() {
  const rects = [];
  for (let i = 0; i < WORLD.avenues; i++) {
    const x = i * WORLD.pitch;
    rects.push({ x: x - WORLD.road / 2, y: 0, w: WORLD.road, h: (WORLD.streets - 1) * WORLD.pitch, vertical: true, at: x });
  }
  for (let j = 0; j < WORLD.streets; j++) {
    const y = j * WORLD.pitch;
    rects.push({ x: 0, y: y - WORLD.road / 2, w: (WORLD.avenues - 1) * WORLD.pitch, h: WORLD.road, vertical: false, at: y });
  }
  return rects;
}

export function isOnRoad(x, y) {
  const half = WORLD.road / 2;
  for (let i = 0; i < WORLD.avenues; i++) {
    const cx = i * WORLD.pitch;
    if (Math.abs(x - cx) <= half && y >= -half && y <= (WORLD.streets - 1) * WORLD.pitch + half) return true;
  }
  for (let j = 0; j < WORLD.streets; j++) {
    const cy = j * WORLD.pitch;
    if (Math.abs(y - cy) <= half && x >= -half && x <= (WORLD.avenues - 1) * WORLD.pitch + half) return true;
  }
  return false;
}

// Nearest point on any road centreline — used to put mission markers
// where a car or a pedestrian can actually reach them.
export function snapToRoad(x, y) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < WORLD.avenues; i++) {
    const cx = i * WORLD.pitch;
    const px = cx;
    const py = Math.max(0, Math.min((WORLD.streets - 1) * WORLD.pitch, y));
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) { bestD = d; best = { x: px, y: py }; }
  }
  for (let j = 0; j < WORLD.streets; j++) {
    const cy = j * WORLD.pitch;
    const px = Math.max(0, Math.min((WORLD.avenues - 1) * WORLD.pitch, x));
    const py = cy;
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) { bestD = d; best = { x: px, y: py }; }
  }
  return best;
}

export function buildWorld(seed) {
  const rng = new Rng(seed);
  const buildings = [];
  const parks = [];
  const plazaBlock = { bi: 4, bj: 3 };
  const parkBlocks = [{ bi: 1, bj: 1 }, { bi: 6, bj: 4 }];
  const towerBlock = { bi: 6, bj: 1 }; // The Meridian
  const garageBlock = { bi: 1, bj: 5 }; // Mara's Garage

  for (let bi = 0; bi < WORLD.avenues - 1; bi++) {
    for (let bj = 0; bj < WORLD.streets - 1; bj++) {
      const bx = bi * WORLD.pitch + WORLD.road / 2;
      const by = bj * WORLD.pitch + WORLD.road / 2;
      const bw = WORLD.pitch - WORLD.road;
      const bh = WORLD.pitch - WORLD.road;
      if (bi === plazaBlock.bi && bj === plazaBlock.bj) continue;
      if (parkBlocks.some((p) => p.bi === bi && p.bj === bj)) {
        const trees = [];
        for (let t = 0; t < 7; t++) {
          trees.push({ x: bx + rng.range(24, bw - 24), y: by + rng.range(24, bh - 24), r: rng.range(9, 15) });
        }
        parks.push({ x: bx, y: by, w: bw, h: bh, trees });
        continue;
      }
      const color = rng.pick(PALETTE.building);
      const roof = rng.pick(PALETTE.roof);
      if (bi === towerBlock.bi && bj === towerBlock.bj) {
        buildings.push({ x: bx + 40, y: by + 20, w: bw - 80, h: bh - 40, color, roof, tower: true, name: 'The Meridian' });
        continue;
      }
      if (bi === garageBlock.bi && bj === garageBlock.bj) {
        buildings.push({ x: bx + 20, y: by + 30, w: bw - 40, h: bh - 90, color: '#c98a4b', roof: '#5e7d4f', name: "Mara's Garage" });
        continue;
      }
      if (rng.chance(0.55)) {
        // Two buildings side by side.
        const split = bw * rng.range(0.42, 0.58);
        buildings.push({ x: bx + 8, y: by + 10, w: split - 16, h: bh - 20, color, roof, floors: rng.int(1, 3) });
        buildings.push({ x: bx + split + 8, y: by + 14, w: bw - split - 16, h: bh - 28, color: rng.pick(PALETTE.building), roof: rng.pick(PALETTE.roof), floors: rng.int(1, 3) });
      } else {
        buildings.push({ x: bx + 14, y: by + 12, w: bw - 28, h: bh - 24, color, roof, floors: rng.int(2, 4) });
      }
    }
  }

  // Dockside Yards: shipping containers on the southern strip.
  const containers = [];
  for (let i = 0; i < 10; i++) {
    containers.push({
      x: 760 + (i % 5) * 210 + rng.range(-8, 8),
      y: 2140 + Math.floor(i / 5) * 130,
      w: 170,
      h: 84,
      color: rng.pick(['#b0553f', '#4e6e8e', '#c98a4b', '#5e7d4f', '#8e6f9e']),
    });
  }

  const plaza = {
    x: plazaBlock.bi * WORLD.pitch + WORLD.road / 2,
    y: plazaBlock.bj * WORLD.pitch + WORLD.road / 2,
    w: WORLD.pitch - WORLD.road,
    h: WORLD.pitch - WORLD.road,
  };
  const fountain = { x: plaza.x + plaza.w / 2, y: plaza.y + plaza.h / 2, r: 26 };

  const pier = { x: WORLD.beachX, y: 950, w: WORLD.waterX + 80 - WORLD.beachX, h: 60 };

  // Ten hidden packages, scattered where a curious player looks.
  const packageSpots = [
    { x: pier.x + pier.w - 30, y: pier.y + 30 },
    { x: plaza.x + 18, y: plaza.y + plaza.h - 18 },
    { x: 420, y: 1644 },
    { x: 1820, y: 560 },
    { x: 700, y: 300 },
    { x: 2100, y: 1400 },
    { x: 900, y: 2200 },
    { x: 1560, y: 2200 },
    { x: 2660, y: 1300 },
    { x: 240, y: 700 },
    { x: 1120, y: 180 },
    { x: 1980, y: 1960 },
  ];
  const packages = [];
  const shuffled = rng.shuffle(packageSpots);
  for (let i = 0; i < 10; i++) {
    packages.push({ x: shuffled[i].x, y: shuffled[i].y, found: false });
  }

  const landmarks = LANDMARKS.map((lm) => {
    const marker = snapToRoad(lm.x, lm.y);
    return { ...lm, marker };
  });

  const world = {
    seed,
    buildings,
    containers,
    parks,
    plaza,
    fountain,
    pier,
    packages,
    landmarks,
    roads: roadRects(),
  };

  world.blockedAt = (x, y, r) => {
    if (x < 24 + r || y < 24 + r || x > WORLD.w - 24 - r || y > WORLD.h - 24 - r) return true;
    // Water is blocked except on the pier deck.
    if (x > WORLD.waterX) {
      const onPier = x >= pier.x && x <= pier.x + pier.w && y >= pier.y && y <= pier.y + pier.h;
      if (!onPier) return true;
    }
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    for (const c of containers) {
      if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return true;
    }
    const fdx = x - fountain.x;
    const fdy = y - fountain.y;
    if (fdx * fdx + fdy * fdy < (fountain.r + r) * (fountain.r + r)) return true;
    return false;
  };

  world.randomRoadPoint = (r2) => {
    if (r2.chance(0.5)) {
      const x = r2.int(0, WORLD.avenues - 1) * WORLD.pitch + r2.range(-14, 14);
      const y = r2.range(0, (WORLD.streets - 1) * WORLD.pitch);
      return { x, y, angle: r2.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
    }
    const y = r2.int(0, WORLD.streets - 1) * WORLD.pitch + r2.range(-14, 14);
    const x = r2.range(0, (WORLD.avenues - 1) * WORLD.pitch);
    return { x, y, angle: r2.chance(0.5) ? 0 : Math.PI };
  };

  world.sidewalkPoint = (r2) => {
    const p = world.randomRoadPoint(r2);
    const off = 52;
    if (Math.abs(Math.sin(p.angle)) > 0.5) {
      p.x += r2.sign() * off;
    } else {
      p.y += r2.sign() * off;
    }
    return p;
  };

  return world;
}
