// Solmar City — combat: fists, pistol and bullets.
//
// Combat is deliberately readable: a punch is a short arc in front of
// Rio, a pistol shot is a fast tracer toward the mouse, and every bullet
// is a point with a velocity that dies on a building or a body. Enemies
// use the same bullets, with worse aim. Nothing here knows about the
// missions; it only knows hit points, positions and damage.

import { CFG } from './config.js';
import { hitsBuilding } from './world.js';

export function makeBullet(x, y, angle, fromPlayer, damage) {
  return {
    x, y,
    vx: Math.cos(angle) * CFG.bulletSpeed,
    vy: Math.sin(angle) * CFG.bulletSpeed,
    fromPlayer,
    damage,
    life: 1.4,
    trail: [],
  };
}

// Rio's punch: hits the nearest enemy or pedestrian in the arc.
export function punch(player, enemies, peds) {
  const reach = CFG.punchRange + 14;
  let best = null;
  let bestD = Infinity;
  const consider = (e) => {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d > reach) return;
    const ang = Math.atan2(e.y - player.y, e.x - player.x);
    let diff = Math.abs(ang - player.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 1.1 && d < bestD) { bestD = d; best = e; }
  };
  for (const e of enemies) consider(e);
  for (const p of peds) consider(p);
  if (best) {
    best.hp -= CFG.punchDamage;
    const kb = 220;
    const ang = Math.atan2(best.y - player.y, best.x - player.x);
    best.x += Math.cos(ang) * kb * 0.08;
    best.y += Math.sin(ang) * kb * 0.08;
    return best;
  }
  return null;
}

// Fire the pistol. Returns a bullet or null (cooling down / reloading).
export function shootPistol(player, angle) {
  if (player.shootCooldown > 0 || player.reloading > 0) return null;
  if (player.ammo <= 0) {
    player.reloading = CFG.reloadTime;
    return null;
  }
  player.ammo -= 1;
  player.shootCooldown = CFG.pistolCooldown;
  const mx = player.x + Math.cos(angle) * 22;
  const my = player.y + Math.sin(angle) * 22;
  return makeBullet(mx, my, angle, true, CFG.pistolDamage);
}

export function startReload(player) {
  if (player.ammo < CFG.pistolMag && player.reloading <= 0) {
    player.reloading = CFG.reloadTime;
  }
}

// Move bullets; returns { hits: [{bullet, target}], dead: [bullet] }.
export function updateBullets(bullets, dt, world, targets) {
  const hits = [];
  const dead = [];
  for (const b of bullets) {
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 5) b.trail.shift();
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { dead.push(b); continue; }
    if (hitsBuilding(world, b.x, b.y, 2)) { dead.push(b); continue; }
    if (b.x < 0 || b.x > CFG.worldW || b.y < 0 || b.y > CFG.worldH) { dead.push(b); continue; }
    for (const t of targets) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      const radius = t.radius || 14;
      if (d < radius + 3) {
        t.hp -= b.damage;
        hits.push({ bullet: b, target: t });
        dead.push(b);
        break;
      }
    }
  }
  return { hits, dead };
}

// An enemy takes a shot at the player with spread. Takes the seeded rng
// so enemy fire stays deterministic with the rest of the game.
export function enemyShoot(enemy, player, spread, rng) {
  const base = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const jitter = (rng() - 0.5) * (spread || 0.35);
  return makeBullet(
    enemy.x + Math.cos(base) * 20,
    enemy.y + Math.sin(base) * 20,
    base + jitter,
    false,
    12,
  );
}
