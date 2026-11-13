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
  // Эффективность относительно покупки ствола на w5 (4 ствола), было → стало:
  // charger 0.30 → 0.60, servo 0.26 → 0.56, lens 0.06 → 0.43, reactor 0.13 → 0.35, amp (новый) 0.50.
  // Порог ниже 1 намеренно: ранний ствол сильнее (жанр), но модуль не должен быть «мусором».
  it('уронные модули на w5 (4 ствола): ≥ 0.45 от покупки оружия, крит ≥ 0.4, редкий ≥ 0.3', () => {
    const s = ref(5, 4);
    const wpn = perScrap(weaponGain(s, 'pulse', 1).pct, weaponPrice(1, 5));
    const floor: Record<string, number> = { amp: 0.45, charger: 0.45, servo: 0.45, overclock: 0.45, lens: 0.4, reactor: 0.3 };
    for (const [id, min] of Object.entries(floor)) {
      const def = MODULES.find((m) => m.id === id)!;
      expect(perScrap(dpsGain(s, def.mods).pct, modulePrice(def.rarity, 5)) / wpn, id).toBeGreaterThan(min);
    }
  });
  it('к поздним волнам (6 стволов) модуль класса сопоставим с новым стволом', () => {
    const s = ref(10, 6);
    const wpn = perScrap(weaponGain(s, 'pulse', 1).pct, weaponPrice(1, 10));
    const def = MODULES.find((m) => m.id === 'charger')!;
    expect(perScrap(dpsGain(s, def.mods).pct, modulePrice(0, 10)) / wpn).toBeGreaterThan(0.8);
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
