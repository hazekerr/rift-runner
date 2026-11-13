import { describe, expect, it } from 'vitest';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import { emptyInput } from '../src/sim/input';
import type { SimEvent } from '../src/sim/events';
import { addModule, dashCap, dashCooldown, pulseRadius } from '../src/sim/state';
import { spawnEnemyNow } from '../src/sim/combat';

// Отзыв v1.1: «рывок и импульс не прокачать». Модули способностей должны реально менять их.
describe('модули способностей', () => {
  it('Ускоритель: +1 заряд рывка, кап копий 2; Охладитель сокращает перезарядку', () => {
    const s = startRun(1, []);
    expect(dashCap(s.p)).toBe(1);
    addModule(s.p, 'thruster');
    expect(dashCap(s.p)).toBe(2);
    const base = dashCooldown(s.p);
    addModule(s.p, 'coolant');
    expect(dashCooldown(s.p)).toBeCloseTo(base * 0.8, 5);
  });
  it('Перегрузка: импульс бьёт сильнее и дальше', () => {
    const hit = (withMod: boolean): { dmg: number; r: number } => {
      const ev: SimEvent[] = [];
      const s = startRun(3, ev);
      s.p.weapons = [];
      if (withMod) addModule(s.p, 'overcharge');
      const e = spawnEnemyNow(s, 'tank', s.p.x + 100, s.p.y, null);
      e.hp = e.maxHp = 1e6;
      s.p.energy = 100;
      step(s, { ...emptyInput(), pulse: true }, DT, ev);
      return { dmg: 1e6 - e.hp, r: pulseRadius(s.p) };
    };
    const a = hit(false);
    const b = hit(true);
    expect(b.dmg).toBeGreaterThan(a.dmg * 1.7);
    expect(b.r).toBeGreaterThan(a.r);
  });
  it('Динамо: энергия импульса копится быстрее', () => {
    const fill = (withMod: boolean): number => {
      const s = startRun(4, []);
      s.p.weapons = [];
      s.god = true;
      if (withMod) addModule(s.p, 'dynamo');
      s.p.energy = 0;
      for (let i = 0; i < 60; i++) step(s, emptyInput(), DT, []);
      return s.p.energy;
    };
    expect(fill(true)).toBeCloseTo(fill(false) * 1.6, 1);
  });
});
