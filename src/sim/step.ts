import { SHIELD, isBoss } from '../content/enemies';
/**
 * Шаг симуляции (dt = 1/60). Порядок систем: ввод/оператор → волна/спавн → враги → оружие →
 * снаряды → мины → скрап и подборы → таймер волны.
 */
import { dist } from '../core/math';
import { WORLD, CRATE_SIZE } from '../content/arena';
import { KIT, enemyHpMult } from '../content/balance';
import { PALETTE } from '../content/palette';
import { BASE_MAGNET, BASE_SPEED } from '../content/stats';
import { segDistance, segRect } from './collide';
import { damageEnemy, hurtPlayer } from './combat';
import { updateEnemies, updateMines } from './enemies';
import type { EventSink } from './events';
import type { TickInput } from './input';
import { createRun, dashCap, dashCooldown, healPlayer, maxHpOf, pulseRadius, type SimState } from './state';
import { gainScrap, startWave, updateWave } from './waves';
import { updateWeapons } from './weapons';
import { onDash, tickEffects } from './effects';
import { enemyHash, liveMaxR, MAX_ENEMY_R, move, nearestEnemy, rebuildEnemyHash } from './world';
import { chance } from '../core/rng';
import { effectScale } from './effects';

const candidates: number[] = [];

export function startRun(seed: number, ev: EventSink, operator = 'operator', threat = 0): SimState {
  const s = createRun(seed, operator, threat);
  startWave(s, ev);
  ev.push({ t: 'sfx', id: 'start' });
  return s;
}

function dash(s: SimState, inp: TickInput, ev: EventSink): void {
  const p = s.p;
  if (p.dashCharges <= 0) return;
  let x = inp.moveX;
  let y = inp.moveY;
  let len = Math.hypot(x, y);
  if (!len) { x = Math.cos(p.angle); y = Math.sin(p.angle); len = 1; }
  p.dx = x / len;
  p.dy = y / len;
  p.dashTime = 0.17;
  p.dashCharges--;
  if (p.dashCd <= 0) p.dashCd = dashCooldown(p);
  p.inv = Math.max(p.inv, 0.28);
  ev.push({ t: 'ring', x: p.x, y: p.y, color: PALETTE.cyan, max: 65, life: 0.3 });
  ev.push({ t: 'sfx', id: 'dash' });
  onDash(s, ev);
}

function pulse(s: SimState, ev: EventSink): void {
  const p = s.p;
  if (p.energy < 100) return;
  p.energy = 0;
  const R = pulseRadius(p);
  ev.push({ t: 'ring', x: p.x, y: p.y, color: '#75f5df', max: R, life: 0.6 });
  ev.push({ t: 'burst', x: p.x, y: p.y, color: '#75f5df', n: 70, force: 650 });
  ev.push({ t: 'shake', v: 12 });
  ev.push({ t: 'sfx', id: 'pulse' });
  const base = 60 * enemyHpMult(s.wave) * (1 + p.fx.pulseDmgPct / 100);
  for (const e of s.enemies) {
    const d = dist(e, p);
    if (d < R && !e.dead) {
      damageEnemy(s, e, base * (1 - d / (R * 1.6)), false, 'ability.pulse', ev);
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      move(s, e, Math.cos(a) * 65, Math.sin(a) * 65);
    }
  }
  s.bullets = s.bullets.filter((b) => b.friendly || dist(b, p) > R + 30);
  s.mines = s.mines.filter((m) => dist(m, p) > R + 30);
  p.inv = Math.max(p.inv, 0.4);
}

function updatePlayer(s: SimState, inp: TickInput, dt: number, ev: EventSink): void {
  const p = s.p;
  if (inp.dash) dash(s, inp, ev);
  if (inp.pulse) pulse(s, ev);
  p.inv = Math.max(0, p.inv - dt);
  // Заряды рывка восстанавливаются по одному
  const cap = dashCap(p);
  if (p.dashCharges < cap) {
    p.dashCd -= dt;
    if (p.dashCd <= 0) {
      p.dashCharges++;
      p.dashCd = p.dashCharges < cap ? dashCooldown(p) : 0;
    }
  } else p.dashCd = 0;
  p.lifestealCd = Math.max(0, p.lifestealCd - dt);
  p.energy = Math.min(100, p.energy + dt * 1.7 * (1 + p.fx.energyRegenPct / 100));
  s.comboTime -= dt;
  // Реген: R HP за 8 с (2.0: было 5 — реген покрывал весь урон волны)
  if (p.stats.regen > 0 && p.hp < maxHpOf(p)) {
    p.regenAcc += (p.stats.regen / 8) * dt;
    if (p.regenAcc >= 1) {
      const add = Math.floor(p.regenAcc);
      p.regenAcc -= add;
      healPlayer(s, add, 'regen');
    }
  }
  let mx = inp.moveX;
  let my = inp.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const speed = BASE_SPEED * Math.max(0.2, 1 + p.stats.speed / 100);
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    move(s, p, p.dx * 1100 * dt, p.dy * 1100 * dt);
    ev.push({ t: 'burst', x: p.x, y: p.y, color: PALETTE.cyan, n: 2, force: 30 });
  } else move(s, p, mx * speed * dt, my * speed * dt);
  // Корпус смотрит на прицел (ручной режим), иначе — по направлению движения
  if (inp.fire) p.angle = Math.atan2(inp.aimY - p.y, inp.aimX - p.x);
  else if (len > 0.1) p.angle = Math.atan2(my, mx);
}

function updateBullets(s: SimState, dt: number, ev: EventSink): void {
  const p = s.p;
  rebuildEnemyHash(s);
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i]!;
    b.px = b.x;
    b.py = b.y;
    // бумеранг: на полпути разворачивается к оператору, режет повторно, исчезает у оператора
    if (b.boom !== undefined) {
      if (!b.ret && b.life <= b.boom + 1.5) { b.ret = true; b.hit.length = 0; }
      if (b.ret) {
        const dd = Math.hypot(p.x - b.x, p.y - b.y) || 1;
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = ((p.x - b.x) / dd) * sp;
        b.vy = ((p.y - b.y) / dd) * sp;
        if (dd < 24) b.life = 0;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 25 || b.y < 25 || b.x > WORLD.w - 25 || b.y > WORLD.h - 25;
    const hitObstacle = s.obstacles.find((o) => segRect(b.px, b.py, b.x, b.y, o, b.r));
    if (hitObstacle) {
      dead = true;
      ev.push({ t: 'burst', x: b.x, y: b.y, color: hitObstacle.crate ? '#ffba6a' : '#637a84', n: 3, force: 90 });
      if (b.friendly && hitObstacle.crate) {
        hitObstacle.hp -= b.damage;
        if (hitObstacle.hp <= 0) {
          const cx = hitObstacle.x + CRATE_SIZE / 2;
          const cy = hitObstacle.y + CRATE_SIZE / 2;
          ev.push({ t: 'burst', x: cx, y: cy, color: '#ffba6a', n: 20, force: 160 });
          s.pickups.push({ x: cx, y: cy, px: cx, py: cy, type: 'heal', life: 20 });
          s.obstacles.splice(s.obstacles.indexOf(hitObstacle), 1);
        }
      }
    }
    if (!dead && b.friendly) {
      candidates.length = 0;
      const pad = liveMaxR + b.r;
      enemyHash.queryRect(Math.min(b.px, b.x) - pad, Math.min(b.py, b.y) - pad, Math.max(b.px, b.x) + pad, Math.max(b.py, b.y) + pad, (j) => {
        candidates.push(j);
      });
      if (candidates.length > 1) candidates.sort((x, y) => x - y);
      for (const j of candidates) {
        const e = s.enemies[j]!;
        if (e.dead || b.hit.includes(e.id)) continue;
        if (segDistance(b.px, b.py, b.x, b.y, e.x, e.y) < e.r + b.r) {
          b.hit.push(e.id);
          // Щитоносец: пуля спереди (±60° от взгляда) гасится щитом и останавливается
          if (e.type === 'shieldbearer') {
            const bl = Math.hypot(b.vx, b.vy) || 1;
            if (-(Math.cos(e.a) * b.vx + Math.sin(e.a) * b.vy) / bl > SHIELD.arc) {
              damageEnemy(s, e, b.damage * SHIELD.mult, false, b.weapon, ev, false);
              ev.push({ t: 'burst', x: b.x, y: b.y, color: '#7fb4ff', n: 3, force: 120 });
              dead = true;
              break;
            }
          }
          damageEnemy(s, e, b.damage, b.crit, b.weapon, ev);
          if (b.burnChance && chance(s.rng.combat, b.burnChance / 100)) {
            e.burn = 3;
            e.burnDps = Math.max(e.burnDps, 6 * effectScale(s) * s.p.fx.burnMult);
          }
          if (b.slowPct) { e.slow = 1.2; e.slowPct = Math.max(e.slowPct, b.slowPct); }
          if (b.explodeR) {
            blast(s, b.x, b.y, b.explodeR, b.damage, b.crit, b.weapon, ev, b.pull ?? 0);
            dead = true;
            break;
          }
          ev.push({ t: 'burst', x: b.x, y: b.y, color: b.color, n: 2, force: 70 });
          b.pierce--;
          if (b.pierce <= 0) { dead = true; break; }
        }
      }
    } else if (!dead && !b.friendly && segDistance(b.px, b.py, b.x, b.y, p.x, p.y) < p.r + b.r) {
      if (p.dashTime <= 0) {
        hurtPlayer(s, b.damage, b.source || 'gunner', ev);
        dead = true;
      }
    }
    if (dead) {
      s.bullets[i] = s.bullets[s.bullets.length - 1]!;
      s.bullets.pop();
    }
  }
}

/** Взрыв оружия оператора (ракета, мина, миномёт): урон всем в радиусе. */
function blast(s: SimState, x: number, y: number, r: number, dmg: number, crit: boolean, weapon: string, ev: EventSink, pull = 0): void {
  ev.push({ t: 'ring', x, y, color: '#ff9a5a', max: r, life: 0.3 });
  ev.push({ t: 'burst', x, y, color: '#ff9a5a', n: 12, force: 240 });
  ev.push({ t: 'shake', v: 3 });
  ev.push({ t: 'sfx', id: 'explode' });
  const hits: number[] = [];
  enemyHash.queryCircle(x, y, r + MAX_ENEMY_R, (i) => { hits.push(i); });
  hits.sort((a, b) => a - b);
  for (const i of hits) {
    const e = s.enemies[i]!;
    const d = Math.hypot(e.x - x, e.y - y);
    if (e.dead || d > r + e.r) continue;
    damageEnemy(s, e, dmg, crit, weapon, ev);
    // гравиган: стянуть к центру (боссов не двигаем)
    if (pull > 0 && !e.dead && !isBoss(e.type) && d > 1) move(s, e, ((x - e.x) / d) * Math.min(pull, d), ((y - e.y) / d) * Math.min(pull, d));
  }
}

function updateTraps(s: SimState, dt: number, ev: EventSink): void {
  for (let i = s.traps.length - 1; i >= 0; i--) {
    const tr = s.traps[i]!;
    tr.arm -= dt;
    tr.life -= dt;
    let go = false;
    if (tr.artillery) go = tr.arm <= 0;
    else if (tr.arm <= 0) {
      enemyHash.queryCircle(tr.x, tr.y, 24 + MAX_ENEMY_R, (j) => {
        const e = s.enemies[j];
        if (e && !e.dead && Math.hypot(e.x - tr.x, e.y - tr.y) < e.r + 24) go = true;
      });
    }
    if (go) blast(s, tr.x, tr.y, tr.r, tr.damage, tr.crit, tr.weapon, ev);
    if (go || tr.life <= 0) s.traps.splice(i, 1);
  }
}

function updateTurrets(s: SimState, dt: number, ev: EventSink): void {
  for (let i = s.turrets.length - 1; i >= 0; i--) {
    const tu = s.turrets[i]!;
    tu.life -= dt;
    tu.cd -= dt;
    if (tu.life <= 0) {
      ev.push({ t: 'burst', x: tu.x, y: tu.y, color: PALETTE.cyan, n: 8, force: 120 });
      s.turrets.splice(i, 1);
      continue;
    }
    const j = nearestEnemy(s, tu.x, tu.y, tu.range);
    if (j < 0) continue;
    const e = s.enemies[j]!;
    tu.aim = Math.atan2(e.y - tu.y, e.x - tu.x);
    if (tu.cd > 0) continue;
    tu.cd = tu.rate;
    const sp = 1100;
    s.bullets.push({
      x: tu.x, y: tu.y, px: tu.x, py: tu.y, vx: Math.cos(tu.aim) * sp, vy: Math.sin(tu.aim) * sp, life: tu.range / sp,
      damage: tu.damage, crit: false, color: PALETTE.cyan, friendly: true, r: 2.5, pierce: 1 + s.p.fx.pierceBonus, hit: [],
      weapon: 'turret', source: '', explodeR: 0, burnChance: 0, slowPct: 0,
    });
  }
}

function updateLoot(s: SimState, dt: number, ev: EventSink): void {
  const p = s.p;
  const magnet = BASE_MAGNET * Math.max(0.3, 1 + p.stats.magnet / 100);
  let picked = 0;
  for (let i = s.scraps.length - 1; i >= 0; i--) {
    const sc = s.scraps[i]!;
    sc.px = sc.x;
    sc.py = sc.y;
    // разлёт при выпадении затухает
    sc.x += sc.vx * dt;
    sc.y += sc.vy * dt;
    const k = Math.exp(-dt * 6);
    sc.vx *= k;
    sc.vy *= k;
    const d = Math.hypot(p.x - sc.x, p.y - sc.y);
    if (d < magnet) sc.pulled = true;
    if (sc.pulled && d > 1) {
      const pull = Math.min(d, (420 + (magnet - Math.min(d, magnet)) * 4) * dt);
      sc.x += ((p.x - sc.x) / d) * pull;
      sc.y += ((p.y - sc.y) / d) * pull;
    }
    if (d < p.r + 10) {
      gainScrap(s, sc.v, ev);
      picked += sc.v;
      s.scraps[i] = s.scraps[s.scraps.length - 1]!;
      s.scraps.pop();
    }
  }
  if (picked) ev.push({ t: 'sfx', id: 'scrap' });
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const item = s.pickups[i]!;
    item.px = item.x;
    item.py = item.y;
    item.life -= dt;
    const d = dist(item, p);
    if (d < 135 && d > 1) {
      item.x += ((p.x - item.x) / d) * 300 * dt;
      item.y += ((p.y - item.y) / d) * 300 * dt;
    }
    if (d < 27) {
      if (item.type === 'heal') {
        const heal = Math.round(maxHpOf(p) * KIT.heal);
        healPlayer(s, heal, 'kit');
        ev.push({ t: 'floater', x: p.x, y: p.y - 28, key: 'float.heal', n: heal, color: PALETTE.cyan });
      } else {
        p.energy = Math.min(100, p.energy + 22);
        ev.push({ t: 'floater', x: p.x, y: p.y - 28, key: 'float.energy', n: 22, color: PALETTE.violet });
      }
      ev.push({ t: 'sfx', id: 'pickup' });
      s.pickups.splice(i, 1);
    } else if (item.life <= 0) s.pickups.splice(i, 1);
  }
}

/** Один тик сима. Ничего не делает вне фазы боя. */
export function step(s: SimState, inp: TickInput, dt: number, ev: EventSink): void {
  if (s.phase !== 'play') return;
  const p = s.p;
  s.tick++;
  s.time += dt;
  p.px = p.x;
  p.py = p.y;
  for (const e of s.enemies) { e.px = e.x; e.py = e.y; }
  // Сетка должна быть актуальна до любых запросов (ударная волна в updatePlayer может вызвать взрывы)
  rebuildEnemyHash(s);

  updatePlayer(s, inp, dt, ev);
  updateEnemies(s, dt, ev);
  if (s.phase !== 'play') return;
  updateWeapons(s, inp, dt, ev);
  tickEffects(s, dt, ev, damageEnemy);
  updateTurrets(s, dt, ev);
  updateBullets(s, dt, ev);
  updateTraps(s, dt, ev);
  updateMines(s, dt, ev);

  let w = 0;
  for (const e of s.enemies) if (!e.dead) s.enemies[w++] = e;
  s.enemies.length = w;
  if (s.phase !== 'play') return;

  updateLoot(s, dt, ev);
  updateWave(s, dt, ev);
}
