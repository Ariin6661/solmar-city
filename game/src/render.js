// Solmar City — the renderer.
//
// One canvas, one camera, everything drawn in layers: ground and sea,
// roads and sidewalks, parks and the pier, buildings with shadows,
// skid marks, cars and people, bullets and particles, and finally the
// light of the hour (bright noon, orange dusk, dark night with
// headlights). The renderer never changes the game state; it only
// looks at it.

import { CFG, PAL } from './config.js';

export function createCamera() {
  return { x: 0, y: 0, shake: 0 };
}

export function updateCamera(camera, target, dt) {
  const wantX = target.x - CFG.viewW / 2;
  const wantY = target.y - CFG.viewH / 2;
  camera.x += (wantX - camera.x) * Math.min(1, dt * 6);
  camera.y += (wantY - camera.y) * Math.min(1, dt * 6);
  camera.x = Math.max(-80, Math.min(CFG.worldW - CFG.viewW + 80, camera.x));
  camera.y = Math.max(-80, Math.min(CFG.worldH - CFG.viewH + 80, camera.y));
  if (camera.shake > 0) camera.shake = Math.max(0, camera.shake - dt * 2.2);
}

function shakeOffset(camera) {
  if (camera.shake <= 0) return { x: 0, y: 0 };
  const s = camera.shake * 7;
  return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
}

export function drawGame(ctx, g) {
  const camera = g.camera;
  const off = shakeOffset(camera);
  ctx.save();
  ctx.translate(-Math.round(camera.x + off.x), -Math.round(camera.y + off.y));
  drawGround(ctx, g);
  drawRoads(ctx, g);
  drawParks(ctx, g);
  drawPier(ctx, g);
  drawBuildings(ctx, g);
  drawSkids(ctx, g);
  drawPackages(ctx, g);
  drawCars(ctx, g);
  drawPeds(ctx, g);
  drawPlayer(ctx, g);
  drawEnemies(ctx, g);
  drawBullets(ctx, g);
  drawParticles(ctx, g);
  ctx.restore();
  drawLighting(ctx, g);
}

function drawGround(ctx, g) {
  // Grass base.
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(0, 0, CFG.worldW, CFG.worldH);
  // Beach sand, then the sea at the very bottom.
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(0, CFG.beachTop, CFG.worldW, CFG.worldH - CFG.beachTop);
  ctx.fillStyle = PAL.sea;
  ctx.fillRect(0, CFG.beachTop + 90, CFG.worldW, CFG.worldH - CFG.beachTop - 90);
  ctx.fillStyle = PAL.seaDeep;
  for (let i = 0; i < 8; i++) {
    const y = CFG.beachTop + 110 + i * 12;
    ctx.fillRect(((i * 317) % CFG.worldW), y, 180, 3);
  }
  // Subtle block tint so the grid reads at a glance.
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (const b of g.world.blocks) {
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }
}

function drawRoads(ctx, g) {
  const half = CFG.roadW / 2;
  ctx.fillStyle = PAL.sidewalk;
  for (const ax of g.world.avenues) {
    ctx.fillRect(ax - half - 8, 0, CFG.roadW + 16, CFG.worldH);
  }
  for (const sy of g.world.streets) {
    ctx.fillRect(0, sy - half - 8, CFG.worldW, CFG.roadW + 16);
  }
  ctx.fillStyle = PAL.road;
  for (const ax of g.world.avenues) {
    ctx.fillRect(ax - half, 0, CFG.roadW, CFG.worldH);
  }
  for (const sy of g.world.streets) {
    ctx.fillRect(0, sy - half, CFG.worldW, CFG.roadW);
  }
  // Centre dashes.
  ctx.fillStyle = PAL.roadLine;
  for (const ax of g.world.avenues) {
    for (let y = 20; y < CFG.worldH; y += 56) {
      ctx.fillRect(ax - 2, y, 4, 26);
    }
  }
  for (const sy of g.world.streets) {
    for (let x = 20; x < CFG.worldW; x += 56) {
      ctx.fillRect(x, sy - 2, 26, 4);
    }
  }
}

function drawParks(ctx, g) {
  for (const p of g.world.parks) {
    ctx.fillStyle = PAL.park;
    ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
  }
  for (const t of g.world.trees) {
    ctx.fillStyle = PAL.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(t.x + 3, t.y + 4, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // The plaza: pale stone with a fountain dot in the middle.
  const pl = g.world.plaza;
  if (pl) {
    ctx.fillStyle = PAL.plaza;
    ctx.fillRect(pl.x0, pl.y0, pl.x1 - pl.x0, pl.y1 - pl.y0);
    ctx.fillStyle = PAL.sea;
    ctx.beginPath();
    ctx.arc((pl.x0 + pl.x1) / 2, (pl.y0 + pl.y1) / 2, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPier(ctx, g) {
  const pier = g.world.landmarks.find((l) => l.kind === 'pier');
  if (!pier) return;
  ctx.fillStyle = PAL.pier;
  ctx.fillRect(pier.x - 26, pier.y - 130, 52, 220);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  for (let y = pier.y - 130; y < pier.y + 90; y += 18) {
    ctx.beginPath();
    ctx.moveTo(pier.x - 26, y);
    ctx.lineTo(pier.x + 26, y);
    ctx.stroke();
  }
}

function drawBuildings(ctx, g) {
  for (const b of g.world.buildings) {
    // Soft shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, Math.min(10, b.h * 0.18));
    // Windows.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 28));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(b.x + 8 + c * 26, b.y + 16 + r * 28, 12, 9);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
    }
  }
  // Landmark labels.
  ctx.save();
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(20,20,20,0.75)';
  for (const lm of g.world.landmarks) {
    ctx.fillText(lm.name, lm.x, lm.y - 46);
  }
  ctx.restore();
}

function drawSkids(ctx, g) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 4;
  for (const car of g.cars) {
    for (const s of car.skid) {
      ctx.globalAlpha = Math.min(0.5, s.life * 0.3);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      ctx.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPackages(ctx, g) {
  for (const pkg of g.missions.packages) {
    if (pkg.taken) continue;
    const bob = Math.sin(g.time * 3 + pkg.bob) * 3;
    ctx.save();
    ctx.translate(pkg.x, pkg.y + bob);
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.fillStyle = '#fff7cc';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRect(ctx, -car.length * 0.18, -car.width / 2 + 4, car.length * 0.32, car.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(car.length * 0.14, -car.width / 2 + 5, 5, car.width - 10);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(car.length / 2 - 2, -car.width / 2 + 2, 3, 5);
  ctx.fillRect(car.length / 2 - 2, car.width / 2 - 7, 3, 5);
  if (car.kind === 'cruiser') {
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(-4, -car.width / 2 + 1, 8, 4);
    ctx.fillStyle = '#4080ff';
    ctx.fillRect(-4, car.width / 2 - 5, 8, 4);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, g) {
  for (const car of g.cars) drawCarShape(ctx, car);
  for (const cruiser of g.police.cruisers) drawCarShape(ctx, cruiser);
  if (g.player.inCar) drawCarShape(ctx, g.player.inCar);
}

function drawPeds(ctx, g) {
  for (const ped of g.peds) {
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.save();
    ctx.translate(ped.x, ped.y + bob * 0.3);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(2, 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayer(ctx, g) {
  const p = g.player;
  if (p.inCar) return;
  const bob = Math.sin(p.walkPhase) * 2;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.2);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 5, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rio: mustard jacket, dark jeans.
  ctx.fillStyle = PAL.player;
  ctx.beginPath();
  ctx.arc(0, 0, CFG.playerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22242a';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 5, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.angle) * 10, Math.sin(p.angle) * 10);
  ctx.lineTo(Math.cos(p.angle) * 17, Math.sin(p.angle) * 17);
  ctx.stroke();
  ctx.restore();
}

function drawEnemies(ctx, g) {
  for (const e of g.enemies) {
    if (e.dead) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = '#7a2e2e';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b5e';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // Health pip.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-12, -22, 24, 4);
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(-12, -22, 24 * Math.max(0, e.hp / CFG.enemyHp), 4);
    ctx.restore();
  }
}

function drawBullets(ctx, g) {
  ctx.save();
  ctx.strokeStyle = '#ffe9a0';
  ctx.lineWidth = 2;
  for (const b of g.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx, g) {
  for (const pt of g.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Time-of-day light: noon is clear, dusk is warm, night is dark with
// a pool of light around Rio.
function drawLighting(ctx, g) {
  const t = (g.timeOfDay / CFG.dayLength) % 1;
  let overlay = null;
  let alpha = 0;
  if (t > 0.42 && t < 0.58) {
    overlay = '255, 140, 60';
    alpha = 0.24 * Math.sin(((t - 0.42) / 0.16) * Math.PI);
  } else if (t >= 0.58 || t < 0.08) {
    overlay = '8, 12, 40';
    alpha = 0.34;
  }
  if (!overlay) return;
  ctx.save();
  ctx.fillStyle = `rgba(${overlay}, ${alpha})`;
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  if (t >= 0.58 || t < 0.08) {
    // Headlight pool around the player.
    const p = g.player.inCar || g.player;
    const sx = p.x - g.camera.x;
    const sy = p.y - g.camera.y;
    const grad = ctx.createRadialGradient(sx, sy, 40, sx, sy, 260);
    grad.addColorStop(0, 'rgba(255, 240, 180, 0.20)');
    grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  }
  ctx.restore();
}
