import type { I18nKey } from '../i18n';

export type EnemyType = 'drone' | 'runner' | 'gunner' | 'tank' | 'splitter' | 'shard' | 'miner' | 'healer' | 'swarm'
  | 'bomber' | 'shieldbearer' | 'leaper' | 'sniper' | 'thief' | 'hive' | 'armadillo' | 'phantom'
  | 'crusher' | 'brood' | 'boss' | 'heart';
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
  gunner: { type: 'gunner', name: 'e.gunner', hp: 30, contact: 6, shotDmg: 6, speed: 110, r: 16, scrap: 2, scrapChance: 1, points: 70, color: '#cf9bff', sides: 6 },
  tank: { type: 'tank', name: 'e.tank', hp: 90, contact: 14, shotDmg: 0, speed: 65, r: 24, scrap: 3, scrapChance: 1, points: 90, color: '#ffb05e', sides: 0 },
  splitter: { type: 'splitter', name: 'e.splitter', hp: 40, contact: 7, shotDmg: 0, speed: 100, r: 18, scrap: 2, scrapChance: 1, points: 60, color: '#ff8fb8', sides: 4 },
  shard: { type: 'shard', name: 'e.shard', hp: 12, contact: 5, shotDmg: 0, speed: 150, r: 10, scrap: 1, scrapChance: 0.5, points: 15, color: '#ff8fb8', sides: 4 },
  miner: { type: 'miner', name: 'e.miner', hp: 35, contact: 6, shotDmg: 12, speed: 90, r: 16, scrap: 2, scrapChance: 1, points: 70, color: '#9be26b', sides: 5 },
  healer: { type: 'healer', name: 'e.healer', hp: 45, contact: 5, shotDmg: 0, speed: 95, r: 16, scrap: 3, scrapChance: 1, points: 90, color: '#5fe0a0', sides: 8 },
  swarm: { type: 'swarm', name: 'e.swarm', hp: 6, contact: 4, shotDmg: 0, speed: 170, r: 8, scrap: 1, scrapChance: 0.5, points: 10, color: '#ffd166', sides: 3 },
  // ---- 2.0 ----
  bomber: { type: 'bomber', name: 'e.bomber', hp: 16, contact: 0, shotDmg: 18, speed: 175, r: 13, scrap: 1, scrapChance: 1, points: 40, color: '#ff4f4f', sides: 4 },
  shieldbearer: { type: 'shieldbearer', name: 'e.shieldbearer', hp: 55, contact: 10, shotDmg: 0, speed: 85, r: 20, scrap: 2, scrapChance: 1, points: 70, color: '#7fb4ff', sides: 5 },
  leaper: { type: 'leaper', name: 'e.leaper', hp: 38, contact: 8, shotDmg: 14, speed: 95, r: 17, scrap: 2, scrapChance: 1, points: 70, color: '#ff9ae0', sides: 6 },
  sniper: { type: 'sniper', name: 'e.sniper', hp: 26, contact: 5, shotDmg: 16, speed: 80, r: 15, scrap: 2, scrapChance: 1, points: 80, color: '#9fffb0', sides: 3 },
  thief: { type: 'thief', name: 'e.thief', hp: 28, contact: 4, shotDmg: 0, speed: 165, r: 13, scrap: 1, scrapChance: 1, points: 50, color: '#5ef0ff', sides: 3 },
  hive: { type: 'hive', name: 'e.hive', hp: 130, contact: 10, shotDmg: 0, speed: 35, r: 26, scrap: 4, scrapChance: 1, points: 120, color: '#e8c45a', sides: 6 },
  armadillo: { type: 'armadillo', name: 'e.armadillo', hp: 85, contact: 14, shotDmg: 0, speed: 60, r: 22, scrap: 3, scrapChance: 1, points: 100, color: '#d6a878', sides: 0 },
  phantom: { type: 'phantom', name: 'e.phantom', hp: 40, contact: 14, shotDmg: 0, speed: 95, r: 16, scrap: 2, scrapChance: 1, points: 90, color: '#d6b3ff', sides: 7 },
  crusher: { type: 'crusher', name: 'e.crusher', hp: 450, contact: 18, shotDmg: 9, speed: 80, r: 36, scrap: 25, scrapChance: 1, points: 800, color: '#ff8c3a', sides: 8 },
  brood: { type: 'brood', name: 'e.brood', hp: 1400, contact: 20, shotDmg: 8, speed: 50, r: 46, scrap: 50, scrapChance: 1, points: 2500, color: '#c7ff5e', sides: 10 },
  boss: { type: 'boss', name: 'e.boss', hp: 3200, contact: 20, shotDmg: 10, speed: 72, r: 45, scrap: 60, scrapChance: 1, points: 1500, color: '#ff5f78', sides: 8 },
  heart: { type: 'heart', name: 'e.heart', hp: 9000, contact: 24, shotDmg: 9, speed: 55, r: 58, scrap: 120, scrapChance: 1, points: 5000, color: '#ff3d6e', sides: 12 },
};

/** Боссы: не лечатся хилерами, не добиваются «Палачом», у них своя полоса HP. */
export const isBoss = (t: EnemyType): boolean => t === 'boss' || t === 'heart' || t === 'crusher' || t === 'brood';
/** Мини-боссы (2.0): появляются посреди обычной волны (5 и 15), уходят в разлом с концом таймера. */
export const isMiniBoss = (t: EnemyType): boolean => t === 'crusher' || t === 'brood';
export const MINI_BOSS: Readonly<Record<number, EnemyType>> = { 5: 'crusher', 15: 'brood' };
export const MINI_BOSS_AT = 0.3;
/** «Бронированные» цели для правила Сварщика. */
export const isArmored = (t: EnemyType, elite: boolean): boolean => elite || t === 'tank' || t === 'armadillo' || isBoss(t);

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

// ---- 2.0: механики новых врагов (у каждой угрозы — телеграф) ----
/** Камикадзе: подбегает, замирает с запалом и взрывается. */
export const BOMBER = { trigger: 75, fuse: 0.6, radius: 85 } as const;
/** Щитоносец: пули спереди (в секторе ±60°) гасятся на 85%. Ближний бой, взрывы и способности — полностью. */
export const SHIELD = { arc: 0.5, mult: 0.15 } as const;
/** Прыгун: замах, прыжок в отмеченную точку, удар по площади. */
export const LEAP = { range: 380, windup: 0.55, time: 0.45, radius: 64, every: 3.2 } as const;
/** Снайпер: держит дистанцию, целится лазером, последние 0.35 с прицел зафиксирован. */
export const SNIPE = { keep: 560, aim: 1.2, lock: 0.35, speed: 950, every: 4 } as const;
/** Улей: выпускает рой, пока жив. */
export const HIVE = { every: 4, count: 3 } as const;
/** Магнитчик: ворует скрап с пола, при смерти отдаёт ×1.5. */
export const THIEF = { seek: 650, payback: 1.5 } as const;
/** Броненосец: всё, кроме ближнего боя и взрывов, наносит 45%. */
export const ARMOR_PLATE = { mult: 0.45 } as const;
/** Фантом: телепорт к оператору с телеграфом в точке появления. */
export const PHASE = { every: 5, tele: 0.7, offset: 120, minDist: 220 } as const;
