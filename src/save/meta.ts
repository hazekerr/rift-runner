import { PRODUCT } from '../config';

/** Мета-сохранение с версией схемы. Миграции применяются по порядку. */
export interface MetaV1 {
  v: 1;
  best: number;
  muted: boolean;
}
export type Meta = MetaV1;

export const META_KEY = `${PRODUCT.storagePrefix}-meta`;
const LEGACY_BEST_KEY = 'rr-best';
export const META_VERSION = 1;

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const defaultMeta = (): Meta => ({ v: 1, best: 0, muted: false });

/** Привести произвольные данные к актуальной схеме. */
export function migrate(raw: unknown): Meta {
  const m = defaultMeta();
  if (!raw || typeof raw !== 'object') return m;
  const r = raw as Record<string, unknown>;
  if (typeof r.best === 'number' && Number.isFinite(r.best) && r.best >= 0) m.best = Math.floor(r.best);
  if (typeof r.muted === 'boolean') m.muted = r.muted;
  return m;
}

export function loadMeta(kv: KV | null): Meta {
  if (!kv) return defaultMeta();
  try {
    const json = kv.getItem(META_KEY);
    if (json) return migrate(JSON.parse(json));
    // Миграция из прототипа: отдельный ключ rr-best
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
