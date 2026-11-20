// HUD: health, money, wanted stars, objective, clock, dialogue,
// minimap, crosshair and ammo — all drawn on the game canvas.
import { CFG, AVE_X, ST_Y } from './config.js';
import { wantedStars } from './police.js';

export function drawHUD(G, ctx, canvas) {
  const W = canvas.width;
  const H = canvas.height;
  ctx.save();
  ctx.textBaseline = 'top';
  // Health bar + money, top left.
  const P = G.player;
  ctx.fillStyle = 'rgba(10, 12, 16, 0.55)';
  ctx.fillRect(14, 14, 210, 64);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 24, 150, 14);
  const hpW = Math.max(0, (P.hp / 100) * 150);
  ctx.fillStyle = P.hp > 50 ? '#2ecc71' : P.hp > 25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(24, 24, hpW, 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HP ' + Math.ceil(P.hp), 180, 24);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#f2c14e';
  ctx.fillText('$' + Math.round(G.money).toLocaleString('en-US'), 24, 44);
  // Wanted stars, top left under the money.
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = G.wanted > 0 ? '#ffd21f' : 'rgba(255,255,255,0.35)';
  ctx.fillText(wantedStars(G), 14, 84);
  // Objective, top centre.
  if (G.objective) {
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(G.objective).width;
    ctx.fillStyle = 'rgba(10, 12, 16, 0.6)';
    ctx.fillRect(W / 2 - tw / 2 - 12, 12, tw + 24, 28);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(G.objective, W / 2 - tw / 2, 19);
  }
  // Clock, top right above the minimap.
  const hh = Math.floor(G.clockHours) % 24;
  const mm = Math.floor((G.clockHours % 1) * 60);
  const clockStr = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(clockStr, W - 70, 14);
  // Packages + taxi, under the clock.
  const taken = G.world.pkgSpots.filter((p) => p.taken).length;
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#f2c14e';
  ctx.fillText('◆ Packages ' + taken + '/10', W - 150, 40);
  if (G.taxi.state === 'riding') {
    ctx.fillStyle = '#7ee787';
    ctx.fillText('TAXI $' + G.taxi.fare, W - 150, 58);
  }
  // Mission timer, centre under the objective.
  if (G.mission.active && G.mission.idx === 2) {
    const t = Math.max(0, Math.ceil(G.mission.timer));
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = t <= 15 ? '#ff5a4e' : '#fff';
    ctx.fillText('⏱ ' + t + 's', W / 2 - 30, 46);
  }
  drawMinimap(G, ctx, W, H);
  // Dialogue box, bottom centre.
  if (G.dialogue && G.dialogue.t > 0) {
    const text = G.dialogue.name + ': ' + G.dialogue.text;
    ctx.font = '15px sans-serif';
    const tw = Math.min(ctx.measureText(text).width, W - 120);
    ctx.fillStyle = 'rgba(10, 12, 16, 0.72)';
    ctx.fillRect(W / 2 - tw / 2 - 14, H - 92, tw + 28, 34);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, W / 2 - tw / 2, H - 84);
  }
  // Crosshair + ammo, on foot with the pistol out. Clamped on-screen:
  // the mouse can sit at a corner, where the raw position would clip.
  if (G.mode === 'playing' && P.onFoot) {
    const mx = Math.max(12, Math.min(W - 12, G.input.mouseX));
    const my = Math.max(12, Math.min(H - 12, G.input.mouseY));
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx - 9, my);
    ctx.lineTo(mx + 9, my);
    ctx.moveTo(mx, my - 9);
    ctx.lineTo(mx, my + 9);
    ctx.stroke();
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#fff';
    const ammo = P.gun.reloading > 0 ? 'RELOADING…' : 'AMMO ' + P.gun.ammo + '/' + CFG.PISTOL_MAG;
    const aw = ctx.measureText(ammo).width;
    let ax = mx + 16;
    if (ax + aw > W - 8) ax = mx - 16 - aw;
    let ay = my - 8;
    if (ay < 10) ay = my + 14;
    ctx.fillText(ammo, ax, ay);
  }
  // Controls hint, bottom left (fades after the first minute).
  if (G.time < 60) {
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('WASD move / drive · E enter car · Space handbrake · Click shoot · F punch · R reload · P pause · M music', 14, H - 22);
  }
  // Car speed, bottom right while driving.
  if (P.car) {
    const kmh = Math.round(Math.abs(P.car.speed) * 0.36);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(kmh + ' km/h', W - 130, H - 34);
  }
  ctx.restore();
}

// Live minimap: the whole city in a 176px box, top right.
export function drawMinimap(G, ctx, W, H) {
  const size = 176;
  const x0 = W - size - 14;
  const y0 = 66;
  const sx = size / CFG.WORLD_W;
  const sy = size / CFG.WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 10, 0.72)';
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
  // Water strip at the bottom.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(x0, y0 + CFG.WATER_Y * sy, size, size - CFG.WATER_Y * sy);
  // Roads.
  ctx.strokeStyle = '#9aa0a8';
  ctx.lineWidth = 2;
  for (let i = 0; i < CFG.AVES; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + AVE_X(i) * sx, y0);
    ctx.lineTo(x0 + AVE_X(i) * sx, y0 + size);
    ctx.stroke();
  }
  for (let j = 0; j < CFG.STS; j++) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ST_Y(j) * sy);
    ctx.lineTo(x0 + size, y0 + ST_Y(j) * sy);
    ctx.stroke();
  }
  // Parks.
  ctx.fillStyle = '#4c7a3f';
  for (const p of G.world.parks) {
    ctx.fillRect(x0 + p.x * sx, y0 + p.y * sy, Math.max(2, p.w * sx), Math.max(2, p.h * sy));
  }
  // Packages.
  ctx.fillStyle = '#f2c14e';
  for (const p of G.world.pkgSpots) {
    if (p.taken) continue;
    ctx.fillRect(x0 + p.x * sx - 2, y0 + p.y * sy - 2, 4, 4);
  }
  // Mission target.
  const M = G.mission;
  if (M.active && M.target) {
    const tx = x0 + M.target.x * sx;
    const ty = y0 + M.target.y * sy;
    ctx.strokeStyle = '#ff5ad0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff5ad0';
    ctx.beginPath();
    ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Taxi fare.
  if (G.taxi.state === 'waiting' && G.taxi.ped) {
    ctx.fillStyle = '#7ee787';
    ctx.fillRect(x0 + G.taxi.ped.x * sx - 3, y0 + G.taxi.ped.y * sy - 3, 6, 6);
  }
  if (G.taxi.state === 'riding' && G.taxi.dest) {
    ctx.fillStyle = '#7ee787';
    ctx.fillRect(x0 + G.taxi.dest.x * sx - 3, y0 + G.taxi.dest.y * sy - 3, 6, 6);
  }
  // Traffic cars, police, player.
  ctx.fillStyle = '#f1c40f';
  for (const c of G.cars) {
    if (c.kind === 'traffic') ctx.fillRect(x0 + c.x * sx - 1, y0 + c.y * sy - 1, 2, 2);
  }
  ctx.fillStyle = '#3b82f6';
  for (const c of G.cops) {
    const blink = Math.floor(G.time * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#3b82f6';
    ctx.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4);
  }
  const P = G.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + P.x * sx, y0 + P.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- Full-screen menus ---

function overlayPanel(ctx, W, H, title, lines, footer) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 10, 14, 0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(title, W / 2, H * 0.2);
  ctx.fillStyle = '#f2efe6';
  ctx.font = '17px sans-serif';
  let y = H * 0.2 + 76;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 30;
  }
  if (footer) {
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(footer, W / 2, y + 22);
  }
  ctx.restore();
}

export function drawStartScreen(G, ctx, canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const done = G.missionDone.filter(Boolean).length;
  overlayPanel(ctx, W, H, 'SOLMAR CITY', [
    'A sun-soaked open-world crime game — Rio Vega is back in Solmar,',
    'and Mara needs a driver. Explore the city on foot and by car,',
    'steal rides, dodge the police, run fares and finish the story.',
    '',
    `Story missions completed: ${done} / 4    •    Money: $${Math.round(G.money)}`,
    '',
    'WASD move / drive   •   E enter & exit car   •   Space handbrake',
    'Mouse aim, click to shoot   •   F punch   •   R reload',
    'P pause   •   M music   •   N next story mission',
  ], 'Press ENTER to start');
}

export function drawPauseScreen(G, ctx, canvas) {
  overlayPanel(ctx, canvas.width, canvas.height, 'PAUSED', [
    'Rio is taking a breather.',
    '',
    `Money: $${Math.round(G.money)}    •    Missions: ${G.missionDone.filter(Boolean).length} / 4`,
    `Packages: ${G.world.pkgSpots.filter((p) => p.taken).length} / 10    •    Fares: ${G.stats.fares}`,
    '',
    'Progress saves automatically to this browser.',
  ], 'Press P to keep playing');
}

export function drawGameOverScreen(G, ctx, canvas) {
  const cause = G.deathCause === 'shot' ? 'gunned down' : G.deathCause === 'rammed' ? 'run down by the police' : 'wrecked';
  overlayPanel(ctx, canvas.width, canvas.height, 'BUSTED OUT', [
    `Rio got ${cause} in the streets of Solmar.`,
    'The medics patched him up at Plaza del Sol — $100 lighter.',
    '',
    `Money: $${Math.round(G.money)}`,
  ], 'Press ENTER to get back up');
}

export function drawPassedScreen(G, ctx, canvas) {
  const def = G.passedMission;
  const next = G.missionDone.findIndex((d) => !d);
  overlayPanel(ctx, canvas.width, canvas.height, 'MISSION PASSED', [
    `${def.name} — complete.`,
    `Reward: $${def.reward}.`,
    next >= 0 ? 'The next job is waiting when you are.' : 'That was the last job. Solmar is yours, Rio.',
  ], next >= 0 ? 'Press ENTER for the next mission' : 'Press ENTER to free roam');
}

export function drawFailedScreen(G, ctx, canvas) {
  overlayPanel(ctx, canvas.width, canvas.height, 'MISSION FAILED', [
    G.failReason || 'The job went sideways.',
    '',
    'Mara is not happy. Try it again.',
  ], 'Press ENTER to retry');
}
