import { describe, expect, it } from 'vitest';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import { emptyInput } from '../src/sim/input';
import type { SimEvent } from '../src/sim/events';
import { rollWeaponDamage, spawnEnemyNow } from '../src/sim/combat';
import { weaponById } from '../src/content/weapons';
import { refreshStats, type SimState } from '../src/sim/state';

function arena(seed: number, weapon: string): { s: SimState; ev: SimEvent[] } {
  const ev: SimEvent[] = [];
  const s = startRun(seed, ev);
  s.enemies.length = 0;
  s.spawnAcc = -1e9;
  s.burstsDone = 99;
  s.waveLeft = 1e6;
  s.god = true;
  s.p.weapons = [{ uid: 1, id: weapon, tier: 1, cd: 0, aim: 0, flash: 0, x: s.p.x, y: s.p.y }];
  refreshStats(s.p);
  return { s, ev };
}
const tick = (s: SimState, ev: SimEvent[], n: number): void => { for (let i = 0; i < n; i++) step(s, emptyInput(), DT, ev); };

describe('оружие 2.0', () => {
  it('диск возвращается и режет ту же цель второй раз', () => {
    const { s, ev } = arena(1, 'disk');
    const e = spawnEnemyNow(s, 'tank', s.p.x + 120, s.p.y, null);
    e.hp = e.maxHp = 1e6; e.speed = 0;
    let hits = 0;
    let last = e.hp;
    s.p.weapons[0]!.cd = 0;
    for (let i = 0; i < 60 * 0.9; i++) {
      step(s, emptyInput(), DT, ev);
      if (e.hp < last) { hits++; last = e.hp; }
      s.p.weapons[0]!.cd = 99; // один бросок
    }
    expect(hits).toBe(2);
  });
  it('гравиган стягивает врагов к точке взрыва', () => {
    const { s, ev } = arena(2, 'gravigun');
    const a = spawnEnemyNow(s, 'tank', s.p.x + 300, s.p.y, null);
    const b = spawnEnemyNow(s, 'drone', s.p.x + 300, s.p.y + 80, null);
    for (const e of [a, b]) { e.hp = e.maxHp = 1e6; e.speed = 0; }
    const d0 = Math.hypot(b.x - a.x, b.y - a.y);
    tick(s, ev, 40);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(d0 - 20);
  });
  it('щиты сбивают вражеские пули', () => {
    const { s, ev } = arena(3, 'bulwark');
    const def = weaponById('bulwark');
    let blocked = 0;
    for (let i = 0; i < 120; i++) {
      // пуля летит в оператора с разных сторон
      const ang = i * 0.37;
      const x = s.p.x + Math.cos(ang) * (def.orbitR! + 40);
      const y = s.p.y + Math.sin(ang) * (def.orbitR! + 40);
      s.bullets.push({ x, y, px: x, py: y, vx: -Math.cos(ang) * 300, vy: -Math.sin(ang) * 300, life: 2, damage: 1, crit: false, color: '#f00', friendly: false, r: 6, pierce: 0, hit: [], weapon: '', source: 'gunner', explodeR: 0, burnChance: 0, slowPct: 0 });
      const n = s.bullets.length;
      tick(s, ev, 8);
      if (s.bullets.filter((q) => !q.friendly).length < n) blocked++;
      s.bullets.length = 0;
    }
    expect(blocked).toBeGreaterThan(20);
  });
  it('миниган раскручивается: темп растёт при непрерывной стрельбе', () => {
    const { s, ev } = arena(4, 'minigun');
    const e = spawnEnemyNow(s, 'tank', s.p.x + 200, s.p.y, null);
    e.hp = e.maxHp = 1e9; e.speed = 0;
    const shots = (sec: number): number => { const n0 = s.stats.damageByWeapon.minigun ?? 0; tick(s, ev, 60 * sec); return (s.stats.damageByWeapon.minigun ?? 0) - n0; };
    const first = shots(1);
    const later = shots(1);
    expect(later).toBeGreaterThan(first * 1.6);
    expect(s.p.weapons[0]!.heat).toBeCloseTo(1, 1);
  });
  it('снайперка критует ×3, молот оглушает', () => {
    const { s } = arena(5, 'sniper');
    s.p.stats.crit = 100;
    const r = rollWeaponDamage(s, weaponById('sniper'), s.p.weapons[0]!);
    expect(r.crit).toBe(true);
    expect(r.dmg).toBeGreaterThan(weaponById('sniper').damage * 2.9);
    const h = arena(6, 'hammer');
    const e = spawnEnemyNow(h.s, 'tank', h.s.p.x + 40, h.s.p.y, null);
    e.hp = e.maxHp = 1e6;
    tick(h.s, h.ev, 3);
    expect(e.slowPct).toBe(100);
  });
});
