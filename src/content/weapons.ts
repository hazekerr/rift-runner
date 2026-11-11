import type { I18nKey } from '../i18n';
import type { SfxId } from '../sim/events';

export type WeaponTag = 'melee' | 'ballistic' | 'energy' | 'explosive' | 'turret' | 'element';
export type DamageClass = 'melee' | 'ranged' | 'energy';
/**
 * Способ атаки: пуля, взмах в конусе, цепная молния, мина под ногами, снаряд по площади с задержкой,
 * переносная турель, вращающиеся диски, мгновенный луч.
 */
export type AttackKind = 'bullet' | 'swing' | 'chain' | 'trap' | 'artillery' | 'turret' | 'orbit' | 'beam';

export interface WeaponDef {
  id: string;
  name: I18nKey;
  desc: I18nKey;
  tags: readonly WeaponTag[];
  dmgClass: DamageClass;
  kind: AttackKind;
  /** Урон тира I за попадание (пулю/цель). */
  damage: number;
  cooldown: number;
  range: number;
  color: string;
  sfx: SfxId;
  /** Пули */
  speed?: number;
  pellets?: number;
  spread?: number;
  pierce?: number;
  bulletR?: number;
  /** Взмах: половина угла конуса, рад */
  arc?: number;
  /** Цепь: число целей и радиус перескока */
  chains?: number;
  chainRange?: number;
  /** Взрыв при попадании пули / радиус мины и снаряда. */
  explodeR?: number;
  /** Шанс поджечь (%) и замедление (%), длительность — из эффектов. */
  burnChance?: number;
  slowPct?: number;
  /** Мина/снаряд: время взвода. */
  arm?: number;
  /** Турель: время жизни, темп стрельбы, максимум одновременно. */
  turretLife?: number;
  turretRate?: number;
  turretMax?: number;
  /** Диски: радиус орбиты и число дисков. */
  orbitR?: number;
  blades?: number;
  /** Отдача камеры (trauma). */
  kick: number;
  /** Силуэт на орбите: длина ствола и ширина. */
  look: { len: number; w: number };
}

/** Оружие этапа 2. DPS тира I по одиночной цели — в комментарии (скилл game-balance: 55–80, AoE −20–35%). */
export const WEAPONS: readonly WeaponDef[] = [
  // 9 / 0.16 = 56 DPS
  { id: 'pulse', name: 'w.pulse.name', desc: 'w.pulse.desc', tags: ['energy'], dmgClass: 'energy', kind: 'bullet',
    damage: 9, cooldown: 0.16, range: 420, speed: 1100, pellets: 1, spread: 0.05, pierce: 1, bulletR: 3,
    color: '#75f5df', sfx: 'shoot.pulse', kick: 0.02, look: { len: 16, w: 5 } },
  // 6×6 / 0.9 = 40 вплотную, конус
  { id: 'scatter', name: 'w.scatter.name', desc: 'w.scatter.desc', tags: ['ballistic'], dmgClass: 'ranged', kind: 'bullet',
    damage: 6, cooldown: 0.9, range: 260, speed: 900, pellets: 6, spread: 0.45, pierce: 1, bulletR: 3,
    color: '#ffb86a', sfx: 'shoot.scatter', kick: 0.12, look: { len: 13, w: 8 } },
  // 48 / 1.1 = 44, пробивает 5
  { id: 'rail', name: 'w.rail.name', desc: 'w.rail.desc', tags: ['energy'], dmgClass: 'energy', kind: 'bullet',
    damage: 48, cooldown: 1.1, range: 650, speed: 1850, pellets: 1, spread: 0, pierce: 5, bulletR: 4,
    color: '#b4a0ff', sfx: 'shoot.rail', kick: 0.15, look: { len: 22, w: 4 } },
  // 22 / 0.5 = 44 по каждой цели в конусе
  { id: 'blade', name: 'w.blade.name', desc: 'w.blade.desc', tags: ['melee'], dmgClass: 'melee', kind: 'swing',
    damage: 22, cooldown: 0.5, range: 85, arc: 0.95,
    color: '#eef3ed', sfx: 'swing', kick: 0.05, look: { len: 20, w: 3 } },
  // 5 / 0.085 = 59, разброс
  { id: 'nailer', name: 'w.nailer.name', desc: 'w.nailer.desc', tags: ['ballistic'], dmgClass: 'ranged', kind: 'bullet',
    damage: 5, cooldown: 0.085, range: 380, speed: 1300, pellets: 1, spread: 0.12, pierce: 1, bulletR: 2,
    color: '#d8dee0', sfx: 'shoot.nailer', kick: 0.01, look: { len: 14, w: 6 } },
  // 14 / 0.7 = 20 × до 3 целей
  { id: 'arc', name: 'w.arc.name', desc: 'w.arc.desc', tags: ['energy', 'element'], dmgClass: 'energy', kind: 'chain',
    damage: 14, cooldown: 0.7, range: 300, chains: 3, chainRange: 140,
    color: '#8fd8ff', sfx: 'shoot.arc', kick: 0.04, look: { len: 12, w: 7 } },
  // 24 + взрыв 24 R65 / 1.3 = 37 по цели + площадь
  { id: 'rocket', name: 'w.rocket.name', desc: 'w.rocket.desc', tags: ['explosive'], dmgClass: 'ranged', kind: 'bullet',
    damage: 24, cooldown: 1.3, range: 520, speed: 620, pellets: 1, spread: 0.03, pierce: 1, bulletR: 5, explodeR: 65,
    color: '#ff9a5a', sfx: 'shoot.rocket', kick: 0.14, look: { len: 18, w: 8 } },
  // 3×2.5 / 0.12 = 62 вплотную, поджог
  { id: 'flamer', name: 'w.flamer.name', desc: 'w.flamer.desc', tags: ['element'], dmgClass: 'energy', kind: 'bullet',
    damage: 2.5, cooldown: 0.12, range: 170, speed: 420, pellets: 3, spread: 0.35, pierce: 3, bulletR: 5, burnChance: 25,
    color: '#ffb347', sfx: 'shoot.flamer', kick: 0.005, look: { len: 15, w: 9 } },
  // 11 / 0.35 = 31, замедляет
  { id: 'cryo', name: 'w.cryo.name', desc: 'w.cryo.desc', tags: ['element', 'energy'], dmgClass: 'energy', kind: 'bullet',
    damage: 11, cooldown: 0.35, range: 400, speed: 900, pellets: 1, spread: 0.02, pierce: 1, bulletR: 4, slowPct: 35,
    color: '#9fe8ff', sfx: 'shoot.cryo', kick: 0.02, look: { len: 17, w: 6 } },
  // 30 R70 / 1.4 = 21 по площади
  { id: 'mine', name: 'w.mine.name', desc: 'w.mine.desc', tags: ['explosive'], dmgClass: 'ranged', kind: 'trap',
    damage: 30, cooldown: 1.4, range: 250, explodeR: 70, arm: 0.4,
    color: '#ffd166', sfx: 'mineArm', kick: 0, look: { len: 10, w: 10 } },
  // 34 R85 / 1.6 = 21 по площади, с задержкой и телеграфом
  { id: 'mortar', name: 'w.mortar.name', desc: 'w.mortar.desc', tags: ['explosive', 'ballistic'], dmgClass: 'ranged', kind: 'artillery',
    damage: 34, cooldown: 1.6, range: 600, explodeR: 85, arm: 0.7,
    color: '#ff7547', sfx: 'shoot.mortar', kick: 0.08, look: { len: 12, w: 10 } },
  // турель: 7 урона каждые 0.3 с, живёт 7 с, до 2 одновременно (≈ 23–47 DPS)
  { id: 'turret', name: 'w.turret.name', desc: 'w.turret.desc', tags: ['turret', 'ballistic'], dmgClass: 'ranged', kind: 'turret',
    damage: 7, cooldown: 6, range: 360, turretLife: 7, turretRate: 0.3, turretMax: 2,
    color: '#62ecd2', sfx: 'shoot.nailer', kick: 0, look: { len: 10, w: 10 } },
  // 2 диска по 10 урона, ICD 0.25 = 40 по каждой задетой цели
  { id: 'saw', name: 'w.saw.name', desc: 'w.saw.desc', tags: ['melee', 'turret'], dmgClass: 'melee', kind: 'orbit',
    damage: 10, cooldown: 0.25, range: 62, orbitR: 62, blades: 2,
    color: '#d8dee0', sfx: 'swing', kick: 0, look: { len: 8, w: 8 } },
  // 30 / 0.9 = 33, пробивает всех на линии
  { id: 'laser', name: 'w.laser.name', desc: 'w.laser.desc', tags: ['energy'], dmgClass: 'energy', kind: 'beam',
    damage: 30, cooldown: 0.9, range: 520,
    color: '#ff5fd2', sfx: 'shoot.laser', kick: 0.06, look: { len: 20, w: 5 } },
];

/** Оценка DPS тира I по одной цели (без статов): для UI и тестов баланса. */
export function estimateDps(d: WeaponDef): number {
  if (d.kind === 'turret') return (d.damage / (d.turretRate ?? 1)) * Math.min(d.turretMax ?? 1, (d.turretLife ?? 1) / d.cooldown);
  const direct = d.damage * (d.pellets ?? 1) + (d.kind === 'bullet' && d.explodeR ? d.damage : 0);
  return direct / d.cooldown;
}

export const weaponById = (id: string): WeaponDef => {
  const w = WEAPONS.find((x) => x.id === id);
  if (!w) throw new Error(`Нет оружия ${id}`);
  return w;
};

export const MAX_WEAPONS = 6;
