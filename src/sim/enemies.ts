import { TAU, clamp, dist } from '../core/math';
import { range } from '../core/rng';
import { AURA_COLOR, BOMBER, ELITE, HEAL_PER_SEC, HEAL_RANGE, HIVE, LEAP, MINE, PHASE, RUNNER_DASH, SNIPE, THIEF } from '../content/enemies';
import { MAX_ALIVE } from '../content/balance';
import { segRect } from './collide';
import { updateBoss } from './bosses';
import { isBoss } from '../content/enemies';
import { threatMods } from '../content/threat';
import { hurtPlayer } from './combat';
import type { EventSink } from './events';
import type { Enemy, SimState } from './state';
import { enemyHash, flow, move, rebuildEnemyHash } from './world';

function enemyShot(s: SimState, e: Enemy, angle: number, speed: number, dmg: number): void {
  const x = e.x + Math.cos(angle) * (e.r + 8);
  const y = e.y + Math.sin(angle) * (e.r + 8);
  const boss = e.type === 'boss';
  const sniper = e.type === 'sniper';
  const sp = speed * threatMods(s.threat).bulletSpeedMult;
  s.bullets.push({
    x, y, px: x, py: y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, life: 5,
    damage: dmg, crit: false, r: boss ? 7 : sniper ? 5 : 6, color: boss ? '#ff6888' : sniper ? '#9fffb0' : '#d79aff', friendly: false, pierce: 0, hit: [],
    weapon: '', source: e.type, explodeR: 0, burnChance: 0, slowPct: 0,
  });
}

/** Ауры элит и лечение хилеров: выставляют флаги/лечат соседей. */
function applySupport(s: SimState, dt: number, ev: EventSink): void {
  for (const e of s.enemies) { e.hasted = false; e.shielded = false; }
  for (const src of s.enemies) {
    if (src.dead) continue;
    if (src.elite) {
      enemyHash.queryCircle(src.x, src.y, ELITE.auraRange, (i) => {
        const o = s.enemies[i];
        if (!o || o === src || o.dead || dist(o, src) > ELITE.auraRange) return;
        if (src.elite === 'haste') o.hasted = true;
        else if (src.elite === 'shield') o.shielded = true;
        else if (!isBoss(o.type)) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.04 * dt); // ауры не лечат боссов
      });
    }
    if (src.type === 'healer') {
      src.aiT -= dt;
      enemyHash.queryCircle(src.x, src.y, HEAL_RANGE, (i) => {
        const o = s.enemies[i];
        if (!o || o === src || o.dead || isBoss(o.type) || dist(o, src) > HEAL_RANGE) return;
        o.hp = Math.min(o.maxHp, o.hp + HEAL_PER_SEC * (src.maxHp / 45) * dt);
      });
      if (src.aiT <= 0) {
        src.aiT = 1.2;
        ev.push({ t: 'ring', x: src.x, y: src.y, color: AURA_COLOR.regen, max: HEAL_RANGE, life: 0.5 });
      }
    }
  }
}

export function updateEnemies(s: SimState, dt: number, ev: EventSink): void {
  const p = s.p;
  flow.update(p.x, p.y, s.obstacles);
  rebuildEnemyHash(s);
  applySupport(s, dt, ev);

  for (const e of s.enemies) {
    if (e.dead) continue;
    e.hit = Math.max(0, e.hit - dt);
    e.phase += dt;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx);
    if (isBoss(e.type)) {
      updateBoss(s, e, dt, ev);
      if (d < e.r + p.r + 4) hurtPlayer(s, e.contact, e.type, ev);
      continue;
    }
    let speed = e.speed * (e.hasted ? 1.3 : 1) * (e.slow > 0 ? 1 - e.slowPct / 100 : 1);

    // Раннер: погоня → замах (телеграф) → рывок → откат
    if (e.type === 'runner') {
      e.aiT -= dt;
      if (e.ai === 0 && d < RUNNER_DASH.range) { e.ai = 1; e.aiT = RUNNER_DASH.windup; e.vx = dx / d; e.vy = dy / d; }
      else if (e.ai === 1) { e.a = Math.atan2(e.vy, e.vx); if (e.aiT <= 0) { e.ai = 2; e.aiT = RUNNER_DASH.time; } }
      else if (e.ai === 2) {
        move(s, e, e.vx * RUNNER_DASH.speed * dt, e.vy * RUNNER_DASH.speed * dt);
        if (e.aiT <= 0) { e.ai = 3; e.aiT = RUNNER_DASH.recover; }
      } else if (e.ai === 3 && e.aiT <= 0) e.ai = 0;
      if (e.ai === 1 || e.ai === 2) {
        if (d < e.r + p.r + 4) hurtPlayer(s, e.contact, e.type, ev);
        continue;
      }
      if (e.ai === 3) speed *= 0.4;
    }

    // ---- 2.0: особые состояния новых врагов (во время телеграфа враг не идёт обычным ходом) ----
    if (specialAi(s, e, d, dx, dy, dt, ev)) {
      if (d < e.r + p.r + 4 && e.contact > 0) hurtPlayer(s, e.contact, e.type, ev);
      continue;
    }

    e.a = a;
    let vx = dx / d;
    let vy = dy / d;
    // Прямая видимость: прямое преследование; иначе обход по полю потоков
    // Прямая видимость дорогая (отрезок × все стены) — пересчитываем раз в 4 тика со сдвигом по id
    if ((s.tick + e.id) % 4 === 0) e.los = !s.obstacles.some((o) => segRect(e.x, e.y, p.x, p.y, o, e.r * 0.5));
    const los = e.los;
    if (!los) {
      const fdir = flow.direction(e.x, e.y);
      if (fdir) { vx = fdir.x; vy = fdir.y; }
    }
    if (los && e.type === 'gunner' && d < 430) {
      const back = d < 260 ? -1 : 0;
      vx = vx * back + Math.cos(a + Math.PI / 2) * 0.6;
      vy = vy * back + Math.sin(a + Math.PI / 2) * 0.6;
    }
    if (los && e.type === 'miner' && d < 420) {
      // держит дистанцию 300–420, стрейфит
      const back = d < 300 ? -1 : 0;
      vx = vx * back + Math.cos(a - Math.PI / 2) * 0.7;
      vy = vy * back + Math.sin(a - Math.PI / 2) * 0.7;
    }
    if (los && e.type === 'sniper' && d < SNIPE.keep + 140) {
      // держит дальнюю дистанцию, медленно стрейфит
      const back = d < SNIPE.keep ? -1 : 0;
      vx = vx * back + Math.cos(a + Math.PI / 2) * 0.4;
      vy = vy * back + Math.sin(a + Math.PI / 2) * 0.4;
    }
    if (e.type === 'thief') {
      // к ближайшему скрапу на полу; если его нет — к оператору
      let best = -1;
      let bd: number = THIEF.seek;
      for (let k = 0; k < s.scraps.length; k++) {
        const sc = s.scraps[k]!;
        const dd = Math.hypot(sc.x - e.x, sc.y - e.y);
        if (dd < bd) { bd = dd; best = k; }
      }
      if (best >= 0) {
        const sc = s.scraps[best]!;
        if (bd < e.r + 8) {
          e.loot = (e.loot ?? 0) + sc.v;
          s.scraps[best] = s.scraps[s.scraps.length - 1]!;
          s.scraps.pop();
        } else { vx = (sc.x - e.x) / bd; vy = (sc.y - e.y) / bd; e.a = Math.atan2(vy, vx); }
      }
    }
    if (e.type === 'healer') {
      // держится за спинами: позади ближайшего союзника
      if (d < 300) { vx = -vx * 0.6 + Math.cos(a + Math.PI / 2) * 0.5; vy = -vy * 0.6 + Math.sin(a + Math.PI / 2) * 0.5; }
    }
    if (e.type === 'swarm') {
      vx += Math.cos(e.phase * 3 + e.id) * 0.5;
      vy += Math.sin(e.phase * 3 + e.id) * 0.5;
    }
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
    enemyHash.queryCircle(e.x, e.y, e.r + 60, (j) => {
      const other = s.enemies[j];
      if (!other || other === e || other.dead) return;
      const ed = dist(e, other);
      const safe = e.r + other.r + 6;
      if (ed < safe && ed > 0) {
        vx += ((e.x - other.x) / ed) * 0.8;
        vy += ((e.y - other.y) / ed) * 0.8;
      }
    });
    const vl = Math.hypot(vx, vy) || 1;
    move(s, e, (vx / vl) * speed * dt, (vy / vl) * speed * dt);
    if (d < e.r + p.r + 4) hurtPlayer(s, e.contact, e.type, ev);

    // Улей выпускает рой, пока жив
    if (e.type === 'hive') {
      e.shot -= dt;
      if (e.shot < 0) {
        e.shot = HIVE.every;
        for (let k = 0; k < HIVE.count && s.enemies.length + s.spawns.length < MAX_ALIVE; k++) {
          const ang = (k / HIVE.count) * TAU + e.phase;
          s.spawns.push({ type: 'swarm', x: e.x + Math.cos(ang) * (e.r + 14), y: e.y + Math.sin(ang) * (e.r + 14), t: 0.5, elite: null });
        }
      }
    }
    // Стрельба и мины
    if (e.type === 'gunner' || e.type === 'miner') {
      e.shot -= dt;
      if (e.shot < 0 && d < 1100) {
        if (e.type === 'miner') {
          s.mines.push({ x: e.x, y: e.y, arm: MINE.arm, life: MINE.life, damage: e.shotDmg });
          e.shot = MINE.every + range(s.rng.combat, -0.4, 0.4);
          ev.push({ t: 'sfx', id: 'mineArm' });
        } else {
          enemyShot(s, e, a, 285, e.shotDmg);
          e.shot = Math.max(0.9, 2.0 - s.wave * 0.04);
        }
      }
    }
  }
}

/**
 * Состояния 2.0 с телеграфами. Возвращает true, если враг в этом тике занят (без обычного движения).
 * Поля: ai — фаза, aiT — таймер фазы, vx/vy — точка или угол цели, shot — перезарядка способности.
 */
function specialAi(s: SimState, e: Enemy, d: number, dx: number, dy: number, dt: number, ev: EventSink): boolean {
  const p = s.p;
  switch (e.type) {
    case 'bomber': {
      if (e.ai === 0 && d < BOMBER.trigger) { e.ai = 1; e.aiT = BOMBER.fuse; ev.push({ t: 'sfx', id: 'teleWarn' }); }
      if (e.ai !== 1) return false;
      e.aiT -= dt;
      if (e.aiT <= 0) {
        if (Math.hypot(p.x - e.x, p.y - e.y) < BOMBER.radius + p.r && p.dashTime <= 0) hurtPlayer(s, e.shotDmg, e.type, ev);
        ev.push({ t: 'ring', x: e.x, y: e.y, color: '#ff4f4f', max: BOMBER.radius, life: 0.35 });
        ev.push({ t: 'burst', x: e.x, y: e.y, color: '#ff4f4f', n: 18, force: 260 });
        ev.push({ t: 'sfx', id: 'mineBoom' });
        e.dead = true; // взорвался сам — без награды
      }
      return true;
    }
    case 'leaper': {
      e.shot -= dt;
      if (e.ai === 0 && d < LEAP.range && e.shot < 0) { e.ai = 1; e.aiT = LEAP.windup; e.vx = p.x; e.vy = p.y; }
      if (e.ai === 0) return false;
      e.aiT -= dt;
      if (e.ai === 1) {
        e.a = Math.atan2(e.vy - e.y, e.vx - e.x);
        if (e.aiT <= 0) { e.ai = 2; e.aiT = LEAP.time; }
      } else {
        const rem = Math.hypot(e.vx - e.x, e.vy - e.y);
        const step = Math.min(rem, (rem / Math.max(dt, e.aiT)) * dt);
        if (rem > 0.5) { e.x += ((e.vx - e.x) / rem) * step; e.y += ((e.vy - e.y) / rem) * step; }
        if (e.aiT <= 0) {
          if (Math.hypot(p.x - e.vx, p.y - e.vy) < LEAP.radius + p.r && p.dashTime <= 0) hurtPlayer(s, e.shotDmg, e.type, ev);
          ev.push({ t: 'ring', x: e.vx, y: e.vy, color: '#ff9ae0', max: LEAP.radius, life: 0.3 });
          ev.push({ t: 'shake', v: 3 });
          e.ai = 0;
          e.shot = LEAP.every;
        }
      }
      return true;
    }
    case 'sniper': {
      e.shot -= dt;
      if (e.ai === 0 && e.shot < 0 && d < 1000 && e.los) { e.ai = 1; e.aiT = SNIPE.aim; e.vx = Math.atan2(dy, dx); }
      if (e.ai !== 1) return false;
      e.aiT -= dt;
      if (e.aiT > SNIPE.lock) e.vx = Math.atan2(dy, dx); // последние 0.35 с прицел зафиксирован — можно уйти
      e.a = e.vx;
      if (e.aiT <= 0) {
        enemyShot(s, e, e.vx, SNIPE.speed, e.shotDmg);
        ev.push({ t: 'sfx', id: 'bossLaser' });
        e.ai = 0;
        e.shot = SNIPE.every;
      }
      return true;
    }
    case 'phantom': {
      e.shot -= dt;
      if (e.ai === 0 && e.shot < 0 && d > PHASE.minDist) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + range(s.rng.combat, -0.8, 0.8);
        e.ai = 1;
        e.aiT = PHASE.tele;
        e.vx = clamp(p.x + Math.cos(ang) * PHASE.offset, 50, 1850);
        e.vy = clamp(p.y + Math.sin(ang) * PHASE.offset, 50, 1200);
      }
      if (e.ai !== 1) return false;
      e.aiT -= dt;
      if (e.aiT <= 0) {
        ev.push({ t: 'burst', x: e.x, y: e.y, color: '#d6b3ff', n: 10, force: 120 });
        e.x = e.px = e.vx;
        e.y = e.py = e.vy;
        ev.push({ t: 'ring', x: e.x, y: e.y, color: '#d6b3ff', max: 40, life: 0.25 });
        e.ai = 0;
        e.shot = PHASE.every;
      }
      return false; // пока телеграф, фантом продолжает идти
    }
    default:
      return false;
  }
}

export function updateMines(s: SimState, dt: number, ev: EventSink): void {
  const p = s.p;
  for (let i = s.mines.length - 1; i >= 0; i--) {
    const m = s.mines[i]!;
    m.arm -= dt;
    m.life -= dt;
    const near = Math.hypot(m.x - p.x, m.y - p.y) < MINE.trigger + p.r;
    if (m.arm <= 0 && (near || m.life <= 0)) {
      if (Math.hypot(m.x - p.x, m.y - p.y) < MINE.radius + p.r && p.dashTime <= 0) hurtPlayer(s, m.damage, 'mine', ev);
      ev.push({ t: 'ring', x: m.x, y: m.y, color: '#ff5a4a', max: MINE.radius, life: 0.35 });
      ev.push({ t: 'burst', x: m.x, y: m.y, color: '#ff5a4a', n: 14, force: 220 });
      ev.push({ t: 'sfx', id: 'mineBoom' });
      s.mines.splice(i, 1);
    }
  }
}
