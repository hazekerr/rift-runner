import { describe, expect, it } from 'vitest';
import { FlowField } from '../src/sim/flowfield';
import { makeArena, WORLD } from '../src/content/arena';

describe('FlowField', () => {
  it('ведёт в обход стены к цели', () => {
    const f = new FlowField(WORLD.w, WORLD.h, 20);
    // арена открытая; проверяем механику на явной стене (сим её поддерживает)
    f.update(950, 625, [...makeArena(), { x: 890, y: 210, w: 120, h: 55, crate: false, hp: Infinity }]);
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
