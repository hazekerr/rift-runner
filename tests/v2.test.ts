import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../src/sim/events';
import { startRun } from '../src/sim/step';
import { killEnemy, spawnEnemyNow } from '../src/sim/combat';
import { KIT, kitCap } from '../src/content/balance';

// План 2.0, этап 3: в 1.1 аптечки покрывали ~75–100% полученного урона.
describe('аптечки', () => {
  it('с врагов за волну выпадает не больше kitCap, даже при огромной удаче и элитах', () => {
    for (const w of [3, 12]) {
      const ev: SimEvent[] = [];
      const s = startRun(5, ev);
      s.wave = w;
      s.kitsThisWave = 0;
      s.p.stats.luck = 1000;
      for (let i = 0; i < 400; i++) {
        const e = spawnEnemyNow(s, 'drone', 300 + (i % 20) * 30, 300 + Math.floor(i / 20) * 30, i % 3 ? null : 'haste');
        killEnemy(s, e, ev);
      }
      expect(s.pickups.filter((p) => p.type === 'heal').length).toBe(kitCap(w));
    }
  });
  it('аптечка лечит 12% максимального HP', () => {
    expect(KIT.heal).toBe(0.12);
  });
});
