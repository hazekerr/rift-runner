/** Замер шага сима на стресс-сцене. Запуск: npm run perf. В обычном npm test пропускается. */
import { describe, expect, it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import { emptyInput } from '../src/sim/input';
import { spawnEnemyNow } from '../src/sim/combat';
import type { SimEvent } from '../src/sim/events';
import { refreshStats } from '../src/sim/state';

describe.skipIf(!process.env.PERF)('производительность сима', () => {
  it('300 врагов + 1000 пуль + 6 оружий', () => {
    const ev: SimEvent[] = [];
    const s = startRun(1, ev);
    s.god = true; s.waveLeft = 1e9; s.spawnAcc = -1e9; s.burstsDone = 99; s.wave = 12;
    for (const id of ['nailer', 'laser', 'arc', 'rocket', 'saw']) s.p.weapons.push({ uid: s.nextId++, id, tier: 2, cd: 0, aim: 0, flash: 0, x: 0, y: 0 });
    refreshStats(s.p);
    for (let i = 0; i < 300; i++) { const e = spawnEnemyNow(s, i % 3 ? 'drone' : 'gunner', 60 + (i * 37) % 1780, 60 + ((i * 53) % 1130), null); e.hp = e.maxHp = 1e9; }
    const keepBullets = (): void => {
      while (s.bullets.length < 1000) {
        const a = Math.random() * Math.PI * 2;
        s.bullets.push({ x: 950, y: 625, px: 950, py: 625, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 2, damage: 1, crit: false, color: '#fff', friendly: s.bullets.length % 5 < 3, r: 3, pierce: 1, hit: [], weapon: 'perf', source: 'gunner', explodeR: 0, burnChance: 0, slowPct: 0 });
      }
    };
    for (let i = 0; i < 60; i++) { keepBullets(); step(s, emptyInput(), DT, ev); ev.length = 0; } // прогрев JIT
    const N = 600;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) { keepBullets(); step(s, { ...emptyInput(), moveX: Math.cos(i / 40), moveY: Math.sin(i / 40) }, DT, ev); ev.length = 0; }
    const ms = (performance.now() - t0) / N;
    appendFileSync(process.env.PERF_OUT ?? 'perf-results.txt', `${new Date().toISOString()} sim ${ms.toFixed(3)} ms/tick · enemies ${s.enemies.length} · bullets ${s.bullets.length}\n`);
    expect(ms).toBeGreaterThan(0);
  }, 120000);
});
