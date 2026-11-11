/**
 * Равномерная сетка поверх мира (Nystrom, Spatial Partition).
 * Каждый объект кладётся в одну ячейку по центру; запрос расширяется на максимальный радиус.
 * Перестраивается целиком каждый тик — для сотен объектов это дешевле инкрементальных правок.
 */
export class SpatialHash {
  readonly cols: number;
  readonly rows: number;
  private heads: Int32Array;
  private next: Int32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cell: number,
    capacity = 1024,
  ) {
    this.cols = Math.max(1, Math.ceil(width / cell));
    this.rows = Math.max(1, Math.ceil(height / cell));
    this.heads = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(capacity);
  }

  private cellIndex(x: number, y: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)));
    return cy * this.cols + cx;
  }

  clear(): void {
    this.heads.fill(-1);
  }

  /** Перестроить по массиву объектов с x/y. Индекс в массиве = id в сетке. */
  build(items: ReadonlyArray<{ x: number; y: number }>): void {
    this.clear();
    if (items.length > this.next.length) this.next = new Int32Array(items.length * 2);
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const c = this.cellIndex(it.x, it.y);
      this.next[i] = this.heads[c]!;
      this.heads[c] = i;
    }
  }

  /** Вызвать cb для каждого индекса в ячейках, пересекающих прямоугольник. */
  queryRect(minX: number, minY: number, maxX: number, maxY: number, cb: (i: number) => void): void {
    const x0 = Math.max(0, Math.floor(minX / this.cell));
    const y0 = Math.max(0, Math.floor(minY / this.cell));
    const x1 = Math.min(this.cols - 1, Math.floor(maxX / this.cell));
    const y1 = Math.min(this.rows - 1, Math.floor(maxY / this.cell));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (let i = this.heads[cy * this.cols + cx]!; i !== -1; i = this.next[i]!) cb(i);
      }
    }
  }

  queryCircle(x: number, y: number, r: number, cb: (i: number) => void): void {
    this.queryRect(x - r, y - r, x + r, y + r, cb);
  }
}
