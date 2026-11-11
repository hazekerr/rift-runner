/**
 * Пул фиксированной ёмкости (Nystrom, Object Pool). Объекты создаются один раз,
 * живые лежат в начале массива [0, count), удаление — swap с последним живым.
 */
export class Pool<T> {
  readonly items: T[];
  count = 0;

  constructor(readonly capacity: number, make: () => T) {
    this.items = Array.from({ length: capacity }, make);
  }

  /** Взять объект; при переполнении переиспользует самый старый слот (0). */
  spawn(): T {
    if (this.count < this.capacity) return this.items[this.count++]!;
    return this.items[0]!;
  }

  /** Удалить живой объект с индексом i (порядок не сохраняется). */
  kill(i: number): void {
    const last = --this.count;
    if (i !== last) {
      const tmp = this.items[i]!;
      this.items[i] = this.items[last]!;
      this.items[last] = tmp;
    }
  }

  clear(): void {
    this.count = 0;
  }
}
