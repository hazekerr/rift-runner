import type { I18nKey } from '../i18n';
import type { StatId } from './stats';
import type { WeaponTag } from './weapons';

/**
 * Эффекты модулей описаны данными и исполняются интерпретатором sim/effects.ts.
 * Урон эффектов масштабируется: dmg · enemyHpMult(w) · (1 + урон%/100).
 */
export type EffectDef =
  | { kind: 'killExplode'; chance: number; r: number; dmg: number }
  | { kind: 'dashNova'; count: number; dmg: number }
  | { kind: 'waveShield'; charges: number }
  | { kind: 'hurtNova'; dmg: number; r: number }
  | { kind: 'burn'; chance: number; dps: number; dur: number }
  | { kind: 'slow'; chance: number; pct: number; dur: number }
  | { kind: 'scrapHeal'; every: number }
  | { kind: 'energyOnKill'; amount: number }
  | { kind: 'lowHpDmg'; pct: number; below: number }
  | { kind: 'critArc'; targets: number; pct: number }
  | { kind: 'zap'; every: number; dmg: number; targets: number }
  | { kind: 'dashReset'; chance: number; sec: number }
  | { kind: 'scrapOnKill'; chance: number }
  | { kind: 'killHeal'; chance: number; amount: number }
  | { kind: 'execute'; below: number };

export type EffectKind = EffectDef['kind'];

export interface ModDef {
  stat: StatId;
  flat?: number;
  pct?: number;
}

export interface ModuleDef {
  id: string;
  name: I18nKey;
  rarity: 0 | 1 | 2 | 3;
  tags: readonly WeaponTag[];
  mods: readonly ModDef[];
  effect?: EffectDef;
  /** Максимум копий (по умолчанию без лимита; легендарные — 1). */
  max?: number;
}

const m = (id: string, rarity: ModuleDef['rarity'], mods: ModDef[], effect?: EffectDef, tags: WeaponTag[] = [], max?: number): ModuleDef => ({
  id, name: `m.${id}` as I18nKey, rarity, tags, mods, ...(effect ? { effect } : {}), ...(max ? { max } : {}),
});

export const MODULES: readonly ModuleDef[] = [
  // ---- СТАНДАРТ ----
  m('servo', 0, [{ stat: 'atkSpeed', flat: 12 }]),
  m('plating', 0, [{ stat: 'armor', flat: 2 }]),
  m('cell', 0, [{ stat: 'maxHp', flat: 12 }]),
  m('lens', 0, [{ stat: 'crit', flat: 10 }]),
  m('actuator', 0, [{ stat: 'speed', flat: 7 }]),
  m('magcoil', 0, [{ stat: 'magnet', flat: 45 }]),
  m('sifter', 0, [{ stat: 'harvest', flat: 10 }]),
  m('scope', 0, [{ stat: 'range', flat: 45 }]),
  m('charger', 0, [{ stat: 'energyDmg', flat: 15 }], undefined, ['energy']),
  m('barrel', 0, [{ stat: 'rangedDmg', flat: 15 }], undefined, ['ballistic']),
  m('whetstone', 0, [{ stat: 'meleeDmg', flat: 15 }], undefined, ['melee']),
  m('chip', 0, [{ stat: 'luck', flat: 12 }]),
  m('medgel', 0, [{ stat: 'regen', flat: 3 }]),
  m('leech', 0, [{ stat: 'lifesteal', flat: 3 }]),
  m('amp', 0, [{ stat: 'damage', flat: 12 }]),
  // ---- УЛУЧШЕННЫЙ ----
  m('overclock', 1, [{ stat: 'atkSpeed', flat: 25 }, { stat: 'maxHp', flat: -5 }]),
  m('heavyplate', 1, [{ stat: 'armor', flat: 4 }, { stat: 'speed', flat: -4 }]),
  m('flicker', 1, [{ stat: 'dodge', flat: 8 }]),
  m('focus', 1, [{ stat: 'crit', flat: 18 }, { stat: 'atkSpeed', flat: -3 }]),
  m('longbarrel', 1, [{ stat: 'range', flat: 80 }, { stat: 'rangedDmg', flat: 8 }], undefined, ['ballistic']),
  m('scrapline', 1, [{ stat: 'harvest', flat: 18 }, { stat: 'damage', flat: -3 }]),
  m('shockpad', 1, [], { kind: 'dashNova', count: 8, dmg: 10 }, ['energy']),
  m('volatile', 1, [], { kind: 'killExplode', chance: 15, r: 70, dmg: 10 }, ['explosive']),
  m('capacitor', 1, [{ stat: 'energyDmg', flat: 5 }], { kind: 'energyOnKill', amount: 3 }, ['energy']),
  m('aegis', 1, [], { kind: 'waveShield', charges: 1 }),
  m('thorns', 1, [{ stat: 'armor', flat: 1 }], { kind: 'hurtNova', dmg: 20, r: 120 }),
  m('igniter', 1, [], { kind: 'burn', chance: 10, dps: 6, dur: 3 }, ['element']),
  m('cryo', 1, [], { kind: 'slow', chance: 15, pct: 40, dur: 1.5 }, ['element']),
  m('siphon', 1, [], { kind: 'scrapHeal', every: 12 }),
  // ---- ПРОТОТИП ----
  m('rage', 2, [], { kind: 'lowHpDmg', pct: 35, below: 40 }),
  m('reactor', 2, [{ stat: 'damage', flat: 35 }, { stat: 'armor', flat: -2 }]),
  m('bulwark', 2, [{ stat: 'maxHp', flat: 20 }, { stat: 'armor', flat: 2 }, { stat: 'speed', flat: -6 }]),
  m('phantom', 2, [{ stat: 'dodge', flat: 12 }, { stat: 'maxHp', flat: -10 }]),
  m('arcprism', 2, [{ stat: 'crit', flat: 3 }], { kind: 'critArc', targets: 2, pct: 50 }, ['energy']),
  m('sentry', 2, [], { kind: 'zap', every: 1.2, dmg: 14, targets: 1 }, ['turret']),
  m('blastcore', 2, [], { kind: 'killExplode', chance: 30, r: 90, dmg: 18 }, ['explosive']),
  m('reflex', 2, [{ stat: 'speed', flat: 4 }], { kind: 'dashReset', chance: 20, sec: 0.5 }),
  m('prospector', 2, [{ stat: 'luck', flat: 5 }], { kind: 'scrapOnKill', chance: 8 }),
  m('novaplate', 2, [{ stat: 'armor', flat: 1 }], { kind: 'dashNova', count: 14, dmg: 18 }, ['energy']),
  // ---- АНОМАЛИЯ ----
  m('singularity', 3, [{ stat: 'magnet', flat: 80 }, { stat: 'harvest', flat: 20 }, { stat: 'damage', flat: 8 }], undefined, [], 1),
  m('riftheart', 3, [{ stat: 'maxHp', flat: 15 }], { kind: 'killHeal', chance: 10, amount: 2 }, [], 1),
  m('storm', 3, [], { kind: 'zap', every: 0.6, dmg: 22, targets: 3 }, ['turret', 'energy'], 1),
  m('phoenix', 3, [{ stat: 'regen', flat: 4 }], { kind: 'waveShield', charges: 3 }, [], 1),
  m('executioner', 3, [{ stat: 'crit', flat: 12 }], { kind: 'execute', below: 12 }, [], 1),
  m('overdrive', 3, [{ stat: 'atkSpeed', flat: 30 }, { stat: 'damage', flat: 10 }, { stat: 'maxHp', flat: -20 }, { stat: 'armor', flat: -3 }], undefined, [], 1),
];

export const moduleById = (id: string): ModuleDef => {
  const d = MODULES.find((x) => x.id === id);
  if (!d) throw new Error(`Нет модуля ${id}`);
  return d;
};

/** Базовые цены (× (1 + 0.1·(w−1))): модули по редкости, оружие по тиру. */
export const MODULE_PRICE = [12, 28, 50, 90] as const;
export const WEAPON_PRICE = [22, 48, 95, 180] as const;
