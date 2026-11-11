/** Ввод на один тик сима — уже в виде действий, без привязки к устройствам. */
export interface TickInput {
  /** Вектор движения, длина ≤ 1 после нормализации в симе. */
  moveX: number;
  moveY: number;
  /** Точка прицела в мировых координатах. */
  aimX: number;
  aimY: number;
  fire: boolean;
  /** Автоприцел на ближайшего врага (тач). */
  autoAim: boolean;
  dash: boolean;
  pulse: boolean;
  reload: boolean;
  /** Выбор оружия по индексу или null. */
  weapon: number | null;
  /** Прокрутка оружия: +1 / -1 / 0. */
  cycle: number;
}

export const emptyInput = (): TickInput => ({
  moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire: false, autoAim: false,
  dash: false, pulse: false, reload: false, weapon: null, cycle: 0,
});
