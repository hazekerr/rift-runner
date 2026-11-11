/** Ввод на один тик сима — уже в виде действий, без привязки к устройствам. */
export interface TickInput {
  /** Вектор движения, длина ≤ 1 после нормализации в симе. */
  moveX: number;
  moveY: number;
  /** Точка прицела в мировых координатах. */
  aimX: number;
  aimY: number;
  /** Ручной огонь (вариант «зажал = ручной»): все оружия целятся в aim. */
  fire: boolean;
  /** Команда «огонь» без ручного прицела (тач-кнопка Связиста): оружие стреляет с автонаведением. */
  fireAuto: boolean;
  dash: boolean;
  pulse: boolean;
}

export const emptyInput = (): TickInput => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire: false, fireAuto: false, dash: false, pulse: false });
