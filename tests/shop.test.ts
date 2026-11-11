import { describe, expect, it } from 'vitest';
import { startRun } from '../src/sim/step';
import type { SimEvent } from '../src/sim/events';
import { addModule, type SimState } from '../src/sim/state';
import {
  buyOffer, canTakeWeapon, currentReroll, mergeWeapon, modulePrice, openShop, rerollShop, sellValue, sellWeapon, toggleLock, weaponPrice,
} from '../src/sim/shop';
import { MODULES } from '../src/content/modules';
import { aggregate } from '../src/sim/effects';
import { damageEnemy, hurtPlayer, spawnEnemyNow } from '../src/sim/combat';
import { enemyHash } from '../src/sim/world';
import { leaveShop } from '../src/sim/waves';

function shopAt(seed: number, wave: number, luck = 0): { s: SimState; ev: SimEvent[] } {
  const ev: SimEvent[] = [];
  const s = startRun(seed, ev);
  s.wave = wave;
  if (luck) s.p.mods.push({ stat: 'luck', flat: luck, source: { kind: 'dev', id: 'luck' } });
  s.p.stats.luck = luck;
  openShop(s);
  return { s, ev };
}

describe('магазин', () => {
  it('генерация детерминирована сидом, 4 позиции, цены по формуле', () => {
    const a = shopAt(42, 5).s.shop.offers;
    const b = shopAt(42, 5).s.shop.offers;
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    for (const o of a) expect(o!.price).toBe(o!.kind === 'weapon' ? weaponPrice(o!.tier, 5) : modulePrice(o!.rarity, 5));
  });
  it('удача повышает долю редких позиций (на 4000 позиций)', () => {
    const avg = (luck: number): number => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += shopAt(i, 8, luck).s.shop.offers.reduce((a, o) => a + o!.rarity, 0);
      return sum / 4000;
    };
    expect(avg(100)).toBeGreaterThan(avg(0) * 1.3);
  });
  it('на волне 1 легендарок нет', () => {
    for (let i = 0; i < 300; i++) for (const o of shopAt(i, 1).s.shop.offers) expect(o!.rarity).toBeLessThan(3);
  });
  it('перебор дорожает в пределах магазина и сбрасывается в новом', () => {
    const { s, ev } = shopAt(1, 10);
    s.scrap = 1000;
    expect(currentReroll(s)).toBe(6);
    rerollShop(s, ev);
    expect(currentReroll(s)).toBe(8);
    expect(s.scrap).toBe(994);
    openShop(s);
    expect(currentReroll(s)).toBe(6);
  });
  it('замок сохраняет позицию и цену через перебор и следующий магазин', () => {
    const { s, ev } = shopAt(2, 4);
    s.scrap = 1000;
    toggleLock(s, 1, ev);
    const locked = { ...s.shop.offers[1]! };
    rerollShop(s, ev);
    expect(s.shop.offers[1]).toMatchObject({ id: locked.id, price: locked.price, locked: true });
    s.wave = 9;
    openShop(s);
    expect(s.shop.offers[1]).toMatchObject({ id: locked.id, price: locked.price });
  });
  it('покупка списывает скрап и освобождает позицию; без денег — отказ', () => {
    const { s, ev } = shopAt(3, 3);
    s.scrap = 0;
    expect(buyOffer(s, 0, ev)).toBe(false);
    s.scrap = 500;
    const price = s.shop.offers[0]!.price;
    expect(buyOffer(s, 0, ev)).toBe(true);
    expect(s.scrap).toBe(500 - price);
    expect(s.shop.offers[0]).toBeNull();
  });
  it('слияние: два одинаковых тира I → тир II, слот освобождается', () => {
    const { s, ev } = shopAt(4, 3);
    s.p.weapons.push({ uid: 50, id: 'pulse', tier: 1, cd: 0, aim: 0, flash: 0, x: 0, y: 0 });
    expect(mergeWeapon(s, s.p.weapons[0]!.uid, ev)).toBe(true);
    expect(s.p.weapons).toHaveLength(1);
    expect(s.p.weapons[0]!.tier).toBe(2);
    expect(mergeWeapon(s, s.p.weapons[0]!.uid, ev)).toBe(false);
  });
  it('полный арсенал: покупка такого же оружия сразу сливается, чужое — нельзя', () => {
    const { s, ev } = shopAt(5, 3);
    s.p.weapons = ['pulse', 'nailer', 'blade', 'rail', 'arc', 'scatter'].map((id, i) => ({ uid: i + 1, id, tier: 1, cd: 0, aim: 0, flash: 0, x: 0, y: 0 }));
    expect(canTakeWeapon(s, 'pulse', 1)).toBe(true);
    expect(canTakeWeapon(s, 'pulse', 2)).toBe(false);
    s.shop.offers[0] = { kind: 'weapon', id: 'rail', tier: 1, rarity: 0, price: 10, locked: false };
    s.shop.offers[1] = { kind: 'weapon', id: 'rail', tier: 2, rarity: 1, price: 10, locked: false };
    s.scrap = 100;
    expect(buyOffer(s, 0, ev)).toBe(true);
    expect(s.p.weapons.find((w) => w.id === 'rail')!.tier).toBe(2);
    expect(s.p.weapons).toHaveLength(6);
    s.p.weapons[0]!.id = 'blade'; // ломаем пару для тира II
    expect(buyOffer(s, 1, ev)).toBe(true); // rail II + rail II → III
    expect(s.p.weapons.find((w) => w.id === 'rail')!.tier).toBe(3);
  });
  it('продажа: 50% цены тира; последнее оружие продать нельзя', () => {
    const { s, ev } = shopAt(6, 6);
    s.p.weapons.push({ uid: 77, id: 'rail', tier: 2, cd: 0, aim: 0, flash: 0, x: 0, y: 0 });
    const before = s.scrap;
    expect(sellWeapon(s, 77, ev)).toBe(true);
    expect(s.scrap - before).toBe(sellValue(2, 6));
    expect(sellValue(2, 6)).toBe(Math.floor(weaponPrice(2, 6) / 2));
    expect(sellWeapon(s, s.p.weapons[0]!.uid, ev)).toBe(false);
  });
  it('уникальный модуль не предлагается после покупки максимума', () => {
    const { s } = shopAt(7, 20, 300);
    addModule(s.p, 'storm');
    for (let i = 0; i < 200; i++) { openShop(s); for (const o of s.shop.offers) expect(o!.id).not.toBe('storm'); }
  });
  it('выход из магазина запускает следующую волну', () => {
    const { s, ev } = shopAt(8, 3);
    leaveShop(s, ev);
    expect(s.phase).toBe('play');
    expect(s.wave).toBe(4);
  });
});

describe('модули и эффекты', () => {
  it('контент: 40+ модулей, все 4 редкости, у уникальных max', () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(40);
    for (let r = 0; r < 4; r++) expect(MODULES.some((m) => m.rarity === r)).toBe(true);
    for (const m of MODULES.filter((x) => x.rarity === 3)) expect(m.max).toBe(1);
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
  });
  it('модификаторы модуля попадают в статы с источником; копии стакаются линейно', () => {
    const ev: SimEvent[] = [];
    const s = startRun(1, ev);
    for (let i = 0; i < 5; i++) addModule(s.p, 'servo');
    expect(s.p.stats.atkSpeed).toBe(30);
    expect(s.p.mods.filter((m) => m.source.id === 'servo')).toHaveLength(5);
  });
  it('агрегация: шансы суммируются с капом, радиус — максимум', () => {
    const fx = aggregate([{ id: 'volatile', count: 3 }, { id: 'blastcore', count: 3 }]);
    expect(fx.killExplode.chance).toBe(100);
    expect(fx.killExplode.r).toBe(90);
  });
  it('взрыв при убийстве не запускает цепную реакцию (глубина 1)', () => {
    const ev: SimEvent[] = [];
    const s = startRun(2, ev);
    s.wave = 1;
    for (let i = 0; i < 3; i++) addModule(s.p, 'blastcore'); // 90% шанс
    for (let i = 0; i < 4; i++) addModule(s.p, 'volatile'); // → 100%
    const es = Array.from({ length: 6 }, (_, i) => spawnEnemyNow(s, 'drone', 300 + i * 40, 300, null));
    for (const e of es) e.hp = 1;
    enemyHash.build(s.enemies);
    damageEnemy(s, es[0]!, 10, false, 'test', ev);
    // первый убит оружием → взрыв R90 задевает соседей в радиусе, их смерти НЕ взрываются дальше
    const dead = es.filter((e) => e.dead).length;
    expect(dead).toBeGreaterThan(1);
    expect(es[5]!.dead).toBe(false); // 200 px от первого — цепочка бы дошла
  });
  it('щит волны поглощает удар', () => {
    const ev: SimEvent[] = [];
    const s = startRun(3, ev);
    addModule(s.p, 'aegis');
    s.p.shield = s.p.fx.waveShield;
    s.p.inv = 0;
    const hp = s.p.hp;
    hurtPlayer(s, 30, 'drone', ev);
    expect(s.p.hp).toBe(hp);
    expect(s.p.shield).toBe(0);
  });
});
