import { PRODUCT } from '../config';
import { OPERATORS, type OperatorDef } from '../content/operators';

/**
 * Мета-сохранение с версией схемы. Новая версия = новая ветка в migrate(), старые данные не теряются.
 * v1 (этап 1–3): рекорд и звук. v2 (этап 4): открытые операторы и статистика за все забеги.
 */
export interface Lifetime {
  runs: number;
  kills: number;
  bestWave: number;
  bestScrap: number;
  guardianKills: number;
  wins: number;
}

export interface MetaV2 {
  v: 2;
  best: number;
  muted: boolean;
  unlocked: string[];
  lastOperator: string;
  life: Lifetime;
}
export type Meta = MetaV2;

export const META_KEY = `${PRODUCT.storagePrefix}-meta`;
const LEGACY_BEST_KEY = 'rr-best';
export const META_VERSION = 2;

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const emptyLife = (): Lifetime => ({ runs: 0, kills: 0, bestWave: 0, bestScrap: 0, guardianKills: 0, wins: 0 });
export const defaultMeta = (): Meta => ({ v: 2, best: 0, muted: false, unlocked: ['operator'], lastOperator: 'operator', life: emptyLife() });

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Привести произвольные данные любой известной версии к актуальной схеме. */
export function migrate(raw: unknown): Meta {
  const m = defaultMeta();
  if (!raw || typeof raw !== 'object') return m;
  const r = raw as Record<string, unknown>;
  // v1 → общие поля
  m.best = num(r.best);
  if (typeof r.muted === 'boolean') m.muted = r.muted;
  // v2
  if (Array.isArray(r.unlocked)) {
    const known = new Set(OPERATORS.map((o) => o.id));
    m.unlocked = [...new Set(['operator', ...r.unlocked.filter((x): x is string => typeof x === 'string' && known.has(x))])];
  }
  if (typeof r.lastOperator === 'string' && m.unlocked.includes(r.lastOperator)) m.lastOperator = r.lastOperator;
  if (r.life && typeof r.life === 'object') {
    const l = r.life as Record<string, unknown>;
    m.life = { runs: num(l.runs), kills: num(l.kills), bestWave: num(l.bestWave), bestScrap: num(l.bestScrap), guardianKills: num(l.guardianKills), wins: num(l.wins) };
  }
  return m;
}

export function loadMeta(kv: KV | null): Meta {
  if (!kv) return defaultMeta();
  try {
    const json = kv.getItem(META_KEY);
    if (json) return migrate(JSON.parse(json));
    const legacy = Number(kv.getItem(LEGACY_BEST_KEY) ?? 0);
    const m = defaultMeta();
    if (Number.isFinite(legacy) && legacy > 0) m.best = Math.floor(legacy);
    return m;
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(kv: KV | null, m: Meta): void {
  if (!kv) return;
  try {
    kv.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* хранилище недоступно (приватный режим) — молча продолжаем */
  }
}

export function storage(): KV | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Прогресс условия открытия: [текущее, нужно]. */
export function unlockProgress(op: OperatorDef, life: Lifetime): [number, number] {
  const u = op.unlock;
  switch (u.kind) {
    case 'none': return [1, 1];
    case 'wave': return [Math.min(life.bestWave, u.n), u.n];
    case 'kills': return [Math.min(life.kills, u.n), u.n];
    case 'scrapRun': return [Math.min(life.bestScrap, u.n), u.n];
    case 'guardian': return [Math.min(life.guardianKills, u.n), u.n];
    case 'wins': return [Math.min(life.wins, u.n), u.n];
  }
}

export interface RunSummary {
  wave: number;
  kills: number;
  scrap: number;
  guardianKills: number;
  won: boolean;
  score: number;
}

/** Записать итог забега; вернуть id операторов, открытых этим забегом. */
export function recordRun(m: Meta, r: RunSummary): string[] {
  m.life.runs++;
  m.life.kills += r.kills;
  m.life.bestWave = Math.max(m.life.bestWave, r.wave);
  m.life.bestScrap = Math.max(m.life.bestScrap, r.scrap);
  m.life.guardianKills += r.guardianKills;
  if (r.won) m.life.wins++;
  m.best = Math.max(m.best, r.score);
  const opened: string[] = [];
  for (const op of OPERATORS) {
    if (m.unlocked.includes(op.id)) continue;
    const [cur, need] = unlockProgress(op, m.life);
    if (cur >= need) {
      m.unlocked.push(op.id);
      opened.push(op.id);
    }
  }
  return opened;
}
