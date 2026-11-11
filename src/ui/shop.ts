import { iconImg, moduleIconUrl, weaponIconUrl } from './icons';
import { statDesc, tagDesc } from './explain';
import type { WeaponTag } from '../content/weapons';
import { MAX_WEAPONS, estimateDps, weaponById } from '../content/weapons';
import { moduleById, type EffectDef, type ModuleDef } from '../content/modules';
import { RARITY_COLOR, RARITY_PIPS } from '../content/levelups';
import { STATS, type StatId } from '../content/stats';
import { TIER_MULT } from '../content/balance';
import { t, type I18nKey } from '../i18n';
import { computeStats } from '../sim/stats';
import { effectScale } from '../sim/effects';
import { canTakeWeapon, currentReroll, mergePartner, sellValue } from '../sim/shop';
import { moduleCount, type ShopOffer, type SimState } from '../sim/state';
import { weaponCooldown, weaponRange } from '../sim/weapons';
import { $, h } from './dom';
import { TAG_ORDER } from '../content/synergies';
import { renderStats } from './statspanel';

export interface ShopActions {
  buy(i: number): void;
  lock(i: number): void;
  reroll(): void;
  sell(uid: number): void;
  merge(uid: number): void;
  go(): void;
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Текст эффекта модуля с числами для текущей волны. */
export function effectText(s: SimState, e: EffectDef): string {
  const sc = effectScale(s);
  switch (e.kind) {
    case 'killExplode': return t('fx.killExplode', { chance: e.chance, r: e.r, dmg: Math.round(e.dmg * sc) });
    case 'dashNova': return t('fx.dashNova', { count: e.count, dmg: Math.round(e.dmg * sc) });
    case 'waveShield': return t('fx.waveShield', { n: e.charges });
    case 'hurtNova': return t('fx.hurtNova', { r: e.r, dmg: Math.round(e.dmg * sc) });
    case 'burn': return t('fx.burn', { chance: e.chance, dps: Math.round(e.dps * sc), dur: e.dur });
    case 'slow': return t('fx.slow', { chance: e.chance, pct: e.pct, dur: e.dur });
    case 'scrapHeal': return t('fx.scrapHeal', { every: e.every });
    case 'energyOnKill': return t('fx.energyOnKill', { n: e.amount });
    case 'lowHpDmg': return t('fx.lowHpDmg', { pct: e.pct, below: e.below });
    case 'critArc': return t('fx.critArc', { targets: e.targets, pct: e.pct });
    case 'zap': return t('fx.zap', { every: e.every, targets: e.targets, dmg: Math.round(e.dmg * sc) });
    case 'dashReset': return t('fx.dashReset', { chance: e.chance, sec: e.sec });
    case 'scrapOnKill': return t('fx.scrapOnKill', { chance: e.chance });
    case 'killHeal': return t('fx.killHeal', { chance: e.chance, amount: e.amount });
    case 'execute': return t('fx.execute', { below: e.below });
  }
}

/** Строки модуля: статы со знаком и стрелкой + эффект. */
export function moduleLines(s: SimState, def: ModuleDef): HTMLElement[] {
  const lines: HTMLElement[] = [];
  for (const m of def.mods) {
    const v = m.flat ?? m.pct ?? 0;
    const unit = m.pct !== undefined ? '%' : STATS[m.stat as StatId].unit;
    const el = h('div', v >= 0 ? 'line up' : 'line down', `${v >= 0 ? '▲ +' : '▼ '}${v}${unit} ${t(STATS[m.stat].name)}`);
    el.title = statDesc(m.stat);
    lines.push(el);
  }
  if (def.effect) lines.push(h('div', 'line fx', `◈ ${effectText(s, def.effect)}`));
  return lines;
}

export function weaponDps(s: SimState, id: string, tier: number): number {
  const def = weaponById(id);
  const st = s.p.stats;
  const cls = def.dmgClass === 'melee' ? st.meleeDmg : def.dmgClass === 'ranged' ? st.rangedDmg : st.energyDmg;
  const mult = Math.max(0.1, 1 + (st.damage + cls) / 100) * (1 + (Math.min(100, st.crit) / 100) * 0.5);
  const inst = { uid: 0, id, tier, cd: 0, aim: 0, flash: 0, x: 0, y: 0 };
  // Базовая оценка тира I из контента, масштабированная статами, тиром и скорострельностью
  const speedUp = def.cooldown / weaponCooldown(s, def, inst);
  return estimateDps(def) * TIER_MULT[tier - 1]! * mult * (def.kind === 'turret' ? 1 : speedUp);
}

/** Теги-кнопки: тап показывает объяснение тега прямо в карточке (на телефоне нет наведения). */
function tagRow(tags: readonly WeaponTag[]): HTMLElement {
  const note = h('div', 'tag-note hidden');
  const row = h('div', 'tags', ...tags.map((tag) => {
    const b = h('button', 'tag', t(`tag.${tag}` as I18nKey));
    b.title = tagDesc(tag);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const same = note.dataset.tag === tag && !note.classList.contains('hidden');
      note.dataset.tag = tag;
      note.textContent = `${tagDesc(tag)} ${t('tagdesc.hint')}`;
      note.classList.toggle('hidden', same);
    });
    return b;
  }));
  return h('div', '', row, note);
}

export class ShopView {
  private open = new Set<StatId>();
  private hovered: number | null = null;

  constructor(private readonly actions: ShopActions) {
    $('shopreroll').addEventListener('click', () => actions.reroll());
    $('shopgo').addEventListener('click', () => actions.go());
  }

  render(s: SimState): void {
    $('shophead').textContent = t('shop.eyebrow', { w: String(s.wave).padStart(2, '0'), n: String(s.wave + 1).padStart(2, '0') });
    $('shopscrap').textContent = String(s.scrap);
    $('offerslabel').textContent = t('shop.offers', { n: s.shop.offers.length });
    const cost = currentReroll(s);
    const rr = $<HTMLButtonElement>('shopreroll');
    rr.textContent = t('shop.reroll', { n: cost });
    rr.disabled = s.scrap < cost;
    const grid = $('offers');
    grid.replaceChildren(...s.shop.offers.map((o, i) => this.offerCard(s, o, i)));
    this.renderArsenal(s);
    this.renderModules(s);
    this.renderSynergies(s);
    this.renderStatList(s);
  }

  private renderSynergies(s: SimState): void {
    const root = $('synlist');
    root.replaceChildren();
    for (const tag of TAG_ORDER) {
      const n = s.p.tags[tag];
      if (!n) continue;
      const next = n >= 6 ? 6 : n >= 3 ? 6 : 3;
      const active = n >= 3;
      const desc = n >= 6 ? `${t(`syn.${tag}.3` as I18nKey)}; ${t(`syn.${tag}.6` as I18nKey)}` : active ? t(`syn.${tag}.3` as I18nKey) : `→ ${t(`syn.${tag}.3` as I18nKey)}`;
      root.append(h('div', `syn${active ? ' on' : ''}`, h('b', '', t(`tagname.${tag}` as I18nKey)), h('span', 'cnt', t('syn.row', { n, m: next })), h('span', 'desc', desc)));
    }
    if (!root.childElementCount) root.append(h('div', 'muted', t('syn.none')));
  }

  private previewStats(s: SimState): ReturnType<typeof computeStats> | null {
    if (this.hovered === null) return null;
    const o = s.shop.offers[this.hovered];
    if (!o || o.kind !== 'module') return null;
    const def = moduleById(o.id);
    const mods = [...s.p.mods, ...def.mods.map((m) => ({ ...m, source: { kind: 'module' as const, id: o.id } }))];
    return computeStats(mods);
  }

  private renderStatList(s: SimState): void {
    renderStats($('statlist'), s.p, this.open, this.previewStats(s));
  }

  private offerCard(s: SimState, o: ShopOffer | null, i: number): HTMLElement {
    if (!o) return h('div', 'offer sold', t('shop.sold'));
    const color = RARITY_COLOR[o.rarity]!;
    const rar = h('div', 'rar', h('span', '', t(`rarity.${o.rarity}` as I18nKey)), h('span', '', RARITY_PIPS[o.rarity]!));
    rar.style.color = color;
    const card = h('div', `offer${o.locked ? ' locked' : ''}`);
    card.style.setProperty('--rar', color);
    const body: Array<Node | string> = [rar];
    let blocked = '';
    if (o.kind === 'weapon') {
      const def = weaponById(o.id);
      body.push(h('div', 'ohead', iconImg(weaponIconUrl(o.id, o.tier), 48, 'offer-icon'), h('div', '', h('b', 'oname', t(def.name)), h('div', 'otype', t('shop.weapon', { n: RARITY_PIPS[o.tier - 1]! })))));
      body.push(h('p', 'odesc', t(def.desc)));
      body.push(h('div', 'line', t('shop.dps', { n: Math.round(weaponDps(s, o.id, o.tier)), r: Math.round(weaponRange(s, def)) })));
      body.push(tagRow(def.tags));
      if (s.p.weapons.some((w) => w.id === o.id && w.tier === o.tier) && o.tier < 4) {
        body.push(h('div', 'badge', t('shop.merge', { n: RARITY_PIPS[o.tier]! })));
      }
      if (!canTakeWeapon(s, o.id, o.tier)) blocked = t('shop.noSlot');
    } else {
      const def = moduleById(o.id);
      body.push(h('div', 'ohead', iconImg(moduleIconUrl(def.id), 48, 'offer-icon'), h('div', '', h('b', 'oname', t(def.name)), h('div', 'otype', `${t('shop.module')}${def.max ? ` · ${t('shop.uniq')}` : ''}${moduleCount(s.p, def.id) ? ` · ×${moduleCount(s.p, def.id)}` : ''}`))));
      body.push(h('div', 'olines', ...moduleLines(s, def)));
      if (def.tags.length) body.push(tagRow(def.tags));
      if (def.max && moduleCount(s.p, def.id) >= def.max) blocked = t('shop.max');
    }
    const buy = h('button', 'buy', blocked || t('shop.buy', { n: o.price }));
    buy.disabled = !!blocked || s.scrap < o.price;
    buy.addEventListener('click', () => this.actions.buy(i));
    const lock = h('button', `lock${o.locked ? ' on' : ''}`, o.locked ? `⊠ ${t('shop.locked')}` : `⊡ ${t('shop.lock')}`);
    lock.addEventListener('click', () => this.actions.lock(i));
    card.append(...body, h('div', 'ofoot', lock, buy));
    card.addEventListener('pointerenter', () => { this.hovered = i; this.renderStatList(s); });
    // тач: тап по карточке (не по кнопкам) включает/выключает превью статов
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.hovered = this.hovered === i ? null : i;
      card.classList.toggle('previewing', this.hovered === i);
      this.renderStatList(s);
    });
    card.addEventListener('pointerleave', () => { this.hovered = null; this.renderStatList(s); });
    return card;
  }

  private renderArsenal(s: SimState): void {
    $('arsenallabel').textContent = t('shop.arsenal', { n: s.p.weapons.length, m: MAX_WEAPONS });
    const root = $('arsenal');
    root.replaceChildren();
    for (let k = 0; k < MAX_WEAPONS; k++) {
      const w = s.p.weapons[k];
      if (!w) { root.append(h('div', 'arm empty', t('shop.empty'))); continue; }
      const def = weaponById(w.id);
      const name = h('span', 'arm-name', iconImg(weaponIconUrl(w.id, w.tier), 22, 'arm-icon'), `${t(def.name)} `, h('em', '', RARITY_PIPS[w.tier - 1]!));
      name.style.color = def.color;
      const row = h('div', 'arm', name, h('span', 'arm-dps', `${Math.round(weaponDps(s, w.id, w.tier))} DPS`));
      if (mergePartner(s.p.weapons, w)) {
        const mb = h('button', 'mini merge', t('shop.mergeBtn'));
        mb.addEventListener('click', () => this.actions.merge(w.uid));
        row.append(mb);
      }
      const sb = h('button', 'mini', t('shop.sell', { n: sellValue(w.tier, s.wave) }));
      sb.disabled = s.p.weapons.length <= 1;
      sb.addEventListener('click', () => this.actions.sell(w.uid));
      row.append(sb);
      root.append(row);
    }
  }

  private renderModules(s: SimState): void {
    $('modlabel').textContent = t('shop.modules', { n: s.p.modules.reduce((a, m) => a + m.count, 0) });
    const root = $('modlist');
    root.replaceChildren();
    if (!s.p.modules.length) { root.append(h('div', 'muted', t('shop.noModules'))); return; }
    for (const m of s.p.modules) {
      const def = moduleById(m.id);
      const chip = h('span', 'chip', iconImg(moduleIconUrl(m.id), 18, 'chip-icon'), `${t(def.name)}${m.count > 1 ? ` ×${m.count}` : ''}`);
      chip.style.borderColor = RARITY_COLOR[def.rarity]!;
      chip.title = [...def.mods.map((x) => `${(x.flat ?? x.pct ?? 0) > 0 ? '+' : ''}${x.flat ?? x.pct}${x.pct !== undefined ? '%' : STATS[x.stat].unit} ${t(STATS[x.stat].name)}`), def.effect ? effectText(s, def.effect) : ''].filter(Boolean).join('\n');
      root.append(chip);
    }
  }
}

export { r1 };
