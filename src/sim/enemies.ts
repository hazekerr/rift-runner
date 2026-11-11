import { TAU, clamp, dist } from '../core/math';
import { range } from '../core/rng';
import { AURA_COLOR, ELITE, HEAL_PER_SEC, HEAL_RANGE, MINE, RUNNER_DASH } from '../content/enemies';
import { segRect } from './collide';
import { updateBoss } from './bosses';
import { isBoss } from '../content/enemies';
import { hurtPlayer } from './combat';
import type { EventSink } from './events';
import type { Enemy, SimState } from './state';
import { enemyHash, flow, move } from './world';

function enemyShot(s: SimState, e: Enemy, angle: number, speed: number, dmg: number): void {
  const x = e.x + Math.cos(angle) * (e.r + 8);
  const y = e.y + Math.sin(angle) * (e.r + 8);
  const boss = e.type === 'boss';
  s.bullets.push({
    x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 5,
    damage: dmg, crit: false, r: boss ? 7 : 6, color: boss ? '#ff6888' : '#d79aff', friendly: false, pierce: 0, hit: [],
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
        const o = s.enemies[i]!;
        if (o === src || o.dead || dist(o, src) > ELITE.auraRange) return;
        if (src.elite === 'haste') o.hasted = true;
        else if (src.elite === 'shield') o.shielded = true;
        else o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.04 * dt);
      });
    }
    if (src.type === 'healer') {
      src.aiT -= dt;
      enemyHash.queryCircle(src.x, src.y, HEAL_RANGE, (i) => {
        const o = s.enemies[i]!;
        if (o === src || o.dead || isBoss(o.type) || dist(o, src) > HEAL_RANGE) return;
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
  enemyHash.build(s.enemies);
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

    e.a = a;
    let vx = dx / d;
    let vy = dy / d;
    // Прямая видимость: прямое преследование; иначе обход по полю потоков
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
    if (los && e.type === 'miner' && d < 420) {
      // держит дистанцию 300–420, стрейфит
      const back = d < 300 ? -1 : 0;
      vx = vx * back + Math.cos(a - Math.PI / 2) * 0.7;
      vy = vy * back + Math.sin(a - Math.PI / 2) * 0.7;
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
    move(s, e, (vx / vl) * speed * dt, (vy / vl) * speed * dt);
    if (d < e.r + p.r + 4) hurtPlayer(s, e.contact, e.type, ev);

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

export function updateMines(s: SimState, dt: number, ev: EventSink): void {
  const p = s.p;
  for (let i = s.mines.length - 1; i >= 0; i--) {
    const m = s.mines[i]!;
    m.arm -= dt;
    m.life -= dt;
    const near = Math.hypot(m.x - p.x, m.y - p.y) < MINE.trigger + p.r;
    if (m.arm <= 0 && (near || m.life <= 0)) {
      if (Math.hypot(m.x - p.x, m.y - p.y) < MINE.radius + p.r && p.dashTime <= 0) hurtPlayer(s, m.damage, 'mine', ev);
      ev.push({ t: 'ring', x: m.x, y: m.y, color: '#9be26b', max: MINE.radius, life: 0.35 });
      ev.push({ t: 'burst', x: m.x, y: m.y, color: '#9be26b', n: 14, force: 220 });
      ev.push({ t: 'sfx', id: 'mineBoom' });
      s.mines.splice(i, 1);
    }
  }
}
