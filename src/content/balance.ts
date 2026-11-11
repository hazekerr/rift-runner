/**
 * Формулы баланса. Источник истины вместе с docs/research/SUMMARY.md (скилл game-balance).
 * Меняешь число — меняй SUMMARY.md, DESIGN.md и тесты.
 */
export const RUN_WAVES = 20;
export const BOSS_WAVES: readonly number[] = [10, 20];
export const MAX_ALIVE = 300;
export const SPAWN_QUIET_TAIL = 3; // секунд без спавна в конце волны
/** Доля обычного спавна на босс-волнах (решение после баланс-прогона: 0.6 → 0.4, бой со Стражем — почти дуэль). */
export const BOSS_WAVE_SPAWN = 0.4;
export const BURST_AT: readonly number[] = [0.35, 0.7];

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function waveTime(w: number): number {
  if (w === 10) return 45;
  if (w >= 20) return 60;
  return Math.round(20 + (40 * (w - 1)) / 19);
}

export function spawnRate(w: number): number {
  return 1.0 + 0.22 * (w - 1);
}

export function enemyHpMult(w: number): number {
  const base = (1 + 0.3 * (w - 1)) * 1.04 ** Math.max(0, w - 10);
  return w > RUN_WAVES ? base * 1.12 ** (w - RUN_WAVES) : base;
}

export function enemyDmgMult(w: number): number {
  const base = 1 + 0.12 * (w - 1);
  return w > RUN_WAVES ? base * 1.06 ** (w - RUN_WAVES) : base;
}

export function eliteChance(w: number): number {
  return Math.max(0, Math.min(0.15, 0.02 * (w - 4)));
}

export function xpToNext(level: number): number {
  return Math.round(8 * level ** 1.3);
}

export function rerollCost(w: number, n: number): number {
  return Math.ceil(1 + 0.5 * w) + n * Math.max(1, Math.floor(w / 4));
}

export const TIER_MULT: readonly number[] = [1, 1.75, 3.0, 5.2];
/** +10% скорострельности за тир выше I. */
export const tierAtkSpeed = (tier: number): number => (tier - 1) * 10;

/** Шансы редкостей 2..4 по «прогрессу» (волна или уровень) с учётом удачи; капы те же. */
export function rarityWeights(progress: number, luck: number): [number, number, number, number] {
  const m = Math.max(0, 1 + luck / 100);
  const r2 = Math.min(0.45, Math.max(0, 0.06 * (progress - 2)) * m);
  const r3 = Math.min(0.25, Math.max(0, 0.03 * (progress - 5)) * m);
  const r4 = Math.min(0.08, Math.max(0, 0.012 * (progress - 8)) * m);
  return [Math.max(0, 1 - r2 - r3 - r4), r2, r3, r4];
}

export const BONUS_POOL_SHARE = 0.5;
export const HARVEST_GROWTH = 1.03;
export const PLAYER_IFRAMES = 0.5;
