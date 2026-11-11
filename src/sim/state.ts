import { createRng, fork, type Rng } from '../core/rng';
import { ARENA_CENTER, makeArena, type ObstacleDef } from '../content/arena';
import { GUNS } from '../content/weapons';
import type { EnemyType } from '../content/enemies';
import type { PerkId } from '../content/perks';

export interface Player {
  x: number; y: number; px: number; py: number; r: number;
  hp: number; maxHp: number; speed: number; angle: number;
  gun: number; ammo: number[]; cool: number; reload: number;
  dashCd: number; dashTime: number; dx: number; dy: number; inv: number; energy: number;
  damage: number; rate: number; reloadSpeed: number; magBonus: number; dashMax: number; lifeSteal: number;
}

export interface Enemy {
  id: number; type: EnemyType;
  x: number; y: number; px: number; py: number;
  hp: number; maxHp: number; r: number; speed: number;
  shot: number; hit: number; a: number; dead: boolean; phase: number;
}

export interface Bullet {
  x: number; y: number; px: number; py: number; vx: number; vy: number;
  life: number; damage: number; color: string; friendly: boolean; r: number;
  pierce: number; hit: number[]; boss: boolean;
}

export interface Pickup {
  x: number; y: number; px: number; py: number; type: 'heal' | 'energy'; life: number;
}

export interface SpawnMarker {
  type: EnemyType; x: number; y: number; t: number;
}

export type Phase = 'play' | 'upgrade' | 'over';

/** Полное состояние забега. Только plain data: сериализуется в JSON. */
export interface SimState {
  seed: number;
  tick: number;
  time: number;
  phase: Phase;
  wave: number;
  score: number;
  kills: number;
  combo: number;
  comboTime: number;
  spawnTimer: number;
  toSpawn: number;
  waveWait: number;
  nextId: number;
  p: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  pickups: Pickup[];
  spawns: SpawnMarker[];
  obstacles: ObstacleDef[];
  /** Предложенные перки (фаза upgrade). */
  offer: PerkId[];
  rng: { spawn: Rng; loot: Rng; combat: Rng };
}

export function createPlayer(): Player {
  return {
    x: ARENA_CENTER.x, y: ARENA_CENTER.y, px: ARENA_CENTER.x, py: ARENA_CENTER.y, r: 16,
    hp: 100, maxHp: 100, speed: 300, angle: 0,
    gun: 0, ammo: GUNS.map((g) => g.mag), cool: 0, reload: 0,
    dashCd: 0, dashTime: 0, dx: 1, dy: 0, inv: 1.5, energy: 100,
    damage: 1, rate: 1, reloadSpeed: 1, magBonus: 0, dashMax: 1.7, lifeSteal: 0,
  };
}

export function createRun(seed: number): SimState {
  const root = createRng(seed);
  return {
    seed, tick: 0, time: 0, phase: 'play', wave: 0, score: 0, kills: 0, combo: 0, comboTime: 0,
    spawnTimer: 0, toSpawn: 0, waveWait: 0, nextId: 1,
    p: createPlayer(), enemies: [], bullets: [], pickups: [], spawns: [], obstacles: makeArena(), offer: [],
    rng: { spawn: fork(root), loot: fork(root), combat: fork(root) },
  };
}
