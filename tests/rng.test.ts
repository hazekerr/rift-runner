import { describe, expect, it } from 'vitest';
import { createRng, fork, int, nextFloat } from '../src/core/rng';

describe('rng', () => {
  it('одинаковый сид → одинаковая последовательность', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(nextFloat(a)).toBe(nextFloat(b));
  });
  it('разные сиды расходятся', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });
  it('состояние сериализуется и восстанавливается', () => {
    const a = createRng(7);
    nextFloat(a);
    const b = JSON.parse(JSON.stringify(a));
    expect(nextFloat(a)).toBe(nextFloat(b));
  });
  it('распределение примерно равномерное', () => {
    const r = createRng(123);
    const bins = [0, 0, 0, 0];
    for (let i = 0; i < 40000; i++) bins[int(r, 4)]!++;
    for (const b of bins) expect(Math.abs(b - 10000)).toBeLessThan(400);
  });
  it('fork даёт независимый поток', () => {
    const r = createRng(5);
    const f = fork(r);
    expect(nextFloat(f)).not.toBe(nextFloat(r));
  });
});
