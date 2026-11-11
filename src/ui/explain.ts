import { STATS, type StatId } from '../content/stats';
import { WEAPONS, type WeaponTag } from '../content/weapons';
import { t, type I18nKey } from '../i18n';

/** Описание стата с подстановкой списка оружия соответствующего класса. */
export function statDesc(stat: StatId): string {
  const cls = stat === 'meleeDmg' ? 'melee' : stat === 'rangedDmg' ? 'ranged' : stat === 'energyDmg' ? 'energy' : null;
  const list = cls ? WEAPONS.filter((w) => w.dmgClass === cls).map((w) => t(w.name).toLowerCase()).join(', ') : '';
  return t(`statdesc.${stat}` as I18nKey, { list });
}

export const statName = (stat: StatId): string => t(STATS[stat].name);

export const tagDesc = (tag: WeaponTag): string => t(`tagdesc.${tag}` as I18nKey);
