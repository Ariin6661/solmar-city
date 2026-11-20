// Combat — a pistol with ammo and a reload, a punch for up close, and
// enemies who shoot back. Bullets are simple fast circles; everything
// they hit is checked here.

import { CONFIG } from './config.js';
import { pointInBuilding, collideCircle } from './world.js';
import { hurtPlayer } from './player.js';
import { scarePeds } from './traffic.js';

export function spawnEnemy(G, x, y) {
  const enemy = {
    x, y,
    angle: 0,
    health: CONFIG.enemyHealth,
    shootCooldown: G.rng.range(0.5, 1.5),
    strafeDir: G.rng.chance(0.5) ? 1 : -1,
    strafeTime: 0,
    dead: false,
    walkPhase: 0,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function playerShoot(G) {
  const player = G.player;
  if (player.inCar || player.reloading > 0 || G.state !== 'playing') return;
  if (player.ammo <= 0) {
    player.reloading = CONFIG.pistolReload;
    return;
  }
  player.ammo--;
  const angle = player.angle + (G.rng.next() - 0.5) * 0.05;
  G.bullets.push({
    x: player.x + Math.cos(angle) * 20,
    y: player.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * CONFIG.bulletSpeed,
    vy: Math.sin(angle) * CONFIG.bulletSpeed,
    from: 'player',
    damage: CONFIG.pistolDamage,
    life: CONFIG.pistolRange / CONFIG.bulletSpeed,
  });
  G.addMuzzle(player.x + Math.cos(angle) * 24, player.y + Math.sin(angle) * 24);
  G.audio.sfx('shoot');
  G.addHeat(CONFIG.heatPerShot, 'fired a shot');
  scarePeds(G, player.x, player.y, 420);
  if (player.ammo <= 0) player.reloading = CONFIG.pistolReload;
}

export function playerPunch(G) {
  const player = G.player;
  if (player.inCar || player.punchCooldown > 0 || G.state !== 'playing') return;
  player.punchCooldown = 0.45;
  G.audio.sfx('punch');
  const reach = CONFIG.punchRange + 14;
  const px = player.x + Math.cos(player.angle) * reach;
  const py = player.y + Math.sin(player.angle) * reach;
  // Enemies first.
  for (const enemy of G.enemies) {
    if (enemy.dead) continue;
    if (Math.hypot(enemy.x - px, enemy.y - py) < 30) {
      damageEnemy(G, enemy, CONFIG.punchDamage);
      enemy.x += Math.cos(player.angle) * 18;
      enemy.y += Math.sin(player.angle) * 18;
      return;
    }
  }
  // Then pedestrians (rude, and the city notices if a cop sees it).
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 28) {
      ped.state = 'down';
      ped.downTime = 3;
      G.addHeat(0.4, 'punched a pedestrian');
      return;
    }
  }
}

export function damageEnemy(G, enemy, amount) {
  enemy.health -= amount;
  G.addBlood(enemy.x, enemy.y);
  if (enemy.health <= 0 && !enemy.dead) {
    enemy.dead = true;
    G.player.money += 25;
    G.addBurst(enemy.x, enemy.y, '#e74c3c', 14);
    G.audio.sfx('punch');
  }
}

// ---- Bullets and enemy brains ----

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (pointInBuilding(G.world, b.x, b.y)) {
      G.addSpark(b.x, b.y);
      b.dead = true;
      continue;
    }
    if (b.from === 'player') {
      for (const enemy of G.enemies) {
        if (enemy.dead) continue;
        if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < 16) {
          damageEnemy(G, enemy, b.damage);
          b.dead = true;
          break;
        }
      }
      if (b.dead) continue;
      for (const ped of G.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          ped.state = 'down';
          ped.downTime = 5;
          G.addHeat(0.8, 'shot a pedestrian');
          b.dead = true;
          break;
        }
      }
    } else {
      // Enemy bullets only threaten the player on foot.
      const player = G.player;
      if (!player.inCar && Math.hypot(player.x - b.x, player.y - b.y) < 14) {
        hurtPlayer(G, b.damage);
        b.dead = true;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
}

export function updateEnemies(G, dt) {
  const player = G.player;
  for (const enemy of G.enemies) {
    if (enemy.dead) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy);
    enemy.angle = Math.atan2(dy, dx);
    // Close to shooting range, then strafe and fire.
    if (d > CONFIG.enemyShootRange * 0.7) {
      enemy.x += (dx / d) * 95 * dt;
      enemy.y += (dy / d) * 95 * dt;
      enemy.walkPhase += dt * 9;
    } else {
      enemy.strafeTime -= dt;
      if (enemy.strafeTime <= 0) {
        enemy.strafeDir *= -1;
        enemy.strafeTime = G.rng.range(0.8, 1.8);
      }
      enemy.x += -Math.sin(enemy.angle) * enemy.strafeDir * 55 * dt;
      enemy.y += Math.cos(enemy.angle) * enemy.strafeDir * 55 * dt;
    }
    const pos = { x: enemy.x, y: enemy.y };
    collideCircle(G.world, pos, 12);
    enemy.x = pos.x;
    enemy.y = pos.y;

    enemy.shootCooldown -= dt;
    if (enemy.shootCooldown <= 0 && d < CONFIG.enemyShootRange && !player.inCar) {
      enemy.shootCooldown = CONFIG.enemyShootInterval * G.rng.range(0.9, 1.3);
      const spread = (G.rng.next() - 0.5) * 0.22;
      const a = enemy.angle + spread;
      G.bullets.push({
        x: enemy.x + Math.cos(a) * 20,
        y: enemy.y + Math.sin(a) * 20,
        vx: Math.cos(a) * CONFIG.bulletSpeed * 0.85,
        vy: Math.sin(a) * CONFIG.bulletSpeed * 0.85,
        from: 'enemy',
        damage: 9,
        life: CONFIG.enemyShootRange / (CONFIG.bulletSpeed * 0.85),
      });
      G.addMuzzle(enemy.x + Math.cos(a) * 24, enemy.y + Math.sin(a) * 24);
      G.audio.sfx('enemyShoot');
    }
  }
  G.enemies = G.enemies.filter((e) => !e.dead);
}
