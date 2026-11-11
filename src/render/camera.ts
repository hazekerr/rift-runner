import { lerp } from '../core/math';
import { ARENA_CENTER } from '../content/arena';

/** Камера следует за оператором (как в прототипе: lerp с k = dt·8), тикает вместе с симом. */
export class Camera {
  x: number = ARENA_CENTER.x;
  y: number = ARENA_CENTER.y;
  px: number = ARENA_CENTER.x;
  py: number = ARENA_CENTER.y;

  snap(x: number, y: number): void {
    this.x = this.px = x;
    this.y = this.py = y;
  }

  tick(tx: number, ty: number, dt: number): void {
    this.px = this.x;
    this.py = this.y;
    const k = Math.min(1, dt * 8);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
  }

  ix(alpha: number): number {
    return lerp(this.px, this.x, alpha);
  }

  iy(alpha: number): number {
    return lerp(this.py, this.y, alpha);
  }
}
