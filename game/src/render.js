// Solmar City — everything on screen: the camera, the city, the cars,
// the people, the effects, the light of day and the menu screens.
import { WORLD, PALETTE } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function lightingFor(clock) {
  const hour = ((clock / 60) % 24 + 24) % 24;
  if (hour >= 6 && hour < 17) return null;
  if (hour >= 17 && hour < 19) return { color: '255,110,40', alpha: 0.16 + (hour - 17) * 0.05 };
  if (hour >= 19 && hour < 21) return { color: '40,30,90', alpha: 0.26 };
  return { color: '8,10,44', alpha: 0.38 };
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const body = car.wrecked ? '#2e2e2e' : car.color;
  // Wheels.
  ctx.fillStyle = '#161616';
  ctx.fillRect(-16, -13, 10, 5);
  ctx.fillRect(-16, 8, 10, 5);
  ctx.fillRect(8, -13, 10, 5);
  ctx.fillRect(8, 8, 10, 5);
  // Body.
  ctx.fillStyle = body;
  roundRect(ctx, -23, -11, 46, 22, 6);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = car.wrecked ? '#1c1c1c' : 'rgba(200,225,240,0.85)';
  roundRect(ctx, -6, -8, 16, 16, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,20,26,0.5)';
  ctx.fillRect(-2, -8, 3, 16);
  // Taxi sign.
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-4, -14, 10, 5);
  }
  // Police light bar, flashing.
  if (car.kind === 'police' && !car.wrecked) {
    const red = Math.floor(time * 5) % 2 === 0;
    ctx.fillStyle = red ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-8, -13, 8, 4);
    ctx.fillStyle = red ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(0, -13, 8, 4);
  }
  ctx.restore();
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(car.x - 10, car.y - 6, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPed(ctx, ped) {
  if (ped.down > 0) {
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 9, 4, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4, 0, Math.PI * 2);
  ctx.fill();
  if (ped.taxi) {
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', ped.x, ped.y - 14);
    ctx.textAlign = 'left';
  }
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2b3a4d';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(3, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol direction.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.aim - p.angle) * 18, Math.sin(p.aim - p.angle) * 18);
  ctx.stroke();
  ctx.restore();
}

function drawParticles(ctx, G, dt) {
  for (const pt of G.particles) {
    const frac = pt.life / pt.max;
    if (pt.kind === 'flash') {
      ctx.fillStyle = `rgba(255,240,150,${frac})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 10 * frac + 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,180,60,${frac})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'hit') {
      ctx.fillStyle = `rgba(255,70,50,${frac})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'puff' || pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(120,120,120,${frac * 0.5})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 + (1 - frac) * 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'fire') {
      ctx.fillStyle = `rgba(255,${Math.floor(120 + frac * 100)},30,${frac})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5 + (1 - frac) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pt.vx !== undefined) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
}

export function drawGame(ctx, G, dt) {
  const view = G.view;
  const cam = G.camera;
  ctx.fillStyle = '#101318';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  const shakeX = (Math.random() - 0.5) * cam.shake;
  const shakeY = (Math.random() - 0.5) * cam.shake;
  ctx.translate(view.w / 2 - cam.x + shakeX, view.h / 2 - cam.y + shakeY);
  const vx0 = cam.x - view.w / 2 - 60;
  const vy0 = cam.y - view.h / 2 - 60;
  const vx1 = cam.x + view.w / 2 + 60;
  const vy1 = cam.y + view.h / 2 + 60;
  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Block tint checker for texture.
  ctx.fillStyle = PALETTE.grassAlt;
  for (let bi = 0; bi < WORLD.avenues - 1; bi++) {
    for (let bj = 0; bj < WORLD.streets - 1; bj++) {
      if ((bi + bj) % 2 === 0) {
        ctx.fillRect(
          bi * WORLD.pitch + WORLD.road / 2,
          bj * WORLD.pitch + WORLD.road / 2,
          WORLD.pitch - WORLD.road,
          WORLD.pitch - WORLD.road,
        );
      }
    }
  }
  // Beach and sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(WORLD.beachX, 0, WORLD.w - WORLD.beachX, WORLD.h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WORLD.waterX, 0, WORLD.w - WORLD.waterX, WORLD.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = 60; y < WORLD.h; y += 130) {
    ctx.beginPath();
    ctx.moveTo(WORLD.waterX + 20 + Math.sin(y * 0.05 + G.time) * 8, y);
    ctx.quadraticCurveTo(WORLD.waterX + 70, y + 14, WORLD.waterX + 120, y);
    ctx.stroke();
  }
  // Sidewalks then roads.
  for (const r of G.world.roads) {
    ctx.fillStyle = PALETTE.sidewalk;
    if (r.vertical) ctx.fillRect(r.x - 10, r.y, r.w + 20, r.h);
    else ctx.fillRect(r.x, r.y - 10, r.w, r.h + 20);
  }
  for (const r of G.world.roads) {
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  // Road centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (let i = 0; i < WORLD.avenues; i++) {
    const x = i * WORLD.pitch;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, (WORLD.streets - 1) * WORLD.pitch);
  }
  for (let j = 0; j < WORLD.streets; j++) {
    const y = j * WORLD.pitch;
    ctx.moveTo(0, y);
    ctx.lineTo((WORLD.avenues - 1) * WORLD.pitch, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Parks.
  for (const park of G.world.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    for (const t of park.trees) {
      ctx.fillStyle = '#4a7d33';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d9c40';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Plaza + fountain.
  const pz = G.world.plaza;
  ctx.fillStyle = PALETTE.plaza;
  ctx.fillRect(pz.x, pz.y, pz.w, pz.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(pz.x + (pz.w / 4) * i, pz.y);
    ctx.lineTo(pz.x + (pz.w / 4) * i, pz.y + pz.h);
    ctx.stroke();
  }
  ctx.fillStyle = '#7fb8d8';
  ctx.beginPath();
  ctx.arc(G.world.fountain.x, G.world.fountain.y, G.world.fountain.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8eef8';
  ctx.beginPath();
  ctx.arc(G.world.fountain.x, G.world.fountain.y, G.world.fountain.r - 8, 0, Math.PI * 2);
  ctx.fill();
  // Dockside containers.
  for (const c of G.world.containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }
  // Pier.
  const pier = G.world.pier;
  ctx.fillStyle = PALETTE.pier;
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let x = pier.x + 20; x < pier.x + pier.w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, pier.y);
    ctx.lineTo(x, pier.y + pier.h);
    ctx.stroke();
  }
  // Buildings.
  for (const b of G.world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, Math.min(26, b.h - 10));
    const night = lightingFor(G.clock) !== null;
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let ci = 0; ci < cols; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        const lit = night && (ci * 7 + ri * 3 + Math.floor(b.x)) % 3 === 0;
        ctx.fillStyle = lit ? '#ffd97a' : 'rgba(40,50,70,0.55)';
        ctx.fillRect(b.x + 10 + ci * 26, b.y + 34 + ri * 30, 12, 14);
      }
    }
    if (b.name) {
      ctx.fillStyle = '#222';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h - 10);
      ctx.textAlign = 'left';
    }
  }
  // Landmark labels.
  ctx.fillStyle = 'rgba(20,20,26,0.8)';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  for (const lm of G.world.landmarks) {
    if (lm.kind === 'garage' || lm.kind === 'hotel') continue;
    ctx.fillText(lm.name, lm.x, lm.y - 26);
  }
  ctx.textAlign = 'left';
  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = 4;
  for (const s of G.skids) {
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
    ctx.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
    ctx.stroke();
  }
  // Hidden packages.
  for (const pack of G.world.packages) {
    if (pack.found) continue;
    const pulse = 0.6 + Math.sin(G.time * 4 + pack.x) * 0.4;
    ctx.fillStyle = `rgba(123,224,123,${pulse})`;
    ctx.beginPath();
    ctx.arc(pack.x, pack.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(pack.x - 7, pack.y - 6, 14, 12);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(pack.x - 7, pack.y - 2, 14, 3);
  }
  // Mission marker beacon.
  const target = G.mission.target || (G.taxi.rider ? G.taxi.dest : null);
  if (target) {
    const pulse = 0.5 + Math.sin(G.time * 5) * 0.3;
    ctx.fillStyle = `rgba(255,217,74,${0.25 * pulse})`;
    ctx.fillRect(target.x - 4, target.y - 260, 8, 260);
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 26 + Math.sin(G.time * 5) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Entities.
  for (const car of G.cars) drawCar(ctx, car, G.time);
  for (const ped of G.peds) drawPed(ctx, ped);
  for (const e of G.enemies) {
    if (e.dead) continue;
    ctx.fillStyle = '#8e2f26';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20);
    ctx.stroke();
    bar(ctx, e.x - 14, e.y - 24, 28, 4, e.health / 50, '#e04040', '#222');
  }
  drawPlayer(ctx, G);
  // Bullets.
  for (const b of G.bullets) {
    ctx.strokeStyle = '#ffe97a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  drawParticles(ctx, G, dt);
  ctx.restore();
  // Day/dusk/night tint over the whole screen.
  const light = lightingFor(G.clock);
  if (light) {
    ctx.fillStyle = `rgba(${light.color},${light.alpha})`;
    ctx.fillRect(0, 0, view.w, view.h);
  }
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function screenBase(ctx, G) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
}

export function drawTitleScreen(ctx, G) {
  screenBase(ctx, G);
  const W = G.view.w;
  const H = G.view.h;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR CITY', W / 2, H / 2 - 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in the sun', W / 2, H / 2 - 52);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#dddddd';
  ctx.fillText('Rio Vega is back in town. Mara needs a driver. The city is yours.', W / 2, H / 2 - 20);
  ctx.fillStyle = '#7be07b';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Click or press Enter to play', W / 2, H / 2 + 30);
  ctx.fillStyle = '#bbbbbb';
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD move / drive · E enter car · Space handbrake · F punch · click shoot', W / 2, H / 2 + 62);
  ctx.fillText('R reload · P pause · M music · N start the next mission', W / 2, H / 2 + 84);
  if (G.save.money > 0 || G.save.missionsDone.length > 0) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = '14px sans-serif';
    ctx.fillText(
      `Welcome back — $${G.save.money} saved · ${G.save.missionsDone.length} of 4 missions done · ${G.save.packagesFound.length} packages found`,
      W / 2,
      H / 2 + 116,
    );
  }
  ctx.textAlign = 'left';
}

export function drawPauseScreen(ctx, G) {
  screenBase(ctx, G);
  const W = G.view.w;
  const H = G.view.h;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#dddddd';
  ctx.fillText('P to resume · M music on/off', W / 2, H / 2 + 14);
  ctx.fillText(`Money $${G.player.money} · Missions ${G.mission.done.length}/4 · Packages ${G.world.packages.filter((p) => p.found).length}/10`, W / 2, H / 2 + 40);
  ctx.textAlign = 'left';
}

export function drawGameOverScreen(ctx, G) {
  screenBase(ctx, G);
  const W = G.view.w;
  const H = G.view.h;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6a5a';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('WASTED', W / 2, H / 2 - 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Rio is down — but Solmar never sleeps.', W / 2, H / 2 + 4);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Press Enter to get back up', W / 2, H / 2 + 44);
  ctx.textAlign = 'left';
}

export function drawPassedScreen(ctx, G) {
  screenBase(ctx, G);
  const W = G.view.w;
  const H = G.view.h;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7be07b';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('MISSION PASSED', W / 2, H / 2 - 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText(G.passedTitle, W / 2, H / 2 + 6);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`+$${G.passedReward}`, W / 2, H / 2 + 38);
  ctx.fillStyle = '#dddddd';
  ctx.font = '15px sans-serif';
  ctx.fillText('Press N for the next mission, or Enter to keep driving', W / 2, H / 2 + 70);
  ctx.textAlign = 'left';
}
