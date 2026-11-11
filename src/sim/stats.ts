import { STATS, STAT_IDS, type StatId } from '../content/stats';

export type SourceKind = 'base' | 'operator' | 'level' | 'module' | 'weapon' | 'tag' | 'dev';

/** Модификатор стата. Источник известен — для экрана расшифровки. */
export interface Modifier {
  stat: StatId;
  flat?: number;
  pct?: number;
  source: { kind: SourceKind; id: string };
}

export type Stats = Record<StatId, number>;

/** value = (base + Σflat) · (1 + Σpct/100). Проценты одной категории складываются. */
export function computeStats(mods: ReadonlyArray<Modifier>): Stats {
  const flat = {} as Record<StatId, number>;
  const pct = {} as Record<StatId, number>;
  for (const id of STAT_IDS) {
    flat[id] = STATS[id].base;
    pct[id] = 0;
  }
  for (const m of mods) {
    flat[m.stat] += m.flat ?? 0;
    pct[m.stat] += m.pct ?? 0;
  }
  const out = {} as Stats;
  for (const id of STAT_IDS) out[id] = flat[id] * (1 + pct[id] / 100);
  return out;
}

export interface BreakdownLine {
  source: Modifier['source'];
  flat: number;
  pct: number;
}

/** Расшифровка стата по источникам (сгруппировано по source). */
export function breakdown(mods: ReadonlyArray<Modifier>, stat: StatId): BreakdownLine[] {
  const lines = new Map<string, BreakdownLine>();
  lines.set('base:base', { source: { kind: 'base', id: 'base' }, flat: STATS[stat].base, pct: 0 });
  for (const m of mods) {
    if (m.stat !== stat) continue;
    const key = `${m.source.kind}:${m.source.id}`;
    const l = lines.get(key) ?? { source: m.source, flat: 0, pct: 0 };
    l.flat += m.flat ?? 0;
    l.pct += m.pct ?? 0;
    lines.set(key, l);
  }
  return [...lines.values()].filter((l) => l.flat || l.pct || l.source.kind === 'base');
}

// ---------- производные формулы (SUMMARY §4) ----------

/** Множитель входящего урона от брони. */
export function armorMult(a: number): number {
  return a >= 0 ? 10 / (10 + a) : Math.min(2, 2 - 10 / (10 - a));
}

/** Эффективное уклонение, %: излом на 40, кап 60. */
export function dodgeChance(d: number): number {
  const eff = d <= 40 ? d : 40 + (d - 40) / 2;
  return Math.max(0, Math.min(60, eff));
}

/** Эффективная скорострельность, %: излом на +100, пол −80. */
export function atkSpeedEff(s: number): number {
  const eff = s <= 100 ? s : 100 + (s - 100) / 2;
  return Math.max(-80, eff);
}

export function cooldownOf(base: number, atkSpeedPct: number): number {
  return Math.max(0.05, base / (1 + atkSpeedEff(atkSpeedPct) / 100));
}

/** Эффективное HP с учётом брони — для UI. */
export const ehp = (hp: number, armor: number): number => hp / armorMult(armor);
