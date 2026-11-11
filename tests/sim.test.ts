import { describe, expect, it } from 'vitest';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import { emptyInput } from '../src/sim/input';
import type { SimEvent } from '../src/sim/events';
import type { SimState } from '../src/sim/state';
import { chooseLevel, chooseSupply, endWave, gainScrap } from '../src/sim/waves';
import { damageEnemy, spawnEnemyNow } from '../src/sim/combat';
import { waveTime } from '../src/content/balance';

/** Бот: кружит, делает рывки и волну; между волнами берёт первое предложение. */
function run(seed: number, ticks: number): { s: SimState; events: SimEvent[] } {
  const events: SimEvent[] = [];
  const s = startRun(seed, events);
  for (let i = 0; i < ticks; i++) {
    const inp = emptyInput();
    inp.moveX = Math.cos(i / 90);
    inp.moveY = Math.sin(i / 90);
    inp.dash = i % 200 === 0;
    inp.pulse = i % 600 === 0;
    step(s, inp, DT, events);
    if (s.phase === 'levelup') chooseLevel(s, 0, events);
    if (s.phase === 'supply') chooseSupply(s, s.supplyOffer[0]!, events);
    if (s.phase === 'over' || s.phase === 'victory') break;
    if (events.length > 5000) events.length = 0;
  }
  return { s, events };
}

describe('sim: детерминизм и сохранение', () => {
  it('одинаковые сид и ввод → одинаковое состояние', () => {
    expect(JSON.stringify(run(1234, 3600).s)).toBe(JSON.stringify(run(1234, 3600).s));
  });
  it('разные сиды дают разные забеги', () => {
    expect(JSON.stringify(run(1, 1200).s)).not.toBe(JSON.stringify(run(2, 1200).s));
  });
  it('продолжение из JSON-снимка совпадает с исходным', () => {
    const { s } = run(77, 900);
    const copy: SimState = JSON.parse(JSON.stringify(s));
    const ev: SimEvent[] = [];
    const inp = { ...emptyInput(), moveX: 1 };
    for (let i = 0; i < 600; i++) { step(s, inp, DT, ev); step(copy, inp, DT, ev); }
    expect(JSON.stringify(copy)).toBe(JSON.stringify(s));
  });
});

describe('sim: волны по таймеру', () => {
  it('волна 1 длится waveTime(1) секунд и заканчивается сама', () => {
    const ev: SimEvent[] = [];
    const s = startRun(5, ev);
    s.god = true;
    expect(s.waveLeft).toBe(waveTime(1));
    let ticks = 0;
    while (s.phase === 'play' && ticks < 60 * 40) { step(s, emptyInput(), DT, ev); ticks++; }
    expect(Math.abs(ticks / 60 - waveTime(1))).toBeLessThan(0.1);
    expect(s.enemies.length).toBe(0);
    expect(['levelup', 'supply']).toContain(s.phase);
  });
  it('стартовое оружие стреляет само и убивает врагов', () => {
    const { s } = run(9, 60 * 20);
    expect(s.stats.kills).toBeGreaterThan(5);
    expect(s.stats.damageByWeapon.pulse).toBeGreaterThan(0);
  });
  it('волна 10: Страж уходит в разлом, если не убит к концу таймера', () => {
    const ev: SimEvent[] = [];
    const s = startRun(3, ev);
    s.wave = 9;
    endWave(s, ev);
    while (s.phase !== 'play') {
      if (s.phase === 'levelup') chooseLevel(s, 0, ev);
      if (s.phase === 'supply') chooseSupply(s, null, ev);
    }
    expect(s.wave).toBe(10);
    s.god = true;
    let ticks = 0;
    while (s.phase === 'play' && ticks < 60 * 60) { step(s, emptyInput(), DT, ev); ticks++; }
    expect(s.wave).toBe(10);
    expect(s.phase).not.toBe('play');
    expect(ev.some((e) => e.t === 'toast' && e.key === 'toast.bossLeft')).toBe(true);
  });
  it('волна 20: овертайм, пока босс жив; победа после его смерти', () => {
    const ev: SimEvent[] = [];
    const s = startRun(4, ev);
    s.wave = 19;
    s.phase = 'play';
    s.p.weapons = [];
    endWave(s, ev);
    for (let k = 0; k < 50 && (s.phase as string) !== 'play'; k++) {
      if ((s.phase as string) === 'levelup') chooseLevel(s, 0, ev);
      else chooseSupply(s, null, ev);
    }
    expect(s.wave).toBe(20);
    s.god = true;
    for (let i = 0; i < 61 * 60; i++) step(s, emptyInput(), DT, ev);
    expect(s.overtime).toBe(true);
    expect(s.phase).toBe('play');
    const boss = s.enemies.find((e) => e.type === 'boss')!;
    damageEnemy(s, boss, boss.hp * 10, false, 'test', ev); // ×10: рядом может быть элита с аурой щита
    for (let i = 0; i < 5 && s.phase === 'play'; i++) step(s, emptyInput(), DT, ev);
    expect(s.phase).toBe('victory');
  });
});

describe('sim: скрап, запас разлома, уровни', () => {
  it('неподобранный скрап: 50% уходит в запас, запас удваивает подбор', () => {
    const ev: SimEvent[] = [];
    const s = startRun(6, ev);
    s.scraps.push({ x: 100, y: 100, px: 100, py: 100, vx: 0, vy: 0, v: 10, pulled: false });
    endWave(s, ev);
    expect(s.bonusPool).toBe(5);
    const before = s.scrap;
    gainScrap(s, 3, ev);
    expect(s.scrap - before).toBe(6);
    expect(s.bonusPool).toBe(2);
  });
  it('опыт копит уровни, выбор улучшения добавляет модификатор с источником', () => {
    const ev: SimEvent[] = [];
    const s = startRun(8, ev);
    gainScrap(s, 30, ev, false);
    expect(s.level).toBe(3);
    expect(s.pendingLevels).toBe(2);
    endWave(s, ev);
    expect(s.phase).toBe('levelup');
    expect(s.levelOffer).toHaveLength(4);
    const o = s.levelOffer[0]!;
    chooseLevel(s, 0, ev);
    expect(s.p.mods.at(-1)).toMatchObject({ stat: o.stat, flat: o.value, source: { kind: 'level' } });
    expect(s.pendingLevels).toBe(1);
  });
  it('магнит притягивает скрап, подбор даёт скрап и опыт', () => {
    const ev: SimEvent[] = [];
    const s = startRun(10, ev);
    s.scraps.push({ x: s.p.x + 70, y: s.p.y, px: 0, py: 0, vx: 0, vy: 0, v: 2, pulled: false });
    for (let i = 0; i < 30; i++) step(s, emptyInput(), DT, ev);
    expect(s.scrap).toBeGreaterThanOrEqual(2);
    expect(s.xp + (s.level - 1) * 8).toBeGreaterThanOrEqual(2);
  });
});

describe('sim: враги', () => {
  it('сплиттер раскалывается на 2 осколка', () => {
    const ev: SimEvent[] = [];
    const s = startRun(12, ev);
    s.p.weapons = [];
    const e = spawnEnemyNow(s, 'splitter', 400, 400, null);
    e.hp = 0.5;
    s.p.weapons = [{ uid: 9, id: 'rail', tier: 1, cd: 0, aim: 0, flash: 0, x: 0, y: 0 }];
    s.p.x = 400; s.p.y = 560;
    for (let i = 0; i < 30; i++) step(s, emptyInput(), DT, ev);
    expect(s.enemies.filter((x) => x.type === 'shard').length + s.stats.kills).toBeGreaterThanOrEqual(2);
  });
  it('регресс: враг за стеной на одной линии с игроком не застревает', () => {
    const ev: SimEvent[] = [];
    const s = startRun(11, ev);
    s.waveLeft = 999;
    s.spawnAcc = -9999;
    s.burstsDone = 99;
    s.p.weapons = [];
    s.god = true;
    spawnEnemyNow(s, 'drone', 950, 167, null);
    for (let i = 0; i < 60 * 8; i++) step(s, emptyInput(), DT, ev);
    const e = s.enemies.find((x) => x.type === 'drone')!;
    expect(Math.hypot(e.x - s.p.x, e.y - s.p.y)).toBeLessThan(60);
  });
});
