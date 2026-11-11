/**
 * Баланс-прогон: бот проходит забег настоящим симом, отчёт пишется в docs/balance-report.md.
 * Запуск: npm run balance (долго — минуты). В обычном npm test пропускается.
 */
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import type { SimEvent } from '../src/sim/events';
import { botInput, botLevel, botShop } from '../src/sim/bot';
import { maxHpOf, type SimState } from '../src/sim/state';
import { weaponDps } from '../src/ui/shop';
import { enemyDmgMult, enemyHpMult, spawnRate, waveTime } from '../src/content/balance';
import { modulePrice, weaponPrice, currentReroll } from '../src/sim/shop';

interface WaveRow { wave: number; reqDps: number; botDps: number; hpEnd: number; maxHp: number; taken: number; kills: number; scrap: number; level: number; weapons: string; }
interface RunResult { seed: number; operator: string; reached: number; won: boolean; rows: WaveRow[]; killedBy: string; }

function runBot(seed: number, operator: string, maxWave = 20): RunResult {
  const ev: SimEvent[] = [];
  const s: SimState = startRun(seed, ev, operator);
  const rows: WaveRow[] = [];
  let seen = 0;
  let spawnedHp = 0;
  let takenAt = 0;
  let killsAt = 0;
  let wave = s.wave;
  let guard = 0;
  while (guard++ < 60 * 60 * 30) {
    if (s.phase === 'play') {
      for (const e of s.enemies) if (e.id > seen) { spawnedHp += e.maxHp; seen = Math.max(seen, e.id); }
      step(s, botInput(s), DT, ev);
    }
    if (s.wave !== wave || s.phase !== 'play') {
      if (s.phase === 'levelup' || s.phase === 'shop' || s.phase === 'victory' || s.phase === 'over') {
        if (rows.length < wave) {
          rows.push({
            wave, reqDps: spawnedHp / waveTime(wave), botDps: s.p.weapons.reduce((a, w) => a + weaponDps(s, w.id, w.tier), 0),
            hpEnd: Math.max(0, s.p.hp), maxHp: maxHpOf(s.p), taken: s.stats.damageTaken - takenAt, kills: s.stats.kills - killsAt,
            scrap: s.scrap, level: s.level, weapons: s.p.weapons.map((w) => `${w.id}${w.tier}`).join(' '),
          });
          spawnedHp = 0; takenAt = s.stats.damageTaken; killsAt = s.stats.kills;
        }
      }
      if (s.phase === 'over' || s.phase === 'victory') break;
      while (s.phase === 'levelup') botLevel(s, ev);
      if (s.phase === 'shop') {
        if (s.wave >= maxWave) break;
        botShop(s, ev);
      }
      wave = s.wave;
    }
    if (ev.length > 2000) ev.length = 0;
  }
  return { seed, operator, reached: s.wave, won: s.phase === 'victory', rows, killedBy: s.stats.killedBy };
}

const median = (xs: number[]): number => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)]! : 0; };

describe.skipIf(!process.env.BALANCE_REPORT)('баланс-прогон', () => {
  it('бот: 6 сидов, оператор по умолчанию', () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const runs = seeds.map((sd) => runBot(sd, 'operator'));
    const lines: string[] = [];
    lines.push('# Баланс-отчёт', '', '> Сгенерировано `npm run balance` (бот `src/sim/bot.ts`, настоящий сим). Бот слабее живого игрока — это нижняя граница проходимости.', '');
    lines.push('## Кривые (формулы `src/content/balance.ts`)', '', '| Волна | Таймер, с | Спавн/с | HP врагов × | Урон врагов × | Оружие I / II / III / IV | Модуль ст./ул./пр./ан. | Реролл |', '|---|---|---|---|---|---|---|---|');
    for (let w = 1; w <= 20; w++) {
      lines.push(`| ${w} | ${waveTime(w)} | ${spawnRate(w).toFixed(2)} | ${enemyHpMult(w).toFixed(2)} | ${enemyDmgMult(w).toFixed(2)} | ${[1, 2, 3, 4].map((t) => weaponPrice(t, w)).join(' / ')} | ${[0, 1, 2, 3].map((r) => modulePrice(r, w)).join(' / ')} | ${currentReroll({ wave: w, shop: { rerolls: 0, offers: [] } } as unknown as SimState)} |`);
    }
    lines.push('', '## Прогоны бота', '', '| Сид | Дошёл до волны | Победа | Причина смерти |', '|---|---|---|---|');
    for (const r of runs) lines.push(`| ${r.seed} | ${r.reached} | ${r.won ? 'да' : 'нет'} | ${r.killedBy || '—'} |`);
    lines.push('', '## Медианы по волнам', '', '| Волна | Требуемый DPS | DPS бота | HP в конце / макс | Получено урона | Убийств | Скрап после | Уровень | n |', '|---|---|---|---|---|---|---|---|---|');
    for (let w = 1; w <= 20; w++) {
      const rs = runs.map((r) => r.rows[w - 1]).filter((x): x is WaveRow => !!x);
      if (!rs.length) break;
      lines.push(`| ${w} | ${Math.round(median(rs.map((x) => x.reqDps)))} | ${Math.round(median(rs.map((x) => x.botDps)))} | ${Math.round(median(rs.map((x) => x.hpEnd)))} / ${Math.round(median(rs.map((x) => x.maxHp)))} | ${Math.round(median(rs.map((x) => x.taken)))} | ${Math.round(median(rs.map((x) => x.kills)))} | ${Math.round(median(rs.map((x) => x.scrap)))} | ${median(rs.map((x) => x.level))} | ${rs.length} |`);
    }
    lines.push('', '## Пример сборки по волнам (сид 1)', '');
    for (const row of runs[0]!.rows) lines.push(`- w${row.wave}: ${row.weapons}`);
    writeFileSync('docs/balance-report.md', lines.join('\n') + '\n');
    console.log(runs.map((r) => `seed ${r.seed}: wave ${r.reached} ${r.won ? 'WIN' : r.killedBy}`).join('\n'));
    expect(runs.length).toBe(6);
  }, 1_800_000);
});
