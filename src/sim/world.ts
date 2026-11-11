import { SpatialHash } from '../core/spatial-hash';
import { WORLD } from '../content/arena';
import { moveBody } from './collide';
import { FlowField } from './flowfield';
import type { SimState } from './state';

/** Производные структуры (не входят в SimState, перестраиваются из него). */
export const enemyHash = new SpatialHash(WORLD.w, WORLD.h, 64, 1024);
export const flow = new FlowField(WORLD.w, WORLD.h, 20);
export const MAX_ENEMY_R = 61; // босс 45 × запас, элита танка 24×1.35≈33

export function move(s: SimState, e: { x: number; y: number; r: number }, dx: number, dy: number): void {
  moveBody(e, dx, dy, s.obstacles, WORLD.w, WORLD.h);
}

/** Ближайший живой враг в радиусе от точки (через spatial hash, построенный в этом тике). */
export function nearestEnemy(s: SimState, x: number, y: number, range: number, exclude?: ReadonlySet<number>): number {
  let best = -1;
  let bd = range * range;
  enemyHash.queryCircle(x, y, range + MAX_ENEMY_R, (i) => {
    const e = s.enemies[i]!;
    if (e.dead || exclude?.has(e.id)) return;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2 - e.r * e.r;
    if (d < bd || (d === bd && best >= 0 && i < best)) {
      bd = d;
      best = i;
    }
  });
  return best;
}
