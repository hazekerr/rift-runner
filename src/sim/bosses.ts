/**
 * Боссы: машины состояний с телеграфами. Каждая атака: wind-up (виден заранее) → исполнение → пауза.
 * Состояние в полях врага: ai (0 — пауза/преследование, 10+k — телеграф паттерна k, 20+k — исполнение),
 * aiT — таймер, shot — счётчик ротации паттернов, tele — то, что рисуется как предупреждение.
 */
import { TAU } from '../core/math';
import { range } from '../core/rng';
import { segDistance } from './collide';
import { hurtPlayer } from './combat';
import type { EventSink } from './events';
import type { Enemy, SimState, Telegraph } from './state';
import { move } from './world';
import { threatMods } from '../content/threat';

type Pattern = 'volley' | 'fan' | 'charge' | 'spiral' | 'ringGap' | 'lasers' | 'summon' | 'slam';

const GUARDIAN: readonly Pattern[] = ['volley', 'fan', 'charge'];
const HEART_BY_PHASE: readonly (readonly Pattern[])[] = [
  ['spiral', 'ringGap'],
  ['spiral', 'lasers', 'ringGap', 'summon'],
  ['lasers', 'slam', 'spiral', 'summon', 'ringGap', 'slam'],
];
/** Длительность телеграфа: тяжёлые атаки дольше (скилл game-feel: 0.3–0.5 / 0.8–1.2 с). */
const WINDUP: Record<Pattern, number> = { volley: 0.5, fan: 0.45, charge: 0.85, spiral: 0.5, ringGap: 0.6, lasers: 1.0, summon: 0.4, slam: 1.0 };
const EXEC: Record<Pattern, number> = { volley: 0.1, fan: 0.1, charge: 0.55, spiral: 2.4, ringGap: 0.6, lasers: 0.25, summon: 0.1, slam: 0.15 };

export function heartPhase(e: Enemy): number {
  const f = e.hp / e.maxHp;
  return f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
}

function patternList(e: Enemy): readonly Pattern[] {
  return e.type === 'heart' ? HEART_BY_PHASE[heartPhase(e) - 1]! : GUARDIAN;
}

function shoot(s: SimState, e: Enemy, angle: number, speed: number, dmg: number): void {
  const x = e.x + Math.cos(angle) * (e.r + 8);
  const y = e.y + Math.sin(angle) * (e.r + 8);
  const sp = speed * threatMods(s.threat).bulletSpeedMult;
  s.bullets.push({
    x, y, px: x, py: y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, life: 6, damage: dmg, crit: false,
    r: 7, color: e.type === 'heart' ? '#ff3d6e' : '#ff6888', friendly: false, pierce: 0, hit: [], weapon: '', source: e.type,
    explodeR: 0, burnChance: 0, slowPct: 0,
  });
}

function tele(kind: Telegraph['kind'], x: number, y: number, total: number, o: Partial<Telegraph> = {}): Telegraph {
  return { kind, x, y, a: 0, spread: 0, count: 1, len: 0, r: 0, t: total, total, ...o };
}

function startTelegraph(s: SimState, e: Enemy, p: Pattern, k: number, aimA: number, ev: EventSink): void {
  const w = WINDUP[p] * (s.overtime ? 0.75 : 1);
  e.ai = 10 + k;
  e.aiT = w;
  switch (p) {
    case 'volley': case 'spiral': case 'ringGap': case 'summon':
      e.tele = tele('ring', e.x, e.y, w, { r: e.r + 40 });
      break;
    case 'fan':
      e.tele = tele('lines', e.x, e.y, w, { a: aimA, spread: 0.5, count: 5, len: 320 });
      break;
    case 'charge':
      e.vx = Math.cos(aimA);
      e.vy = Math.sin(aimA);
      e.tele = tele('lines', e.x, e.y, w, { a: aimA, count: 1, len: 720 * EXEC.charge, r: e.r });
      break;
    case 'lasers':
      e.tele = tele('lines', e.x, e.y, w, { a: aimA, spread: 0.7, count: 3, len: 1100, r: 14 });
      break;
    case 'slam':
      e.tele = tele('circle', s.p.x, s.p.y, w, { r: 130 });
      break;
  }
  ev.push({ t: 'sfx', id: 'teleWarn' });
}

function execute(s: SimState, e: Enemy, p: Pattern, ev: EventSink): void {
  const dmg = e.shotDmg;
  const tl = e.tele;
  switch (p) {
    case 'volley': {
      const a = Math.atan2(s.p.y - e.y, s.p.x - e.x);
      for (let i = 0; i < 14; i++) shoot(s, e, (i * TAU) / 14 + e.phase * 0.4, 225 + s.wave * 4, dmg);
      for (let i = -1; i <= 1; i++) shoot(s, e, a + i * 0.18, 340, dmg * 1.2);
      ev.push({ t: 'sfx', id: 'bossVolley' });
      break;
    }
    case 'fan':
      if (tl) for (let i = 0; i < 5; i++) shoot(s, e, tl.a + (i - 2) * 0.25, 380, dmg);
      ev.push({ t: 'sfx', id: 'bossVolley' });
      break;
    case 'ringGap': {
      const gap = range(s.rng.combat, 0, TAU);
      for (let i = 0; i < 28; i++) {
        const a = (i * TAU) / 28;
        let d = Math.abs(a - gap) % TAU;
        d = Math.min(d, TAU - d);
        if (d > 0.5) shoot(s, e, a, 190, dmg);
      }
      ev.push({ t: 'sfx', id: 'bossVolley' });
      break;
    }
    case 'lasers':
      if (tl) {
        for (let i = 0; i < tl.count; i++) {
          const a = tl.a + (i - (tl.count - 1) / 2) * tl.spread;
          const ex = e.x + Math.cos(a) * tl.len;
          const ey = e.y + Math.sin(a) * tl.len;
          ev.push({ t: 'beam', pts: [e.x, e.y, ex, ey], color: '#ff3d6e', life: 0.3, straight: true });
          if (segDistance(e.x, e.y, ex, ey, s.p.x, s.p.y) < s.p.r + tl.r && s.p.dashTime <= 0) hurtPlayer(s, dmg * 2.5, e.type, ev);
        }
      }
      ev.push({ t: 'shake', v: 8 });
      ev.push({ t: 'sfx', id: 'bossLaser' });
      break;
    case 'summon':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const x = Math.min(1850, Math.max(50, s.p.x + Math.cos(a) * 300));
        const y = Math.min(1200, Math.max(50, s.p.y + Math.sin(a) * 300));
        s.spawns.push({ type: 'swarm', x, y, t: 0.85, elite: null });
      }
      break;
    case 'slam':
      if (tl) {
        if (Math.hypot(s.p.x - tl.x, s.p.y - tl.y) < tl.r + s.p.r && s.p.dashTime <= 0) hurtPlayer(s, dmg * 3, e.type, ev);
        ev.push({ t: 'ring', x: tl.x, y: tl.y, color: '#ff3d6e', max: tl.r, life: 0.4 });
        ev.push({ t: 'burst', x: tl.x, y: tl.y, color: '#ff3d6e', n: 30, force: 300 });
      }
      ev.push({ t: 'shake', v: 14 });
      ev.push({ t: 'sfx', id: 'bossSlam' });
      break;
    default:
      break;
  }
}

/** Обновить босса (движение, паттерны, телеграфы). У Сердца поле vx хранит текущую фазу. */
export function updateBoss(s: SimState, e: Enemy, dt: number, ev: EventSink): void {
  const p = s.p;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const a = Math.atan2(dy, dx);
  e.a = a;
  // смена фазы Сердца
  if (e.type === 'heart') {
    const ph = heartPhase(e);
    if (ph !== e.vx && e.ai < 10) {
      if (e.vx > 0 && ph > e.vx) {
        ev.push({ t: 'toast', key: ph === 2 ? 'toast.heart.p2' : 'toast.heart.p3', sub: 'toast.phase.sub', params: {}, duration: 2 });
        ev.push({ t: 'ring', x: e.x, y: e.y, color: '#ff3d6e', max: 260, life: 0.6 });
        ev.push({ t: 'hitstop', ms: 80 });
      }
      e.vx = ph;
    }
  }
  const list = patternList(e);
  e.aiT -= dt;
  if (e.tele) e.tele.t = Math.max(0, e.aiT);

  if (e.ai === 0) {
    // преследование/дистанция
    const want = e.type === 'heart' ? 320 : 120;
    const sp = e.speed * (s.overtime ? 1.3 : 1) * (e.slow > 0 ? 1 - e.slowPct / 100 : 1);
    const dir = d > want ? 1 : -0.6;
    move(s, e, (dx / d) * sp * dir * dt, (dy / d) * sp * dir * dt);
    if (e.aiT <= 0) {
      const k = e.shot % list.length;
      startTelegraph(s, e, list[k]!, k, a, ev);
    }
  } else if (e.ai < 20) {
    if (e.type === 'boss' && list[e.ai - 10] !== 'charge' && e.tele) { e.tele.x = e.x; e.tele.y = e.y; }
    if (e.aiT <= 0) {
      const k = e.ai - 10;
      const pat = list[k] ?? list[0]!;
      e.ai = 20 + k;
      e.aiT = EXEC[pat];
      if (pat !== 'spiral' && pat !== 'charge') execute(s, e, pat, ev);
    }
  } else {
    const k = e.ai - 20;
    const pat = list[k] ?? list[0]!;
    if (pat === 'charge' && e.type === 'boss') {
      const vx = e.tele ? Math.cos(e.tele.a) : 0;
      const vy = e.tele ? Math.sin(e.tele.a) : 0;
      move(s, e, vx * 720 * dt, vy * 720 * dt);
    }
    if (pat === 'spiral') {
      // 4 потока, поворачиваются; выстрел каждые ~0.12 с
      if (Math.floor((e.aiT + dt) / 0.12) !== Math.floor(e.aiT / 0.12)) {
        const base = e.phase * 1.7;
        for (let i = 0; i < 4; i++) shoot(s, e, base + (i * TAU) / 4, 210, e.shotDmg);
      }
    }
    if (e.aiT <= 0) {
      e.ai = 0;
      e.tele = null;
      e.shot++;
      e.aiT = (e.type === 'heart' ? 0.9 : 1.3) * (s.overtime ? 0.6 : 1);
    }
  }
}
