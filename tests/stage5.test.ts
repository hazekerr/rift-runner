import { describe, expect, it } from 'vitest';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import { emptyInput } from '../src/sim/input';
import type { SimEvent } from '../src/sim/events';
import type { SimState } from '../src/sim/state';
import { chooseLevel, endWave, leaveShop } from '../src/sim/waves';
import { buyOffer } from '../src/sim/shop';
import { spawnEnemyNow } from '../src/sim/combat';
import { RUN_KEY, clearRun, loadRun, saveRun } from '../src/save/run';
import { defaultMeta, migrate, recordRun, type KV } from '../src/save/meta';
import { threatMods } from '../src/content/threat';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';
import { enemyHpMult } from '../src/content/balance';
import { ENEMIES } from '../src/content/enemies';

const mem = (): KV & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

/** Довести забег до магазина после 1-й волны. */
function toShop(seed: number): { s: SimState; ev: SimEvent[] } {
  const ev: SimEvent[] = [];
  const s = startRun(seed, ev);
  s.god = true;
  for (let i = 0; i < 60 * 25 && s.phase === 'play'; i++) step(s, { ...emptyInput(), moveX: Math.cos(i / 50) }, DT, ev);
  while (s.phase === 'levelup') chooseLevel(s, 0, ev);
  return { s, ev };
}

describe('сохранение забега', () => {
  it('сохраняется только между волнами; продолжение из сохранения совпадает с исходным', () => {
    const kv = mem();
    const { s, ev } = toShop(21);
    expect(s.phase).toBe('shop');
    s.god = false;
    expect(saveRun(kv, s)).toBe(true);
    const restored = loadRun(kv)!;
    expect(restored).not.toBeNull();
    // одинаковые действия → одинаковый результат (включая RNG)
    for (const x of [s, restored]) {
      buyOffer(x, 0, ev);
      leaveShop(x, ev);
      for (let i = 0; i < 600; i++) step(x, { ...emptyInput(), moveX: 1 }, DT, ev);
    }
    expect(JSON.stringify(restored)).toBe(JSON.stringify(s));
  });
  it('в бою не сохраняется; dev-забег не сохраняется', () => {
    const kv = mem();
    const ev: SimEvent[] = [];
    const s = startRun(1, ev);
    expect(saveRun(kv, s)).toBe(false);
    s.phase = 'shop';
    s.dev = true;
    expect(saveRun(kv, s)).toBe(false);
  });
  it('другая версия схемы или мусор — сохранение отбрасывается', () => {
    const kv = mem();
    kv.setItem(RUN_KEY, JSON.stringify({ v: 999, state: {} }));
    expect(loadRun(kv)).toBeNull();
    kv.setItem(RUN_KEY, '{broken');
    expect(loadRun(kv)).toBeNull();
    const { s } = toShop(3);
    saveRun(kv, s);
    clearRun(kv);
    expect(loadRun(kv)).toBeNull();
  });
});

describe('Угроза', () => {
  it('модификаторы наследуются по уровням', () => {
    expect(threatMods(0)).toMatchObject({ hpMult: 1, dmgMult: 1, priceMult: 1, bonusShare: 0.5, scoreMult: 1 });
    expect(threatMods(1).hpMult).toBe(1.2);
    expect(threatMods(3)).toMatchObject({ hpMult: 1.2, eliteMult: 2, dmgMult: 1.25 });
    expect(threatMods(4)).toMatchObject({ priceMult: 1.2, bonusShare: 0.25, scoreMult: 2 });
  });
  it('HP и урон врагов растут с Угрозой', () => {
    const ev: SimEvent[] = [];
    const a = startRun(1, ev, 'operator', 0);
    const b = startRun(1, ev, 'operator', 3);
    const ea = spawnEnemyNow(a, 'drone', 100, 100, null);
    const eb = spawnEnemyNow(b, 'drone', 100, 100, null);
    expect(ea.maxHp).toBe(Math.round(ENEMIES.drone.hp * enemyHpMult(1)));
    expect(eb.maxHp).toBe(Math.round(ENEMIES.drone.hp * 1.2));
    expect(eb.contact / ea.contact).toBeCloseTo(1.25);
  });
  it('на Угрозе 4 в запас уходит 25% скрапа, цены выше', () => {
    const ev: SimEvent[] = [];
    const s = startRun(2, ev, 'operator', 4);
    s.scraps.push({ x: 1, y: 1, px: 1, py: 1, vx: 0, vy: 0, v: 20, pulled: false });
    endWave(s, ev);
    expect(s.bonusPool).toBe(5);
  });
  it('победа открывает следующий уровень Угрозы', () => {
    const m = defaultMeta();
    recordRun(m, { wave: 20, kills: 1, scrap: 1, guardianKills: 1, won: true, score: 1, threat: 0 });
    expect(m.maxThreat).toBe(1);
    recordRun(m, { wave: 20, kills: 1, scrap: 1, guardianKills: 1, won: true, score: 1, threat: 1 });
    expect(m.maxThreat).toBe(2);
    recordRun(m, { wave: 20, kills: 1, scrap: 1, guardianKills: 1, won: true, score: 1, threat: 4 });
    expect(m.maxThreat).toBe(4);
  });
});

describe('настройки (meta v3)', () => {
  it('значения по умолчанию и клампинг мусора', () => {
    const m = migrate({ v: 2, best: 5, life: { wins: 1 }, settings: { music: 7, sfx: -1, shake: 0.4, flashes: 'no', lang: 'de', quality: 'low' } });
    expect(m.settings).toEqual({ music: 1, sfx: 0, shake: 0.4, flashes: true, numbers: true, lang: 'ru', quality: 'low' });
    expect(m.maxThreat).toBe(1); // v2 с победой → Угроза I открыта
  });
});

describe('локализация', () => {
  it('EN содержит все ключи RU с теми же параметрами', () => {
    const params = (v: string): string => [...v.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
    for (const k of Object.keys(ru) as Array<keyof typeof ru>) {
      expect(en[k], k).toBeTypeOf('string');
      expect(params(en[k]), k).toBe(params(ru[k]));
    }
  });
});
