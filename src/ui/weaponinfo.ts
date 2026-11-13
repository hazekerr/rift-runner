/**
 * Подробная карточка оружия: урон за попадание, перезарядка, дальность, особенности, теги, DPS.
 * Используется в арсенале (по нажатию) и в предложениях магазина — отзыв v1.1: «кроме DPS ничего не глянуть».
 */
import { TIER_MULT } from '../content/balance';
import { CRIT_MULT } from '../content/stats';
import { weaponById, type WeaponDef } from '../content/weapons';
import { operatorById } from '../content/operators';
import { t, type I18nKey } from '../i18n';
import { weaponDps } from '../sim/dps';
import type { SimState } from '../sim/state';
import { weaponCooldown, weaponRange } from '../sim/weapons';
import { h } from './dom';
import { iconImg, weaponIconUrl } from './icons';
import { RARITY_PIPS } from '../content/levelups';

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Урон одного попадания с текущими статами (без крита). */
export function hitDamage(s: SimState, def: WeaponDef, tier: number): number {
  const st = s.p.stats;
  const cls = def.dmgClass === 'melee' ? st.meleeDmg : def.dmgClass === 'ranged' ? st.rangedDmg : st.energyDmg;
  const manual = operatorById(s.operator).rule.manualOnly ?? 1;
  return def.damage * TIER_MULT[tier - 1]! * Math.max(0.1, 1 + (st.damage + cls) / 100) * manual;
}

const classStat = (def: WeaponDef): 'meleeDmg' | 'rangedDmg' | 'energyDmg' =>
  def.dmgClass === 'melee' ? 'meleeDmg' : def.dmgClass === 'ranged' ? 'rangedDmg' : 'energyDmg';

/** Пары «подпись — значение» для карточки оружия. */
export function weaponFacts(s: SimState, id: string, tier: number): Array<[string, string]> {
  const def = weaponById(id);
  const inst = { uid: 0, id, tier, cd: 0, aim: 0, flash: 0, x: 0, y: 0 };
  const fx = s.p.fx;
  const dmg = hitDamage(s, def, tier);
  const rows: Array<[string, string]> = [];
  const pellets = def.pellets ?? 1;
  rows.push([t('wi.hit'), `${r1(dmg)}${pellets > 1 ? ` ×${pellets}` : ''} · ${t('wi.crit', { n: r1(dmg * CRIT_MULT) })}`]);
  rows.push([t('wi.class'), `${t(`wi.cls.${def.dmgClass}` as I18nKey)} · ${fmtSigned(s.p.stats[classStat(def)] + s.p.stats.damage)}%`]);
  if (def.kind === 'turret') {
    rows.push([t('wi.turret'), t('wi.turretV', { n: def.turretMax ?? 1, life: r1((def.turretLife ?? 0) * fx.turretLifeMult), rate: r1(def.turretRate ?? 1) })]);
    rows.push([t('wi.deploy'), `${r1(weaponCooldown(s, def, inst))} ${t('wi.sec')}`]);
  } else if (def.kind === 'orbit') {
    rows.push([t('wi.blades'), String(def.blades ?? 2)]);
  } else {
    const cd = weaponCooldown(s, def, inst);
    rows.push([t('wi.cooldown'), `${r1(cd)} ${t('wi.sec')} · ${r1(1 / cd)}/${t('wi.sec')}`]);
  }
  rows.push([t('wi.range'), String(Math.round(weaponRange(s, def)))]);
  const pierce = (def.pierce ?? 1) + (def.kind === 'bullet' && def.tags.includes('ballistic') ? fx.pierceBonus : 0);
  if (def.kind === 'bullet' && pierce > 1) rows.push([t('wi.pierce'), String(pierce)]);
  if (def.chains) rows.push([t('wi.chains'), String(def.chains)]);
  if (def.explodeR) rows.push([t('wi.explode'), String(Math.round(def.explodeR * fx.explodeRadiusMult))]);
  if (def.arc) rows.push([t('wi.arc'), `${Math.round((def.arc * 2 * 180) / Math.PI)}°`]);
  if (def.burnChance) rows.push([t('wi.burn'), `${def.burnChance}%`]);
  if (def.slowPct) rows.push([t('wi.slow'), `${def.slowPct}%`]);
  rows.push(['DPS', String(Math.round(weaponDps(s, id, tier)))]);
  return rows;
}

const fmtSigned = (v: number): string => (v >= 0 ? `+${Math.round(v)}` : `−${Math.round(-v)}`);

/** Блок фактов для вставки в карточку/строку. */
export function weaponFactsEl(s: SimState, id: string, tier: number): HTMLElement {
  const def = weaponById(id);
  return h('div', 'wfacts',
    h('p', 'wdesc', t(def.desc)),
    ...weaponFacts(s, id, tier).map(([k, v]) => h('div', 'wfact', h('span', '', k), h('b', '', v))));
}

/** Пауза: оружие списком; нажатие раскрывает карточку (по одному). */
export function renderPauseWeapons(root: HTMLElement, s: SimState): void {
  root.replaceChildren();
  let open = -1;
  const draw = (): void => {
    root.replaceChildren();
    s.p.weapons.forEach((w, i) => {
      const def = weaponById(w.id);
      const head = h('button', `pw-head${open === i ? ' open' : ''}`, iconImg(weaponIconUrl(w.id, w.tier), 22, 'arm-icon'), h('span', '', `${t(def.name)} ${RARITY_PIPS[w.tier - 1]!}`), h('small', '', `${Math.round(weaponDps(s, w.id, w.tier))} DPS`));
      head.style.color = def.color;
      head.addEventListener('click', () => { open = open === i ? -1 : i; draw(); });
      root.append(head);
      if (open === i) root.append(h('div', 'arm-detail', weaponFactsEl(s, w.id, w.tier)));
    });
  };
  draw();
}
