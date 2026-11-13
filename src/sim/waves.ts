import { TAU } from '../core/math';
import { chance, int, nextFloat, range } from '../core/rng';
import {
  BOSS_WAVES, BOSS_WAVE_SPAWN, BURST_AT, HARVEST_GROWTH, MAX_ALIVE, RUN_WAVES, SPAWN_QUIET_TAIL,
  eliteChance, enemyDmgMult, rarityWeights, rerollCost, spawnRate, waveTime, xpToNext,
} from '../content/balance';
import { ARENA_CENTER, WORLD } from '../content/arena';
import { ENEMIES, isBoss, type Aura, type EnemyType } from '../content/enemies';
import { LEVEL_UPS } from '../content/levelups';
import { waveWeights } from '../content/waves';
import { circleRect } from './collide';
import { spawnEnemyNow, sweepScrap } from './combat';
import type { EventSink } from './events';
import { dashCap, healPlayer, maxHpOf, refreshStats, type SimState } from './state';
import { openShop } from './shop';
import { operatorById } from '../content/operators';
import { threatMods } from '../content/threat';

const AURAS: readonly Aura[] = ['haste', 'shield', 'regen'];
export const isBossWave = (w: number): boolean => BOSS_WAVES.includes(w);

// ---------- волна ----------

export function startWave(s: SimState, ev: EventSink): void {
  s.wave++;
  s.waveDuration = waveTime(s.wave);
  s.waveLeft = s.waveDuration;
  s.spawnAcc = 0;
  s.burstsDone = 0;
  s.kitsThisWave = 0;
  s.overtime = false;
  s.levelRerolls = 0;
  s.waveDmgMult = enemyDmgMult(s.wave);
  s.phase = 'play';
  const p = s.p;
  // Каждая волна начинается с полного HP и из центра арены
  refreshStats(p);
  p.hp = Math.max(1, Math.round(p.stats.maxHp));
  p.x = p.px = ARENA_CENTER.x;
  p.y = p.py = ARENA_CENTER.y;
  p.inv = 1.0;
  p.dashCd = 0;
  p.dashCharges = dashCap(p);
  s.traps.length = 0;
  s.turrets.length = 0;
  for (const w of p.weapons) w.cd = 0.3;
  p.shield = p.fx.waveShield;
  p.zapT = p.fx.zaps.map(() => 0.5);
  if (isBossWave(s.wave)) {
    s.spawns.push({ type: s.wave >= RUN_WAVES ? 'heart' : 'boss', x: ARENA_CENTER.x, y: 110, t: 1.5, elite: null });
    ev.push({ t: 'toast', key: s.wave >= RUN_WAVES ? 'toast.final' : 'toast.boss', sub: 'toast.boss.sub', params: { n: s.wave }, duration: 3 });
    ev.push({ t: 'sfx', id: 'bossSpawn' });
  } else {
    ev.push({ t: 'toast', key: 'toast.wave', sub: 'toast.wave.sub2', params: { n: String(s.wave).padStart(2, '0'), s: s.waveDuration }, duration: 2.2 });
    ev.push({ t: 'sfx', id: 'waveStart' });
  }
}

function freeSpot(s: SimState, x: number, y: number, r: number): boolean {
  return !s.obstacles.some((o) => circleRect(x, y, r + 6, o));
}

function edgeSpot(s: SimState): { x: number; y: number } {
  const r = s.rng.spawn;
  for (let tries = 0; tries < 6; tries++) {
    const side = int(r, 4);
    let x = side === 0 ? 55 : side === 1 ? WORLD.w - 55 : range(r, 70, WORLD.w - 70);
    let y = side === 2 ? 55 : side === 3 ? WORLD.h - 55 : range(r, 70, WORLD.h - 70);
    if (Math.hypot(x - s.p.x, y - s.p.y) < 400) {
      x = s.p.x < WORLD.w / 2 ? WORLD.w - 65 : 65;
      y = range(r, 80, WORLD.h - 80);
    }
    if (freeSpot(s, x, y, 30)) return { x, y };
  }
  return { x: 65, y: 65 };
}

function queue(s: SimState, type: EnemyType, x: number, y: number, elite: Aura | null): void {
  s.spawns.push({ type, x, y, t: 0.85, elite });
}

function pickType(s: SimState): { type: EnemyType; pack: number } {
  const ws = waveWeights(s.wave);
  let total = 0;
  for (const w of ws) total += w.weight;
  let roll = nextFloat(s.rng.spawn) * total;
  for (const w of ws) {
    roll -= w.weight;
    if (roll <= 0) return { type: w.row.type, pack: w.row.pack ?? 1 };
  }
  return { type: 'drone', pack: 1 };
}

const alive = (s: SimState): number => s.enemies.length + s.spawns.length;

function spawnOne(s: SimState): void {
  const { type, pack } = pickType(s);
  if (alive(s) + pack > MAX_ALIVE) return;
  const at = edgeSpot(s);
  const th = threatMods(s.threat);
  const eliteP = s.wave >= th.eliteFromWave ? Math.min(0.3, Math.max(eliteChance(s.wave), th.eliteMult > 1 ? 0.03 : 0) * th.eliteMult) : 0;
  const elite = pack === 1 && chance(s.rng.spawn, eliteP) ? AURAS[int(s.rng.spawn, 3)]! : null;
  for (let i = 0; i < pack; i++) {
    const a = (i / pack) * TAU;
    const ox = pack > 1 ? Math.cos(a) * 26 : 0;
    const oy = pack > 1 ? Math.sin(a) * 26 : 0;
    queue(s, type, Math.min(WORLD.w - 40, Math.max(40, at.x + ox)), Math.min(WORLD.h - 40, Math.max(40, at.y + oy)), elite);
  }
}

/** Всплеск: кольцо врагов вокруг оператора. */
function burst(s: SimState): void {
  const n = Math.round(spawnRate(s.wave) * 4);
  const base = range(s.rng.spawn, 0, TAU);
  const type: EnemyType = s.wave >= 3 && chance(s.rng.spawn, 0.5) ? 'swarm' : s.wave >= 2 && chance(s.rng.spawn, 0.4) ? 'runner' : 'drone';
  for (let i = 0; i < n && alive(s) < MAX_ALIVE; i++) {
    const a = base + (i / n) * TAU;
    const x = s.p.x + Math.cos(a) * 470;
    const y = s.p.y + Math.sin(a) * 470;
    if (x < 50 || y < 50 || x > WORLD.w - 50 || y > WORLD.h - 50 || !freeSpot(s, x, y, 20)) continue;
    queue(s, type, x, y, null);
  }
}

export function updateWave(s: SimState, dt: number, ev: EventSink): void {
  const boss = isBossWave(s.wave);
  if (!s.overtime) {
    s.waveLeft -= dt;
    if (s.waveLeft > SPAWN_QUIET_TAIL) {
      s.spawnAcc += spawnRate(s.wave) * (boss ? BOSS_WAVE_SPAWN : 1) * dt;
      while (s.spawnAcc >= 1) { s.spawnAcc -= 1; spawnOne(s); }
      const progress = 1 - s.waveLeft / s.waveDuration;
      if (s.burstsDone < BURST_AT.length && progress >= BURST_AT[s.burstsDone]!) { s.burstsDone++; burst(s); }
    }
  }
  for (let i = s.spawns.length - 1; i >= 0; i--) {
    const sp = s.spawns[i]!;
    sp.t -= dt;
    if (sp.t <= 0) {
      spawnEnemyNow(s, sp.type, sp.x, sp.y, sp.elite);
      s.spawns.splice(i, 1);
    }
  }
  if (s.waveLeft <= 0) {
    const bossAlive = s.enemies.some((e) => isBoss(e.type) && !e.dead) || s.spawns.some((x) => isBoss(x.type));
    if (boss && bossAlive) {
      if (s.wave >= RUN_WAVES) {
        // Решение A: финальный босс — овертайм с яростью до победы или смерти
        if (!s.overtime) {
          s.overtime = true;
          s.waveLeft = 0;
          ev.push({ t: 'toast', key: 'toast.overtime', sub: 'toast.overtime.sub', params: {}, duration: 2.5 });
        }
        return;
      }
      // Страж уходит в разлом без награды
      for (const e of s.enemies) if (e.type === 'boss') { e.dead = true; ev.push({ t: 'ring', x: e.x, y: e.y, color: ENEMIES.boss.color, max: 200, life: 0.6 }); }
      ev.push({ t: 'sfx', id: 'bossLeave' });
      ev.push({ t: 'toast', key: 'toast.bossLeft', sub: 'toast.bossLeft.sub', params: {}, duration: 2.5 });
    }
    endWave(s, ev);
  }
}

export function endWave(s: SimState, ev: EventSink): void {
  for (const e of s.enemies) {
    if (!e.dead) ev.push({ t: 'burst', x: e.x, y: e.y, color: '#3d5560', n: 5, force: 90 });
  }
  s.enemies.length = 0;
  s.spawns.length = 0;
  s.bullets.length = 0;
  s.mines.length = 0;
  s.traps.length = 0;
  s.turrets.length = 0;
  s.pickups.length = 0;
  const saved = sweepScrap(s);
  const harvest = Math.floor(Math.max(0, s.p.stats.harvest) * s.harvestMult);
  if (harvest > 0) gainScrap(s, harvest, ev, false);
  s.harvestMult *= HARVEST_GROWTH;
  ev.push({ t: 'sfx', id: 'waveEnd' });
  ev.push({ t: 'toast', key: 'toast.waveEnd', sub: 'toast.waveEnd.sub', params: { n: saved, h: harvest }, duration: 1.8 });
  if (s.wave >= RUN_WAVES) {
    s.phase = 'victory';
    ev.push({ t: 'sfx', id: 'victory' });
  } else intermission(s);
  ev.push({ t: 'phase' });
}

/** Порядок между волнами: уровни → магазин → (кнопка «В бой») → следующая волна. */
function intermission(s: SimState): void {
  if (s.pendingLevels > 0) {
    s.phase = 'levelup';
    makeLevelOffer(s);
  } else openShop(s);
}

// ---------- скрап и опыт ----------

/** Подобрать скрап: бонус из запаса разлома +1 за единицу, пока он не кончится (решение A). */
export function gainScrap(s: SimState, v: number, ev: EventSink, useBonus = true): void {
  const bonus = useBonus ? Math.min(s.bonusPool, v) : 0;
  s.bonusPool -= bonus;
  const mult = useBonus ? operatorById(s.operator).rule.scrapMult ?? 1 : 1;
  // Мародёр: +50% к подбору; дробная часть накапливается детерминированно
  s.scrapFrac += (v + bonus) * mult;
  const total = Math.floor(s.scrapFrac);
  s.scrapFrac -= total;
  s.scrap += total;
  s.xp += total;
  s.stats.scrapCollected += total;
  const every = s.p.fx.scrapHealEvery;
  if (every > 0 && s.phase === 'play') {
    s.p.scrapHealAcc += total;
    while (s.p.scrapHealAcc >= every) { s.p.scrapHealAcc -= every; healPlayer(s, 1, 'module'); }
  }
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    s.pendingLevels++;
    ev.push({ t: 'floater', x: s.p.x, y: s.p.y - 44, key: 'float.level', n: s.level, color: '#ffd166', big: true });
    ev.push({ t: 'ring', x: s.p.x, y: s.p.y, color: '#ffd166', max: 70, life: 0.4 });
    ev.push({ t: 'sfx', id: 'levelUp' });
  }
}

// ---------- уровни ----------

export function makeLevelOffer(s: SimState): void {
  const pool = [...LEVEL_UPS];
  const weights = rarityWeights(s.level, s.p.stats.luck);
  s.levelOffer = [];
  for (let i = 0; i < 4 && pool.length; i++) {
    const def = pool.splice(int(s.rng.offer, pool.length), 1)[0]!;
    let roll = nextFloat(s.rng.offer);
    let rarity = 0;
    for (let r = 3; r >= 1; r--) {
      if (roll < weights[r]!) { rarity = r; break; }
      roll -= weights[r]!;
    }
    s.levelOffer.push({ stat: def.stat, rarity, value: def.values[rarity]! });
  }
}

export function chooseLevel(s: SimState, idx: number, ev: EventSink): boolean {
  const o = s.levelOffer[idx];
  if (s.phase !== 'levelup' || !o) return false;
  s.p.mods.push({ stat: o.stat, flat: o.value, source: { kind: 'level', id: String(s.level - s.pendingLevels + 1) } });
  refreshStats(s.p);
  s.pendingLevels--;
  ev.push({ t: 'sfx', id: 'choose' });
  intermission(s);
  ev.push({ t: 'phase' });
  return true;
}

export function rerollLevel(s: SimState, ev: EventSink): boolean {
  const cost = rerollCost(s.wave, s.levelRerolls);
  if (s.phase !== 'levelup' || s.scrap < cost) {
    ev.push({ t: 'sfx', id: 'error' });
    return false;
  }
  s.scrap -= cost;
  s.levelRerolls++;
  makeLevelOffer(s);
  ev.push({ t: 'sfx', id: 'reroll' });
  ev.push({ t: 'phase' });
  return true;
}

// ---------- магазин ----------

/** Выйти из магазина в следующую волну. */
export function leaveShop(s: SimState, ev: EventSink): boolean {
  if (s.phase !== 'shop') return false;
  ev.push({ t: 'sfx', id: 'choose' });
  startWave(s, ev);
  ev.push({ t: 'phase' });
  return true;
}
