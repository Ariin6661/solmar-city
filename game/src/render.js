// Rendering — the camera, the city, and every effect on it.
// All drawing is plain canvas 2D, flat colours, no images: the art is
// the geometry. The HUD lives in hud.js, not here.

import { CONFIG, PALETTE } from './config.js';

export function updateCamera(G, dt) {
  const targetX = G.player.x - CONFIG.viewWidth / 2;
  const targetY = G.player.y - CONFIG.viewHeight / 2;
  if (G.shotMode) {
    // Staged scenes: snap straight onto the player, no pan.
    G.camera.x = Math.max(0, Math.min(G.world.size - CONFIG.viewWidth, targetX));
    G.camera.y = Math.max(0, Math.min(G.world.size - CONFIG.viewHeight, targetY));
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
    return;
  }
  const k = 1 - Math.exp(-6 * dt);
  G.camera.x += (targetX - G.camera.x) * k;
  G.camera.y += (targetY - G.camera.y) * k;
  G.camera.x = Math.max(0, Math.min(G.world.size - CONFIG.viewWidth, G.camera.x));
  G.camera.y = Math.max(0, Math.min(G.world.size - CONFIG.viewHeight, G.camera.y));
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
}

export function render(G) {
  const ctx = G.ctx;
  const cam = G.camera;
  const shakeX = G.shake > 0 ? (G.rng.next() - 0.5) * G.shake : 0;
  const shakeY = G.shake > 0 ? (G.rng.next() - 0.5) * G.shake : 0;

  ctx.save();
  ctx.clearRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
  ctx.translate(-Math.round(cam.x + shakeX), -Math.round(cam.y + shakeY));

  drawGround(G, ctx);
  drawRoads(G, ctx);
  drawParks(G, ctx);
  drawBuildings(G, ctx);
  drawSkids(G, ctx);
  drawPackages(G, ctx);
  drawMarkers(G, ctx);
  drawCars(G, ctx);
  drawPeds(G, ctx);
  drawEnemies(G, ctx);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawParticles(G, ctx);

  ctx.restore();
  drawDayTint(G, ctx);
}

function drawGround(G, ctx) {
  const world = G.world;
  const cam = G.camera;
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(world.size, cam.x + CONFIG.viewWidth + 40);
  const y1 = Math.min(world.size, cam.y + CONFIG.viewHeight + 40);

  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Sand, then the sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, Math.max(y0, CONFIG.beachTop), x1 - x0, Math.max(0, Math.min(y1, CONFIG.waterTop) - Math.max(y0, CONFIG.beachTop)));
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, Math.max(y0, CONFIG.waterTop), x1 - x0, Math.max(0, y1 - Math.max(y0, CONFIG.waterTop)));

  // Gentle waves: moving lighter strokes on the water.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 3;
  const t = G.elapsed * 0.7;
  for (let wy = CONFIG.waterTop + 26; wy < y1; wy += 52) {
    ctx.beginPath();
    for (let wx = x0; wx <= x1; wx += 46) {
      const wave = Math.sin(wx * 0.02 + t + wy * 0.05) * 5;
      if (wx === x0) ctx.moveTo(wx, wy + wave);
      else ctx.lineTo(wx, wy + wave);
    }
    ctx.stroke();
  }
}

function drawRoads(G, ctx) {
  const world = G.world;
  const half = CONFIG.roadWidth / 2;
  // Sidewalks first (a lighter band under the asphalt).
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of world.avenues) {
    ctx.fillRect(ax - half - 12, 0, CONFIG.roadWidth + 24, CONFIG.beachTop);
  }
  for (const sy of world.streets) {
    ctx.fillRect(0, sy - half - 12, world.size, CONFIG.roadWidth + 24);
  }
  // Asphalt.
  ctx.fillStyle = PALETTE.asphalt;
  for (const ax of world.avenues) {
    ctx.fillRect(ax - half, 0, CONFIG.roadWidth, CONFIG.beachTop);
  }
  for (const sy of world.streets) {
    ctx.fillRect(0, sy - half, world.size, CONFIG.roadWidth);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const ax of world.avenues) {
    for (let y = 0; y < CONFIG.beachTop; y += 56) {
      ctx.fillRect(ax - 2, y, 4, 26);
    }
  }
  for (const sy of world.streets) {
    for (let x = 0; x < world.size; x += 56) {
      ctx.fillRect(x, sy - 2, 26, 4);
    }
  }
}

function drawParks(G, ctx) {
  for (const park of G.world.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    for (const tree of park.trees) {
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const tree of G.world.trees) {
    ctx.fillStyle = '#8a6d3b';
    ctx.fillRect(tree.x - 2, tree.y, 4, 10);
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y - 4, tree.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuildings(G, ctx) {
  for (const b of G.world.buildings) {
    // Soft shadow to the south-east, scaled by the building's height.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(b.x + 5 * b.height, b.y + 6 * b.height, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof edge.
    ctx.fillStyle = PALETTE.roof;
    ctx.fillRect(b.x, b.y, b.w, 7);
    ctx.fillRect(b.x, b.y, 7, b.h);
    // Windows: a grid of small lit panes.
    ctx.fillStyle = 'rgba(255, 255, 220, 0.5)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c * 7 + r * 3 + b.w) % 5 === 0) continue;
        ctx.fillRect(b.x + 10 + c * 26, b.y + 12 + r * 26, 10, 12);
      }
    }
  }
}

function drawSkids(G, ctx) {
  ctx.strokeStyle = 'rgba(20, 20, 20, 0.5)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const s of G.skids) {
    ctx.globalAlpha = Math.max(0, s.life / s.maxLife) * 0.55;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPackages(G, ctx) {
  for (const pkg of G.packages) {
    if (pkg.found) continue;
    const bob = Math.sin(G.elapsed * 3 + pkg.index) * 3;
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(pkg.x - 11, pkg.y - 9 + bob, 22, 18);
    ctx.fillStyle = '#c98f4e';
    ctx.fillRect(pkg.x - 11, pkg.y - 9 + bob, 22, 5);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(pkg.x - 2, pkg.y - 9 + bob, 4, 18);
  }
}

function drawMarkers(G, ctx) {
  // The active objective marker: a pulsing ring + beam on the ground.
  const marker = G.activeMarker;
  if (!marker) return;
  const pulse = 1 + Math.sin(G.elapsed * 4) * 0.12;
  const r = 30 * pulse;
  ctx.fillStyle = 'rgba(255, 210, 63, 0.18)';
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, r + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.marker;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
  ctx.stroke();
  // A beam pointing at it from the sky, visible from far away.
  ctx.fillStyle = 'rgba(255, 210, 63, 0.35)';
  ctx.fillRect(marker.x - 4, marker.y - 260, 8, 260);
}

function drawCarBody(G, ctx, car) {
  const hl = CONFIG.carLength / 2;
  const hw = CONFIG.carWidth / 2;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#141414';
  ctx.fillRect(-hl + 6, -hw - 3, 12, 6);
  ctx.fillRect(-hl + 6, hw - 3, 12, 6);
  ctx.fillRect(hl - 16, -hw - 3, 12, 6);
  ctx.fillRect(hl - 16, hw - 3, 12, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -hl, -hw, CONFIG.carLength, CONFIG.carWidth, 7);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
  ctx.fillRect(hl - 18, -hw + 4, 8, CONFIG.carWidth - 8);
  ctx.fillRect(-hl + 8, -hw + 4, 7, CONFIG.carWidth - 8);
  // Roof.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(-hl + 16, -hw + 4, hl - 26, CONFIG.carWidth - 8);
  if (car.taxi) {
    ctx.fillStyle = '#111';
    ctx.fillRect(-4, -hw - 1, 10, 5);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('TAXI', -3, -hw + 7);
  }
  if (car.police) {
    const flash = Math.floor(G.elapsed * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(-2, -hw + 2, 8, 7);
    ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(-2, hw - 9, 8, 7);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('POLICE', -hl + 8, 3);
  }
  ctx.restore();
}

function drawCars(G, ctx) {
  for (const car of G.cars) {
    if (car.dead) continue;
    drawCarBody(G, ctx, car);
  }
}

function drawPeds(G, ctx) {
  for (const ped of G.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(G.elapsed * 8 + ped.x * 0.1) * 1.5;
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(3, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(9 + bob, -3, 5, 6);
    ctx.restore();
  }
}

function drawEnemies(G, ctx) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = '#3a2b2b';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(3, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    // Gun barrel.
    ctx.fillStyle = '#111';
    ctx.fillRect(10, -2, 12, 4);
    ctx.restore();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 14, e.y - 22, 28 * (e.health / CONFIG.enemyHealth), 4);
  }
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (p.inCar) return; // the car shows him
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  ctx.rotate(p.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body + head.
  ctx.fillStyle = PALETTE.playerShirt;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Hair + gun.
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(1, 0, 5, Math.PI * 0.6, Math.PI * 1.5);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(10 + bob, -2, 12, 4);
  ctx.restore();
}

function drawBullets(G, ctx) {
  ctx.fillStyle = '#ffe66d';
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const mz of G.muzzles) {
    ctx.globalAlpha = Math.max(0, mz.life / 0.08);
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.arc(mz.x, mz.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawParticles(G, ctx) {
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawDayTint(G, ctx) {
  const minutes = G.clockMinutes % 1440;
  let tint = null;
  if (minutes < 360 || minutes >= 1200) {
    tint = 'rgba(8, 12, 40, 0.30)'; // night
  } else if (minutes >= 360 && minutes < 450) {
    tint = 'rgba(255, 140, 60, 0.10)'; // dawn
  } else if (minutes >= 1020 && minutes < 1200) {
    tint = 'rgba(255, 110, 40, 0.14)'; // dusk
  }
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
  }
  // Hurt flash.
  if (G.player.hurtCooldown > 0.35) {
    ctx.fillStyle = 'rgba(200, 0, 0, 0.12)';
    ctx.fillRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
  }
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
