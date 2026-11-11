import type { EffectDef, ModDef } from './modules';
import type { WeaponTag } from './weapons';

/** Флаги, которые меняют поведение оружия (не выражаются статами). */
export interface SynergyFlags {
  pierceBonus?: number;
  explodeRadiusMult?: number;
  turretLifeMult?: number;
  burnMult?: number;
}

export interface SynergyTier {
  mods: readonly ModDef[];
  effects?: readonly EffectDef[];
  flags?: SynergyFlags;
}

/** Пороги синергий тегов: 3 и 6 предметов (оружие + модули). Бонусы порогов складываются. */
export const SYNERGY_THRESHOLDS = [3, 6] as const;

export const SYNERGIES: Record<WeaponTag, readonly [SynergyTier, SynergyTier]> = {
  melee: [
    { mods: [{ stat: 'meleeDmg', flat: 15 }, { stat: 'lifesteal', flat: 3 }] },
    { mods: [{ stat: 'meleeDmg', flat: 25 }, { stat: 'armor', flat: 3 }] },
  ],
  ballistic: [
    { mods: [{ stat: 'rangedDmg', flat: 12 }, { stat: 'range', flat: 40 }] },
    { mods: [{ stat: 'crit', flat: 5 }], flags: { pierceBonus: 1 } },
  ],
  energy: [
    { mods: [{ stat: 'energyDmg', flat: 12 }] },
    { mods: [{ stat: 'crit', flat: 8 }], effects: [{ kind: 'critArc', targets: 1, pct: 40 }] },
  ],
  explosive: [
    { mods: [], effects: [{ kind: 'killExplode', chance: 10, r: 70, dmg: 12 }] },
    { mods: [], effects: [{ kind: 'killExplode', chance: 15, r: 70, dmg: 12 }], flags: { explodeRadiusMult: 1.4 } },
  ],
  turret: [
    { mods: [], effects: [{ kind: 'zap', every: 2, dmg: 10, targets: 1 }] },
    { mods: [], effects: [{ kind: 'zap', every: 1, dmg: 14, targets: 2 }], flags: { turretLifeMult: 1.5 } },
  ],
  element: [
    { mods: [], effects: [{ kind: 'burn', chance: 10, dps: 6, dur: 3 }] },
    { mods: [], effects: [{ kind: 'slow', chance: 20, pct: 30, dur: 1.5 }], flags: { burnMult: 1.5 } },
  ],
};

export const TAG_ORDER: readonly WeaponTag[] = ['melee', 'ballistic', 'energy', 'explosive', 'turret', 'element'];
