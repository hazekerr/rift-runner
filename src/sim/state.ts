import { createRng, fork, type Rng } from '../core/rng';
import { ARENA_CENTER, makeArena, type ObstacleDef } from '../content/arena';
import type { Aura, EnemyType } from '../content/enemies';
import { OPERATORS } from '../content/operators';
import type { StatId } from '../content/stats';
import { computeStats, type Modifier, type Stats } from './stats';

export interface WeaponInst {
  uid: number;
  id: string;
  tier: number; // 1..4
  cd: number;
  /** Текущий угол прицела (рад). */
  aim: number;
  /** Таймер анимации атаки (визуальный, но детерминированный). */
  flash: number;
  /** Мировая позиция на орбите (обновляется каждый тик). */
  x: number;
  y: number;
}

export interface Player {
  x: number; y: number; px: number; py: number; r: number;
  hp: number; angle: number;
  dashCd: number; dashTime: number; dashMax: number; dx: number; dy: number;
  inv: number; energy: number;
  regenAcc: number; lifestealCd: number;
  mods: Modifier[];
  stats: Stats;
  weapons: WeaponInst[];
}

export interface Enemy {
  id: number; type: EnemyType; elite: Aura | null;
  x: number; y: number; px: number; py: number;
  hp: number; maxHp: number; r: number; speed: number; contact: number; shotDmg: number;
  shot: number; hit: number; a: number; dead: boolean; phase: number;
  /** Подсостояние ИИ (раннер: 0 погоня, 1 замах, 2 рывок, 3 откат) и его таймер. */
  ai: number; aiT: number; vx: number; vy: number;
  /** Временные баффы от аур (сбрасываются каждый тик). */
  hasted: boolean; shielded: boolean;
}

export interface Bullet {
  x: number; y: number; px: number; py: number; vx: number; vy: number;
  life: number; damage: number; crit: boolean; color: string; friendly: boolean; r: number;
  pierce: number; hit: number[]; weapon: string; source: EnemyType | '';
}

export interface Mine {
  x: number; y: number; arm: number; life: number; damage: number;
}

export interface Scrap {
  x: number; y: number; px: number; py: number; vx: number; vy: number; v: number; pulled: boolean;
}

export interface Pickup {
  x: number; y: number; px: number; py: number; type: 'heal' | 'energy'; life: number;
}

export interface SpawnMarker {
  type: EnemyType; x: number; y: number; t: number; elite: Aura | null;
}

export type Phase = 'play' | 'levelup' | 'supply' | 'over' | 'victory';

export interface LevelOffer {
  stat: StatId;
  rarity: number; // 0..3
  value: number;
}

export interface RunStats {
  kills: number;
  damageByWeapon: Record<string, number>;
  damageTaken: number;
  killedBy: EnemyType | 'mine' | '';
  scrapCollected: number;
}

/** Полное состояние забега. Только plain data: сериализуется в JSON. */
export interface SimState {
  seed: number;
  operator: string;
  tick: number;
  time: number;
  phase: Phase;
  wave: number;
  waveLeft: number;
  waveDuration: number;
  overtime: boolean;
  waveDmgMult: number;
  spawnAcc: number;
  burstsDone: number;
  score: number;
  combo: number;
  comboTime: number;
  nextId: number;
  scrap: number;
  bonusPool: number;
  xp: number;
  level: number;
  pendingLevels: number;
  levelOffer: LevelOffer[];
  levelRerolls: number;
  supplyOffer: string[];
  harvestMult: number;
  p: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  mines: Mine[];
  scraps: Scrap[];
  pickups: Pickup[];
  spawns: SpawnMarker[];
  obstacles: ObstacleDef[];
  stats: RunStats;
  god: boolean;
  rng: { spawn: Rng; loot: Rng; combat: Rng; offer: Rng };
}

export function createPlayer(operator: string): Player {
  const op = OPERATORS.find((o) => o.id === operator) ?? OPERATORS[0]!;
  const mods: Modifier[] = [];
  const stats = computeStats(mods);
  return {
    x: ARENA_CENTER.x, y: ARENA_CENTER.y, px: ARENA_CENTER.x, py: ARENA_CENTER.y, r: 16,
    hp: stats.maxHp, angle: 0,
    dashCd: 0, dashTime: 0, dashMax: 1.7, dx: 1, dy: 0, inv: 1.5, energy: 100,
    regenAcc: 0, lifestealCd: 0,
    mods, stats,
    weapons: op.startWeapons.map((id, i) => ({ uid: i + 1, id, tier: 1, cd: 0.3, aim: 0, flash: 0, x: ARENA_CENTER.x, y: ARENA_CENTER.y })),
  };
}

export function createRun(seed: number, operator = 'operator'): SimState {
  const root = createRng(seed);
  return {
    seed, operator, tick: 0, time: 0, phase: 'play', wave: 0, waveLeft: 0, waveDuration: 0, overtime: false, waveDmgMult: 1,
    spawnAcc: 0, burstsDone: 0, score: 0, combo: 0, comboTime: 0, nextId: 100,
    scrap: 0, bonusPool: 0, xp: 0, level: 1, pendingLevels: 0, levelOffer: [], levelRerolls: 0, supplyOffer: [],
    harvestMult: 1,
    p: createPlayer(operator), enemies: [], bullets: [], mines: [], scraps: [], pickups: [], spawns: [],
    obstacles: makeArena(),
    stats: { kills: 0, damageByWeapon: {}, damageTaken: 0, killedBy: '', scrapCollected: 0 },
    god: false,
    rng: { spawn: fork(root), loot: fork(root), combat: fork(root), offer: fork(root) },
  };
}

/** Пересчитать статы после изменения модификаторов (HP растёт вместе с максимумом). */
export function refreshStats(p: Player): void {
  const oldMax = p.stats.maxHp;
  p.stats = computeStats(p.mods);
  const maxHp = Math.max(1, Math.round(p.stats.maxHp));
  if (maxHp > oldMax) p.hp += maxHp - oldMax;
  p.hp = Math.min(p.hp, maxHp);
}

export const maxHpOf = (p: Player): number => Math.max(1, Math.round(p.stats.maxHp));
