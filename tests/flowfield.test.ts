import { describe, expect, it } from 'vitest';
import { FlowField } from '../src/sim/flowfield';
import { makeArena, WORLD } from '../src/content/arena';

describe('FlowField', () => {
  it('ведёт в обход стены к цели', () => {
    const f = new FlowField(WORLD.w, WORLD.h, 20);
    f.update(950, 625, makeArena());
    // над стеной [890,210,120,55], цель снизу: направление должно иметь горизонтальную составляющую
    const d = f.direction(950, 180)!;
    expect(d).not.toBeNull();
    expect(Math.abs(d.x)).toBeGreaterThan(0.5);
  });
  it('в открытом поле указывает примерно на цель', () => {
    const f = new FlowField(WORLD.w, WORLD.h, 20);
    f.update(950, 625, makeArena());
    const d = f.direction(800, 625)!;
    expect(d.x).toBeGreaterThan(0.6);
  });
});
