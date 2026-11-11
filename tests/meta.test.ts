import { describe, expect, it } from 'vitest';
import { META_KEY, loadMeta, migrate, saveMeta, type KV } from '../src/save/meta';

const mem = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('meta save', () => {
  it('миграция из ключа прототипа rr-best', () => {
    expect(loadMeta(mem({ 'rr-best': '4520' })).best).toBe(4520);
  });
  it('мусор и битый JSON → значения по умолчанию', () => {
    expect(loadMeta(mem({ [META_KEY]: '{oops' })).best).toBe(0);
    expect(migrate({ best: -5, muted: 'yes' })).toEqual({ v: 1, best: 0, muted: false });
  });
  it('сохранение и загрузка', () => {
    const kv = mem();
    saveMeta(kv, { v: 1, best: 99, muted: true });
    expect(loadMeta(kv)).toEqual({ v: 1, best: 99, muted: true });
  });
  it('без хранилища не падает', () => {
    expect(loadMeta(null).best).toBe(0);
    expect(() => saveMeta(null, { v: 1, best: 1, muted: false })).not.toThrow();
  });
});
