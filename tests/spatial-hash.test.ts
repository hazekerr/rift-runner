import { describe, expect, it } from 'vitest';
import { SpatialHash } from '../src/core/spatial-hash';
import { createRng, range } from '../src/core/rng';

describe('SpatialHash', () => {
  it('queryCircle находит все объекты в радиусе (против полного перебора)', () => {
    const r = createRng(9);
    const items = Array.from({ length: 500 }, () => ({ x: range(r, 0, 1900), y: range(r, 0, 1250) }));
    const hash = new SpatialHash(1900, 1250, 64, 16);
    hash.build(items);
    for (let q = 0; q < 50; q++) {
      const cx = range(r, 0, 1900);
      const cy = range(r, 0, 1250);
      const rad = range(r, 10, 150);
      const found = new Set<number>();
      hash.queryCircle(cx, cy, rad, (i) => found.add(i));
      items.forEach((it, i) => {
        if (Math.hypot(it.x - cx, it.y - cy) <= rad) expect(found.has(i)).toBe(true);
      });
    }
  });
  it('объекты за границей мира попадают в крайние ячейки', () => {
    const hash = new SpatialHash(100, 100, 50);
    hash.build([{ x: -10, y: 150 }]);
    const found: number[] = [];
    hash.queryRect(0, 50, 49, 99, (i) => found.push(i));
    expect(found).toEqual([0]);
  });
});
