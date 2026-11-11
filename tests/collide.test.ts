import { describe, expect, it } from 'vitest';
import { circleRect, moveBody, segDistance, segRect } from '../src/sim/collide';

const box = { x: 100, y: 100, w: 50, h: 50 };

describe('collide', () => {
  it('circleRect: касание и промах', () => {
    expect(circleRect(95, 125, 6, box)).toBe(true);
    expect(circleRect(90, 125, 6, box)).toBe(false);
    expect(circleRect(125, 125, 1, box)).toBe(true); // внутри
  });
  it('segDistance: проекция на отрезок и концы', () => {
    expect(segDistance(0, 0, 10, 0, 5, 3)).toBeCloseTo(3);
    expect(segDistance(0, 0, 10, 0, -4, 3)).toBeCloseTo(5);
    expect(segDistance(0, 0, 0, 0, 3, 4)).toBeCloseTo(5);
  });
  it('segRect: пролёт сквозь, мимо, с радиусом', () => {
    expect(segRect(50, 125, 200, 125, box, 0)).toBe(true);
    expect(segRect(50, 90, 200, 90, box, 0)).toBe(false);
    expect(segRect(50, 90, 200, 90, box, 12)).toBe(true);
    expect(segRect(50, 125, 90, 125, box, 0)).toBe(false); // не долетел
  });
  it('moveBody: скольжение вдоль стены по свободной оси', () => {
    const e = { x: 90, y: 125, r: 8 };
    moveBody(e, 10, 5, [box], 1900, 1250);
    expect(e.x).toBe(90); // упёрлись по X
    expect(e.y).toBe(130); // по Y движение прошло
  });
  it('moveBody: границы мира с отступом 25', () => {
    const e = { x: 40, y: 40, r: 10 };
    moveBody(e, -100, -100, [], 1900, 1250);
    expect(e).toMatchObject({ x: 35, y: 35 });
  });
});
