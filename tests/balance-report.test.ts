/**
 * Баланс-прогон: бот проходит забег настоящим симом, отчёт пишется в docs/balance-report.md.
 * Запуск: npm run balance (долго — минуты). В обычном npm test пропускается.
 */
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { DT } from '../src/core/loop';
import { startRun, step } from '../src/sim/step';
import type { SimEvent } from '../src/sim/events';
import { botInput, botLevel, botMelee, botShop } from '../src/sim/bot';
import { maxHpOf, refreshStats, type SimState } from '../src/sim/state';
import { WEAPONS } from '../src/content/weapons';
import { weaponDps } from '../src/ui/shop';
import { enemyDmgMult, enemyHpMult, spawnRate, waveTime } from '../src/content/balance';
import { modulePrice, weaponPrice, currentReroll } from '../src/sim/shop';

interface WaveRow { wave: number; reqDps: number; botDps: number; hpEnd: number; maxHp: number; taken: number; kills: number; scrap: number; level: number; weapons: string; healKit: number; healOther: number; alive: number; }
interface RunResult { seed: number; operator: string; reached: number; won: boolean; rows: WaveRow[]; killedBy: string; }

const healKit = (s: SimState): number => s.stats.healBy?.kit ?? 0;
const healOther = (s: SimState): number => Object.entries(s.stats.healBy ?? {}).reduce((a, [k, v]) => a + (k === 'kit' ? 0 : v ?? 0), 0);

/** Реальный DPS оружия в бою: 4 копии тира II, бот своего стиля, 25 с волны, бессмертный оператор. */
function weaponProbe(id: string, wave: number, seeds: readonly number[], hpMul = 1): { dps: number; taken: number } {
  let dmg = 0;
  let taken = 0;
  for (const seed of seeds) {
    const ev: SimEvent[] = [];
    const s = startRun(seed, ev);
    s.wave = wave;
    s.waveLeft = 30;
    s.p.weapons = [0, 1, 2, 3].map((i) => ({ uid: 50 + i, id, tier: 2, cd: 0, aim: 0, flash: 0, x: s.p.x, y: s.p.y }));
    refreshStats(s.p);
    s.p.stats.maxHp = 1e6; s.p.hp = 1e6;
    // hpMul > 1 — «толпа»: враги не успевают умирать, видно масштабирование по площади
    let seen = 0;
    for (let t = 0; t < 60 * 25 && s.phase === 'play'; t++) {
      for (const e of s.enemies) if (e.id > seen) { e.hp *= hpMul; e.maxHp *= hpMul; seen = Math.max(seen, e.id); }
      step(s, botInput(s), DT, ev);
      ev.length = 0;
    }
    dmg += s.stats.damageByWeapon[id] ?? 0;
    taken += s.stats.damageTaken;
  }
  return { dps: dmg / (25 * seeds.length), taken: taken / seeds.length };
}

function runBot(seed: number, operator: string, maxWave = 20): RunResult {
  const ev: SimEvent[] = [];
  const s: SimState = startRun(seed, ev, operator);
  const rows: WaveRow[] = [];
  let seen = 0;
  let spawnedHp = 0;
  let takenAt = 0;
  let killsAt = 0;
  let healKitAt = 0;
  let healOtherAt = 0;
  let peakAlive = 0;
  let wave = s.wave;
  let guard = 0;
  while (guard++ < 60 * 60 * 30) {
    if (s.phase === 'play') {
      for (const e of s.enemies) if (e.id > seen) { spawnedHp += e.maxHp; seen = Math.max(seen, e.id); }
      step(s, botInput(s), DT, ev);
      peakAlive = Math.max(peakAlive, s.enemies.length);
    }
    if (s.wave !== wave || s.phase !== 'play') {
      if (s.phase === 'levelup' || s.phase === 'shop' || s.phase === 'victory' || s.phase === 'over') {
        if (rows.length < wave) {
          rows.push({
            wave, reqDps: spawnedHp / waveTime(wave), botDps: s.p.weapons.reduce((a, w) => a + weaponDps(s, w.id, w.tier), 0),
            hpEnd: Math.max(0, s.p.hp), maxHp: maxHpOf(s.p), taken: s.stats.damageTaken - takenAt, kills: s.stats.kills - killsAt,
            scrap: s.scrap, level: s.level, weapons: s.p.weapons.map((w) => `${w.id}${w.tier}`).join(' '),
            healKit: healKit(s) - healKitAt, healOther: healOther(s) - healOtherAt, alive: peakAlive,
          });
          spawnedHp = 0; takenAt = s.stats.damageTaken; killsAt = s.stats.kills;
          healKitAt = healKit(s); healOtherAt = healOther(s); peakAlive = 0;
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
    const welder = [1, 2, 3].map((sd) => runBot(sd, 'welder'));
    const lines: string[] = [];
    lines.push('# Баланс-отчёт', '', '> Сгенерировано `npm run balance` (бот `src/sim/bot.ts`, настоящий сим). Бот слабее живого игрока — это нижняя граница проходимости.', '');
    lines.push('## Кривые (формулы `src/content/balance.ts`)', '', '| Волна | Таймер, с | Спавн/с | HP врагов × | Урон врагов × | Оружие I / II / III / IV | Модуль ст./ул./пр./ан. | Реролл |', '|---|---|---|---|---|---|---|---|');
    for (let w = 1; w <= 20; w++) {
      lines.push(`| ${w} | ${waveTime(w)} | ${spawnRate(w).toFixed(2)} | ${enemyHpMult(w).toFixed(2)} | ${enemyDmgMult(w).toFixed(2)} | ${[1, 2, 3, 4].map((t) => weaponPrice(t, w)).join(' / ')} | ${[0, 1, 2, 3].map((r) => modulePrice(r, w)).join(' / ')} | ${currentReroll({ wave: w, shop: { rerolls: 0, offers: [] } } as unknown as SimState)} |`);
    }
    lines.push('', '## Прогоны бота', '', '| Сид | Дошёл до волны | Победа | Причина смерти |', '|---|---|---|---|');
    for (const r of runs) lines.push(`| ${r.seed} | ${r.reached} | ${r.won ? 'да' : 'нет'} | ${r.killedBy || '—'} |`);
    lines.push('', '### Сварщик (только ближний бой, бот в стиле «ближний»)', '', '| Сид | Дошёл до волны | Победа | Причина смерти |', '|---|---|---|---|');
    for (const r of welder) lines.push(`| ${r.seed} | ${r.reached} | ${r.won ? 'да' : 'нет'} | ${r.killedBy || '—'} |`);
    lines.push('', '## Медианы по волнам', '', '| Волна | Требуемый DPS | DPS бота | HP в конце / макс | Получено урона | Лечение: аптечки / прочее | Пик живых | Убийств | Скрап после | Уровень | n |', '|---|---|---|---|---|---|---|---|---|---|---|');
    for (let w = 1; w <= 20; w++) {
      const rs = runs.map((r) => r.rows[w - 1]).filter((x): x is WaveRow => !!x);
      if (!rs.length) break;
      lines.push(`| ${w} | ${Math.round(median(rs.map((x) => x.reqDps)))} | ${Math.round(median(rs.map((x) => x.botDps)))} | ${Math.round(median(rs.map((x) => x.hpEnd)))} / ${Math.round(median(rs.map((x) => x.maxHp)))} | ${Math.round(median(rs.map((x) => x.taken)))} | ${Math.round(median(rs.map((x) => x.healKit)))} / ${Math.round(median(rs.map((x) => x.healOther)))} | ${Math.round(median(rs.map((x) => x.alive)))} | ${Math.round(median(rs.map((x) => x.kills)))} | ${Math.round(median(rs.map((x) => x.scrap)))} | ${median(rs.map((x) => x.level))} | ${rs.length} |`);
    }
    lines.push('', '## Реальный DPS оружия', '', '4 копии тира II, бот своего стиля (ближнее оружие — подходит вплотную), волна 12, 25 с, 3 сида, бессмертный оператор. Два замера: обычные враги (сильное оружие упирается в поток спавна) и «толпа» — враги ×4 HP (видно масштабирование по площади). Оценка — среднее геометрическое долей от медианы, коридор 0.7–1.4.', '', '| Оружие | Класс | Стиль бота | DPS обычн. | DPS толпа | Получено урона (толпа) | Оценка |', '|---|---|---|---|---|---|---|');
    const probe = WEAPONS.map((d) => {
      const tmp = startRun(1, []);
      tmp.p.weapons = [{ uid: 1, id: d.id, tier: 2, cd: 0, aim: 0, flash: 0, x: 0, y: 0 }];
      const crowd = weaponProbe(d.id, 12, [1, 2, 3], 4);
      return { d, style: botMelee(tmp) ? 'ближний' : 'дальний', norm: weaponProbe(d.id, 12, [1, 2, 3]).dps, crowd: crowd.dps, taken: crowd.taken };
    });
    const mN = median(probe.map((x) => x.norm));
    const mC = median(probe.map((x) => x.crowd));
    for (const x of probe) {
      const k = Math.sqrt((x.norm / mN) * (x.crowd / mC));
      lines.push(`| ${x.d.id} | ${x.d.dmgClass} | ${x.style} | ${Math.round(x.norm)} | ${Math.round(x.crowd)} | ${Math.round(x.taken)} | ${k.toFixed(2)}${k < 0.7 || k > 1.4 ? ' ⚠' : ''} |`);
    }
    lines.push('', '## Пример сборки по волнам (сид 1)', '');
    for (const row of runs[0]!.rows) lines.push(`- w${row.wave}: ${row.weapons}`);
    writeFileSync('docs/balance-report.md', lines.join('\n') + '\n');
    console.log(runs.map((r) => `seed ${r.seed}: wave ${r.reached} ${r.won ? 'WIN' : r.killedBy}`).join('\n'));
    expect(runs.length).toBe(6);
  }, 1_800_000);
});

describe.skipIf(!process.env.WEAPON_PROBE)('реальный DPS оружия (быстрый замер)', () => {
  it('таблица', () => {
    const rows = WEAPONS.map((d) => ({ id: d.id, n: weaponProbe(d.id, 12, [1, 2, 3]).dps, c: weaponProbe(d.id, 12, [1, 2, 3], 4) }));
    const mN = median(rows.map((x) => x.n));
    const mC = median(rows.map((x) => x.c.dps));
    console.log(rows.map((x) => `${x.id.padEnd(8)} norm=${Math.round(x.n)} crowd=${Math.round(x.c.dps)} taken=${Math.round(x.c.taken)} k=${Math.sqrt((x.n / mN) * (x.c.dps / mC)).toFixed(2)}`).join('\n'));
  }, 600_000);
});
