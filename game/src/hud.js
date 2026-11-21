// Solmar City — the HUD: money, health, wanted stars, objective,
// minimap, clock, dialogue, crosshair and ammo. All screen space.
import { WORLD, PALETTE, TUNE } from './config.js';

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawMinimap(ctx, G, x, y, w, h) {
  const sx = w / WORLD.w;
  const sy = h / WORLD.h;
  ctx.save();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Ground: grass, sand strip, sea.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x + WORLD.beachX * sx, y, (WORLD.w - WORLD.beachX) * sx, h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x + WORLD.waterX * sx, y, (WORLD.w - WORLD.waterX) * sx, h);
  // Roads.
  ctx.strokeStyle = '#4a4f58';
  ctx.lineWidth = Math.max(2, WORLD.road * sx);
  ctx.beginPath();
  for (let i = 0; i < WORLD.avenues; i++) {
    const rx = x + i * WORLD.pitch * sx;
    ctx.moveTo(rx, y);
    ctx.lineTo(rx, y + (WORLD.streets - 1) * WORLD.pitch * sy);
  }
  for (let j = 0; j < WORLD.streets; j++) {
    const ry = y + j * WORLD.pitch * sy;
    ctx.moveTo(x, ry);
    ctx.lineTo(x + (WORLD.avenues - 1) * WORLD.pitch * sx, ry);
  }
  ctx.stroke();
  // Buildings.
  ctx.fillStyle = 'rgba(30,30,36,0.75)';
  for (const b of G.world.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const pack of G.world.packages) {
    if (!pack.found) dot(pack.x, pack.y, '#7be07b', 2.5);
  }
  if (G.taxi.offer) dot(G.taxi.offer.x, G.taxi.offer.y, '#37d67a', 3);
  for (const e of G.enemies) {
    if (!e.dead) dot(e.x, e.y, '#ff4a3a', 3);
  }
  for (const car of G.cars) {
    if (car.wrecked) continue;
    if (car.kind === 'police') dot(car.x, car.y, Math.floor(G.time * 4) % 2 ? '#ff3b30' : '#3b82ff', 3);
    else if (car.driver === 'player') dot(car.x, car.y, '#ffd94a', 3.5);
    else dot(car.x, car.y, '#e8e8e8', 2.5);
  }
  // Mission marker: pulsing gold star.
  const target = G.mission.target || (G.taxi.rider ? G.taxi.dest : null);
  if (target) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    dot(target.x, target.y, '#ffd94a', pulse);
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + target.x * sx, y + target.y * sy, pulse + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Player arrow.
  const px = x + G.player.x * sx;
  const py = y + G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.inCar ? G.player.inCar.angle : G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('N', x + w - 10, y + 11);
  ctx.restore();
}

export function drawHud(ctx, G) {
  const W = G.view.w;
  const H = G.view.h;
  const p = G.player;
  ctx.textBaseline = 'alphabetic';
  // Money + health, top left.
  ctx.fillStyle = 'rgba(10,12,16,0.55)';
  ctx.fillRect(12, 12, 210, 64);
  ctx.fillStyle = '#7be07b';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${p.money}`, 22, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 22, 58);
  bar(ctx, 76, 48, 130, 10, p.health / 100, p.health > 30 ? '#4caf50' : '#e04040', '#222');
  // Wanted stars, top centre.
  ctx.fillStyle = 'rgba(10,12,16,0.55)';
  ctx.fillRect(W / 2 - 110, 12, 220, 34);
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted > 0 ? '#ffd94a' : '#888888';
  ctx.fillText(stars, W / 2, 36);
  ctx.textAlign = 'left';
  // Objective line under the stars. Measure with the font it is drawn
  // in, so the backing bar hugs the text.
  const objective = G.mission.targetLabel || (G.taxi.rider ? 'Drop the passenger at the marker' : 'Explore Solmar City — press N for a mission');
  ctx.font = '13px sans-serif';
  const ow = ctx.measureText(objective).width + 24;
  ctx.fillStyle = 'rgba(10,12,16,0.55)';
  ctx.fillRect(W / 2 - ow / 2, 50, ow, 26);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(objective, W / 2, 68);
  ctx.textAlign = 'left';
  // Minimap + clock, top right.
  drawMinimap(ctx, G, W - 206, 12, 190, 150);
  const hh = Math.floor(G.clock / 60) % 24;
  const mm = Math.floor(G.clock % 60);
  ctx.fillStyle = 'rgba(10,12,16,0.55)';
  ctx.fillRect(W - 206, 166, 190, 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, W - 111, 183);
  ctx.textAlign = 'left';
  // Ammo + speed, bottom right.
  ctx.fillStyle = 'rgba(10,12,16,0.55)';
  ctx.fillRect(W - 150, H - 64, 138, 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  if (p.inCar) {
    ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.24)} km/h`, W - 138, H - 40);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText(p.inCar.name, W - 138, H - 22);
  } else {
    ctx.fillText(p.reloading ? 'RELOADING…' : `AMMO ${p.ammo} / 12`, W - 138, H - 40);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText('F punch · click shoot', W - 138, H - 22);
  }
  // Bust meter.
  if (G.bustedT > 0) {
    ctx.fillStyle = 'rgba(10,12,16,0.6)';
    ctx.fillRect(W / 2 - 120, 84, 240, 22);
    ctx.fillStyle = '#e04040';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED IN ' + (TUNE.bustedTime - G.bustedT).toFixed(1) + 's — RUN!', W / 2, 100);
    ctx.textAlign = 'left';
  }
  // Toast message.
  if (G.toastT > 0) {
    ctx.globalAlpha = Math.min(1, G.toastT);
    ctx.fillStyle = 'rgba(10,12,16,0.7)';
    ctx.font = '14px sans-serif';
    const tw = ctx.measureText(G.toastText).width + 28;
    ctx.fillRect(W / 2 - tw / 2, H - 118, tw, 30);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(G.toastText, W / 2, H - 98);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  // Dialogue box.
  if (G.dialogue.active && G.dialogue.i < G.dialogue.lines.length) {
    const line = G.dialogue.lines[G.dialogue.i];
    ctx.fillStyle = 'rgba(8,10,14,0.82)';
    ctx.fillRect(60, H - 190, W - 120, 58);
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, H - 190, W - 120, 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText(line, 78, H - 166);
    ctx.fillStyle = '#ffd94a';
    ctx.font = '12px sans-serif';
    ctx.fillText('E / click to continue', 78, H - 144);
  }
  // Crosshair on foot.
  if (!p.inCar && G.state === 'playing') {
    const mx = G.input.mouse.x;
    const my = G.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx - 10, my);
    ctx.lineTo(mx - 3, my);
    ctx.moveTo(mx + 3, my);
    ctx.lineTo(mx + 10, my);
    ctx.moveTo(mx, my - 10);
    ctx.lineTo(mx, my - 3);
    ctx.moveTo(mx, my + 3);
    ctx.lineTo(mx, my + 10);
    ctx.stroke();
  }
  // Controls hint, first seconds only.
  if (G.time < 14 && G.state === 'playing') {
    ctx.fillStyle = 'rgba(10,12,16,0.55)';
    ctx.fillRect(12, H - 64, 300, 52);
    ctx.fillStyle = '#dddddd';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD move/drive · E enter car · Space handbrake', 22, H - 44);
    ctx.fillText('F punch · R reload · P pause · M music · N mission', 22, H - 26);
  }
}
