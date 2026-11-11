/**
 * Интерпретатор эффектов модулей. Эффекты агрегируются по типу (сумма шансов/силы, максимум радиусов),
 * триггеры вызываются из боя. Глубина рекурсии 1: урон от эффектов не запускает on-hit/on-kill эффекты.
 */
import { TAU } from '../core/math';
import { chance } from '../core/rng';
import { enemyHpMult } from '../content/balance';
import { moduleById } from '../content/modules';
import { PALETTE } from '../content/palette';
import type { EventSink } from './events';
import { maxHpOf, type Enemy, type SimState } from './state';
import { enemyHash, MAX_ENEMY_R, nearestEnemy } from './world';

export interface FxAgg {
  killExplode: { chance: number; r: number; dmg: number };
  dashNova: { count: number; dmg: number };
  waveShield: number;
  hurtNova: { dmg: number; r: number };
  burn: { chance: number; dps: number; dur: number };
  slow: { chance: number; pct: number; dur: number };
  scrapHealEvery: number;
  energyOnKill: number;
  lowHpDmg: { pct: number; below: number };
  critArc: { targets: number; pct: number };
  zaps: Array<{ every: number; dmg: number; targets: number }>;
  dashReset: { chance: number; sec: number };
  scrapOnKill: number;
  killHeal: { chance: number; amount: number };
  execute: number;
}

export const emptyFx = (): FxAgg => ({
  killExplode: { chance: 0, r: 0, dmg: 0 }, dashNova: { count: 0, dmg: 0 }, waveShield: 0, hurtNova: { dmg: 0, r: 0 },
  burn: { chance: 0, dps: 0, dur: 0 }, slow: { chance: 0, pct: 0, dur: 0 }, scrapHealEvery: 0, energyOnKill: 0,
  lowHpDmg: { pct: 0, below: 0 }, critArc: { targets: 0, pct: 0 }, zaps: [], dashReset: { chance: 0, sec: 0 },
  scrapOnKill: 0, killHeal: { chance: 0, amount: 0 }, execute: 0,
});

/** Сложить эффекты всех модулей (копии стакаются). */
export function aggregate(modules: ReadonlyArray<{ id: string; count: number }>): FxAgg {
  const a = emptyFx();
  for (const { id, count } of modules) {
    const e = moduleById(id).effect;
    if (!e) continue;
    for (let i = 0; i < count; i++) {
      switch (e.kind) {
        case 'killExplode': a.killExplode.chance += e.chance; a.killExplode.r = Math.max(a.killExplode.r, e.r); a.killExplode.dmg = Math.max(a.killExplode.dmg, e.dmg); break;
        case 'dashNova': a.dashNova.count += e.count; a.dashNova.dmg = Math.max(a.dashNova.dmg, e.dmg); break;
        case 'waveShield': a.waveShield += e.charges; break;
        case 'hurtNova': a.hurtNova.dmg += e.dmg; a.hurtNova.r = Math.max(a.hurtNova.r, e.r); break;
        case 'burn': a.burn.chance += e.chance; a.burn.dps = Math.max(a.burn.dps, e.dps); a.burn.dur = Math.max(a.burn.dur, e.dur); break;
        case 'slow': a.slow.chance += e.chance; a.slow.pct = Math.max(a.slow.pct, e.pct); a.slow.dur = Math.max(a.slow.dur, e.dur); break;
        case 'scrapHeal': a.scrapHealEvery = a.scrapHealEvery ? Math.max(3, a.scrapHealEvery * 0.7) : e.every; break;
        case 'energyOnKill': a.energyOnKill += e.amount; break;
        case 'lowHpDmg': a.lowHpDmg.pct += e.pct; a.lowHpDmg.below = Math.max(a.lowHpDmg.below, e.below); break;
        case 'critArc': a.critArc.targets += e.targets; a.critArc.pct = Math.max(a.critArc.pct, e.pct); break;
        case 'zap': a.zaps.push({ every: e.every, dmg: e.dmg, targets: e.targets }); break;
        case 'dashReset': a.dashReset.chance += e.chance; a.dashReset.sec = Math.max(a.dashReset.sec, e.sec); break;
        case 'scrapOnKill': a.scrapOnKill += e.chance; break;
        case 'killHeal': a.killHeal.chance += e.chance; a.killHeal.amount = Math.max(a.killHeal.amount, e.amount); break;
        case 'execute': a.execute = Math.max(a.execute, e.below); break;
      }
    }
  }
  a.killExplode.chance = Math.min(100, a.killExplode.chance);
  a.burn.chance = Math.min(100, a.burn.chance);
  a.slow.chance = Math.min(100, a.slow.chance);
  a.dashReset.chance = Math.min(100, a.dashReset.chance);
  a.killHeal.chance = Math.min(100, a.killHeal.chance);
  a.dashNova.count = Math.min(40, a.dashNova.count);
  return a;
}

/** Масштаб урона эффектов: растёт с волной и общим уроном. */
export const effectScale = (s: SimState): number => enemyHpMult(Math.max(1, s.wave)) * Math.max(0.1, 1 + s.p.stats.damage / 100);

type DamageFn = (s: SimState, e: Enemy, raw: number, crit: boolean, weapon: string, ev: EventSink, show: boolean, depth: number) => void;

/** Урон по области (взрыв/нова), без рекурсии эффектов. */
export function areaDamage(s: SimState, x: number, y: number, r: number, dmg: number, source: string, ev: EventSink, dmgFn: DamageFn): void {
  enemyHash.queryCircle(x, y, r + MAX_ENEMY_R, (i) => {
    const e = s.enemies[i]!;
    if (e.dead || Math.hypot(e.x - x, e.y - y) > r + e.r) return;
    dmgFn(s, e, dmg, false, source, ev, true, 1);
  });
}

export function onHit(s: SimState, e: Enemy, dmg: number, crit: boolean, ev: EventSink, dmgFn: DamageFn): void {
  const fx = s.p.fx;
  if (fx.burn.chance && chance(s.rng.combat, fx.burn.chance / 100)) {
    e.burn = fx.burn.dur;
    e.burnDps = fx.burn.dps * effectScale(s);
  }
  if (fx.slow.chance && chance(s.rng.combat, fx.slow.chance / 100)) {
    e.slow = fx.slow.dur;
    e.slowPct = fx.slow.pct;
  }
  if (crit && fx.critArc.targets > 0) {
    const hit = new Set<number>([e.id]);
    const pts = [e.x, e.y];
    let from = e;
    for (let k = 0; k < fx.critArc.targets; k++) {
      const j = nearestEnemy(s, from.x, from.y, 150, hit);
      if (j < 0) break;
      const o = s.enemies[j]!;
      hit.add(o.id);
      pts.push(o.x, o.y);
      dmgFn(s, o, (dmg * fx.critArc.pct) / 100, false, 'm.arcprism', ev, true, 1);
      from = o;
    }
    if (pts.length > 2) ev.push({ t: 'beam', pts, color: '#8fd8ff', life: 0.12 });
  }
  if (fx.execute > 0 && !e.dead && e.type !== 'boss' && e.hp > 0 && e.hp / e.maxHp < fx.execute / 100) {
    dmgFn(s, e, e.hp + 1, false, 'm.executioner', ev, false, 1);
  }
}

/** Вернуть дополнительный скрап от эффектов (onKill). */
export function onKill(s: SimState, e: Enemy, ev: EventSink, dmgFn: DamageFn): number {
  const fx = s.p.fx;
  const p = s.p;
  let extraScrap = 0;
  if (fx.killExplode.chance && chance(s.rng.combat, fx.killExplode.chance / 100)) {
    ev.push({ t: 'ring', x: e.x, y: e.y, color: '#ff9a5a', max: fx.killExplode.r, life: 0.3 });
    ev.push({ t: 'burst', x: e.x, y: e.y, color: '#ff9a5a', n: 14, force: 260 });
    ev.push({ t: 'shake', v: 3 });
    areaDamage(s, e.x, e.y, fx.killExplode.r, fx.killExplode.dmg * effectScale(s), 'm.explode', ev, dmgFn);
  }
  if (fx.energyOnKill) p.energy = Math.min(100, p.energy + fx.energyOnKill);
  if (fx.killHeal.chance && chance(s.rng.combat, fx.killHeal.chance / 100)) p.hp = Math.min(maxHpOf(p), p.hp + fx.killHeal.amount);
  if (fx.dashReset.chance && chance(s.rng.combat, fx.dashReset.chance / 100)) p.dashCd = Math.max(0, p.dashCd - fx.dashReset.sec);
  if (fx.scrapOnKill && chance(s.rng.loot, fx.scrapOnKill / 100)) extraScrap++;
  return extraScrap;
}

export function onDash(s: SimState, ev: EventSink): void {
  const n = s.p.fx.dashNova.count;
  if (!n) return;
  const dmg = s.p.fx.dashNova.dmg * effectScale(s);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    s.bullets.push({
      x: s.p.x, y: s.p.y, px: s.p.x, py: s.p.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.4,
      damage: dmg, crit: false, color: PALETTE.cyan, friendly: true, r: 3, pierce: 2, hit: [], weapon: 'm.nova', source: '',
    });
  }
}

/** Вернуть true, если удар поглощён щитом. */
export function absorbHit(s: SimState, ev: EventSink): boolean {
  if (s.p.shield <= 0) return false;
  s.p.shield--;
  s.p.inv = 0.5;
  ev.push({ t: 'ring', x: s.p.x, y: s.p.y, color: '#8fd8ff', max: 50, life: 0.35 });
  ev.push({ t: 'floater', x: s.p.x, y: s.p.y - 30, key: 'float.shield', n: s.p.shield, color: '#8fd8ff' });
  ev.push({ t: 'sfx', id: 'dodge' });
  return true;
}

export function onHurt(s: SimState, ev: EventSink, dmgFn: DamageFn): void {
  const hn = s.p.fx.hurtNova;
  if (!hn.dmg) return;
  ev.push({ t: 'ring', x: s.p.x, y: s.p.y, color: PALETTE.orange, max: hn.r, life: 0.3 });
  areaDamage(s, s.p.x, s.p.y, hn.r, hn.dmg * effectScale(s), 'm.thorns', ev, dmgFn);
}

/** Периодические эффекты и DoT/замедление врагов. */
export function tickEffects(s: SimState, dt: number, ev: EventSink, dmgFn: DamageFn): void {
  const p = s.p;
  const zaps = p.fx.zaps;
  while (p.zapT.length < zaps.length) p.zapT.push(0);
  for (let k = 0; k < zaps.length; k++) {
    const z = zaps[k]!;
    p.zapT[k]! -= dt;
    if (p.zapT[k]! > 0) continue;
    const hit = new Set<number>();
    const pts: number[] = [];
    for (let j = 0; j < z.targets; j++) {
      const i = nearestEnemy(s, p.x, p.y, 380, hit);
      if (i < 0) break;
      const e = s.enemies[i]!;
      hit.add(e.id);
      pts.push(p.x, p.y - 26, e.x, e.y);
      dmgFn(s, e, z.dmg * effectScale(s), false, 'm.zap', ev, true, 1);
    }
    p.zapT[k] = hit.size ? z.every : 0.2;
    if (pts.length) {
      for (let j = 0; j < pts.length; j += 4) ev.push({ t: 'beam', pts: pts.slice(j, j + 4), color: '#b4a0ff', life: 0.1 });
      ev.push({ t: 'sfx', id: 'shoot.arc' });
    }
  }
  for (const e of s.enemies) {
    if (e.dead) continue;
    if (e.slow > 0) e.slow -= dt;
    if (e.burn > 0) {
      e.burn -= dt;
      dmgFn(s, e, e.burnDps * dt, false, 'm.burn', ev, false, 1);
    }
  }
}
