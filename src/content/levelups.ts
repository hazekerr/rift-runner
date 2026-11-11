import type { StatId } from './stats';

/** Улучшения статов при уровне: значения flat по редкости I..IV. */
export interface LevelUpDef {
  stat: StatId;
  values: readonly [number, number, number, number];
}

export const LEVEL_UPS: readonly LevelUpDef[] = [
  { stat: 'maxHp', values: [3, 6, 9, 12] },
  { stat: 'regen', values: [2, 3, 4, 5] },
  { stat: 'lifesteal', values: [1, 2, 3, 4] },
  { stat: 'damage', values: [5, 8, 12, 16] },
  { stat: 'meleeDmg', values: [6, 10, 14, 18] },
  { stat: 'rangedDmg', values: [6, 10, 14, 18] },
  { stat: 'energyDmg', values: [6, 10, 14, 18] },
  { stat: 'atkSpeed', values: [5, 10, 15, 20] },
  { stat: 'crit', values: [3, 5, 7, 9] },
  { stat: 'range', values: [15, 30, 45, 60] },
  { stat: 'armor', values: [1, 2, 3, 4] },
  { stat: 'dodge', values: [3, 6, 9, 12] },
  { stat: 'speed', values: [3, 6, 9, 12] },
  { stat: 'luck', values: [5, 10, 15, 20] },
  { stat: 'harvest', values: [5, 8, 10, 12] },
  { stat: 'magnet', values: [15, 25, 35, 45] },
];

export const RARITY_COLOR = ['#b8c7c8', '#62ecd2', '#b4a0ff', '#ff7547'] as const;
export const RARITY_PIPS = ['I', 'II', 'III', 'IV'] as const;
