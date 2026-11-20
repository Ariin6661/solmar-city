// The HUD and the menus — everything drawn in screen space after the
// world: money, health, wanted stars, the clock, the objective line,
// the live minimap, dialogue, and the title / pause / dead screens.

import { CONFIG, PALETTE } from './config.js';
import { wantedStars } from './police.js';
import { missionMarker, taxiMarker, nextMissionId } from './missions.js';

export function drawHud(G) {
  const ctx = G.ctx;
  ctx.save();

  // Top-left: cash and health.
  panel(ctx, 14, 12, 210, 64);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`$${G.player.money.toLocaleString('en-US')}`, 26, 20);
  const hw = 186;
  const hp = Math.max(0, G.player.health / CONFIG.playerHealth);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(26, 52, hw, 10);
  ctx.fillStyle = hp > 0.3 ? PALETTE.health : PALETTE.healthLow;
  ctx.fillRect(26, 52, hw * hp, 10);

  // Top-right: wanted stars and the clock.
  const stars = wantedStars(G);
  panel(ctx, CONFIG.viewWidth - 224, 12, 210, 64);
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < CONFIG.maxWanted; i++) {
    ctx.fillStyle = i < stars ? PALETTE.star : PALETTE.starEmpty;
    ctx.fillText('\u2605', CONFIG.viewWidth - 212 + i * 26, 20);
  }
  const hh = Math.floor(G.clockMinutes / 60) % 24;
  const mm = Math.floor(G.clockMinutes % 60);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, CONFIG.viewWidth - 86, 52);

  // Top-centre: the current objective.
  const objective = currentObjective(G);
  if (objective) {
    ctx.font = 'bold 17px sans-serif';
    const w = ctx.measureText(objective).width + 28;
    panel(ctx, (CONFIG.viewWidth - w) / 2, 12, w, 34);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(objective, CONFIG.viewWidth / 2, 20);
    if (G.mission && G.mission.id === 2 && G.mission.step === 1) {
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = G.mission.timer < 15 ? '#ff5a5a' : PALETTE.marker;
      ctx.fillText(`${Math.ceil(G.mission.timer)}s`, CONFIG.viewWidth / 2, 52);
    }
  }

  // Crosshair + ammo, on foot. The aim point is the mouse in world space,
  // so the crosshair sits where the bullets will go.
  if (!G.player.inCar && G.state === 'playing') {
    const mx = G.input.aimX - G.camera.x;
    const my = G.input.aimY - G.camera.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my);
    ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my);
    ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13);
    ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5);
    ctx.lineTo(mx, my + 13);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    const ammoText = G.player.reloading > 0 ? 'RELOADING…' : `AMMO ${G.player.ammo}/${CONFIG.pistolAmmo}`;
    ctx.fillText(ammoText, mx + 18, my - 8);
  }

  // Bottom-centre: the one control that matters right now.
  const hint = contextHint(G);
  if (hint && G.state === 'playing') {
    ctx.font = '15px sans-serif';
    const w = ctx.measureText(hint).width + 24;
    panel(ctx, (CONFIG.viewWidth - w) / 2, CONFIG.viewHeight - 40, w, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(hint, CONFIG.viewWidth / 2, CONFIG.viewHeight - 32);
  }

  // Dialogue line, above the hint.
  if (G.dialogue && G.dialogueTime > 0) {
    ctx.font = 'italic 17px sans-serif';
    const w = Math.min(CONFIG.viewWidth - 120, ctx.measureText(G.dialogue).width + 32);
    panel(ctx, (CONFIG.viewWidth - w) / 2, CONFIG.viewHeight - 84, w, 32);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(G.dialogue, CONFIG.viewWidth / 2, CONFIG.viewHeight - 76);
  }

  drawMinimap(G, ctx);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function currentObjective(G) {
  if (G.mission) return `${G.mission.def.title} — ${G.mission.objective}`;
  if (G.taxiFare) {
    return G.taxiFare.state === 'toPassenger'
      ? 'Taxi fare — pick up the passenger'
      : `Taxi fare — drop off the passenger ($${G.taxiFare.reward})`;
  }
  const next = nextMissionId(G);
  if (next !== null) return `Next job: ${['Borrowed Wheels', 'The Pickup', 'Beat the Clock', 'Dockside Standoff'][next]} — drive to Mara\u2019s Garage`;
  return 'Solmar City — free roam. Find packages, run fares, stay out of trouble.';
}

function contextHint(G) {
  if (G.player.inCar) return 'W A S D drive · Space handbrake · E get out · M music';
  const nearCar = G.nearestCarHere;
  if (nearCar) return 'E — get in the car';
  return 'W A S D move · Shift run · Mouse aim · Click shoot · Space punch · E enter car';
}

// ---- Minimap ----

function drawMinimap(G, ctx) {
  const size = CONFIG.minimapSize;
  const x0 = 14;
  const y0 = CONFIG.viewHeight - size - 14;
  const scale = size / CONFIG.minimapRange;
  const px = G.player.x;
  const py = G.player.y;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, size, size, 10);
  ctx.clip();

  // Ground.
  ctx.fillStyle = '#6d9c4e';
  ctx.fillRect(x0, y0, size, size);
  // Sea.
  const seaTop = (CONFIG.waterTop - (py - CONFIG.minimapRange / 2)) * scale;
  if (seaTop < size) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, y0 + Math.max(0, seaTop), size, size);
  }
  // Roads.
  ctx.strokeStyle = '#3a3f46';
  ctx.lineWidth = Math.max(2, CONFIG.roadWidth * scale);
  for (const ax of G.world.avenues) {
    const sx = x0 + (ax - (px - CONFIG.minimapRange / 2)) * scale;
    ctx.beginPath();
    ctx.moveTo(sx, y0);
    ctx.lineTo(sx, y0 + size);
    ctx.stroke();
  }
  for (const sy of G.world.streets) {
    const sy2 = y0 + (sy - (py - CONFIG.minimapRange / 2)) * scale;
    ctx.beginPath();
    ctx.moveTo(x0, sy2);
    ctx.lineTo(x0 + size, sy2);
    ctx.stroke();
  }
  // Buildings as small blocks.
  ctx.fillStyle = 'rgba(30, 30, 30, 0.55)';
  for (const b of G.world.buildings) {
    const bx = x0 + (b.x - (px - CONFIG.minimapRange / 2)) * scale;
    const by = y0 + (b.y - (py - CONFIG.minimapRange / 2)) * scale;
    if (bx > x0 - 20 && bx < x0 + size + 20 && by > y0 - 20 && by < y0 + size + 20) {
      ctx.fillRect(bx, by, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
    }
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + (wx - (px - CONFIG.minimapRange / 2)) * scale, y0 + (wy - (py - CONFIG.minimapRange / 2)) * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Objective marker (mission first, then taxi).
  const marker = missionMarker(G) || taxiMarker(G);
  if (marker) {
    const mx = x0 + (marker.x - (px - CONFIG.minimapRange / 2)) * scale;
    const my = y0 + (marker.y - (py - CONFIG.minimapRange / 2)) * scale;
    ctx.fillStyle = PALETTE.marker;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  // Cars and police.
  for (const car of G.cars) {
    if (car.driver === 'player') continue;
    dot(car.x, car.y, car.police ? '#3a7bff' : 'rgba(255,255,255,0.75)', car.police ? 4 : 2.5);
  }
  // The player, centre, as a triangle pointing where he faces.
  ctx.save();
  ctx.translate(x0 + size / 2, y0 + size / 2);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
  // Frame + north tick.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x0, y0, size, size, 10);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + size / 2, y0 - 4);
}

// ---- Menus ----

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(8, 10, 18, ${alpha})`;
  ctx.fillRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, CONFIG.viewWidth / 2, y);
}

export function drawTitle(G) {
  const ctx = G.ctx;
  overlay(ctx, 0.55);
  centerText(ctx, 'SOLMAR CITY', 130, 'bold 84px sans-serif', '#ffd23f');
  centerText(ctx, 'an open-world crime story', 226, 'italic 24px sans-serif', '#ffffff');
  centerText(ctx, 'Rio Vega is back in Solmar — and the city does not forget a debt.', 280, '18px sans-serif', 'rgba(255,255,255,0.85)');
  const hasSave = !!G.saveData;
  centerText(ctx, hasSave ? 'ENTER — continue your story' : 'ENTER — start a new story', 360, 'bold 22px sans-serif', '#ffffff');
  centerText(ctx, 'WASD move / drive · Mouse aim · Click shoot · Space punch / handbrake', 410, '17px sans-serif', 'rgba(255,255,255,0.8)');
  centerText(ctx, 'E get in & out of cars · P pause · M music · R reload', 438, '17px sans-serif', 'rgba(255,255,255,0.8)');
  centerText(ctx, 'Steal cars, outrun the police, run Mara\u2019s jobs — and find all 10 hidden packages.', 486, '16px sans-serif', 'rgba(255,255,255,0.7)');
  if (hasSave) {
    const s = G.saveData;
    centerText(ctx, `Save: $${s.money} · ${s.missionsDone.length}/4 jobs done · ${s.packagesFound.length}/10 packages`, 540, '16px sans-serif', '#ffd23f');
  }
  centerText(ctx, 'A completely original game. No real city, no real gangsters.', 640, '14px sans-serif', 'rgba(255,255,255,0.5)');
}

export function drawPaused(G) {
  const ctx = G.ctx;
  overlay(ctx, 0.6);
  centerText(ctx, 'PAUSED', 220, 'bold 64px sans-serif', '#ffffff');
  centerText(ctx, 'ENTER — keep playing', 330, '20px sans-serif', '#ffffff');
  centerText(ctx, 'R — restart the current job', 366, '20px sans-serif', 'rgba(255,255,255,0.85)');
  centerText(ctx, 'Q — save and quit to the title screen', 402, '20px sans-serif', 'rgba(255,255,255,0.85)');
  centerText(ctx, `Jobs done: ${G.missionsDone.length}/4 · Cash: $${G.player.money} · Best wanted: ${G.stats.bestWanted} stars`, 470, '17px sans-serif', '#ffd23f');
}

export function drawDead(G) {
  const ctx = G.ctx;
  overlay(ctx, 0.65);
  centerText(ctx, 'RIO IS DOWN', 230, 'bold 72px sans-serif', '#ff5a5a');
  centerText(ctx, 'The city keeps moving without you.', 320, '20px sans-serif', '#ffffff');
  centerText(ctx, 'ENTER — wake up at Mara\u2019s Garage (you lose $100 to the medics)', 380, '19px sans-serif', 'rgba(255,255,255,0.9)');
}

export function drawMissionPassed(G) {
  const ctx = G.ctx;
  overlay(ctx, 0.55);
  centerText(ctx, 'JOB DONE', 210, 'bold 68px sans-serif', '#ffd23f');
  centerText(ctx, G.passedTitle, 300, 'bold 28px sans-serif', '#ffffff');
  centerText(ctx, `+$${G.passedReward}`, 350, 'bold 40px sans-serif', '#2ecc71');
  const done = G.missionsDone.length;
  centerText(ctx, done >= 4 ? 'Every job is done. Solmar is yours, Rio.' : `${done}/4 jobs done — Mara will call with the next one.`, 420, '19px sans-serif', 'rgba(255,255,255,0.9)');
  centerText(ctx, 'ENTER — keep playing', 480, '20px sans-serif', '#ffffff');
}
