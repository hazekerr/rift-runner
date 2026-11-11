/**
 * Логика боя. Этап 1 — перенос прототипа legacy/RR.html один в один,
 * но с фиксированным шагом, сидовым RNG и событиями вместо прямых вызовов эффектов.
 */
import { TAU, clamp, dist } from '../core/math';
import { int, nextFloat, range } from '../core/rng';
import { SpatialHash } from '../core/spatial-hash';
import { WORLD, ARENA_CENTER, CRATE_SIZE } from '../content/arena';
import { ENEMIES, type EnemyType } from '../content/enemies';
import { GUNS } from '../content/weapons';
import { PERKS, type PerkId } from '../content/perks';
import { PALETTE } from '../content/palette';
import { moveBody, segDistance, segRect } from './collide';
import { FlowField } from './flowfield';
import type { EventSink } from './events';
import type { TickInput } from './input';
import { createRun, type Enemy, type SimState } from './state';

const BOSS_ARM = 45 + 6; // максимальный радиус врага + радиус пули
const hash = new SpatialHash(WORLD.w, WORLD.h, 64, 512);
const candidates: number[] = [];
const flow = new FlowField(WORLD.w, WORLD.h, 20);

export function startRun(seed: number, ev: EventSink): SimState {
  const s = createRun(seed);
  nextWave(s, ev);
  ev.push({ t: 'sfx', id: 'start' });
  return s;
}

const move = (s: SimState, e: { x: number; y: number; r: number }, dx: number, dy: number): void =>
  moveBody(e, dx, dy, s.obstacles, WORLD.w, WORLD.h);

const comboMult = (combo: number): number => Math.min(5, 1 + Math.floor(combo / 6));

export function nextWave(s: SimState, ev: EventSink): void {
  s.wave++;
  s.waveWait = 0;
  s.toSpawn = 7 + s.wave * 3;
  s.spawnTimer = 0.9;
  if (s.wave % 5 === 0) {
    s.toSpawn = Math.round(s.toSpawn * 0.6);
    queueEnemy(s, 'boss', ARENA_CENTER.x, 90);
    ev.push({ t: 'toast', key: 'toast.boss', sub: 'toast.boss.sub', params: { n: s.wave }, duration: 3 });
    ev.push({ t: 'sfx', id: 'bossSpawn' });
  } else {
    ev.push({ t: 'toast', key: 'toast.wave', sub: 'toast.wave.sub', params: { n: String(s.wave).padStart(2, '0') }, duration: 2.2 });
  }
}

function queueEnemy(s: SimState, type: EnemyType, x?: number, y?: number): void {
  const r = s.rng.spawn;
  if (x === undefined || y === undefined) {
    const side = Math.floor(range(r, 0, 4));
    x = side === 0 ? 55 : side === 1 ? WORLD.w - 55 : range(r, 70, WORLD.w - 70);
    y = side === 2 ? 55 : side === 3 ? WORLD.h - 55 : range(r, 70, WORLD.h - 70);
    if (Math.hypot(x - s.p.x, y - s.p.y) < 400) {
      x = s.p.x < WORLD.w / 2 ? WORLD.w - 65 : 65;
      y = range(r, 80, WORLD.h - 80);
    }
  }
  s.spawns.push({ type, x, y, t: 0.85 });
}

function createEnemy(s: SimState, type: EnemyType, x: number, y: number): void {
  const d = ENEMIES[type];
  const hp = d.hp(s.wave);
  s.enemies.push({
    id: s.nextId++, type, x, y, px: x, py: y, hp, maxHp: hp, r: d.r, speed: d.speed(s.wave),
    shot: range(s.rng.spawn, 0.8, 2), hit: 0, a: 0, dead: false, phase: 0,
  });
  range(s.rng.spawn, 0, TAU); // seed прототипа: не используется, но держим поток одинаковым
}

function reload(s: SimState, ev: EventSink): void {
  const p = s.p;
  const g = GUNS[p.gun]!;
  if (p.reload <= 0 && p.ammo[p.gun]! < g.mag + p.magBonus) {
    p.reload = g.reload / p.reloadSpeed;
    ev.push({ t: 'sfx', id: 'reload' });
  }
}

function switchGun(s: SimState, i: number, ev: EventSink): void {
  const p = s.p;
  if (i === p.gun || i < 0 || i >= GUNS.length) return;
  p.gun = i;
  p.reload = 0;
  p.cool = Math.max(p.cool, 0.13);
  ev.push({ t: 'sfx', id: 'switch', v: i });
}

function dash(s: SimState, inp: TickInput, ev: EventSink): void {
  const p = s.p;
  if (p.dashCd > 0) return;
  let x = inp.moveX;
  let y = inp.moveY;
  let len = Math.hypot(x, y);
  if (!len) {
    x = Math.cos(p.angle);
    y = Math.sin(p.angle);
    len = 1;
  }
  p.dx = x / len;
  p.dy = y / len;
  p.dashTime = 0.17;
  p.dashCd = p.dashMax;
  p.inv = Math.max(p.inv, 0.28);
  ev.push({ t: 'ring', x: p.x, y: p.y, color: PALETTE.cyan, max: 65, life: 0.3 });
  ev.push({ t: 'sfx', id: 'dash' });
}

function pulse(s: SimState, ev: EventSink): void {
  const p = s.p;
  if (p.energy < 100) return;
  p.energy = 0;
  ev.push({ t: 'ring', x: p.x, y: p.y, color: '#75f5df', max: 340, life: 0.6 });
  ev.push({ t: 'burst', x: p.x, y: p.y, color: '#75f5df', n: 70, force: 650 });
  ev.push({ t: 'shake', v: 12 });
  ev.push({ t: 'sfx', id: 'pulse' });
  for (const e of s.enemies) {
    const d = dist(e, p);
    if (d < 340) {
      damageEnemy(s, e, 200 * (1 - d / 550), ev);
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      move(s, e, Math.cos(a) * 65, Math.sin(a) * 65);
    }
  }
  s.bullets = s.bullets.filter((b) => b.friendly || dist(b, p) > 370);
  p.inv = Math.max(p.inv, 0.4);
}

function shoot(s: SimState, ev: EventSink): void {
  const p = s.p;
  const g = GUNS[p.gun]!;
  if (p.reload > 0 || p.cool > 0) return;
  if (p.ammo[p.gun]! <= 0) {
    reload(s, ev);
    return;
  }
  p.ammo[p.gun]!--;
  p.cool = g.delay / p.rate;
  const a = p.angle;
  const sx = p.x + Math.cos(a) * 25;
  const sy = p.y + Math.sin(a) * 25;
  for (let i = 0; i < g.pellets; i++) {
    const angle = a + (g.pellets > 1 ? ((i - (g.pellets - 1) / 2) * g.spread) / (g.pellets - 1) : range(s.rng.combat, -g.spread, g.spread));
    s.bullets.push({
      x: sx, y: sy, px: sx, py: sy, vx: Math.cos(angle) * g.speed, vy: Math.sin(angle) * g.speed,
      life: g.life, damage: g.damage * p.damage, color: g.color, friendly: true, r: g.bulletR,
      pierce: g.pierce, hit: [], boss: false,
    });
  }
  ev.push({ t: 'burst', x: sx, y: sy, color: g.color, n: 4, force: 100 });
  ev.push({ t: 'shake', v: g.shake });
  ev.push({ t: 'sfx', id: `shoot.${g.id}` });
}

function damageEnemy(s: SimState, e: Enemy, damage: number, ev: EventSink): void {
  if (e.dead) return;
  const p = s.p;
  e.hp -= damage;
  e.hit = 0.08;
  if (e.hp > 0) return;
  e.dead = true;
  s.kills++;
  s.combo = s.comboTime > 0 ? s.combo + 1 : 1;
  s.comboTime = 2.5;
  const def = ENEMIES[e.type];
  const boss = e.type === 'boss';
  const points = def.points * comboMult(s.combo);
  s.score += points;
  p.energy = clamp(p.energy + (boss ? 35 : 7), 0, 100);
  if (p.lifeSteal) p.hp = Math.min(p.maxHp, p.hp + p.lifeSteal);
  ev.push({ t: 'burst', x: e.x, y: e.y, color: def.color, n: boss ? 70 : 18, force: boss ? 400 : 200 });
  ev.push({ t: 'ring', x: e.x, y: e.y, color: def.color, max: boss ? 180 : 45, life: 0.3 });
  ev.push({ t: 'floater', x: e.x, y: e.y - 20, key: 'float.points', n: points, color: def.color });
  ev.push({ t: 'shake', v: boss ? 16 : 2 });
  if (boss || nextFloat(s.rng.loot) < 0.11) s.pickups.push({ x: e.x, y: e.y, px: e.x, py: e.y, type: 'heal', life: 18 });
  else if (nextFloat(s.rng.loot) < 0.16) s.pickups.push({ x: e.x, y: e.y, px: e.x, py: e.y, type: 'energy', life: 15 });
  ev.push({ t: 'sfx', id: boss ? 'killBoss' : 'kill' });
  if (s.combo === 12 || s.combo === 24) {
    ev.push({ t: 'toast', key: 'toast.combo', sub: 'toast.combo.sub', params: { n: s.combo, m: comboMult(s.combo) }, duration: 1.3 });
  }
}

function hurt(s: SimState, dmg: number, ev: EventSink): void {
  const p = s.p;
  if (p.inv > 0 || s.phase !== 'play') return;
  p.hp -= dmg;
  p.inv = 0.85;
  s.combo = 0;
  s.comboTime = 0;
  ev.push({ t: 'flash', v: 0.55 });
  ev.push({ t: 'shake', v: 10 });
  ev.push({ t: 'burst', x: p.x, y: p.y, color: '#ff6b61', n: 16, force: 180 });
  ev.push({ t: 'sfx', id: 'hurt' });
  if (p.hp <= 0) end(s, ev);
}

function end(s: SimState, ev: EventSink): void {
  s.p.hp = 0;
  s.phase = 'over';
  ev.push({ t: 'burst', x: s.p.x, y: s.p.y, color: PALETTE.cyan, n: 65, force: 350 });
  ev.push({ t: 'sfx', id: 'gameover' });
  ev.push({ t: 'gameover' });
}

function chooseUpgrade(s: SimState, ev: EventSink): void {
  s.phase = 'upgrade';
  const pool: PerkId[] = PERKS.map((x) => x.id);
  s.offer = [];
  for (let i = 0; i < 3; i++) s.offer.push(pool.splice(int(s.rng.loot, pool.length), 1)[0]!);
  ev.push({ t: 'sfx', id: 'upgradeOpen' });
  ev.push({ t: 'upgrade' });
}

export function applyPerk(s: SimState, id: PerkId, ev: EventSink): void {
  if (s.phase !== 'upgrade' || !s.offer.includes(id)) return;
  const p = s.p;
  switch (id) {
    case 'overload': p.damage *= 1.25; break;
    case 'rapid': p.rate *= 1.18; break;
    case 'plates': p.maxHp += 25; p.hp = p.maxHp; break;
    case 'chassis': p.speed *= 1.12; break;
    case 'mag': p.magBonus += 4; p.ammo = p.ammo.map((a) => a + 4); break;
    case 'hands': p.reloadSpeed *= 1.33; break;
    case 'phase': p.dashMax = Math.max(0.5, p.dashMax * 0.8); break;
    case 'vampire': p.lifeSteal++; break;
  }
  p.hp = Math.min(p.maxHp, p.hp + 20);
  p.ammo = GUNS.map((g) => g.mag + p.magBonus);
  p.reload = 0;
  s.bullets = [];
  s.spawns = [];
  p.inv = 1.5;
  s.offer = [];
  s.phase = 'play';
  ev.push({ t: 'sfx', id: 'upgradeTake' });
  nextWave(s, ev);
}

function enemyShot(s: SimState, e: Enemy, angle: number, speed = 285): void {
  const boss = e.type === 'boss';
  const x = e.x + Math.cos(angle) * (e.r + 8);
  const y = e.y + Math.sin(angle) * (e.r + 8);
  s.bullets.push({
    x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 5,
    damage: boss ? 16 : 12, r: 6, color: boss ? '#ff6888' : '#d79aff', friendly: false, pierce: 0, hit: [], boss,
  });
}

/** Один тик сима (dt = 1/60). */
export function step(s: SimState, inp: TickInput, dt: number, ev: EventSink): void {
  if (s.phase !== 'play') return;
  const p = s.p;
  s.tick++;
  s.time += dt;
  p.px = p.x;
  p.py = p.y;
  for (const e of s.enemies) { e.px = e.x; e.py = e.y; }
  for (const it of s.pickups) { it.px = it.x; it.py = it.y; }

  // Действия по нажатию (в прототипе — обработчики keydown между кадрами)
  if (inp.weapon !== null) switchGun(s, inp.weapon, ev);
  if (inp.cycle) switchGun(s, (p.gun + (inp.cycle > 0 ? 1 : 2)) % 3, ev);
  if (inp.reload) reload(s, ev);
  if (inp.dash) dash(s, inp, ev);
  if (inp.pulse) pulse(s, ev);

  p.inv = Math.max(0, p.inv - dt);
  p.cool -= dt;
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.energy = Math.min(100, p.energy + dt * 1.7);
  s.comboTime -= dt;
  if (p.reload > 0) {
    p.reload -= dt;
    if (p.reload <= 0) {
      p.ammo[p.gun] = GUNS[p.gun]!.mag + p.magBonus;
      ev.push({ t: 'sfx', id: 'reloadDone' });
    }
  }

  let mx = inp.moveX;
  let my = inp.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    move(s, p, p.dx * 1100 * dt, p.dy * 1100 * dt);
    ev.push({ t: 'burst', x: p.x, y: p.y, color: PALETTE.cyan, n: 2, force: 30 });
  } else move(s, p, mx * p.speed * dt, my * p.speed * dt);

  if (inp.autoAim) {
    let target: Enemy | null = null;
    let md = Infinity;
    for (const e of s.enemies) {
      const d = dist(e, p);
      if (d < md && !e.dead) { md = d; target = e; }
    }
    if (target) p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    if (target && md < 900) shoot(s, ev);
  } else {
    p.angle = Math.atan2(inp.aimY - p.y, inp.aimX - p.x);
    if (inp.fire) shoot(s, ev);
  }

  // Спавн
  if (s.toSpawn > 0) {
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      let type: EnemyType = 'drone';
      const r = nextFloat(s.rng.spawn);
      if (s.wave >= 2 && r < 0.24) type = 'runner';
      else if (s.wave >= 3 && r < 0.48) type = 'gunner';
      else if (s.wave >= 4 && r > 0.78) type = 'tank';
      queueEnemy(s, type);
      s.toSpawn--;
      s.spawnTimer = Math.max(0.19, 0.95 - s.wave * 0.045);
    }
  }
  for (let i = s.spawns.length - 1; i >= 0; i--) {
    const sp = s.spawns[i]!;
    sp.t -= dt;
    if (sp.t <= 0) {
      createEnemy(s, sp.type, sp.x, sp.y);
      s.spawns.splice(i, 1);
    }
  }

  // Враги
  flow.update(p.x, p.y, s.obstacles);
  hash.build(s.enemies);
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.hit = Math.max(0, e.hit - dt);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx);
    e.a = a;
    e.phase += dt;
    let vx = dx / d;
    let vy = dy / d;
    // Прямая видимость: поведение прототипа. Иначе — обход по полю потоков
    // (фикс: в прототипе враги застревали за стенами и на углах, если игрок стоял на месте).
    const los = !s.obstacles.some((o) => segRect(e.x, e.y, p.x, p.y, o, e.r * 0.5));
    if (!los) {
      const fdir = flow.direction(e.x, e.y);
      if (fdir) { vx = fdir.x; vy = fdir.y; }
    }
    if (los && e.type === 'gunner' && d < 430) {
      const back = d < 260 ? -1 : 0;
      vx = vx * back + Math.cos(a + Math.PI / 2) * 0.6;
      vy = vy * back + Math.sin(a + Math.PI / 2) * 0.6;
    }
    if (e.type === 'boss' && d < 260) { vx *= 0.3; vy *= 0.3; }
    const reach = los ? 70 : 12;
    for (const o of s.obstacles) {
      const qx = clamp(e.x, o.x, o.x + o.w);
      const qy = clamp(e.y, o.y, o.y + o.h);
      const od = Math.hypot(e.x - qx, e.y - qy);
      if (od < e.r + reach && od > 0) {
        const strength = (1 - od / (e.r + reach)) * 2;
        vx += ((e.x - qx) / od) * strength;
        vy += ((e.y - qy) / od) * strength;
      }
    }
    hash.queryCircle(e.x, e.y, e.r + 60, (j) => {
      const other = s.enemies[j]!;
      if (other === e || other.dead) return;
      const ed = dist(e, other);
      const safe = e.r + other.r + 6;
      if (ed < safe && ed > 0) {
        vx += ((e.x - other.x) / ed) * 0.8;
        vy += ((e.y - other.y) / ed) * 0.8;
      }
    });
    const vl = Math.hypot(vx, vy) || 1;
    move(s, e, (vx / vl) * e.speed * dt, (vy / vl) * e.speed * dt);
    if (d < e.r + p.r + 4) hurt(s, ENEMIES[e.type].contact, ev);

    if (ENEMIES[e.type].shooter) {
      e.shot -= dt;
      if (e.shot < 0 && d < 1100) {
        if (e.type === 'boss') {
          for (let i = 0; i < 14; i++) enemyShot(s, e, (i * TAU) / 14 + e.phase * 0.4, 225 + s.wave * 4);
          for (let i = -1; i <= 1; i++) enemyShot(s, e, a + i * 0.18, 340);
          e.shot = 1.9;
          ev.push({ t: 'ring', x: e.x, y: e.y, color: '#ff6888', max: 100, life: 0.3 });
          ev.push({ t: 'sfx', id: 'bossVolley' });
        } else {
          enemyShot(s, e, a);
          e.shot = Math.max(0.65, 1.8 - s.wave * 0.035);
        }
      }
    }
  }

  // Снаряды
  hash.build(s.enemies);
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 25 || b.y < 25 || b.x > WORLD.w - 25 || b.y > WORLD.h - 25;
    const hitObstacle = s.obstacles.find((o) => segRect(b.px, b.py, b.x, b.y, o, b.r));
    if (hitObstacle) {
      dead = true;
      ev.push({ t: 'burst', x: b.x, y: b.y, color: hitObstacle.crate ? '#ffba6a' : '#637a84', n: 4, force: 90 });
      if (b.friendly && hitObstacle.crate) {
        hitObstacle.hp -= b.damage;
        if (hitObstacle.hp <= 0) {
          const cx = hitObstacle.x + CRATE_SIZE / 2;
          const cy = hitObstacle.y + CRATE_SIZE / 2;
          ev.push({ t: 'burst', x: cx, y: cy, color: '#ffba6a', n: 20, force: 160 });
          if (nextFloat(s.rng.loot) < 0.5) s.pickups.push({ x: cx, y: cy, px: cx, py: cy, type: 'heal', life: 20 });
          s.obstacles.splice(s.obstacles.indexOf(hitObstacle), 1);
        }
      }
    }
    if (!dead && b.friendly) {
      candidates.length = 0;
      hash.queryRect(
        Math.min(b.px, b.x) - BOSS_ARM, Math.min(b.py, b.y) - BOSS_ARM,
        Math.max(b.px, b.x) + BOSS_ARM, Math.max(b.py, b.y) + BOSS_ARM,
        (j) => { candidates.push(j); },
      );
      candidates.sort((x, y) => x - y); // порядок прототипа: по массиву врагов
      for (const j of candidates) {
        const e = s.enemies[j]!;
        if (e.dead || b.hit.includes(e.id)) continue;
        if (segDistance(b.px, b.py, b.x, b.y, e.x, e.y) < e.r + b.r) {
          b.hit.push(e.id);
          damageEnemy(s, e, b.damage, ev);
          ev.push({ t: 'burst', x: b.x, y: b.y, color: b.color, n: 3, force: 70 });
          b.pierce--;
          if (b.pierce <= 0) { dead = true; break; }
        }
      }
    } else if (!dead && !b.friendly && segDistance(b.px, b.py, b.x, b.y, p.x, p.y) < p.r + b.r) {
      if (p.dashTime <= 0) {
        hurt(s, b.damage, ev);
        dead = true;
      }
    }
    if (dead) {
      s.bullets[i] = s.bullets[s.bullets.length - 1]!;
      s.bullets.pop();
    }
  }

  // Удаление мёртвых врагов без аллокаций
  let w = 0;
  for (const e of s.enemies) if (!e.dead) s.enemies[w++] = e;
  s.enemies.length = w;

  // Подборы
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const item = s.pickups[i]!;
    item.life -= dt;
    const d = dist(item, p);
    if (d < 135 && d > 1) {
      item.x += ((p.x - item.x) / d) * 300 * dt;
      item.y += ((p.y - item.y) / d) * 300 * dt;
    }
    if (d < 27) {
      if (item.type === 'heal') {
        p.hp = Math.min(p.maxHp, p.hp + 20);
        ev.push({ t: 'floater', x: p.x, y: p.y - 28, key: 'float.heal', n: 20, color: PALETTE.cyan });
      } else {
        p.energy = Math.min(100, p.energy + 22);
        ev.push({ t: 'floater', x: p.x, y: p.y - 28, key: 'float.energy', n: 22, color: PALETTE.violet });
      }
      ev.push({ t: 'sfx', id: 'pickup' });
      s.pickups.splice(i, 1);
    } else if (item.life <= 0) s.pickups.splice(i, 1);
  }

  if (!s.enemies.length && !s.toSpawn && !s.spawns.length && s.phase === 'play') {
    s.waveWait += dt;
    if (s.waveWait > 1.3) chooseUpgrade(s, ev);
  }
}

/** Сколько целей осталось в волне (для HUD). */
export const remainingTargets = (s: SimState): number => s.enemies.length + s.toSpawn + s.spawns.length;
