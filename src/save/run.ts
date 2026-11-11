import { PRODUCT } from '../config';
import { OPERATORS } from '../content/operators';
import { refreshStats, type SimState } from '../sim/state';
import type { KV } from './meta';

/**
 * Сохранение забега между волнами (фазы «уровень» и «магазин»), чтобы можно было закрыть вкладку.
 * Состояние сима — plain JSON, вместе с состоянием RNG: продолжение детерминировано.
 * При несовпадении версии схемы сохранение отбрасывается (старый забег нельзя продолжить корректно).
 */
export const RUN_KEY = `${PRODUCT.storagePrefix}-run`;
export const RUN_VERSION = 1;

interface RunSave {
  v: number;
  savedAt: number;
  state: SimState;
}

export function canSave(s: SimState): boolean {
  return s.phase === 'shop' || s.phase === 'levelup';
}

export function saveRun(kv: KV | null, s: SimState): boolean {
  if (!kv || !canSave(s) || s.dev) return false;
  try {
    const data: RunSave = { v: RUN_VERSION, savedAt: Date.now(), state: s };
    kv.setItem(RUN_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearRun(kv: KV | null): void {
  if (!kv) return;
  try {
    kv.setItem(RUN_KEY, '');
  } catch {
    /* игнор */
  }
}

/** Прочитать сохранённый забег; null — если нет, повреждён или другой версии. */
export function loadRun(kv: KV | null): SimState | null {
  if (!kv) return null;
  try {
    const raw = kv.getItem(RUN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<RunSave>;
    if (data.v !== RUN_VERSION || !data.state) return null;
    const s = data.state;
    if (typeof s.wave !== 'number' || !s.p || !Array.isArray(s.p.weapons) || !canSave(s)) return null;
    if (!OPERATORS.some((o) => o.id === s.operator)) return null;
    // производные поля (статы, эффекты, теги) пересчитываем из модификаторов
    const hp = s.p.hp;
    refreshStats(s.p);
    s.p.hp = hp;
    return s;
  } catch {
    return null;
  }
}
