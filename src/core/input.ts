import type { TickInput } from '../sim/input';

/** Кнопки стандартного геймпада (W3C Standard Gamepad). */
const PAD = { A: 0, B: 1, X: 2, Y: 3, RB: 5, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export type NavCmd = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';
const DEADZONE = 0.2;

/**
 * Слой ввода: устройства → действия. Нажатия «защёлкиваются» до ближайшего тика,
 * чтобы короткий тап не потерялся между кадрами и тиками.
 */
export class Input {
  keys = new Set<string>();
  mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
  stick = { x: 0, y: 0 };
  /** Тач-кнопка «ОГОНЬ» (для Связиста). */
  touchFire = false;
  readonly touchMode = matchMedia('(pointer:coarse)').matches;
  /** Правый стик геймпада: направление ручного огня (если отклонён). */
  padAim = { x: 0, y: 0, active: false };
  private padMove = { x: 0, y: 0 };
  private padPrev: boolean[] = [];
  private latch = { dash: false, pulse: false };
  /** Колбэк на Start геймпада (пауза). */
  onPadStart: (() => void) | null = null;
  /** Навигация по меню с геймпада (вызывается только по фронту нажатия). */
  onPadNav: ((cmd: NavCmd) => void) | null = null;
  private stickNav = 0;

  press(action: 'dash' | 'pulse'): void {
    this.latch[action] = true;
  }

  reset(): void {
    this.keys.clear();
    this.mouse.down = false;
    this.stick.x = 0;
    this.stick.y = 0;
    this.touchFire = false;
    this.latch = { dash: false, pulse: false };
  }

  /** Опрос геймпада — раз в кадр. */
  pollGamepad(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const gp = pads.find((g) => g && g.connected) ?? null;
    if (!gp) {
      this.padMove.x = this.padMove.y = 0;
      this.padAim.active = false;
      return;
    }
    const dz = (v: number): number => (Math.abs(v) < DEADZONE ? 0 : v);
    this.padMove.x = dz(gp.axes[0] ?? 0);
    this.padMove.y = dz(gp.axes[1] ?? 0);
    const ax = dz(gp.axes[2] ?? 0);
    const ay = dz(gp.axes[3] ?? 0);
    this.padAim.active = Math.hypot(ax, ay) > 0.35;
    this.padAim.x = ax;
    this.padAim.y = ay;
    const pressed = (i: number): boolean => !!gp.buttons[i]?.pressed;
    const edge = (i: number): boolean => pressed(i) && !this.padPrev[i];
    if (edge(PAD.A) || edge(PAD.RB)) this.latch.dash = true;
    if (edge(PAD.X) || edge(PAD.RT)) this.latch.pulse = true;
    if (edge(PAD.START)) this.onPadStart?.();
    const nav = this.onPadNav;
    if (nav) {
      if (edge(PAD.UP)) nav('up');
      if (edge(PAD.DOWN)) nav('down');
      if (edge(PAD.LEFT)) nav('left');
      if (edge(PAD.RIGHT)) nav('right');
      if (edge(PAD.A)) nav('ok');
      if (edge(PAD.B)) nav('back');
      // левый стик как крестовина: срабатывает при выходе за порог, повтор — после возврата в центр
      const sx = gp.axes[0] ?? 0;
      const sy = gp.axes[1] ?? 0;
      const dir = Math.abs(sx) > 0.6 || Math.abs(sy) > 0.6 ? (Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 4 : 3) : sy > 0 ? 2 : 1) : 0;
      if (dir && dir !== this.stickNav) nav((['', 'up', 'down', 'left', 'right'] as const)[dir] as NavCmd);
      this.stickNav = dir;
    }
    this.padPrev = gp.buttons.map((b) => b.pressed);
  }

  private axis(): { x: number; y: number } {
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.stick.x + this.padMove.x;
    const y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) + this.stick.y + this.padMove.y;
    return { x, y };
  }

  /** Собрать ввод тика. toWorld переводит экранные координаты мыши в мировые; player — позиция оператора. */
  consume(toWorld: (sx: number, sy: number) => { x: number; y: number }, player: { x: number; y: number }): TickInput {
    const a = this.axis();
    let aim = toWorld(this.mouse.x, this.mouse.y);
    let fire = this.mouse.down && !this.touchMode;
    if (this.padAim.active) {
      aim = { x: player.x + this.padAim.x * 300, y: player.y + this.padAim.y * 300 };
      fire = true;
    }
    const out: TickInput = { moveX: a.x, moveY: a.y, aimX: aim.x, aimY: aim.y, fire, fireAuto: this.touchFire, dash: this.latch.dash, pulse: this.latch.pulse };
    this.latch = { dash: false, pulse: false };
    return out;
  }
}
