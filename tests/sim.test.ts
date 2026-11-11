import { describe, expect, it } from 'vitest';
import { DT } from '../src/core/loop';
import { applyPerk, startRun, step } from '../src/sim/step';
import { emptyInput, type TickInput } from '../src/sim/input';
import type { SimEvent } from '../src/sim/events';
import type { SimState } from '../src/sim/state';

/** Скриптованный «бот»: кружит и стреляет в ближайшего, проходит перки. */
function run(seed: number, ticks: number): { s: SimState; events: SimEvent[] } {
  const events: SimEvent[] = [];
  const s = startRun(seed, events);
  for (let i = 0; i < ticks; i++) {
    const inp: TickInput = { ...emptyInput(), autoAim: true };
    inp.moveX = Math.cos(i / 90);
    inp.moveY = Math.sin(i / 90);
    if (i % 200 === 0) inp.dash = true;
    if (i % 600 === 0) inp.pulse = true;
    step(s, inp, DT, events);
    if (s.phase === 'upgrade') applyPerk(s, s.offer[0]!, events);
    if (s.phase === 'over') break;
  }
  return { s, events };
}

describe('sim', () => {
  it('детерминизм: одинаковые сид и ввод → одинаковое состояние', () => {
    const a = run(1234, 3000).s;
    const b = run(1234, 3000).s;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('разные сиды дают разные забеги', () => {
    expect(JSON.stringify(run(1, 1500).s)).not.toBe(JSON.stringify(run(2, 1500).s));
  });
  it('состояние сериализуемо и продолжение из снимка совпадает', () => {
    const events: SimEvent[] = [];
    const s = startRun(77, events);
    const inp = { ...emptyInput(), autoAim: true, moveX: 1 };
    for (let i = 0; i < 600; i++) step(s, inp, DT, events);
    const copy: SimState = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 600; i++) {
      step(s, inp, DT, events);
      step(copy, inp, DT, events);
    }
    expect(JSON.stringify(copy)).toBe(JSON.stringify(s));
  });
  it('первая волна: 10 целей, бот её зачищает и получает перк', () => {
    const events: SimEvent[] = [];
    const s = startRun(5, events);
    expect(s.wave).toBe(1);
    expect(s.toSpawn).toBe(10);
    const { s: after, events: ev } = run(5, 60 * 60);
    expect(after.wave).toBeGreaterThan(1);
    expect(ev.some((e) => e.t === 'upgrade')).toBe(true);
  });
  it('пятая волна — босс', () => {
    const events: SimEvent[] = [];
    const s = startRun(3, events);
    while (s.wave < 5) { s.phase = 'upgrade'; s.offer = ['overload']; applyPerk(s, 'overload', events); }
    expect(s.spawns.some((x) => x.type === 'boss')).toBe(true);
    expect(s.toSpawn).toBe(Math.round((7 + 5 * 3) * 0.6));
  });
  it('урон от касания уважает i-frames', () => {
    const events: SimEvent[] = [];
    const s = startRun(9, events);
    s.p.inv = 0;
    s.enemies.push({ id: 999, type: 'drone', x: s.p.x + 10, y: s.p.y, px: 0, py: 0, hp: 50, maxHp: 50, r: 17, speed: 0, shot: 9, hit: 0, a: 0, dead: false, phase: 0 });
    step(s, emptyInput(), DT, events);
    expect(s.p.hp).toBe(86);
    step(s, emptyInput(), DT, events);
    expect(s.p.hp).toBe(86);
  });
});

describe('регресс: враг за стеной на одной линии с игроком', () => {
  it('не застревает и доходит до игрока', () => {
    const events: SimEvent[] = [];
    const s = startRun(11, events);
    s.toSpawn = 0;
    s.spawns = [];
    s.p.inv = 999;
    // стена [890,210,120,55], игрок в (950,625) — дрон строго над стеной
    s.enemies.push({ id: 1, type: 'drone', x: 950, y: 167, px: 950, py: 167, hp: 50, maxHp: 50, r: 17, speed: 121, shot: 9, hit: 0, a: 0, dead: false, phase: 0 });
    for (let i = 0; i < 60 * 8; i++) step(s, emptyInput(), DT, events);
    const e = s.enemies[0]!;
    expect(Math.hypot(e.x - s.p.x, e.y - s.p.y)).toBeLessThan(60);
  });
});
