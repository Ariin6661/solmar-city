// Combat: the pistol, the punch, enemy shooters and bullets.
import { CFG } from './config.js';
import { pointInRect } from './world.js';
import { damagePlayer } from './vehicles.js';
import { addWanted } from './police.js';
import { sfx } from './audio.js';

export function makeBullet(x, y, angle, speed, from, dmg) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.9,
    from, // 'player' | 'enemy'
    dmg,
  };
}

// Line of sight: sample the segment; blocked if any sample is in a building.
export function losClear(world, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(d / 18));
  for (let i = 1; i < steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    for (const b of world.buildings) {
      if (pointInRect(x, y, b)) return false;
    }
  }
  return true;
}

export function spawnEnemy(G, x, y) {
  const e = {
    x, y,
    hp: 60,
    angle: G.rng.range(0, Math.PI * 2),
    shootCd: G.rng.range(0.6, 1.4),
    strafeDir: G.rng.chance(0.5) ? 1 : -1,
    strafeT: G.rng.range(1, 2.5),
    color: '#7b2d26',
    flash: 0,
  };
  G.enemies.push(e);
  return e;
}

export function tryShoot(G) {
  const P = G.player;
  if (G.mode !== 'playing' || !P.onFoot) return;
  if (!G.input.mousePressed && !G.input.mouseDown) return;
  if (P.gun.cd > 0 || P.gun.reloading > 0) return;
  if (P.gun.ammo <= 0) {
    P.gun.reloading = CFG.RELOAD_TIME;
    return;
  }
  P.gun.cd = 0.16;
  P.gun.ammo--;
  const a = P.aimAngle + (Math.random() - 0.5) * 0.05;
  const bx = P.x + Math.cos(a) * 24;
  const by = P.y + Math.sin(a) * 24;
  G.bullets.push(makeBullet(bx, by, a, CFG.BULLET_SPEED, 'player', 34));
  G.lastShot = { x: P.x, y: P.y, t: G.time };
  // Firing in public is a crime, but not every single shot.
  if (G.crimeCd <= 0) {
    addWanted(G, 1);
    G.crimeCd = 6;
  }
  sfx(G.audio, 'shot');
  G.particles.push({
    x: bx, y: by, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
    life: 0.08, maxLife: 0.08, color: '#ffd76a', size: 7,
  });
}

export function punch(G) {
  const P = G.player;
  const range = 58;
  const arc = 0.75;
  let hitAny = false;
  const hitAt = (x, y, r) => {
    const d = Math.hypot(x - P.x, y - P.y);
    if (d > range + r) return false;
    let diff = Math.atan2(y - P.y, x - P.x) - P.aimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < arc;
  };
  for (const e of G.enemies) {
    if (hitAt(e.x, e.y, 16)) {
      damageEnemy(G, e, 25, Math.cos(P.aimAngle) * 260, Math.sin(P.aimAngle) * 260);
      hitAny = true;
    }
  }
  for (const ped of G.peds) {
    if (!ped.down && hitAt(ped.x, ped.y, 12)) {
      ped.down = true;
      ped.downTimer = 5;
      addWanted(G, 1);
      hitAny = true;
    }
  }
  if (hitAny) sfx(G.audio, 'punch');
  G.particles.push({
    x: P.x + Math.cos(P.aimAngle) * 40,
    y: P.y + Math.sin(P.aimAngle) * 40,
    vx: 0, vy: 0, life: 0.12, maxLife: 0.12, color: '#ffffff', size: 10,
  });
}

export function damageEnemy(G, e, dmg, kx, ky) {
  e.hp -= dmg;
  e.flash = 0.12;
  if (kx !== undefined) {
    e.x += kx * 0.06;
    e.y += ky * 0.06;
  }
  if (e.hp <= 0) {
    const idx = G.enemies.indexOf(e);
    if (idx >= 0) G.enemies.splice(idx, 1);
    G.stats.kills++;
    G.money += 100;
    G.stats.earned += 100;
    for (let i = 0; i < 14; i++) {
      const a = G.rng.range(0, Math.PI * 2);
      const sp = G.rng.range(40, 220);
      G.particles.push({
        x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: G.rng.range(0.3, 0.7), maxLife: 0.7, color: '#c0392b', size: 4,
      });
    }
    sfx(G.audio, 'cash');
  }
}

// Enemies stand their ground, strafe a little, and shoot when they
// can see you (line of sight past the buildings).
export function stepEnemies(G, dt) {
  const P = G.player;
  for (const e of G.enemies) {
    if (e.flash > 0) e.flash -= dt;
    const dx = P.x - e.x;
    const dy = P.y - e.y;
    const dist = Math.hypot(dx, dy);
    e.angle = Math.atan2(dy, dx);
    e.strafeT -= dt;
    if (e.strafeT <= 0) {
      e.strafeT = G.rng.range(1, 2.5);
      e.strafeDir *= -1;
    }
    if (dist < 460 && dist > 90) {
      const px = -Math.sin(e.angle) * e.strafeDir * 42 * dt;
      const py = Math.cos(e.angle) * e.strafeDir * 42 * dt;
      const res = { x: e.x + px, y: e.y + py };
      e.x = res.x;
      e.y = res.y;
    }
    e.shootCd -= dt;
    if (e.shootCd <= 0 && dist < 460 && losClear(G.world, e.x, e.y, P.x, P.y)) {
      e.shootCd = G.rng.range(1.1, 1.7);
      const spread = (G.rng.next() - 0.5) * 0.22;
      const a = e.angle + spread;
      G.bullets.push(makeBullet(
        e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 22,
        a, CFG.ENEMY_BULLET_SPEED, 'enemy', 8,
      ));
      sfx(G.audio, 'enemyShot');
      G.particles.push({
        x: e.x + Math.cos(a) * 26, y: e.y + Math.sin(a) * 26,
        vx: 0, vy: 0, life: 0.07, maxLife: 0.07, color: '#ffd76a', size: 6,
      });
    }
  }
}

export function stepBullets(G, dt) {
  for (const b of G.bullets.slice()) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Buildings stop bullets with a spark.
      for (const rect of G.world.buildings) {
        if (pointInRect(b.x, b.y, rect)) {
          dead = true;
          G.particles.push({
            x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, color: '#f2c14e', size: 4,
          });
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const e of G.enemies.slice()) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < 17) {
          damageEnemy(G, e, b.dmg, b.vx * 0.35, b.vy * 0.35);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const ped of G.peds) {
        if (!ped.down && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
          ped.down = true;
          ped.downTimer = 5;
          addWanted(G, 1);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const car of G.cars) {
        if (car.kind === 'police' && Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          addWanted(G, 1);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      const P = G.player;
      if (Math.hypot(P.x - b.x, P.y - b.y) < 15) {
        damagePlayer(G, b.dmg, 'shot');
        dead = true;
      }
    }
    if (dead) {
      const i = G.bullets.indexOf(b);
      if (i >= 0) G.bullets.splice(i, 1);
    }
  }
}

export function stepParticles(G, dt) {
  for (const p of G.particles.slice()) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.4 * dt;
    p.vy *= 1 - 2.4 * dt;
    p.life -= dt;
    if (p.life <= 0) {
      const i = G.particles.indexOf(p);
      if (i >= 0) G.particles.splice(i, 1);
    }
  }
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);
}
