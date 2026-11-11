export type EnemyType = 'drone' | 'runner' | 'gunner' | 'tank' | 'boss';

export interface EnemyDef {
  type: EnemyType;
  hp: (wave: number) => number;
  r: number;
  speed: (wave: number) => number;
  contact: number;
  points: number;
  color: string;
  shooter: boolean;
}

/** Параметры прототипа один в один. */
export const ENEMIES: Record<EnemyType, EnemyDef> = {
  drone: { type: 'drone', hp: (w) => 46 + w * 5, r: 17, speed: (w) => 118 + w * 3, contact: 14, points: 40, color: '#ff755e', shooter: false },
  runner: { type: 'runner', hp: (w) => 28 + w * 3, r: 12, speed: (w) => 190 + w * 2, contact: 14, points: 40, color: '#ffed87', shooter: false },
  gunner: { type: 'gunner', hp: (w) => 55 + w * 5, r: 17, speed: () => 110, contact: 14, points: 70, color: '#cf9bff', shooter: true },
  tank: { type: 'tank', hp: (w) => 140 + w * 12, r: 25, speed: () => 68, contact: 25, points: 90, color: '#ffb05e', shooter: false },
  boss: { type: 'boss', hp: (w) => 650 + w * 80, r: 45, speed: () => 72, contact: 32, points: 1500, color: '#ff5f78', shooter: true },
};
