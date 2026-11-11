/**
 * Поле потоков к игроку: Дейкстра по сетке 25 px (8 соседей), стены расширены на радиус.
 * Производные данные: однозначно вычисляются из позиции игрока и препятствий,
 * поэтому не хранятся в SimState и не ломают детерминизм/сохранения.
 */
import type { Rect } from './collide';

const CELL = 25;
const INF = 1e9;

export class FlowField {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;
  private distance: Float64Array;
  private key = '';
  private heap: number[] = [];

  constructor(readonly w: number, readonly h: number, readonly pad = 20) {
    this.cols = Math.ceil(w / CELL);
    this.rows = Math.ceil(h / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.distance = new Float64Array(this.cols * this.rows);
  }

  private cellOf(x: number, y: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / CELL)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / CELL)));
    return cy * this.cols + cx;
  }

  /** Пересчитать, если изменилась клетка игрока или набор препятствий. */
  update(tx: number, ty: number, obstacles: ReadonlyArray<Rect>): void {
    const target = this.cellOf(tx, ty);
    let sig = 0;
    for (const o of obstacles) sig = (sig * 31 + o.x * 7 + o.y * 13 + o.w + o.h) % 1e9;
    const key = `${target}:${obstacles.length}:${sig}`;
    if (key === this.key) return;
    this.key = key;
    this.rebuildBlocked(obstacles);
    this.dijkstra(target);
  }

  private rebuildBlocked(obstacles: ReadonlyArray<Rect>): void {
    const { cols, rows, pad } = this;
    this.blocked.fill(0);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const x = (cx + 0.5) * CELL;
        const y = (cy + 0.5) * CELL;
        if (x < 25 || y < 25 || x > this.w - 25 || y > this.h - 25) { this.blocked[cy * cols + cx] = 1; continue; }
        for (const o of obstacles) {
          if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) {
            this.blocked[cy * cols + cx] = 1;
            break;
          }
        }
      }
    }
  }

  private push(cost: number, idx: number): void {
    const heap = this.heap;
    heap.push(cost, idx);
    let i = heap.length / 2 - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p * 2]! <= heap[i * 2]!) break;
      [heap[p * 2], heap[i * 2]] = [heap[i * 2]!, heap[p * 2]!];
      [heap[p * 2 + 1], heap[i * 2 + 1]] = [heap[i * 2 + 1]!, heap[p * 2 + 1]!];
      i = p;
    }
  }

  private pop(): number {
    const heap = this.heap;
    const idx = heap[1]!;
    const lastIdx = heap.pop()!;
    const lastCost = heap.pop()!;
    if (heap.length) {
      heap[0] = lastCost;
      heap[1] = lastIdx;
      let i = 0;
      const n = heap.length / 2;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < n && heap[l * 2]! < heap[m * 2]!) m = l;
        if (r < n && heap[r * 2]! < heap[m * 2]!) m = r;
        if (m === i) break;
        [heap[m * 2], heap[i * 2]] = [heap[i * 2]!, heap[m * 2]!];
        [heap[m * 2 + 1], heap[i * 2 + 1]] = [heap[i * 2 + 1]!, heap[m * 2 + 1]!];
        i = m;
      }
    }
    return idx;
  }

  private dijkstra(target: number): void {
    const { cols, rows, distance, blocked } = this;
    distance.fill(INF);
    this.heap.length = 0;
    distance[target] = 0;
    this.push(0, target);
    while (this.heap.length) {
      const cost = this.heap[0]!;
      const cur = this.pop();
      if (cost > distance[cur]!) continue;
      const cx = cur % cols;
      const cy = (cur - cx) / cols;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (blocked[ni]) continue;
          // по диагонали только если обе ортогональные клетки свободны (не срезаем углы)
          if (dx && dy && (blocked[cy * cols + nx] || blocked[ny * cols + cx])) continue;
          const nc = cost + (dx && dy ? 1.4142 : 1);
          if (nc < distance[ni]!) {
            distance[ni] = nc;
            this.push(nc, ni);
          }
        }
      }
    }
  }

  /** Направление (единичный вектор) к игроку из точки; null — если клетка изолирована. */
  direction(x: number, y: number): { x: number; y: number } | null {
    const { cols, rows, distance } = this;
    const c = this.cellOf(x, y);
    const cx = c % cols;
    const cy = (c - cx) / cols;
    let best = distance[c]!;
    let bx = 0;
    let by = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const d = distance[ny * cols + nx]!;
        if (d < best) { best = d; bx = dx; by = dy; }
      }
    }
    if (!bx && !by) return null;
    const l = Math.hypot(bx, by);
    return { x: bx / l, y: by / l };
  }
}
