import type { I18nKey } from '../i18n';
import type { ModDef } from './modules';
import type { WeaponTag } from './weapons';

/** Условие открытия оператора (по накопленной мета-статистике). */
export type Unlock =
  | { kind: 'none' }
  | { kind: 'wave'; n: number }
  | { kind: 'kills'; n: number }
  | { kind: 'scrapRun'; n: number }
  | { kind: 'guardian'; n: number }
  | { kind: 'wins'; n: number };

export interface OperatorRules {
  /** В магазине и снабжении только оружие с этим тегом. */
  onlyTag?: WeaponTag;
  /** +% урона по танкам, элитам и боссам. */
  armoredBonus?: number;
  /** Оружие стреляет только по команде (ЛКМ / кнопка «ОГОНЬ»), множитель урона. */
  manualOnly?: number;
  /** Множитель подбираемого скрапа (и опыта). */
  scrapMult?: number;
  /** Броня не действует. */
  armorDisabled?: boolean;
  /** Заряды рывка и множитель его перезарядки. */
  dashCharges?: number;
  dashCdMult?: number;
  /** 2.0, Мясник: шанс +1 HP за удар ближнего оружия (%) и множитель получаемого урона. */
  meleeHeal?: number;
  damageTakenMult?: number;
}

export interface OperatorDef {
  id: string;
  name: I18nKey;
  role: I18nKey;
  rules: readonly I18nKey[];
  color: string;
  glyph: string;
  startWeapons: readonly string[];
  mods: readonly ModDef[];
  rule: OperatorRules;
  unlock: Unlock;
}

export const OPERATORS: readonly OperatorDef[] = [
  { id: 'operator', name: 'op.operator', role: 'op.operator.role', rules: ['op.operator.r1'], color: '#62ecd2', glyph: '⬡',
    startWeapons: ['pulse'], mods: [], rule: {}, unlock: { kind: 'none' } },
  { id: 'welder', name: 'op.welder', role: 'op.welder.role', rules: ['op.welder.r1', 'op.welder.r2'], color: '#ffb05e', glyph: '⚒',
    startWeapons: ['blade'], mods: [{ stat: 'meleeDmg', flat: 15 }, { stat: 'maxHp', flat: 15 }], rule: { onlyTag: 'melee', armoredBonus: 20 },
    unlock: { kind: 'wave', n: 5 } },
  { id: 'signal', name: 'op.signal', role: 'op.signal.role', rules: ['op.signal.r1', 'op.signal.r2'], color: '#b4a0ff', glyph: '⌖',
    startWeapons: ['pulse'], mods: [{ stat: 'range', flat: 60 }], rule: { manualOnly: 2 },
    unlock: { kind: 'kills', n: 1000 } },
  { id: 'marauder', name: 'op.marauder', role: 'op.marauder.role', rules: ['op.marauder.r1', 'op.marauder.r2'], color: '#ffc163', glyph: '◆',
    startWeapons: ['nailer'], mods: [{ stat: 'maxHp', pct: -25 }], rule: { scrapMult: 1.5 },
    unlock: { kind: 'scrapRun', n: 800 } },
  { id: 'ghost', name: 'op.ghost', role: 'op.ghost.role', rules: ['op.ghost.r1', 'op.ghost.r2'], color: '#8fd8ff', glyph: '◇',
    startWeapons: ['rail'], mods: [{ stat: 'dodge', flat: 10 }], rule: { armorDisabled: true, dashCharges: 2, dashCdMult: 0.6 },
    unlock: { kind: 'guardian', n: 1 } },
  // 2.0: ближний бой как отдельный стиль — лечится ударами, держит удар, но только ближнее оружие
  { id: 'butcher', name: 'op.butcher', role: 'op.butcher.role', rules: ['op.butcher.r1', 'op.butcher.r2'], color: '#ff6d8a', glyph: '✖',
    startWeapons: ['claws'], mods: [{ stat: 'meleeDmg', flat: 10 }, { stat: 'maxHp', flat: 20 }, { stat: 'speed', flat: -5 }],
    rule: { onlyTag: 'melee', meleeHeal: 2, damageTakenMult: 0.85 },
    unlock: { kind: 'wave', n: 10 } },
];

export const operatorById = (id: string): OperatorDef => OPERATORS.find((o) => o.id === id) ?? OPERATORS[0]!;
