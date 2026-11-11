import { describe, expect, it } from 'vitest';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import { emptyInput } from '../src/sim/input';
import type { SimEvent } from '../src/sim/events';
import { addModule, refreshStats, type SimState } from '../src/sim/state';
import { spawnEnemyNow, hurtPlayer } from '../src/sim/combat';
import { openShop } from '../src/sim/shop';
import { gainScrap } from '../src/sim/waves';
import { heartPhase } from '../src/sim/bosses';
import { WEAPONS, weaponById } from '../src/content/weapons';

function arena(seed: number, op = 'operator'): { s: SimState; ev: SimEvent[] } {
  const ev: SimEvent[] = [];
  const s = startRun(seed, ev, op);
  s.waveLeft = 999; s.spawnAcc = -1e9; s.burstsDone = 99; s.spawns.length = 0; s.god = true;
  return { s, ev };
}
const give = (s: SimState, id: string, tier = 1): void => {
  s.p.weapons.push({ uid: s.nextId++, id, tier, cd: 0, aim: 0, flash: 0, x: s.p.x, y: s.p.y });
  refreshStats(s.p);
};

describe('оружие этапа 4: каждое наносит урон', () => {
  for (const w of WEAPONS) {
    it(w.id, () => {
      const { s, ev } = arena(1);
      s.p.weapons = [];
      give(s, w.id);
      // цель рядом (для пилы — на орбите дисков)
      const dist = w.kind === 'orbit' ? 62 : Math.min(120, w.range * 0.6);
      const e = spawnEnemyNow(s, 'tank', s.p.x + dist, s.p.y, null);
      e.hp = e.maxHp = 1e6;
      e.speed = 0;
      for (let i = 0; i < 60 * 8; i++) step(s, emptyInput(), DT, ev);
      expect(s.stats.damageByWeapon[w.id] ?? 0, w.id).toBeGreaterThan(0);
    });
  }
});

describe('операторы', () => {
  it('Сварщик: в магазине только оружие ближнего боя, бонус по танкам', () => {
    const { s } = arena(2, 'welder');
    s.wave = 5;
    for (let i = 0; i < 100; i++) {
      openShop(s);
      for (const o of s.shop.offers) if (o!.kind === 'weapon') expect(weaponById(o!.id).tags).toContain('melee');
    }
    expect(s.p.weapons[0]!.id).toBe('blade');
  });
  it('Связист: без команды оружие молчит, с командой — урон ×2', () => {
    const { s, ev } = arena(3, 'signal');
    const e = spawnEnemyNow(s, 'tank', s.p.x + 150, s.p.y, null);
    e.hp = e.maxHp = 1e6; e.speed = 0;
    for (let i = 0; i < 120; i++) step(s, emptyInput(), DT, ev);
    expect(s.stats.damageByWeapon.pulse ?? 0).toBe(0);
    for (let i = 0; i < 120; i++) step(s, { ...emptyInput(), fireAuto: true }, DT, ev);
    expect(s.stats.damageByWeapon.pulse).toBeGreaterThan(0);
  });
  it('Мародёр: +50% скрапа, −25% HP', () => {
    const { s, ev } = arena(4, 'marauder');
    expect(s.p.stats.maxHp).toBe(75);
    gainScrap(s, 10, ev);
    expect(s.scrap).toBe(15);
  });
  it('Призрак: броня не действует, 2 заряда рывка', () => {
    const { s, ev } = arena(5, 'ghost');
    s.god = false;
    s.p.mods.push({ stat: 'armor', flat: 50, source: { kind: 'dev', id: 'x' } });
    s.p.mods.push({ stat: 'dodge', flat: -100, source: { kind: 'dev', id: 'x' } });
    refreshStats(s.p);
    s.p.inv = 0;
    const hp = s.p.hp;
    hurtPlayer(s, 20, 'drone', ev);
    expect(hp - s.p.hp).toBe(20);
    expect(s.p.dashMaxCharges).toBe(2);
    step(s, { ...emptyInput(), dash: true }, DT, ev);
    s.p.dashTime = 0;
    step(s, { ...emptyInput(), dash: true }, DT, ev);
    expect(s.p.dashCharges).toBe(0);
  });
});

describe('синергии тегов', () => {
  it('3 энергетических предмета дают +12% энергоурона с источником «тег»', () => {
    const { s } = arena(6);
    expect(s.p.stats.energyDmg).toBe(0);
    give(s, 'rail');
    give(s, 'laser');
    expect(s.p.tags.energy).toBe(3);
    expect(s.p.stats.energyDmg).toBe(12);
    expect(s.p.mods.some((m) => m.source.kind === 'tag' && m.source.id === 'energy:3')).toBe(true);
  });
  it('пороги складываются (6 → оба бонуса), модули тоже считаются', () => {
    const { s } = arena(7);
    give(s, 'rail'); give(s, 'laser'); give(s, 'arc');
    addModule(s.p, 'charger'); addModule(s.p, 'charger');
    expect(s.p.tags.energy).toBe(6);
    expect(s.p.stats.crit).toBe(5 + 8);
    expect(s.p.fx.critArc.targets).toBe(1);
  });
  it('снятие предмета убирает бонус', () => {
    const { s } = arena(8);
    give(s, 'rail'); give(s, 'laser');
    s.p.weapons.pop();
    refreshStats(s.p);
    expect(s.p.stats.energyDmg).toBe(0);
  });
});

describe('боссы', () => {
  it('Страж телеграфирует атаку до выстрела', () => {
    const { s, ev } = arena(9);
    s.p.weapons = [];
    const b = spawnEnemyNow(s, 'boss', s.p.x, s.p.y - 300, null);
    let sawTele = false;
    let bulletsBeforeTele = 0;
    for (let i = 0; i < 60 * 4; i++) {
      step(s, emptyInput(), DT, ev);
      if (b.tele) sawTele = true;
      if (!sawTele) bulletsBeforeTele = s.bullets.filter((x) => !x.friendly).length;
    }
    expect(sawTele).toBe(true);
    expect(bulletsBeforeTele).toBe(0);
  });
  it('Сердце: фазы по HP, в 3-й фазе есть удар по площади', () => {
    const { s, ev } = arena(10);
    s.p.weapons = [];
    s.wave = 20;
    const h = spawnEnemyNow(s, 'heart', s.p.x, s.p.y - 320, null);
    expect(heartPhase(h)).toBe(1);
    h.hp = h.maxHp * 0.5;
    expect(heartPhase(h)).toBe(2);
    h.hp = h.maxHp * 0.2;
    expect(heartPhase(h)).toBe(3);
    const kinds = new Set<string>();
    for (let i = 0; i < 60 * 20; i++) { step(s, emptyInput(), DT, ev); if (h.tele) kinds.add(h.tele.kind); }
    expect(kinds.has('circle')).toBe(true);
    expect(kinds.has('lines')).toBe(true);
  });
});

describe('регресс: босс не застревает за стеной', () => {
  it('Сердце за верхней стеной выходит к оператору', () => {
    const { s, ev } = arena(31);
    s.p.weapons = [];
    s.wave = 20;
    const h = spawnEnemyNow(s, 'heart', 1015, 152, null); // точка, где застревало в баланс-прогоне
    s.p.x = 630; s.p.y = 624;
    for (let i = 0; i < 60 * 15; i++) { s.p.x = 630; s.p.y = 624; step(s, emptyInput(), DT, ev); }
    expect(Math.hypot(h.x - 630, h.y - 624)).toBeLessThan(450);
  });
});

describe('регресс: аура регенерации не лечит босса', () => {
  it('Страж рядом с элитой-регеном не восстанавливает HP', () => {
    const { s, ev } = arena(41);
    s.p.weapons = [];
    const b = spawnEnemyNow(s, 'boss', s.p.x, s.p.y - 400, null);
    spawnEnemyNow(s, 'drone', b.x + 30, b.y, 'regen');
    b.hp = b.maxHp * 0.5;
    for (let i = 0; i < 120; i++) step(s, emptyInput(), DT, ev);
    expect(b.hp).toBeLessThanOrEqual(b.maxHp * 0.5);
  });
});
