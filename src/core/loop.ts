/**
 * Цикл с фиксированным шагом (Fiedler, «Fix Your Timestep!»).
 * update вызывается строго с DT, render получает alpha ∈ [0,1) для интерполяции.
 */
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;
const MAX_FRAME = 0.25;
const MAX_STEPS = 5;

export interface LoopHooks {
  /** Вернуть false, чтобы не продвигать сим (пауза, меню). */
  shouldTick(): boolean;
  tick(dt: number): void;
  /** frameDt — реальное время кадра (для эффектов вне сима). */
  render(alpha: number, frameDt: number): void;
}

export function startLoop(hooks: LoopHooks): () => void {
  let last = -1;
  let acc = 0;
  let raf = 0;
  const frame = (ts: number): void => {
    const frameDt = last < 0 ? DT : Math.min(MAX_FRAME, (ts - last) / 1000);
    last = ts;
    if (hooks.shouldTick()) {
      acc += frameDt;
      let steps = 0;
      while (acc >= DT && steps < MAX_STEPS) {
        hooks.tick(DT);
        acc -= DT;
        steps++;
        if (!hooks.shouldTick()) break;
      }
      if (steps === MAX_STEPS) acc = Math.min(acc, DT);
    } else {
      acc = 0;
    }
    hooks.render(hooks.shouldTick() ? acc / DT : 1, frameDt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
