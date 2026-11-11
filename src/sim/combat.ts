import { TAU, clamp } from '../core/math';
import { chance, nextFloat, range } from '../core/rng';
import { BONUS_POOL_SHARE, PLAYER_IFRAMES, enemyHpMult } from '../content/balance';
import { ELITE, ENEMIES, isArmored, isBoss, type EnemyType } from '../content/enemies';
import { operatorById } from '../content/operators';
import { threatMods } from '../content/threat';
import { PALETTE } from '../content/palette';
import { CRIT_MULT } from '../content/stats';
import type { WeaponDef } from '../content/weapons';
import type { EventSink } from './events';
import { armorMult, dodgeChance } from './stats';
import { maxHpOf, type Enemy, type SimState, type WeaponInst } from './state';
import { absorbHit, onHit, onHurt, onKill } from './effects';
import { TIER_MULT } from '../content/balance';

const comboMult = (combo: number): number => Math.min(5, 1 + Math.floor(combo / 6));
const MAX_SCRAP_ENTITIES = 700;

/** Урон одного попадания оружия: base · tier · (1 + (урон% + класс%)/100) · крит. */
export function rollWeaponDamage(s: SimState, def: WeaponDef, inst: WeaponInst): { dmg: number; crit: boolean } {
  const st = s.p.stats;
  const cls = def.dmgClass === 'melee' ? st.meleeDmg : def.dmgClass === 'ranged' ? st.rangedDmg : st.energyDmg;
  const p = s.p;
  const low = p.fx.lowHpDmg.pct && p.hp < maxHpOf(p) * (p.fx.lowHpDmg.below / 100) ? p.fx.lowHpDmg.pct : 0;
  const mult = Math.max(0.1, 1 + (st.damage + cls + low) / 100);
  const crit = chance(s.rng.combat, clamp(st.crit, 0, 100) / 100);
  const manual = operatorById(s.operator).rule.manualOnly ?? 1;
  return { dmg: def.damage * TIER_MULT[inst.tier - 1]! * mult * manual * (crit ? CRIT_MULT : 1), crit };
}

export function dropScrap(s: SimState, x: number, y: number, value: number): void {
  if (value <= 0) return;
  if (s.scraps.length >= MAX_SCRAP_ENTITIES) {
    // Лимит сущностей: сливаем в случайный существующий кусок
    s.scraps[Math.floor(nextFloat(s.rng.loot) * s.scraps.length)]!.v += value;
    return;
  }
  const a = range(s.rng.loot, 0, TAU);
  const sp = range(s.rng.loot, 40, 140);
  s.scraps.push({ x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v: value, pulled: false });
}

/**
 * Нанести урон врагу. weapon — id источника для статистики.
 * depth 0 — прямое попадание оружия (запускает on-hit/on-kill эффекты), 1 — урон от эффектов (не запускает).
 */
export function damageEnemy(s: SimState, e: Enemy, raw: number, crit: boolean, weapon: string, ev: EventSink, showNumber = true, depth = 0): void {
  if (e.dead) return;
  const armored = depth === 0 ? operatorById(s.operator).rule.armoredBonus ?? 0 : 0;
  const bonus = armored && isArmored(e.type, !!e.elite) ? 1 + armored / 100 : 1;
  const dmg = (e.shielded ? raw * 0.6 : raw) * bonus;
  e.hp -= dmg;
  e.hit = 0.06;
  s.stats.damageByWeapon[weapon] = (s.stats.damageByWeapon[weapon] ?? 0) + Math.min(dmg, dmg + e.hp);
  if (showNumber) {
    ev.push({ t: 'floater', x: e.x + range(s.rng.combat, -8, 8), y: e.y - e.r - 6, key: crit ? 'float.crit' : 'float.dmg', n: Math.round(dmg), color: crit ? '#ffd166' : '#eef3ed', big: crit });
  }
  // Вампиризм: шанс +1 HP за попадание, ICD 0.1 с
  const p = s.p;
  if (p.stats.lifesteal > 0 && p.lifestealCd <= 0 && chance(s.rng.combat, Math.min(100, p.stats.lifesteal) / 100)) {
    p.hp = Math.min(maxHpOf(p), p.hp + 1);
    p.lifestealCd = 0.1;
  }
  if (depth === 0 && e.hp > 0) onHit(s, e, dmg, crit, ev, damageEnemy);
  if (e.hp <= 0) killEnemy(s, e, ev, depth);
}

export function killEnemy(s: SimState, e: Enemy, ev: EventSink, depth = 0): void {
  if (e.dead) return;
  e.dead = true;
  const def = ENEMIES[e.type];
  const boss = isBoss(e.type);
  s.stats.kills++;
  if (e.type === 'boss') s.stats.guardianKills++;
  s.combo = s.comboTime > 0 ? s.combo + 1 : 1;
  s.comboTime = 2.5;
  const points = Math.round(def.points * (e.elite ? ELITE.points : 1) * comboMult(s.combo) * threatMods(s.threat).scoreMult);
  s.score += points;
  s.p.energy = clamp(s.p.energy + (boss ? 35 : e.elite ? 15 : 7), 0, 100);
  ev.push({ t: 'burst', x: e.x, y: e.y, color: def.color, n: boss ? 70 : e.elite ? 30 : 12, force: boss ? 400 : 200 });
  ev.push({ t: 'ring', x: e.x, y: e.y, color: def.color, max: boss ? 180 : e.elite ? 80 : 40, life: 0.3 });
  if (boss || e.elite) {
    ev.push({ t: 'hitstop', ms: boss ? 90 : 60 });
    ev.push({ t: 'shake', v: boss ? 16 : 7 });
  } else ev.push({ t: 'shake', v: 1.2 });
  ev.push({ t: 'sfx', id: boss ? 'killBoss' : e.elite ? 'killElite' : 'kill' });

  // Эффекты модулей при убийстве (только от прямых попаданий — без цепных реакций)
  const extra = depth === 0 ? onKill(s, e, ev, damageEnemy) : 0;
  if (extra) dropScrap(s, e.x, e.y, extra);
  // Скрап
  const value = e.elite ? ELITE.scrap : def.scrap;
  if (chance(s.rng.loot, def.scrapChance)) {
    if (boss) for (let i = 0; i < 12; i++) dropScrap(s, e.x, e.y, Math.ceil(value / 12));
    else dropScrap(s, e.x, e.y, value);
  }
  // Расходники (удача повышает шанс)
  const luckM = 1 + Math.max(0, s.p.stats.luck) / 100;
  if (boss || e.elite) s.pickups.push({ x: e.x, y: e.y, px: e.x, py: e.y, type: 'heal', life: 18 });
  else if (chance(s.rng.loot, 0.02 * luckM)) s.pickups.push({ x: e.x, y: e.y, px: e.x, py: e.y, type: 'heal', life: 15 });
  else if (chance(s.rng.loot, 0.03 * luckM)) s.pickups.push({ x: e.x, y: e.y, px: e.x, py: e.y, type: 'energy', life: 15 });

  // Сплиттер раскалывается
  if (e.type === 'splitter') {
    ev.push({ t: 'sfx', id: 'split' });
    for (let i = -1; i <= 1; i += 2) {
      const a = e.a + (i * Math.PI) / 2;
      spawnEnemyNow(s, 'shard', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, null);
    }
  }
  if (s.combo === 15 || s.combo === 40 || s.combo === 80) {
    ev.push({ t: 'toast', key: 'toast.combo', sub: 'toast.combo.sub', params: { n: s.combo, m: comboMult(s.combo) }, duration: 1.3 });
  }
}

/** Создать врага немедленно (без телеграфа) — для осколков и призывов. */
export function spawnEnemyNow(s: SimState, type: EnemyType, x: number, y: number, elite: Enemy['elite']): Enemy {
  const def = ENEMIES[type];
  const w = Math.max(1, s.wave);
  const th = threatMods(s.threat);
  const hpMult = enemyHpMult(w) * (elite ? ELITE.hp : 1) * th.hpMult;
  const dmgMult = s.waveDmgMult * (elite ? ELITE.dmg : 1) * th.dmgMult;
  const hp = Math.round(def.hp * hpMult);
  const e: Enemy = {
    id: s.nextId++, type, elite, x, y, px: x, py: y, hp, maxHp: hp,
    r: def.r * (elite ? ELITE.size : 1), speed: def.speed, contact: def.contact * dmgMult, shotDmg: def.shotDmg * dmgMult,
    shot: range(s.rng.spawn, 0.8, 2), hit: 0, a: 0, dead: false, phase: range(s.rng.spawn, 0, TAU),
    ai: 0, aiT: 0, vx: 0, vy: 0, hasted: false, shielded: false, burn: 0, burnDps: 0, slow: 0, slowPct: 0, tele: null, los: true,
  };
  if (isBoss(type)) {
    e.aiT = 1.5;
    e.shot = 0; // у боссов shot — счётчик ротации паттернов
  }
  s.enemies.push(e);
  return e;
}

/** Урон оператору с уклонением и бронёй. */
export function hurtPlayer(s: SimState, raw: number, source: EnemyType | 'mine', ev: EventSink): void {
  const p = s.p;
  if (p.inv > 0 || s.phase !== 'play' || s.god) return;
  if (absorbHit(s, ev)) return;
  if (chance(s.rng.combat, dodgeChance(p.stats.dodge) / 100)) {
    p.inv = 0.2;
    ev.push({ t: 'floater', x: p.x, y: p.y - 30, key: 'float.dodge', n: 0, color: PALETTE.cyan });
    ev.push({ t: 'sfx', id: 'dodge' });
    return;
  }
  const armor = operatorById(s.operator).rule.armorDisabled ? 0 : p.stats.armor;
  const dmg = Math.max(1, Math.round(raw * armorMult(armor)));
  p.hp -= dmg;
  p.inv = PLAYER_IFRAMES;
  s.stats.damageTaken += dmg;
  s.combo = 0;
  s.comboTime = 0;
  ev.push({ t: 'floater', x: p.x, y: p.y - 30, key: 'float.hurt', n: dmg, color: '#ff6b61' });
  ev.push({ t: 'flash', v: 0.55 });
  ev.push({ t: 'shake', v: 10 });
  ev.push({ t: 'hitstop', ms: 50 });
  ev.push({ t: 'burst', x: p.x, y: p.y, color: '#ff6b61', n: 16, force: 180 });
  ev.push({ t: 'sfx', id: 'hurt' });
  onHurt(s, ev, damageEnemy);
  if (p.hp <= 0) {
    p.hp = 0;
    s.stats.killedBy = source;
    s.phase = 'over';
    ev.push({ t: 'burst', x: p.x, y: p.y, color: PALETTE.cyan, n: 65, force: 350 });
    ev.push({ t: 'sfx', id: 'gameover' });
    ev.push({ t: 'phase' });
  }
}

/** Неподобранный скрап в конце волны: доля уходит в запас разлома (решение A). */
export function sweepScrap(s: SimState): number {
  let total = 0;
  for (const sc of s.scraps) total += sc.v;
  s.scraps.length = 0;
  const saved = Math.floor(total * Math.min(BONUS_POOL_SHARE, threatMods(s.threat).bonusShare));
  s.bonusPool += saved;
  return saved;
}
