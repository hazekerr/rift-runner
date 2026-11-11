import type { I18nKey } from '../i18n';

export type EnemyType = 'drone' | 'runner' | 'gunner' | 'tank' | 'splitter' | 'shard' | 'miner' | 'healer' | 'swarm' | 'boss' | 'heart';
export type Aura = 'haste' | 'shield' | 'regen';

export interface EnemyDef {
  type: EnemyType;
  name: I18nKey;
  /** HP на волне 1 (умножается на enemyHpMult(w)). */
  hp: number;
  /** Урон касанием на волне 1 (× enemyDmgMult(w)). */
  contact: number;
  /** Урон снаряда/мины на волне 1. */
  shotDmg: number;
  speed: number;
  r: number;
  /** Ценность скрапа и шанс выпадения. */
  scrap: number;
  scrapChance: number;
  points: number;
  color: string;
  /** Форма силуэта: число вершин (0 = квадрат). */
  sides: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  drone: { type: 'drone', name: 'e.drone', hp: 24, contact: 8, shotDmg: 0, speed: 120, r: 16, scrap: 1, scrapChance: 1, points: 40, color: '#ff755e', sides: 6 },
  runner: { type: 'runner', name: 'e.runner', hp: 14, contact: 6, shotDmg: 0, speed: 200, r: 12, scrap: 1, scrapChance: 1, points: 40, color: '#ffed87', sides: 3 },
  gunner: { type: 'gunner', name: 'e.gunner', hp: 30, contact: 6, shotDmg: 7, speed: 110, r: 16, scrap: 2, scrapChance: 1, points: 70, color: '#cf9bff', sides: 6 },
  tank: { type: 'tank', name: 'e.tank', hp: 90, contact: 14, shotDmg: 0, speed: 65, r: 24, scrap: 3, scrapChance: 1, points: 90, color: '#ffb05e', sides: 0 },
  splitter: { type: 'splitter', name: 'e.splitter', hp: 40, contact: 7, shotDmg: 0, speed: 100, r: 18, scrap: 2, scrapChance: 1, points: 60, color: '#ff8fb8', sides: 4 },
  shard: { type: 'shard', name: 'e.shard', hp: 12, contact: 5, shotDmg: 0, speed: 150, r: 10, scrap: 1, scrapChance: 0.5, points: 15, color: '#ff8fb8', sides: 4 },
  miner: { type: 'miner', name: 'e.miner', hp: 35, contact: 6, shotDmg: 12, speed: 90, r: 16, scrap: 2, scrapChance: 1, points: 70, color: '#9be26b', sides: 5 },
  healer: { type: 'healer', name: 'e.healer', hp: 45, contact: 5, shotDmg: 0, speed: 95, r: 16, scrap: 3, scrapChance: 1, points: 90, color: '#5fe0a0', sides: 8 },
  swarm: { type: 'swarm', name: 'e.swarm', hp: 6, contact: 4, shotDmg: 0, speed: 170, r: 8, scrap: 1, scrapChance: 0.5, points: 10, color: '#ffd166', sides: 3 },
  boss: { type: 'boss', name: 'e.boss', hp: 3200, contact: 20, shotDmg: 10, speed: 72, r: 45, scrap: 60, scrapChance: 1, points: 1500, color: '#ff5f78', sides: 8 },
  heart: { type: 'heart', name: 'e.heart', hp: 9000, contact: 24, shotDmg: 9, speed: 55, r: 58, scrap: 120, scrapChance: 1, points: 5000, color: '#ff3d6e', sides: 12 },
};

/** Боссы: не лечатся хилерами, не добиваются «Палачом», у них своя полоса HP. */
export const isBoss = (t: EnemyType): boolean => t === 'boss' || t === 'heart';
/** «Бронированные» цели для правила Сварщика. */
export const isArmored = (t: EnemyType, elite: boolean): boolean => elite || t === 'tank' || isBoss(t);

export const ELITE = { hp: 4, dmg: 1.3, size: 1.35, scrap: 8, points: 5, auraRange: 150 } as const;
export const AURA_GLYPH: Record<Aura, string> = { haste: '»', shield: '◆', regen: '✚' };
export const AURA_COLOR: Record<Aura, string> = { haste: '#ffed87', shield: '#8fd8ff', regen: '#5fe0a0' };

/** Хилер */
export const HEAL_RANGE = 140;
export const HEAL_PER_SEC = 6;
/** Минёр */
export const MINE = { every: 3, arm: 0.8, life: 9, trigger: 45, radius: 62 } as const;
/** Раннер */
export const RUNNER_DASH = { range: 260, windup: 0.45, time: 0.35, speed: 560, recover: 1.0 } as const;
