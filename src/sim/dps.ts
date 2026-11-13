/**
 * Оценка DPS для интерфейса и баланс-тестов (чистые функции, без побочных эффектов).
 * Одна формула для карточек магазина, арсенала, экрана уровня и теста «цены за эффект».
 */
import { TIER_MULT } from '../content/balance';
import { estimateDps, weaponById } from '../content/weapons';
import { CRIT_MULT } from '../content/stats';
import type { ModDef } from '../content/modules';
import { computeStats, type Stats } from './stats';
import type { SimState } from './state';
import { weaponCooldown } from './weapons';

/** DPS одного оружия при статах st (по умолчанию — текущих). */
export function weaponDps(s: SimState, id: string, tier: number, st: Stats = s.p.stats): number {
  const def = weaponById(id);
  const cls = def.dmgClass === 'melee' ? st.meleeDmg : def.dmgClass === 'ranged' ? st.rangedDmg : st.energyDmg;
  const mult = Math.max(0.1, 1 + (st.damage + cls) / 100) * (1 + (Math.min(100, st.crit) / 100) * (CRIT_MULT - 1));
  const inst = { uid: 0, id, tier, cd: 0, aim: 0, flash: 0, x: 0, y: 0 };
  const view = st === s.p.stats ? s : { ...s, p: { ...s.p, stats: st } };
  const speedUp = def.cooldown / weaponCooldown(view, def, inst);
  return estimateDps(def) * TIER_MULT[tier - 1]! * mult * (def.kind === 'turret' ? 1 : speedUp);
}

/** Суммарный DPS арсенала. */
export function arsenalDps(s: SimState, st: Stats = s.p.stats): number {
  let sum = 0;
  for (const w of s.p.weapons) sum += weaponDps(s, w.id, w.tier, st);
  return sum;
}

/** Прирост DPS арсенала, если добавить модификаторы (модуль или улучшение уровня). */
export function dpsGain(s: SimState, mods: readonly ModDef[]): { abs: number; pct: number } {
  const now = arsenalDps(s);
  const st = computeStats([...s.p.mods, ...mods.map((m) => ({ ...m, source: { kind: 'module' as const, id: '?' } }))]);
  const next = arsenalDps(s, st);
  return { abs: next - now, pct: now > 0 ? ((next - now) / now) * 100 : 0 };
}

/** Прирост DPS от покупки оружия (новый слот). */
export function weaponGain(s: SimState, id: string, tier: number): { abs: number; pct: number } {
  const now = arsenalDps(s);
  const add = weaponDps(s, id, tier);
  return { abs: add, pct: now > 0 ? (add / now) * 100 : 100 };
}
