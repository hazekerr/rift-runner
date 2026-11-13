import { createRng, fork, type Rng } from '../core/rng';
import { ARENA_CENTER, makeArena, type ObstacleDef } from '../content/arena';
import type { Aura, EnemyType } from '../content/enemies';
import { operatorById } from '../content/operators';
import { SYNERGIES, SYNERGY_THRESHOLDS, TAG_ORDER } from '../content/synergies';
import { weaponById, type WeaponTag } from '../content/weapons';
import type { EffectDef } from '../content/modules';
import type { StatId } from '../content/stats';
import { computeStats, type Modifier, type Stats } from './stats';
import { aggregate, emptyFx, type FxAgg } from './effects';
import { moduleById } from '../content/modules';

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
  /** Раскрутка (миниган), 0..1. */
  heat?: number;
}

export interface Player {
  x: number; y: number; px: number; py: number; r: number;
  hp: number; angle: number;
  dashCd: number; dashTime: number; dashMax: number; dx: number; dy: number;
  /** Заряды рывка (у Призрака 2). */
  dashCharges: number; dashMaxCharges: number;
  inv: number; energy: number;
  regenAcc: number; lifestealCd: number;
  mods: Modifier[];
  stats: Stats;
  weapons: WeaponInst[];
  /** Купленные модули (копии стакаются). */
  modules: Array<{ id: string; count: number }>;
  /** Агрегированные эффекты модулей (производное от modules, пересчитывается в refreshStats). */
  fx: FxAgg;
  shield: number;
  scrapHealAcc: number;
  zapT: number[];
  /** Счётчики тегов (оружие + модули) для синергий. Производное, пересчитывается в refreshStats. */
  tags: Record<WeaponTag, number>;
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
  /** Горение (DoT) и замедление от модулей. */
  burn: number; burnDps: number; slow: number; slowPct: number;
  /** Телеграф атаки босса (для отрисовки предупреждения). */
  tele: Telegraph | null;
  /** Магнитчик: украденный скрап. */
  loot?: number;
  /** Кеш прямой видимости до игрока (пересчёт раз в 4 тика со сдвигом по id). */
  los: boolean;
}

export interface Telegraph {
  kind: 'ring' | 'lines' | 'circle' | 'corridor';
  x: number; y: number;
  /** Направление и разброс линий. */
  a: number; spread: number; count: number; len: number;
  r: number;
  t: number; total: number;
}

export interface Bullet {
  x: number; y: number; px: number; py: number; vx: number; vy: number;
  life: number; damage: number; crit: boolean; color: string; friendly: boolean; r: number;
  pierce: number; hit: number[]; weapon: string; source: EnemyType | '';
  /** Свойства оружия: взрыв при попадании, шанс поджога, замедление. */
  explodeR: number; burnChance: number; slowPct: number;
  /** 2.0: бумеранг (момент разворота по остатку жизни; ret — уже летит назад) и стягивание при взрыве. */
  boom?: number; ret?: boolean; pull?: number;
}

/** Мина или снаряд миномёта оператора. */
export interface Trap {
  x: number; y: number; arm: number; life: number; damage: number; crit: boolean; r: number; weapon: string;
  /** true — взрывается сам по окончании взвода (миномёт), false — от контакта (мина). */
  artillery: boolean;
}

export interface Turret {
  x: number; y: number; life: number; total: number; cd: number; rate: number; damage: number; range: number;
  weapon: string; aim: number;
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

export type Phase = 'play' | 'levelup' | 'shop' | 'over' | 'victory';

export interface ShopOffer {
  kind: 'weapon' | 'module';
  id: string;
  /** Тир оружия (1..4) или 0 для модуля. */
  tier: number;
  rarity: number;
  price: number;
  locked: boolean;
}

export interface ShopState {
  offers: Array<ShopOffer | null>;
  rerolls: number;
}

export interface LevelOffer {
  stat: StatId;
  rarity: number; // 0..3
  value: number;
}

export type HealSource = 'kit' | 'regen' | 'lifesteal' | 'module';

export interface RunStats {
  kills: number;
  /** Реально восстановленное HP по источникам (без перелечивания) — для баланс-отчёта. */
  healBy?: Partial<Record<HealSource, number>>;
  damageByWeapon: Record<string, number>;
  damageTaken: number;
  killedBy: EnemyType | 'mine' | '';
  scrapCollected: number;
  /** Убито боссов: Страж (boss), Сердце (heart). */
  guardianKills: number;
}

/** Полное состояние забега. Только plain data: сериализуется в JSON. */
export interface SimState {
  seed: number;
  operator: string;
  /** Уровень Угрозы 0..4. */
  threat: number;
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
  /** Дробный остаток подбора (множитель Мародёра). */
  scrapFrac: number;
  bonusPool: number;
  xp: number;
  level: number;
  pendingLevels: number;
  /** Аптечек выпало с врагов в этой волне (кап kitCap). */
  kitsThisWave?: number;
  /** Орда «Разлома» в этой волне уже была. */
  hordeDone?: boolean;
  /** Мини-босс этой волны уже вышел. */
  miniDone?: boolean;
  levelOffer: LevelOffer[];
  levelRerolls: number;
  shop: ShopState;
  harvestMult: number;
  p: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  mines: Mine[];
  traps: Trap[];
  turrets: Turret[];
  scraps: Scrap[];
  pickups: Pickup[];
  spawns: SpawnMarker[];
  obstacles: ObstacleDef[];
  stats: RunStats;
  god: boolean;
  /** Использовалась dev-панель: забег не идёт в мета-статистику. */
  dev: boolean;
  rng: { spawn: Rng; loot: Rng; combat: Rng; offer: Rng };
}

/** Заряды рывка с модулями. */
export const dashCap = (p: Player): number => p.dashMaxCharges + p.fx.dashCharges;
/** Перезарядка одного заряда рывка с модулями. */
export const dashCooldown = (p: Player): number => p.dashMax * (1 - p.fx.dashCdPct / 100);
/** Радиус импульса. */
export const pulseRadius = (p: Player): number => 340 * (1 + p.fx.pulseRPct / 100);

/** Вылечить оператора; возвращает реально восстановленное HP и учитывает источник. */
export function healPlayer(s: SimState, amount: number, src: HealSource): number {
  const p = s.p;
  const before = p.hp;
  p.hp = Math.min(maxHpOf(p), p.hp + amount);
  const got = p.hp - before;
  if (got > 0) {
    const hb = (s.stats.healBy ??= {});
    hb[src] = (hb[src] ?? 0) + got;
  }
  return got;
}

export function createPlayer(operator: string): Player {
  const op = operatorById(operator);
  const mods: Modifier[] = op.mods.map((m) => ({ ...m, source: { kind: 'operator' as const, id: op.id } }));
  const charges = op.rule.dashCharges ?? 1;
  const p: Player = {
    x: ARENA_CENTER.x, y: ARENA_CENTER.y, px: ARENA_CENTER.x, py: ARENA_CENTER.y, r: 16,
    hp: 100, angle: 0,
    dashCd: 0, dashTime: 0, dashMax: 1.7 * (op.rule.dashCdMult ?? 1), dx: 1, dy: 0,
    dashCharges: charges, dashMaxCharges: charges, inv: 1.5, energy: 100,
    regenAcc: 0, lifestealCd: 0,
    mods, stats: computeStats(mods), modules: [], fx: emptyFx(), shield: 0, scrapHealAcc: 0, zapT: [],
    tags: emptyTags(),
    weapons: op.startWeapons.map((id, i) => ({ uid: i + 1, id, tier: 1, cd: 0.3, aim: 0, flash: 0, x: ARENA_CENTER.x, y: ARENA_CENTER.y })),
  };
  refreshStats(p);
  p.hp = maxHpOf(p);
  return p;
}

export function createRun(seed: number, operator = 'operator', threat = 0): SimState {
  const root = createRng(seed);
  return {
    seed, operator, threat, tick: 0, time: 0, phase: 'play', wave: 0, waveLeft: 0, waveDuration: 0, overtime: false, waveDmgMult: 1,
    spawnAcc: 0, burstsDone: 0, score: 0, combo: 0, comboTime: 0, nextId: 100,
    scrap: 0, scrapFrac: 0, bonusPool: 0, xp: 0, level: 1, pendingLevels: 0, levelOffer: [], levelRerolls: 0, shop: { offers: [], rerolls: 0 },
    harvestMult: 1,
    p: createPlayer(operator), enemies: [], bullets: [], mines: [], traps: [], turrets: [], scraps: [], pickups: [], spawns: [],
    obstacles: makeArena(),
    stats: { kills: 0, damageByWeapon: {}, damageTaken: 0, killedBy: '', scrapCollected: 0, guardianKills: 0 },
    god: false,
    dev: false,
    rng: { spawn: fork(root), loot: fork(root), combat: fork(root), offer: fork(root) },
  };
}

/** Пересчитать статы после изменения модификаторов (HP растёт вместе с максимумом). */
export function refreshStats(p: Player): void {
  const oldMax = p.stats.maxHp;
  // Синергии тегов: пересобрать модификаторы с источником 'tag'
  p.tags = countTags(p);
  p.mods = p.mods.filter((m) => m.source.kind !== 'tag');
  const extra: EffectDef[] = [];
  const flags = { pierceBonus: 0, explodeRadiusMult: 1, turretLifeMult: 1, burnMult: 1 };
  for (const tag of TAG_ORDER) {
    SYNERGY_THRESHOLDS.forEach((need, k) => {
      if (p.tags[tag] < need) return;
      const tier = SYNERGIES[tag][k]!;
      for (const m of tier.mods) p.mods.push({ ...m, source: { kind: 'tag', id: `${tag}:${need}` } });
      if (tier.effects) extra.push(...tier.effects);
      const f = tier.flags;
      if (f?.pierceBonus) flags.pierceBonus += f.pierceBonus;
      if (f?.explodeRadiusMult) flags.explodeRadiusMult *= f.explodeRadiusMult;
      if (f?.turretLifeMult) flags.turretLifeMult *= f.turretLifeMult;
      if (f?.burnMult) flags.burnMult *= f.burnMult;
    });
  }
  p.stats = computeStats(p.mods);
  p.fx = { ...aggregate(p.modules, extra), ...flags };
  const maxHp = Math.max(1, Math.round(p.stats.maxHp));
  if (maxHp > oldMax) p.hp += maxHp - oldMax;
  p.hp = Math.min(p.hp, maxHp);
}

export const maxHpOf = (p: Player): number => Math.max(1, Math.round(p.stats.maxHp));

/** Добавить модуль: копия + его модификаторы с источником. */
export function addModule(p: Player, id: string): void {
  const def = moduleById(id);
  const slot = p.modules.find((m) => m.id === id);
  if (slot) slot.count++;
  else p.modules.push({ id, count: 1 });
  for (const m of def.mods) p.mods.push({ stat: m.stat, ...(m.flat !== undefined ? { flat: m.flat } : {}), ...(m.pct !== undefined ? { pct: m.pct } : {}), source: { kind: 'module', id } });
  refreshStats(p);
}

export const moduleCount = (p: Player, id: string): number => p.modules.find((m) => m.id === id)?.count ?? 0;

export const emptyTags = (): Record<WeaponTag, number> => ({ melee: 0, ballistic: 0, energy: 0, explosive: 0, turret: 0, element: 0 });

/** Теги: каждое оружие считается раз, модули — по числу копий. */
export function countTags(p: Player): Record<WeaponTag, number> {
  const out = emptyTags();
  for (const w of p.weapons) for (const t of weaponById(w.id).tags) out[t]++;
  for (const m of p.modules) for (const t of moduleById(m.id).tags) out[t] += m.count;
  return out;
}
