import { describe, expect, it } from 'vitest';
import { META_KEY, loadMeta, migrate, recordRun, saveMeta, type KV } from '../src/save/meta';

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
    expect(migrate({ best: -5, muted: 'yes' })).toMatchObject({ v: 3, best: 0, muted: false, unlocked: ['operator'] });
  });
  it('сохранение и загрузка', () => {
    const kv = mem();
    const m = loadMeta(kv);
    m.best = 99; m.muted = true; m.unlocked.push('welder');
    saveMeta(kv, m);
    expect(loadMeta(kv)).toEqual(m);
  });
  it('без хранилища не падает', () => {
    expect(loadMeta(null).best).toBe(0);
    expect(() => saveMeta(null, loadMeta(null))).not.toThrow();
  });
});

describe('meta v2: миграция и открытия', () => {
  it('v1 → v2: рекорд сохраняется, базовый оператор открыт', () => {
    const m = migrate({ v: 1, best: 777, muted: true });
    expect(m).toMatchObject({ v: 3, best: 777, muted: true, unlocked: ['operator'], lastOperator: 'operator' });
    expect(m.life.runs).toBe(0);
  });
  it('неизвестные операторы и мусор отбрасываются', () => {
    const m = migrate({ v: 2, unlocked: ['operator', 'hacker', 5, 'ghost'], lastOperator: 'hacker', life: { kills: 'x', wins: 2 } });
    expect(m.unlocked).toEqual(['operator', 'ghost']);
    expect(m.lastOperator).toBe('operator');
    expect(m.life).toMatchObject({ kills: 0, wins: 2 });
  });
  it('recordRun копит статистику и открывает операторов по условиям', () => {
    const m = loadMeta(null);
    expect(recordRun(m, { wave: 5, kills: 300, scrap: 200, guardianKills: 0, won: false, score: 100, threat: 0 })).toEqual(['welder']);
    expect(recordRun(m, { wave: 11, kills: 800, scrap: 900, guardianKills: 1, won: false, score: 50, threat: 0 }).sort()).toEqual(['ghost', 'marauder', 'signal']);
    expect(m.life).toMatchObject({ runs: 2, kills: 1100, bestWave: 11, bestScrap: 900, guardianKills: 1 });
    expect(m.best).toBe(100);
  });
});
