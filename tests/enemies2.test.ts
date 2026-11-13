import { describe, expect, it } from 'vitest';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import { emptyInput } from '../src/sim/input';
import type { SimEvent } from '../src/sim/events';
import { damageEnemy, killEnemy, spawnEnemyNow } from '../src/sim/combat';
import { BOMBER, LEAP, SNIPE, isBoss } from '../src/content/enemies';
import type { SimState } from '../src/sim/state';

function arena(seed: number): { s: SimState; ev: SimEvent[] } {
  const ev: SimEvent[] = [];
  const s = startRun(seed, ev);
  s.p.weapons = [];
  s.enemies.length = 0;
  s.spawnAcc = -1e9;
  s.burstsDone = 99;
  s.waveLeft = 1e6;
  s.p.inv = 0;
  return { s, ev };
}
const run = (s: SimState, ev: SimEvent[], sec: number): void => { for (let i = 0; i < 60 * sec; i++) step(s, emptyInput(), DT, ev); };

describe('враги 2.0', () => {
  it('камикадзе: запал BOMBER.fuse, затем взрыв и смерть без скрапа', () => {
    const { s, ev } = arena(1);
    const e = spawnEnemyNow(s, 'bomber', s.p.x + 60, s.p.y, null);
    const hp0 = s.p.hp;
    step(s, emptyInput(), DT, ev);
    expect(e.ai).toBe(1);
    run(s, ev, BOMBER.fuse + 0.1);
    expect(e.dead || !s.enemies.includes(e)).toBe(true);
    expect(s.p.hp).toBeLessThan(hp0);
    expect(s.scraps.length).toBe(0);
  });
  it('щитоносец гасит пули спереди и пропускает сзади', () => {
    const shoot = (fromFront: boolean): number => {
      const { s, ev } = arena(2);
      const e = spawnEnemyNow(s, 'shieldbearer', s.p.x + 300, s.p.y, null);
      e.hp = e.maxHp = 1e6;
      e.speed = 0;
      e.a = Math.PI; // смотрит на оператора (он слева)
      const bx = fromFront ? e.x - 10 : e.x + 10;
      const v = fromFront ? 900 : -900;
      s.bullets.push({ x: bx, y: e.y, px: bx - Math.sign(v) * 30, py: e.y, vx: v, vy: 0, life: 1, damage: 100, crit: false, color: '#fff', friendly: true, r: 3, pierce: 1, hit: [], weapon: 'pulse', source: '', explodeR: 0, burnChance: 0, slowPct: 0 });
      step(s, emptyInput(), DT, ev);
      return 1e6 - e.hp;
    };
    expect(shoot(true)).toBeCloseTo(15, 0);
    expect(shoot(false)).toBeCloseTo(100, 0);
  });
  it('броненосец: пули 45%, ближний бой и взрывы 100%', () => {
    const { s, ev } = arena(3);
    const e = spawnEnemyNow(s, 'armadillo', s.p.x + 300, s.p.y, null);
    e.hp = e.maxHp = 1e6;
    damageEnemy(s, e, 100, false, 'pulse', ev, false);
    expect(1e6 - e.hp).toBeCloseTo(45);
    damageEnemy(s, e, 100, false, 'blade', ev, false);
    damageEnemy(s, e, 100, false, 'rocket', ev, false);
    expect(1e6 - e.hp).toBeCloseTo(245);
  });
  it('магнитчик крадёт скрап и при смерти отдаёт ×1.5', () => {
    const { s, ev } = arena(4);
    s.p.stats.magnet = 0;
    const e = spawnEnemyNow(s, 'thief', s.p.x + 400, s.p.y + 200, null);
    s.scraps.push({ x: e.x + 40, y: e.y, px: e.x + 40, py: e.y, vx: 0, vy: 0, v: 10, pulled: false });
    run(s, ev, 1);
    expect(e.loot).toBe(10);
    killEnemy(s, e, ev);
    expect(s.scraps.reduce((a, x) => a + x.v, 0)).toBeGreaterThanOrEqual(15);
  });
  it('прыгун приземляется в отмеченную точку', () => {
    const { s, ev } = arena(5);
    const e = spawnEnemyNow(s, 'leaper', s.p.x + 250, s.p.y, null);
    e.shot = 0;
    step(s, emptyInput(), DT, ev);
    expect(e.ai).toBe(1);
    const tx = e.vx;
    const ty = e.vy;
    run(s, ev, LEAP.windup + LEAP.time);
    expect(Math.hypot(e.x - tx, e.y - ty)).toBeLessThan(25);
  });
  it('снайпер стреляет туда, где прицел зафиксирован', () => {
    const { s, ev } = arena(6);
    const e = spawnEnemyNow(s, 'sniper', s.p.x + 500, s.p.y, null);
    e.shot = 0;
    e.speed = 0;
    let locked = NaN;
    for (let i = 0; i < 60 * (SNIPE.aim + 0.3); i++) {
      if (e.ai === 1 && e.aiT <= SNIPE.lock && Number.isNaN(locked)) locked = e.vx;
      s.p.y += 1; // оператор уходит в сторону
      const before = s.bullets.length;
      step(s, emptyInput(), DT, ev);
      const b = s.bullets.slice(before).find((x) => !x.friendly);
      if (b) { expect(Math.atan2(b.vy, b.vx)).toBeCloseTo(locked, 5); return; }
    }
    throw new Error('снайпер не выстрелил');
  });
  it('мини-босс выходит на 5-й волне и считается боссом', () => {
    const { s, ev } = arena(7);
    s.wave = 5;
    s.waveDuration = 28;
    s.waveLeft = 28 * 0.69;
    s.spawnAcc = 0;
    s.miniDone = false;
    run(s, ev, 1.6);
    const mb = s.enemies.find((x) => x.type === 'crusher');
    expect(mb).toBeDefined();
    expect(isBoss('crusher')).toBe(true);
  });
});
