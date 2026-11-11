import type { I18nKey } from '../i18n';
import type { SfxId } from '../sim/events';

export type WeaponTag = 'melee' | 'ballistic' | 'energy' | 'explosive' | 'turret' | 'element';
export type DamageClass = 'melee' | 'ranged' | 'energy';
/** Способ атаки: пуля, взмах в конусе, цепная молния. */
export type AttackKind = 'bullet' | 'swing' | 'chain';

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
];

export const weaponById = (id: string): WeaponDef => {
  const w = WEAPONS.find((x) => x.id === id);
  if (!w) throw new Error(`Нет оружия ${id}`);
  return w;
};

export const MAX_WEAPONS = 6;
