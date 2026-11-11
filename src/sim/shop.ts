/**
 * Магазин между волнами: 4 позиции (оружие и модули), перебор с растущей ценой, замок,
 * покупка, продажа и слияние оружия. Чистая логика на сидовом RNG (поток offer).
 */
import { chance, int, nextFloat } from '../core/rng';
import { rarityWeights, rerollCost } from '../content/balance';
import { MODULES, MODULE_PRICE, WEAPON_PRICE, moduleById } from '../content/modules';
import { MAX_WEAPONS, WEAPONS } from '../content/weapons';
import type { EventSink } from './events';
import type { I18nKey } from '../i18n';
import { addModule, moduleCount, refreshStats, type ShopOffer, type SimState, type WeaponInst } from './state';
import { operatorById } from '../content/operators';
import { threatMods } from '../content/threat';

export const SHOP_SLOTS = 4;
export const SELL_SHARE = 0.5;
export const WEAPON_OFFER_CHANCE = 0.35;

/** Цена с учётом волны: floor(base · (1 + 0.1·(w−1))). */
export const priceAt = (base: number, w: number): number => Math.max(1, Math.floor(base * (1 + 0.1 * (Math.max(1, w) - 1))));
export const weaponPrice = (tier: number, w: number): number => priceAt(WEAPON_PRICE[tier - 1]!, w);
export const modulePrice = (rarity: number, w: number): number => priceAt(MODULE_PRICE[rarity]!, w);
export const sellValue = (tier: number, w: number): number => Math.floor(weaponPrice(tier, w) * SELL_SHARE);

/** Есть ли у оружия пара для слияния (тот же id и тир, тир < 4). */
export function mergePartner(weapons: ReadonlyArray<WeaponInst>, w: WeaponInst): WeaponInst | null {
  if (w.tier >= 4) return null;
  return weapons.find((o) => o !== w && o.id === w.id && o.tier === w.tier) ?? null;
}

/** Можно ли взять оружие: есть слот или оно сразу сольётся с имеющимся. */
export function canTakeWeapon(s: SimState, id: string, tier: number): boolean {
  if (s.p.weapons.length < MAX_WEAPONS) return true;
  return tier < 4 && s.p.weapons.some((w) => w.id === id && w.tier === tier);
}

function rollRarity(s: SimState): number {
  const weights = rarityWeights(s.wave, s.p.stats.luck);
  let roll = nextFloat(s.rng.offer);
  for (let r = 3; r >= 1; r--) {
    if (roll < weights[r]!) return r;
    roll -= weights[r]!;
  }
  return 0;
}

function rollOffer(s: SimState): ShopOffer {
  const rarity = rollRarity(s);
  if (chance(s.rng.offer, WEAPON_OFFER_CHANCE)) {
    // Сварщик и др.: только оружие с нужным тегом
    const only = operatorById(s.operator).rule.onlyTag;
    const pool = only ? WEAPONS.filter((w) => w.tags.includes(only)) : WEAPONS;
    const def = pool[int(s.rng.offer, pool.length)]!;
    const tier = rarity + 1;
    return { kind: 'weapon', id: def.id, tier, rarity, price: Math.floor(weaponPrice(tier, s.wave) * threatMods(s.threat).priceMult), locked: false };
  }
  // модуль этой редкости; уникальные, которых уже максимум, не предлагаем; иначе — редкость ниже
  for (let r = rarity; r >= 0; r--) {
    const pool = MODULES.filter((m) => m.rarity === r && (!m.max || moduleCount(s.p, m.id) < m.max));
    if (pool.length) {
      const def = pool[int(s.rng.offer, pool.length)]!;
      return { kind: 'module', id: def.id, tier: 0, rarity: r, price: Math.floor(modulePrice(r, s.wave) * threatMods(s.threat).priceMult), locked: false };
    }
  }
  return { kind: 'module', id: 'cell', tier: 0, rarity: 0, price: modulePrice(0, s.wave), locked: false };
}

/** Заполнить пустые и незамкнутые позиции. Замкнутые сохраняются с ценой. */
export function fillShop(s: SimState): void {
  const prev = s.shop.offers;
  const offers: Array<ShopOffer | null> = [];
  for (let i = 0; i < SHOP_SLOTS; i++) {
    const o = prev[i];
    offers.push(o && o.locked ? o : rollOffer(s));
  }
  s.shop.offers = offers;
}

export function openShop(s: SimState): void {
  s.shop.rerolls = 0;
  s.phase = 'shop';
  fillShop(s);
}

export const currentReroll = (s: SimState): number => rerollCost(s.wave, s.shop.rerolls);

export function rerollShop(s: SimState, ev: EventSink): boolean {
  const cost = currentReroll(s);
  if (s.phase !== 'shop' || s.scrap < cost) {
    ev.push({ t: 'sfx', id: 'error' });
    return false;
  }
  s.scrap -= cost;
  s.shop.rerolls++;
  fillShop(s);
  ev.push({ t: 'sfx', id: 'reroll' });
  ev.push({ t: 'phase' });
  return true;
}

export function toggleLock(s: SimState, i: number, ev: EventSink): void {
  const o = s.shop.offers[i];
  if (s.phase !== 'shop' || !o) return;
  o.locked = !o.locked;
  ev.push({ t: 'sfx', id: 'choose' });
  ev.push({ t: 'phase' });
}

/** Слить оружие с его парой: обе копии уходят, на месте первой — тир +1. */
export function mergeWeapon(s: SimState, uid: number, ev: EventSink): boolean {
  const ws = s.p.weapons;
  const w = ws.find((x) => x.uid === uid);
  if (!w) return false;
  const partner = mergePartner(ws, w);
  if (!partner) return false;
  ws.splice(ws.indexOf(partner), 1);
  w.tier++;
  w.cd = 0.3;
  refreshStats(s.p);
  ev.push({ t: 'sfx', id: 'levelUp' });
  ev.push({ t: 'phase' });
  return true;
}

export function buyOffer(s: SimState, i: number, ev: EventSink): boolean {
  const o = s.shop.offers[i];
  if (s.phase !== 'shop' || !o || s.scrap < o.price) {
    ev.push({ t: 'sfx', id: 'error' });
    return false;
  }
  if (o.kind === 'weapon') {
    if (!canTakeWeapon(s, o.id, o.tier)) {
      ev.push({ t: 'sfx', id: 'error' });
      return false;
    }
    const inst: WeaponInst = { uid: s.nextId++, id: o.id, tier: o.tier, cd: 0.3, aim: 0, flash: 0, x: s.p.x, y: s.p.y };
    if (s.p.weapons.length >= MAX_WEAPONS) {
      // Полный арсенал: покупка сразу сливается с парой
      const partner = s.p.weapons.find((w) => w.id === o.id && w.tier === o.tier)!;
      partner.tier++;
    } else s.p.weapons.push(inst);
    const before = { ...s.p.tags };
    refreshStats(s.p);
    synergyToasts(s, before, ev);
  } else {
    const def = moduleById(o.id);
    if (def.max && moduleCount(s.p, o.id) >= def.max) {
      ev.push({ t: 'sfx', id: 'error' });
      return false;
    }
    const before = { ...s.p.tags };
    addModule(s.p, o.id);
    synergyToasts(s, before, ev);
  }
  s.scrap -= o.price;
  s.shop.offers[i] = null;
  ev.push({ t: 'sfx', id: 'choose' });
  ev.push({ t: 'phase' });
  return true;
}

export function sellWeapon(s: SimState, uid: number, ev: EventSink): boolean {
  const ws = s.p.weapons;
  const w = ws.find((x) => x.uid === uid);
  if (s.phase !== 'shop' || !w || ws.length <= 1) {
    ev.push({ t: 'sfx', id: 'error' });
    return false;
  }
  ws.splice(ws.indexOf(w), 1);
  refreshStats(s.p);
  s.scrap += sellValue(w.tier, s.wave);
  ev.push({ t: 'sfx', id: 'scrap' });
  ev.push({ t: 'phase' });
  return true;
}

/** Сообщить о новых активных порогах синергий. */
function synergyToasts(s: SimState, before: Record<string, number>, ev: EventSink): void {
  for (const [tag, n] of Object.entries(s.p.tags)) {
    const was = before[tag] ?? 0;
    for (const need of [3, 6]) {
      if (was < need && n >= need) {
        ev.push({ t: 'toast', key: 'syn.on', sub: `syn.${tag}.${need}` as I18nKey, params: { nKey: `tagname.${tag}`, m: need }, duration: 2.2 });
        ev.push({ t: 'sfx', id: 'synergy' });
      }
    }
  }
}
