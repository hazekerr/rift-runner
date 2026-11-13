import type { EnemyType } from './enemies';

/**
 * Состав волн как данные: вес типа = min(max, w0 + perWave·(w − from)), 0 до from.
 * Новый тип появляется с малым весом за волну до массового (скилл game-balance).
 */
export interface WaveRow {
  type: EnemyType;
  from: number;
  w0: number;
  perWave: number;
  max: number;
  /** Сколько врагов появляется за одно «решение спавна» (рой — пачкой). */
  pack?: number;
}

export const WAVE_TABLE: readonly WaveRow[] = [
  { type: 'drone', from: 1, w0: 10, perWave: -0.25, max: 10 },
  { type: 'runner', from: 2, w0: 1.5, perWave: 0.4, max: 4 },
  { type: 'swarm', from: 3, w0: 0.6, perWave: 0.15, max: 2, pack: 8 },
  { type: 'gunner', from: 4, w0: 1, perWave: 0.3, max: 3.5 },
  { type: 'splitter', from: 5, w0: 1, perWave: 0.25, max: 3 },
  { type: 'tank', from: 6, w0: 0.6, perWave: 0.2, max: 2.5 },
  { type: 'miner', from: 7, w0: 0.6, perWave: 0.15, max: 2 },
  { type: 'healer', from: 8, w0: 0.4, perWave: 0.1, max: 1.2 },
  // 2.0: новые типы — сначала по одному (малый вес), к поздним волнам массово
  { type: 'bomber', from: 4, w0: 0.6, perWave: 0.25, max: 2.5 },
  { type: 'shieldbearer', from: 6, w0: 0.5, perWave: 0.2, max: 2 },
  { type: 'leaper', from: 8, w0: 0.5, perWave: 0.2, max: 2 },
  { type: 'sniper', from: 9, w0: 0.4, perWave: 0.15, max: 1.5 },
  { type: 'thief', from: 11, w0: 0.5, perWave: 0.1, max: 1.2 },
  { type: 'hive', from: 12, w0: 0.3, perWave: 0.08, max: 0.8 },
  { type: 'armadillo', from: 13, w0: 0.4, perWave: 0.15, max: 1.8 },
  { type: 'phantom', from: 15, w0: 0.5, perWave: 0.15, max: 1.5 },
];

export function waveWeights(w: number): Array<{ row: WaveRow; weight: number }> {
  return WAVE_TABLE.map((row) => ({
    row,
    weight: w < row.from ? 0 : Math.max(0, Math.min(row.max, row.w0 + row.perWave * (w - row.from))),
  })).filter((x) => x.weight > 0);
}
