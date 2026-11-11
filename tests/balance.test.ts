import { describe, expect, it } from 'vitest';
import { enemyDmgMult, enemyHpMult, rarityWeights, rerollCost, spawnRate, waveTime, xpToNext } from '../src/content/balance';
import { WEAPONS } from '../src/content/weapons';
import { waveWeights } from '../src/content/waves';

describe('баланс: кривые совпадают с SUMMARY.md', () => {
  it('таймер волны', () => {
    expect(waveTime(1)).toBe(20);
    expect(waveTime(10)).toBe(45);
    expect(waveTime(19)).toBe(58);
    expect(waveTime(20)).toBe(60);
  });
  it('множители врагов', () => {
    expect(enemyHpMult(1)).toBe(1);
    expect(enemyHpMult(10)).toBeCloseTo(3.7);
    expect(enemyHpMult(20)).toBeCloseTo(9.92, 1);
    expect(enemyDmgMult(20)).toBeCloseTo(3.28);
    expect(spawnRate(20)).toBeCloseTo(5.18);
  });
  it('опыт и реролл', () => {
    expect([1, 2, 3, 4].map(xpToNext)).toEqual([8, 20, 33, 49]);
    expect([0, 1, 2].map((n) => rerollCost(1, n))).toEqual([2, 3, 4]);
    expect([0, 1, 2].map((n) => rerollCost(10, n))).toEqual([6, 8, 10]);
  });
  it('веса редкостей: сумма 1, капы, удача растит редкие', () => {
    for (const p of [1, 5, 10, 20, 40]) {
      const w = rarityWeights(p, 0);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
    expect(rarityWeights(1, 0)[3]).toBe(0);
    expect(rarityWeights(100, 1000)[3]).toBeCloseTo(0.08);
    expect(rarityWeights(8, 50)[1]).toBeGreaterThan(rarityWeights(8, 0)[1]);
  });
  it('новые типы врагов вводятся с малым весом (не массово сразу)', () => {
    for (let w = 2; w <= 10; w++) {
      const total = waveWeights(w).reduce((a, x) => a + x.weight, 0);
      for (const x of waveWeights(w)) if (x.row.from === w && x.row.type !== 'drone') expect(x.weight / total).toBeLessThan(0.2);
    }
  });
  it('DPS тира I по одиночной цели в коридоре скилла game-balance', () => {
    const table = WEAPONS.map((w) => ({ id: w.id, dps: (w.damage * (w.pellets ?? 1)) / w.cooldown }));
    for (const { id, dps } of table) {
      expect(dps, id).toBeGreaterThan(18); // AoE/цепь — ниже одиночного
      expect(dps, id).toBeLessThan(85);
    }
  });
});
