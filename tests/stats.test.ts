import { describe, expect, it } from 'vitest';
import { armorMult, atkSpeedEff, breakdown, computeStats, cooldownOf, dodgeChance, ehp, type Modifier } from '../src/sim/stats';

describe('статы и формулы', () => {
  it('flat + pct: (base + Σflat)·(1 + Σpct/100), проценты складываются', () => {
    const mods: Modifier[] = [
      { stat: 'maxHp', flat: 20, source: { kind: 'level', id: '2' } },
      { stat: 'maxHp', pct: 10, source: { kind: 'module', id: 'a' } },
      { stat: 'maxHp', pct: 10, source: { kind: 'module', id: 'b' } },
    ];
    expect(computeStats(mods).maxHp).toBeCloseTo(120 * 1.2);
    expect(computeStats([]).crit).toBe(5);
  });
  it('расшифровка по источникам', () => {
    const mods: Modifier[] = [
      { stat: 'armor', flat: 2, source: { kind: 'level', id: '3' } },
      { stat: 'armor', flat: 1, source: { kind: 'level', id: '3' } },
      { stat: 'armor', flat: 4, source: { kind: 'module', id: 'plate' } },
    ];
    const b = breakdown(mods, 'armor');
    expect(b.find((l) => l.source.kind === 'level')!.flat).toBe(3);
    expect(b.find((l) => l.source.id === 'plate')!.flat).toBe(4);
  });
  it('броня: гипербола 10/(10+A), EHP линейно, отрицательная с капом ×2', () => {
    expect(armorMult(0)).toBe(1);
    expect(armorMult(10)).toBeCloseTo(0.5);
    expect(ehp(100, 10)).toBeCloseTo(200);
    expect(ehp(100, 20)).toBeCloseTo(300);
    expect(armorMult(-10)).toBeCloseTo(1.5);
    expect(armorMult(-1000)).toBeLessThanOrEqual(2);
    expect(armorMult(1e6)).toBeGreaterThan(0);
  });
  it('уклонение: линейно до 40, затем ×0.5, кап 60', () => {
    expect(dodgeChance(30)).toBe(30);
    expect(dodgeChance(60)).toBe(50);
    expect(dodgeChance(80)).toBe(60);
    expect(dodgeChance(500)).toBe(60);
    expect(dodgeChance(-5)).toBe(0);
  });
  it('скорострельность: излом на +100, пол кулдауна 0.05, минимум −80%', () => {
    expect(atkSpeedEff(50)).toBe(50);
    expect(atkSpeedEff(200)).toBe(150);
    expect(cooldownOf(1, 100)).toBeCloseTo(0.5);
    expect(cooldownOf(0.1, 10000)).toBe(0.05);
    expect(cooldownOf(1, -500)).toBeCloseTo(5);
  });
});
