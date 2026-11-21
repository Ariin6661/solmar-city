// Solmar City — HUD, minimap, menus and dialogue.
//
// Everything drawn on top of the world: the live minimap, health and
// money, the wanted stars, the objective line, the clock, dialogue boxes
// and the screens between states (title, pause, game over, mission
// passed). The HUD reads the game state and draws; it never changes it.

import { CFG, PAL } from './config.js';
import { currentObjective } from './missions.js';

export function drawHud(ctx, g) {
  const W = CFG.viewW;
  const H = CFG.viewH;
  drawMinimap(ctx, g);
  drawTopBar(ctx, g);
  drawObjective(ctx, g);
  drawDialogue(ctx, g);
  drawCrosshair(ctx, g);
  drawAmmo(ctx, g);
  if (g.state === 'title') drawTitle(ctx, g);
  if (g.state === 'paused') drawPaused(ctx);
  if (g.state === 'gameover') drawGameOver(ctx, g);
  if (g.missions.passedFlash > 0) drawPassed(ctx, g);
  if (g.player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200, 30, 30, ${Math.min(0.35, g.player.hurtFlash * 0.4)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMinimap(ctx, g) {
  const size = 148;
  const x0 = 14;
  const y0 = 14;
  const sx = size / CFG.worldW;
  const sy = size / CFG.worldH;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 18, 24, 0.78)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  // Sea and sand.
  ctx.fillStyle = PAL.sea;
  ctx.fillRect(x0, y0 + CFG.beachTop * sy, size, size - CFG.beachTop * sy);
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(x0, y0 + (CFG.beachTop - 60) * sy, size, 60 * sy);
  // Roads.
  ctx.strokeStyle = '#5a5e66';
  ctx.lineWidth = 2;
  for (const ax of g.world.avenues) {
    ctx.beginPath();
    ctx.moveTo(x0 + ax * sx, y0);
    ctx.lineTo(x0 + ax * sx, y0 + size);
    ctx.stroke();
  }
  for (const sy2 of g.world.streets) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + sy2 * sy);
    ctx.lineTo(x0 + size, y0 + sy2 * sy);
    ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = '#e8c95a';
  for (const lm of g.world.landmarks) {
    ctx.beginPath();
    ctx.arc(x0 + lm.x * sx, y0 + lm.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission / taxi marker.
  const marker = missionMarker(g);
  if (marker) {
    const pulse = 4 + Math.sin(g.time * 5) * 1.5;
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cruisers.
  ctx.fillStyle = '#ff4040';
  for (const c of g.police.cruisers) {
    ctx.beginPath();
    ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = g.player.inCar || g.player;
  ctx.save();
  ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
  ctx.rotate(g.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function missionMarker(g) {
  const ms = g.missions;
  if (ms.active >= 0) {
    const def = ms.active;
    const kinds = [['plaza'], ['hotel', 'pier'], ['docks'], ['docks']];
    const kind = kinds[def][Math.min(ms.stage, kinds[def].length - 1)];
    return g.world.landmarks.find((l) => l.kind === kind) || null;
  }
  if (ms.taxi) return ms.taxi.phase === 'pickup' ? ms.taxi.from : ms.taxi.to;
  return null;
}

function drawTopBar(ctx, g) {
  const W = CFG.viewW;
  ctx.save();
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  // Money.
  ctx.fillStyle = 'rgba(12, 18, 24, 0.72)';
  ctx.fillRect(W - 250, 14, 236, 34);
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(`$${g.player.money}`, W - 238, 20);
  // Wanted stars.
  ctx.fillStyle = '#ffd23e';
  let stars = '';
  for (let i = 0; i < Math.ceil(g.police.wanted); i++) stars += '★';
  ctx.fillText(stars, W - 150, 20);
  // Clock.
  const hour = clockHour(g);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(hour, W - 60, 22);
  // Health bar.
  ctx.fillStyle = 'rgba(12, 18, 24, 0.72)';
  ctx.fillRect(14, CFG.viewH - 30, 220, 16);
  ctx.fillStyle = g.player.hp > 30 ? '#5ad66b' : '#e5484d';
  // Clamp the width: a stray hp value must never draw past the frame.
  const hpW = Math.max(0, Math.min(216, 216 * (g.player.hp / CFG.playerHp)));
  ctx.fillRect(16, CFG.viewH - 28, hpW, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(g.player.hp)}`, 20, CFG.viewH - 27);
  ctx.restore();
}

export function clockHour(g) {
  const t = (g.timeOfDay / CFG.dayLength) * 24;
  const h = Math.floor(t) % 24;
  const m = Math.floor((t % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawObjective(ctx, g) {
  const text = currentObjective(g.missions);
  ctx.save();
  ctx.font = '16px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = 'rgba(12, 18, 24, 0.72)';
  ctx.fillRect((CFG.viewW - w) / 2, 14, w, 30);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CFG.viewW / 2, 30);
  if (g.missions.active >= 0 && g.missions.timer > 0) {
    ctx.fillStyle = g.missions.timer < 15 ? '#ff5a3c' : '#ffd23e';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(g.missions.timer)}s`, CFG.viewW / 2, 58);
  }
  ctx.restore();
}

function drawDialogue(ctx, g) {
  const d = g.missions.dialogue;
  if (!d) return;
  ctx.save();
  const w = 560;
  const x = (CFG.viewW - w) / 2;
  const y = CFG.viewH - 128;
  ctx.fillStyle = 'rgba(12, 18, 24, 0.85)';
  ctx.fillRect(x, y, w, 64);
  ctx.strokeStyle = '#e8c95a';
  ctx.strokeRect(x, y, w, 64);
  ctx.fillStyle = '#e8c95a';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(d.name, x + 14, y + 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px system-ui, sans-serif';
  wrapText(ctx, d.text, x + 14, y + 28, w - 28, 19);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

function drawCrosshair(ctx, g) {
  if (g.player.inCar || g.state !== 'playing') return;
  const m = g.input.mouse;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(m.x - 13, m.y);
  ctx.lineTo(m.x - 5, m.y);
  ctx.moveTo(m.x + 5, m.y);
  ctx.lineTo(m.x + 13, m.y);
  ctx.moveTo(m.x, m.y - 13);
  ctx.lineTo(m.x, m.y - 5);
  ctx.moveTo(m.x, m.y + 5);
  ctx.lineTo(m.x, m.y + 13);
  ctx.stroke();
  ctx.restore();
}

function drawAmmo(ctx, g) {
  if (g.player.inCar) return;
  ctx.save();
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const label = g.player.reloading > 0 ? 'RELOADING…' : `AMMO ${g.player.ammo} / ${CFG.pistolMag}`;
  ctx.fillStyle = 'rgba(12, 18, 24, 0.72)';
  const w = ctx.measureText(label).width + 20;
  ctx.fillRect(CFG.viewW - w - 14, CFG.viewH - 64, w, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, CFG.viewW - 24, CFG.viewH - 38);
  ctx.restore();
}

function drawTitle(ctx, g) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 18, 0.55)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SOLMAR CITY', CFG.viewW / 2, 190);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Rio Vega is back. The city never forgot him.', CFG.viewW / 2, 250);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('WASD drive & walk · E steal a car · Click shoot · F punch · R reload', CFG.viewW / 2, 320);
  ctx.fillText('Space handbrake · P pause · M music · N next mission', CFG.viewW / 2, 348);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 22px system-ui, sans-serif';
  const blink = Math.sin(g.time * 4) > 0 ? 1 : 0.25;
  ctx.globalAlpha = blink;
  ctx.fillText('Press any key to start', CFG.viewW / 2, 420);
  ctx.restore();
}

function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 18, 0.6)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CFG.viewW / 2, CFG.viewH / 2 - 10);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Press P to keep playing', CFG.viewW / 2, CFG.viewH / 2 + 30);
  ctx.restore();
}

function drawGameOver(ctx, g) {
  ctx.save();
  ctx.fillStyle = 'rgba(20, 4, 4, 0.72)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.fillStyle = '#ff5a3c';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED', CFG.viewW / 2, CFG.viewH / 2 - 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(`The Solmar police took $${CFG.bustedFine}. Rio walks out of the station.`, CFG.viewW / 2, CFG.viewH / 2 + 24);
  ctx.fillText('Press any key to get back on the street', CFG.viewW / 2, CFG.viewH / 2 + 56);
  ctx.restore();
}

function drawPassed(ctx, g) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, g.missions.passedFlash);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION PASSED', CFG.viewW / 2, 120);
  ctx.restore();
}
