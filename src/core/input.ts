import type { TickInput } from '../sim/input';

/**
 * Слой ввода: устройства → действия. Нажатия «защёлкиваются» до ближайшего тика,
 * чтобы короткий тап не потерялся между кадрами и тиками.
 */
export class Input {
  keys = new Set<string>();
  mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
  stick = { x: 0, y: 0 };
  readonly touchMode = matchMedia('(pointer:coarse)').matches;
  private latch = { dash: false, pulse: false, reload: false, weapon: null as number | null, cycle: 0 };

  press(action: 'dash' | 'pulse' | 'reload'): void {
    this.latch[action] = true;
  }
  selectWeapon(i: number): void {
    this.latch.weapon = i;
  }
  cycleWeapon(dir: number): void {
    this.latch.cycle = dir;
  }

  reset(): void {
    this.keys.clear();
    this.mouse.down = false;
    this.stick.x = 0;
    this.stick.y = 0;
    this.latch = { dash: false, pulse: false, reload: false, weapon: null, cycle: 0 };
  }

  private axis(): { x: number; y: number } {
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.stick.x;
    const y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) + this.stick.y;
    return { x, y };
  }

  /** Собрать ввод тика. toWorld переводит экранные координаты мыши в мировые. */
  consume(toWorld: (sx: number, sy: number) => { x: number; y: number }): TickInput {
    const a = this.axis();
    const aim = toWorld(this.mouse.x, this.mouse.y);
    const out: TickInput = {
      moveX: a.x, moveY: a.y, aimX: aim.x, aimY: aim.y,
      fire: this.mouse.down, autoAim: this.touchMode,
      dash: this.latch.dash, pulse: this.latch.pulse, reload: this.latch.reload,
      weapon: this.latch.weapon, cycle: this.latch.cycle,
    };
    this.latch = { dash: false, pulse: false, reload: false, weapon: null, cycle: 0 };
    return out;
  }
}
