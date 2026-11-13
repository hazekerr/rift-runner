/**
 * Бот-оператор для баланс-прогонов и автотестов (не для игрока).
 * Движение: отталкивание от врагов и вражеских снарядов, мягкое притяжение к центру и к скрапу, рывок при угрозе.
 * Магазин: слияния → оружие до 6 → модули; уровни: по фиксированному приоритету статов.
 * Бот заметно слабее живого игрока: его результат — нижняя граница проходимости.
 */
import { ARENA_CENTER } from '../content/arena';
import type { StatId } from '../content/stats';
import { MAX_WEAPONS, weaponById } from '../content/weapons';
import { weaponRange } from './weapons';
import type { EventSink } from './events';
import { emptyInput, type TickInput } from './input';
import { buyOffer, canTakeWeapon, currentReroll, mergePartner, mergeWeapon, rerollShop } from './shop';
import type { SimState } from './state';
import { chooseLevel, leaveShop } from './waves';

/** Стиль бота: «ближний», если хотя бы половина оружия — ближнего боя (иначе ближний бой не измерить честно). */
export function botMelee(s: SimState): boolean {
  const n = s.p.weapons.length;
  return n > 0 && s.p.weapons.filter((w) => weaponById(w.id).dmgClass === 'melee').length * 2 >= n;
}

/** Дистанция удара ближнего оружия бота (минимум по арсеналу). */
function meleeReach(s: SimState): number {
  let r = Infinity;
  for (const w of s.p.weapons) {
    const def = weaponById(w.id);
    if (def.dmgClass === 'melee') r = Math.min(r, weaponRange(s, def));
  }
  return Number.isFinite(r) ? r : 80;
}

export function botInput(s: SimState): TickInput {
  const p = s.p;
  const inp = emptyInput();
  const melee = botMelee(s);
  // дальний стиль держит дистанцию 280, ближний подпускает до касания и сам идёт к цели
  const keep = melee ? 34 : 280;
  let vx = 0;
  let vy = 0;
  let nearCount = 0;
  let closest = Infinity;
  let target: { x: number; y: number; r: number } | null = null;
  let td = Infinity;
  for (const e of s.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 280) nearCount++;
    if (d - e.r < keep) {
      const w = (keep - (d - e.r)) / keep;
      vx += (dx / d) * w * w * 3;
      vy += (dy / d) * w * w * 3;
    }
    if (d < td) { td = d; target = e; }
    closest = Math.min(closest, d - e.r);
  }
  if (melee && target && td - target.r > meleeReach(s) * 0.7) {
    vx -= ((p.x - target.x) / td) * 1.5;
    vy -= ((p.y - target.y) / td) * 1.5;
  }
  let bulletDanger = false;
  for (const b of s.bullets) {
    if (b.friendly) continue;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 170) continue;
    // уходить перпендикулярно траектории снаряда
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const toward = (dx * b.vx + dy * b.vy) / (d * sp);
    if (toward < 0.3) continue;
    const side = Math.sign(dx * b.vy - dy * b.vx) || 1;
    vx += (-b.vy / sp) * side * 1.6;
    vy += (b.vx / sp) * side * 1.6;
    if (d < 45) bulletDanger = true;
  }
  for (const m of s.mines) {
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    if (d < 110) { vx += (p.x - m.x) / d; vy += (p.y - m.y) / d; }
  }
  for (const e of s.enemies) {
    if (!e.tele) continue;
    const tl = e.tele;
    if (tl.kind === 'circle' && Math.hypot(p.x - tl.x, p.y - tl.y) < tl.r + 30) { vx += (p.x - tl.x) * 0.05; vy += (p.y - tl.y) * 0.05; }
  }
  // к боссу, если он вне дальности оружия
  const boss = s.enemies.find((e) => e.type === 'boss' || e.type === 'heart');
  if (boss) {
    const d = Math.hypot(boss.x - p.x, boss.y - p.y);
    if (d > 380) { vx += ((boss.x - p.x) / d) * 1.2; vy += ((boss.y - p.y) / d) * 1.2; }
  }
  // к центру (не зажиматься в углах) и к ближайшему скрапу, если спокойно
  vx += (ARENA_CENTER.x - p.x) / 900;
  vy += (ARENA_CENTER.y - p.y) / 900;
  if (nearCount < 4) {
    let best = null as null | { x: number; y: number };
    let bd = 400;
    for (const sc of s.scraps) {
      const d = Math.hypot(sc.x - p.x, sc.y - p.y);
      if (d < bd) { bd = d; best = sc; }
    }
    if (best) { vx += ((best.x - p.x) / bd) * 0.7; vy += ((best.y - p.y) / bd) * 0.7; }
  }
  const len = Math.hypot(vx, vy);
  if (len > 0.05) { inp.moveX = vx / len; inp.moveY = vy / len; }
  inp.dash = (!melee && closest < 26) || bulletDanger;
  inp.pulse = p.energy >= 100 && nearCount >= 10;
  return inp;
}

const LEVEL_PRIORITY: readonly StatId[] = ['damage', 'atkSpeed', 'maxHp', 'armor', 'regen', 'energyDmg', 'rangedDmg', 'meleeDmg', 'crit', 'dodge', 'lifesteal', 'speed', 'range', 'harvest', 'magnet', 'luck'];

/** Выбрать улучшение по приоритету статов (с учётом редкости). */
export function botLevel(s: SimState, ev: EventSink): void {
  let best = 0;
  let bestScore = -Infinity;
  s.levelOffer.forEach((o, i) => {
    const score = (LEVEL_PRIORITY.length - LEVEL_PRIORITY.indexOf(o.stat)) + o.rarity * 6;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  chooseLevel(s, best, ev);
}

/** Закупка: слить пары → оружие (сначала то, что сольётся) → модули подороже → в бой. */
export function botShop(s: SimState, ev: EventSink): void {
  for (let guard = 0; guard < 24; guard++) {
    const pair = s.p.weapons.find((w) => mergePartner(s.p.weapons, w));
    if (pair && mergeWeapon(s, pair.uid, ev)) continue;
    const offers = s.shop.offers.map((o, i) => ({ o, i })).filter((x) => x.o && x.o.price <= s.scrap);
    const weapons = offers.filter((x) => x.o!.kind === 'weapon' && canTakeWeapon(s, x.o!.id, x.o!.tier));
    const mergeable = weapons.find((x) => s.p.weapons.some((w) => w.id === x.o!.id && w.tier === x.o!.tier));
    const pick = mergeable ?? (s.p.weapons.length < MAX_WEAPONS ? weapons.sort((a, b) => b.o!.tier - a.o!.tier)[0] : undefined)
      ?? offers.filter((x) => x.o!.kind === 'module').sort((a, b) => b.o!.rarity - a.o!.rarity)[0];
    if (pick && buyOffer(s, pick.i, ev)) continue;
    // как живой игрок: при избытке скрапа перебирает (не больше 4 раз за магазин)
    if (s.shop.rerolls < 4 && s.scrap > currentReroll(s) * 4 && rerollShop(s, ev)) continue;
    break;
  }
  leaveShop(s, ev);
}
