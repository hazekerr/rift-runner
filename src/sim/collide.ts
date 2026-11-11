import { clamp } from '../core/math';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Пересечение круга и AABB. */
export function circleRect(x: number, y: number, r: number, o: Rect): boolean {
  const nx = clamp(x, o.x, o.x + o.w);
  const ny = clamp(y, o.y, o.y + o.h);
  return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
}

/** Расстояние от точки (x,y) до отрезка (x1,y1)-(x2,y2). */
export function segDistance(x1: number, y1: number, x2: number, y2: number, x: number, y: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = dx * dx + dy * dy;
  const t = l ? clamp(((x - x1) * dx + (y - y1) * dy) / l, 0, 1) : 0;
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
}

/** Пересекает ли отрезок прямоугольник, расширенный на r (Liang–Barsky). */
export function segRect(x1: number, y1: number, x2: number, y2: number, o: Rect, r: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const edges: Array<[number, number]> = [
    [-dx, x1 - o.x + r],
    [dx, o.x + o.w + r - x1],
    [-dy, y1 - o.y + r],
    [dy, o.y + o.h + r - y1],
  ];
  for (const [a, b] of edges) {
    if (a === 0) {
      if (b < 0) return false;
    } else {
      const t = b / a;
      if (a < 0) {
        if (t > t1) return false;
        t0 = Math.max(t0, t);
      } else {
        if (t < t0) return false;
        t1 = Math.min(t1, t);
      }
    }
  }
  return true;
}

export interface Body {
  x: number;
  y: number;
  r: number;
}

/** Движение с раздельным разрешением по осям и стенами мира с отступом 25. */
export function moveBody(e: Body, dx: number, dy: number, obstacles: ReadonlyArray<Rect>, worldW: number, worldH: number): void {
  const nx = clamp(e.x + dx, 25 + e.r, worldW - 25 - e.r);
  if (!obstacles.some((o) => circleRect(nx, e.y, e.r, o))) e.x = nx;
  const ny = clamp(e.y + dy, 25 + e.r, worldH - 25 - e.r);
  if (!obstacles.some((o) => circleRect(e.x, ny, e.r, o))) e.y = ny;
}
