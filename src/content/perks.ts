import type { I18nKey } from '../i18n';

export type PerkId = 'overload' | 'rapid' | 'plates' | 'chassis' | 'mag' | 'hands' | 'phase' | 'vampire';

export interface PerkDef {
  id: PerkId;
  icon: string;
  name: I18nKey;
  desc: I18nKey;
}

/** Перки прототипа (после каждой волны). На этапе 2 заменяются уровнями и магазином. */
export const PERKS: readonly PerkDef[] = [
  { id: 'overload', icon: '↗', name: 'perk.overload.name', desc: 'perk.overload.desc' },
  { id: 'rapid', icon: '»', name: 'perk.rapid.name', desc: 'perk.rapid.desc' },
  { id: 'plates', icon: '✚', name: 'perk.plates.name', desc: 'perk.plates.desc' },
  { id: 'chassis', icon: 'ϟ', name: 'perk.chassis.name', desc: 'perk.chassis.desc' },
  { id: 'mag', icon: '∞', name: 'perk.mag.name', desc: 'perk.mag.desc' },
  { id: 'hands', icon: '↻', name: 'perk.hands.name', desc: 'perk.hands.desc' },
  { id: 'phase', icon: '◇', name: 'perk.phase.name', desc: 'perk.phase.desc' },
  { id: 'vampire', icon: '♥', name: 'perk.vampire.name', desc: 'perk.vampire.desc' },
];
