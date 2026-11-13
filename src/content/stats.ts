import type { I18nKey } from '../i18n';

export const STAT_IDS = [
  'maxHp', 'regen', 'lifesteal', 'damage', 'meleeDmg', 'rangedDmg', 'energyDmg',
  'atkSpeed', 'crit', 'range', 'armor', 'dodge', 'speed', 'luck', 'harvest', 'magnet',
] as const;
export type StatId = (typeof STAT_IDS)[number];

export interface StatMeta {
  base: number;
  /** Суффикс отображения: '%' или ''. */
  unit: '' | '%';
  name: I18nKey;
  /** Глиф для карточек (не только цвет). */
  glyph: string;
}

export const STATS: Record<StatId, StatMeta> = {
  maxHp: { base: 100, unit: '', name: 'stat.maxHp', glyph: '✚' },
  regen: { base: 0, unit: '', name: 'stat.regen', glyph: '↺' },
  lifesteal: { base: 0, unit: '%', name: 'stat.lifesteal', glyph: '♥' },
  damage: { base: 0, unit: '%', name: 'stat.damage', glyph: '↗' },
  meleeDmg: { base: 0, unit: '%', name: 'stat.meleeDmg', glyph: '⚔' },
  rangedDmg: { base: 0, unit: '%', name: 'stat.rangedDmg', glyph: '➶' },
  energyDmg: { base: 0, unit: '%', name: 'stat.energyDmg', glyph: 'ϟ' },
  atkSpeed: { base: 0, unit: '%', name: 'stat.atkSpeed', glyph: '»' },
  crit: { base: 5, unit: '%', name: 'stat.crit', glyph: '✦' },
  range: { base: 0, unit: '', name: 'stat.range', glyph: '◎' },
  armor: { base: 0, unit: '', name: 'stat.armor', glyph: '⛨' },
  dodge: { base: 0, unit: '%', name: 'stat.dodge', glyph: '◇' },
  speed: { base: 0, unit: '%', name: 'stat.speed', glyph: '➤' },
  luck: { base: 0, unit: '', name: 'stat.luck', glyph: '☘' },
  harvest: { base: 0, unit: '', name: 'stat.harvest', glyph: '⚙' },
  magnet: { base: 0, unit: '%', name: 'stat.magnet', glyph: '⊙' },
};

export const BASE_SPEED = 300;
export const BASE_MAGNET = 90;
export const CRIT_MULT = 2;
