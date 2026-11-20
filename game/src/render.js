// World rendering: camera, streets, buildings, beach, cars, people,
// effects and the day-time lighting tint.
import { CFG, AVE_X, ST_Y, PAL, blockRect, LANDMARKS } from './config.js';

// Smooth-follow camera; in screenshot mode it snaps dead-on.
export function updateCamera(G, dt) {
  const P = G.player;
  const snap = !!G.shot;
  if (snap) {
    G.cam.x = P.x;
    G.cam.y = P.y;
  } else {
    const k = 1 - Math.exp(-5.5 * dt);
    G.cam.x += (P.x - G.cam.x) * k;
    G.cam.y += (P.y - G.cam.y) * k;
  }
  if (G.cam.shake > 0) {
    G.cam.shake = Math.max(0, G.cam.shake - dt * 26);
  }
}

function cameraOffset(G) {
  const s = G.cam.shake;
  if (s <= 0.2) return { x: 0, y: 0 };
  return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
}

export function drawWorld(G, ctx, canvas) {
  const W = canvas.width;
  const H = canvas.height;
  updateCamera(G, 0); // camera already stepped in update(); snap only
  const off = cameraOffset(G);
  const camX = G.cam.x - W / 2 + off.x;
  const camY = G.cam.y - H / 2 + off.y;
  ctx.save();
  ctx.translate(-camX, -camY);
  drawGround(G, ctx);
  drawRoads(G, ctx);
  drawBlocks(G, ctx);
  drawSkids(G, ctx);
  drawPackages(G, ctx);
  drawCars(G, ctx);
  drawPeds(G, ctx);
  drawEnemies(G, ctx);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawParticles(G, ctx);
  ctx.restore();
  drawLightingTint(G, ctx, W, H);
}

function drawGround(G, ctx) {
  // Base: dry coastal grass.
  ctx.fillStyle = PAL.grassDry;
  ctx.fillRect(0, 0, CFG.WORLD_W, CFG.WORLD_H);
  // City limits: a visible hedge line around the map edge, so the
  // boundary reads as part of the world instead of an invisible wall.
  ctx.fillStyle = '#2f4a26';
  ctx.fillRect(0, 0, CFG.WORLD_W, 10);
  ctx.fillRect(0, 0, 10, CFG.WORLD_H);
  ctx.fillRect(CFG.WORLD_W - 10, 0, 10, CFG.WORLD_H);
  ctx.fillStyle = '#3f6136';
  for (let x = 20; x < CFG.WORLD_W; x += 90) ctx.fillRect(x, 0, 34, 10);
  for (let y = 20; y < CFG.WORLD_H; y += 90) ctx.fillRect(0, y, 10, 34);
  for (let y = 20; y < CFG.WORLD_H; y += 90) ctx.fillRect(CFG.WORLD_W - 10, y, 10, 34);
  // Beach sand, then the sea at the south edge.
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(0, CFG.BEACH_Y, CFG.WORLD_W, CFG.WATER_Y - CFG.BEACH_Y);
  ctx.fillStyle = PAL.water;
  ctx.fillRect(0, CFG.WATER_Y, CFG.WORLD_W, CFG.WORLD_H - CFG.WATER_Y);
  ctx.fillStyle = PAL.waterDeep;
  for (let x = 40; x < CFG.WORLD_W; x += 260) {
    ctx.fillRect(x, CFG.WATER_Y + 34, 150, 4);
    ctx.fillRect(x + 90, CFG.WATER_Y + 62, 120, 4);
  }
  // The pier walks out over the water.
  const pier = LANDMARKS[3];
  ctx.fillStyle = PAL.pier;
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.fillStyle = '#6b4f33';
  for (let y = pier.y + 12; y < pier.y + pier.h; y += 22) {
    ctx.fillRect(pier.x, y, pier.w, 3);
  }
  ctx.fillStyle = '#f2efe6';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('SOLMAR PIER', pier.x - 22, pier.y + pier.h + 18);
}

function drawRoads(G, ctx) {
  ctx.fillStyle = PAL.road;
  for (let i = 0; i < CFG.AVES; i++) {
    ctx.fillRect(AVE_X(i) - CFG.ROAD_W / 2, 0, CFG.ROAD_W, CFG.BEACH_Y);
  }
  for (let j = 0; j < CFG.STS; j++) {
    ctx.fillRect(0, ST_Y(j) - CFG.ROAD_W / 2, CFG.WORLD_W, CFG.ROAD_W);
  }
  // Centre dashes.
  ctx.fillStyle = PAL.roadLine;
  for (let i = 0; i < CFG.AVES; i++) {
    for (let y = 20; y < CFG.BEACH_Y; y += 56) {
      ctx.fillRect(AVE_X(i) - 2, y, 4, 26);
    }
  }
  for (let j = 0; j < CFG.STS; j++) {
    for (let x = 20; x < CFG.WORLD_W; x += 56) {
      ctx.fillRect(x, ST_Y(j) - 2, 26, 4);
    }
  }
}

function drawBlocks(G, ctx) {
  // Sidewalk slabs, then parks, then buildings with a soft shadow.
  for (let i = 0; i < CFG.AVES - 1; i++) {
    for (let j = 0; j < CFG.STS - 1; j++) {
      const cell = blockRect(i, j, 4);
      ctx.fillStyle = PAL.sidewalk;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    }
  }
  for (const p of G.world.parks) {
    ctx.fillStyle = PAL.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = PAL.tree;
    for (const t of p.trees) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8f0d8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(p.name.toUpperCase(), p.x + 10, p.y + 18);
  }
  for (const b of G.world.buildings) {
    // Drop shadow, offset by the building's height.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + b.h * 0.4, b.y + b.h * 0.55, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Roof details: a lighter inner slab.
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, Math.max(6, b.h - 16));
  }
  // Landmark labels on their roofs.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText("MARA'S GARAGE", LANDMARKS[0].x + 8, LANDMARKS[0].y + 24);
  ctx.fillText('THE MERIDIAN', LANDMARKS[2].x + 8, LANDMARKS[2].y + 24);
  ctx.fillText('DOCKSIDE YARDS', LANDMARKS[4].x + 8, LANDMARKS[4].y + 24);
}

function drawSkids(G, ctx) {
  for (const s of G.skids) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, s.life / 5);
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-14, -11, 28, 4);
    ctx.fillRect(-14, 7, 28, 4);
    ctx.restore();
  }
}

function drawPackages(G, ctx) {
  for (const p of G.world.pkgSpots) {
    if (p.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(G.time * 4 + p.x);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(p.x - 9, p.y - 9, 18, 18);
    ctx.fillStyle = '#8a6b1f';
    ctx.fillRect(p.x - 9, p.y - 2, 18, 4);
    ctx.fillRect(p.x - 2, p.y - 9, 4, 18);
    ctx.restore();
  }
}

function drawCars(G, ctx) {
  for (const car of G.cars) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-22, -9, 48, 26);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-24, -12, 48, 24, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -10, 18, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 240, 0.5)';
    ctx.fillRect(8, -9, 4, 18);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(22, -10, 3, 5);
    ctx.fillRect(22, 5, 3, 5);
    // Police light bar, flashing red/blue.
    if (car.kind === 'police') {
      const blink = Math.floor(G.time * 5 + car.id) % 2 === 0;
      ctx.fillStyle = blink ? '#ff3b30' : '#3b82f6';
      ctx.fillRect(-4, -12, 8, 5);
      ctx.fillStyle = blink ? '#3b82f6' : '#ff3b30';
      ctx.fillRect(-4, 7, 8, 5);
    }
    // The player's car gets a white roof marker.
    if (car.kind === 'player') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-2, -3, 5, 6);
    }
    ctx.restore();
  }
}

function drawPeds(G, ctx) {
  for (const ped of G.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down) {
      // Lying flat.
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    // Shadow + body.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 8, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 + bob * 0.3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // A waiting taxi fare waves a green arm.
    if (ped.state === 'fare') {
      ctx.strokeStyle = '#7ee787';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(10, -14 + Math.sin(G.time * 6) * 4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawEnemies(G, ctx) {
  for (const e of G.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    // Gun barrel + health bar.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(e.angle) * 20, Math.sin(e.angle) * 20);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(-12, -20, 24, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-12, -20, 24 * Math.max(0, e.hp / 60), 4);
    ctx.restore();
  }
}

function drawPlayer(G, ctx) {
  const P = G.player;
  if (P.car) return; // the car drawing shows the driver
  ctx.save();
  ctx.translate(P.x, P.y);
  const bob = Math.sin(P.walkPhase) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rio: teal jacket, dark jeans.
  ctx.fillStyle = '#0e7c7b';
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(P.angle) * 4, Math.sin(P.angle) * 4 + bob * 0.3, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand, pointing at the aim.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(P.aimAngle) * 18, Math.sin(P.aimAngle) * 18);
  ctx.stroke();
  ctx.restore();
}

function drawBullets(G, ctx) {
  ctx.save();
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.strokeStyle = b.from === 'player' ? '#ffd76a' : '#ff8a7a';
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(G, ctx) {
  for (const p of G.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Sun-soaked by day, orange at dusk, deep blue at night.
function drawLightingTint(G, ctx, W, H) {
  const h = G.clockHours % 24;
  let color = null;
  if (h >= 17.5 && h < 19.5) {
    color = 'rgba(255, 122, 40, 0.16)';
  } else if (h >= 19.5 || h < 6) {
    color = 'rgba(12, 18, 54, 0.34)';
  } else if (h >= 6 && h < 7.5) {
    color = 'rgba(255, 170, 90, 0.10)';
  }
  if (color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
