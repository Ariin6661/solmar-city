// Solmar City — bullets, punches and armed enemies.
// Bullets fly straight, spark on walls, dent cars and drop enemies.
// Enemies stand their ground and shoot back on a timer.
import { TUNE } from './config.js';

export function fireBullet(G, x, y, angle, from) {
  G.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * TUNE.bulletSpeed,
    vy: Math.sin(angle) * TUNE.bulletSpeed,
    life: 1.1,
    from,
  });
  G.particles.push({ x, y, kind: 'flash', life: 0.08, max: 0.08 });
}

export function spawnEnemy(G, x, y) {
  const e = {
    x,
    y,
    angle: 0,
    health: TUNE.enemyHealth,
    shootT: 1 + Math.random(),
    strafe: Math.random() * Math.PI * 2,
    dead: false,
  };
  G.enemies.push(e);
  return e;
}

export function punchHit(G) {
  const p = G.player;
  if (p.punchT > 0) return;
  p.punchT = 0.45;
  G.audio.punch();
  const reach = TUNE.punchRange + 14;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < reach) hurtEnemy(G, e, TUNE.punchDamage);
  }
  for (const ped of G.peds) {
    if (ped.down > 0) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < reach) {
      ped.down = 4;
      G.addWanted(1, 'assault');
    }
  }
  for (const car of G.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < reach + 10 && car.driver === 'traffic') {
      car.speed = 0;
    }
  }
}

export function hurtEnemy(G, e, dmg) {
  e.health -= dmg;
  G.particles.push({ x: e.x, y: e.y, kind: 'hit', life: 0.25, max: 0.25 });
  if (e.health <= 0 && !e.dead) {
    e.dead = true;
    G.stats.kills++;
    G.save.kills = G.stats.kills;
    G.player.money += 25;
    G.save.money = G.player.money;
    G.saveDirty = true;
    for (let i = 0; i < 14; i++) {
      G.particles.push({
        x: e.x,
        y: e.y,
        kind: 'puff',
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        life: 0.5,
        max: 0.5,
      });
    }
  }
}

export function damageCar(G, car, dmg) {
  car.health -= dmg;
  G.particles.push({ x: car.x, y: car.y, kind: 'hit', life: 0.2, max: 0.2 });
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = 0;
    G.audio.crash();
    G.camera.shake = 14;
    for (let i = 0; i < 22; i++) {
      G.particles.push({
        x: car.x + (Math.random() - 0.5) * 40,
        y: car.y + (Math.random() - 0.5) * 20,
        kind: i % 3 === 0 ? 'fire' : 'smoke',
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 0.7,
        max: 0.7,
      });
    }
    if (car.driver === 'player') {
      G.player.inCar = null;
      G.player.x = car.x + 40;
      G.player.y = car.y + 40;
    }
  }
}

export function stepBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (G.world.blockedAt(b.x, b.y, 2)) {
      b.life = 0;
      G.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.15, max: 0.15 });
      continue;
    }
    if (b.from === 'player') {
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          hurtEnemy(G, e, TUNE.bulletDamage);
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of G.cars) {
        if (car.wrecked || car.driver === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          damageCar(G, car, TUNE.bulletDamage);
          b.life = 0;
          break;
        }
      }
    } else {
      const p = G.player;
      if (!p.inCar && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        hurtPlayer(G, 12);
        b.life = 0;
      } else if (p.inCar && Math.hypot(p.inCar.x - b.x, p.inCar.y - b.y) < 24) {
        damageCar(G, p.inCar, 8);
        b.life = 0;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (p.dead) return;
  p.health -= dmg;
  G.camera.shake = Math.max(G.camera.shake, 6);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.state = 'over';
  }
}

export function stepEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const d = Math.hypot(px - e.x, py - e.y);
    if (d < 460) {
      e.angle = Math.atan2(py - e.y, px - e.x);
      e.shootT -= dt;
      if (e.shootT <= 0 && d > 40) {
        e.shootT = 1.3 + Math.random() * 0.7;
        const spread = (Math.random() - 0.5) * 0.22;
        fireBullet(G, e.x + Math.cos(e.angle) * 18, e.y + Math.sin(e.angle) * 18, e.angle + spread, 'enemy');
        G.audio.gunshot();
      }
      // Strafe slowly so they are not standing targets.
      e.strafe += dt;
      const sx = e.x + Math.cos(e.strafe) * 14 * dt;
      const sy = e.y + Math.sin(e.strafe) * 14 * dt;
      if (!G.world.blockedAt(sx, sy, 12)) {
        e.x = sx;
        e.y = sy;
      }
    }
  }
}
