import { describe, expect, it } from 'vitest';
import { startRun } from '../src/sim/step';
import type { SimEvent } from '../src/sim/events';
import { refreshStats, type SimState } from '../src/sim/state';
import { dpsGain, weaponGain } from '../src/sim/dps';
import { modulePrice, weaponPrice } from '../src/sim/shop';
import { MODULES } from '../src/content/modules';

/** Эталонная сборка: N оружий тира I одного класса (энергия), волна w. */
function ref(w: number, n: number): SimState {
  const ev: SimEvent[] = [];
  const s = startRun(7, ev);
  s.wave = w;
  s.p.weapons = Array.from({ length: n }, (_, i) => ({ uid: 100 + i, id: i % 2 ? 'rail' : 'pulse', tier: 1, cd: 0, aim: 0, flash: 0, x: 0, y: 0 }));
  refreshStats(s.p);
  return s;
}

/** «Цена за эффект»: % прироста DPS арсенала за 1 скрап. */
const perScrap = (pct: number, price: number): number => pct / price;

describe('экономика: цена за эффект (скилл game-balance)', () => {
  // Отзыв игроков: ранние модули на +% были «мусором» — проигрывали покупке оружия в разы.
  // Таблица (w5, 4 ствола, было → стало): amp —/0.71, charger 0.38/0.89, servo 0.40/0.80, lens 0.10/0.63, reactor 0.14/0.48.
  it('уронные модули на w5 (4 ствола) дают ≥ 0.6 от эффективности покупки оружия, редкий ≥ 0.4', () => {
    const s = ref(5, 4);
    const wpn = perScrap(weaponGain(s, 'pulse', 1).pct, weaponPrice(1, 5));
    const floor: Record<string, number> = { amp: 0.6, charger: 0.6, servo: 0.6, lens: 0.6, overclock: 0.6, reactor: 0.4 };
    for (const [id, min] of Object.entries(floor)) {
      const def = MODULES.find((m) => m.id === id)!;
      expect(perScrap(dpsGain(s, def.mods).pct, modulePrice(def.rarity, 5)) / wpn, id).toBeGreaterThan(min);
    }
  });
  it('к поздним волнам (6 стволов) модуль урона выгоднее нового ствола', () => {
    const s = ref(10, 6);
    const wpn = perScrap(weaponGain(s, 'pulse', 1).pct, weaponPrice(1, 10));
    const def = MODULES.find((m) => m.id === 'amp')!;
    expect(perScrap(dpsGain(s, def.mods).pct, modulePrice(0, 10)) / wpn).toBeGreaterThan(1);
  });
  it('ни один уронный модуль «Стандарт» не обязателен: ≤ 2.5× от оружия', () => {
    const s = ref(5, 4);
    const wpn = perScrap(weaponGain(s, 'pulse', 1).pct, weaponPrice(1, 5));
    for (const def of MODULES.filter((m) => m.rarity === 0)) {
      const g = dpsGain(s, def.mods);
      if (g.pct <= 0) continue;
      expect(perScrap(g.pct, modulePrice(0, 5)) / wpn, def.id).toBeLessThan(2.5);
    }
  });
  it('прирост DPS видим: модуль урона даёт заметную дельту, защитный — ноль', () => {
    const s = ref(5, 3);
    expect(dpsGain(s, [{ stat: 'damage', flat: 8 }]).pct).toBeGreaterThan(6);
    expect(dpsGain(s, [{ stat: 'armor', flat: 2 }]).abs).toBe(0);
  });
});
