import { TAU } from '../core/math';
import { range as rnd } from '../core/rng';
import { tierAtkSpeed } from '../content/balance';
import { operatorById } from '../content/operators';
import { weaponById, type WeaponDef } from '../content/weapons';
import { segDistance } from './collide';
import { damageEnemy, rollWeaponDamage } from './combat';
import type { EventSink } from './events';
import type { TickInput } from './input';
import { cooldownOf } from './stats';
import { healPlayer, type Enemy, type SimState, type WeaponInst } from './state';
import { chance } from '../core/rng';
import { isBoss } from '../content/enemies';
import { enemyHash, MAX_ENEMY_R, move, nearestEnemy } from './world';

const ORBIT_R = 34;

export function weaponRange(s: SimState, def: WeaponDef): number {
  if (def.kind === 'orbit') return def.orbitR ?? 60;
  const bonus = s.p.stats.range * (def.kind === 'swing' ? 0.5 : 1);
  return Math.max(40, def.range + bonus);
}

export function weaponCooldown(s: SimState, def: WeaponDef, inst: WeaponInst): number {
  return cooldownOf(def.cooldown, s.p.stats.atkSpeed + tierAtkSpeed(inst.tier));
}

/** Позиция диска пилы k (для сима и рендера). */
export function bladePos(s: SimState, inst: WeaponInst, def: WeaponDef, k: number): { x: number; y: number } {
  const n = def.blades ?? 2;
  const a = s.time * 4 + (k * TAU) / n + inst.uid;
  const r = def.orbitR ?? 60;
  return { x: s.p.x + Math.cos(a) * r, y: s.p.y + Math.sin(a) * r };
}

/** Позиции на орбите, наведение и стрельба всех оружий. */
export function updateWeapons(s: SimState, inp: TickInput, dt: number, ev: EventSink): void {
  const p = s.p;
  const rule = operatorById(s.operator).rule;
  const n = p.weapons.length;
  const manual = inp.fire;
  // Связист: оружие стреляет только по команде
  const allowed = !rule.manualOnly || inp.fire || inp.fireAuto;
  for (let k = 0; k < n; k++) {
    const inst = p.weapons[k]!;
    const def = weaponById(inst.id);
    const oa = s.time * 0.8 + (k * TAU) / n;
    inst.x = p.x + (n > 1 ? Math.cos(oa) * ORBIT_R : 0);
    inst.y = p.y + (n > 1 ? Math.sin(oa) * ORBIT_R : 0);
    inst.cd -= dt;
    inst.flash = Math.max(0, inst.flash - dt);
    // раскрутка остывает, когда нет цели (cd ушёл далеко в минус)
    if (def.spin && inst.cd < -0.25) inst.heat = Math.max(0, (inst.heat ?? 0) - dt * 0.9);
    if (!allowed) continue;
    const rangeV = weaponRange(s, def);

    if (def.kind === 'orbit') {
      if (def.blockBullets) blockBullets(s, def, inst, ev);
      if (inst.cd > 0) continue;
      orbitHit(s, def, inst, ev);
      inst.cd = weaponCooldown(s, def, inst);
      continue;
    }

    let target = -1;
    if (manual) {
      inst.aim = Math.atan2(inp.aimY - inst.y, inp.aimX - inst.x);
      if (def.kind === 'chain') target = nearestEnemy(s, inp.aimX, inp.aimY, 160);
    } else {
      target = nearestEnemy(s, inst.x, inst.y, rangeV);
      if (target >= 0) {
        const e = s.enemies[target]!;
        inst.aim = Math.atan2(e.y - inst.y, e.x - inst.x);
      }
    }
    if (inst.cd > 0) continue;
    if (!manual && target < 0) continue;
    if (manual && def.kind === 'chain' && target < 0) continue;
    if (def.kind === 'turret' && s.turrets.filter((t) => t.weapon === `${inst.uid}`).length >= (def.turretMax ?? 1)) continue;
    fire(s, def, inst, rangeV, target, manual ? { x: inp.aimX, y: inp.aimY } : null, ev);
    if (def.spin) inst.heat = Math.min(1, (inst.heat ?? 0) + 0.1);
    inst.cd = weaponCooldown(s, def, inst) / (def.spin ? 1 + 2 * (inst.heat ?? 0) : 1);
    inst.flash = 0.08;
  }
}

/** Оглушение и встроенный вампиризм ближнего оружия. */
function meleeExtras(s: SimState, def: WeaponDef, e: Enemy): void {
  if (def.stun && !e.dead && !isBoss(e.type)) { e.slow = Math.max(e.slow, def.stun); e.slowPct = 100; }
  const leech = (def.leech ?? 0) + (operatorById(s.operator).rule.meleeHeal ?? 0);
  if (leech > 0 && chance(s.rng.combat, leech / 100)) healPlayer(s, 1, 'lifesteal');
}

/** Отбросить врага от точки удара (не боссов). */
function knockBack(s: SimState, e: Enemy, fx: number, fy: number, px: number): void {
  if (px <= 0 || e.dead || isBoss(e.type)) return;
  const d = Math.hypot(e.x - fx, e.y - fy) || 1;
  // танки и элиты держат удар; 2.0: стек отбрасывания делал ближний бой неуязвимым (бот получал 20–50 урона за волну)
  const k = e.type === 'tank' || e.type === 'armadillo' || e.elite ? 0.4 : 1;
  move(s, e, ((e.x - fx) / d) * px * k, ((e.y - fy) / d) * px * k);
}

/** Щиты на орбите сбивают вражеские пули — каждый тик, независимо от перезарядки удара. */
function blockBullets(s: SimState, def: WeaponDef, inst: WeaponInst, ev: EventSink): void {
  for (let k = 0; k < (def.blades ?? 2); k++) {
    const b = bladePos(s, inst, def, k);
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const q = s.bullets[i]!;
      if (q.friendly || Math.hypot(q.x - b.x, q.y - b.y) > 20 + q.r) continue;
      ev.push({ t: 'burst', x: q.x, y: q.y, color: def.color, n: 3, force: 90 });
      s.bullets[i] = s.bullets[s.bullets.length - 1]!;
      s.bullets.pop();
    }
  }
}

function orbitHit(s: SimState, def: WeaponDef, inst: WeaponInst, ev: EventSink): void {
  let any = false;
  for (let k = 0; k < (def.blades ?? 2); k++) {
    const b = bladePos(s, inst, def, k);
    enemyHash.queryCircle(b.x, b.y, 16 + MAX_ENEMY_R, (i) => {
      const e = s.enemies[i];
      if (!e || e.dead || Math.hypot(e.x - b.x, e.y - b.y) > e.r + 16) return;
      const { dmg, crit } = rollWeaponDamage(s, def, inst);
      damageEnemy(s, e, dmg, crit, def.id, ev);
      knockBack(s, e, b.x, b.y, def.knock ?? 0);
      meleeExtras(s, def, e);
      any = true;
    });
  }
  if (any) ev.push({ t: 'sfx', id: def.sfx });
}

function fire(s: SimState, def: WeaponDef, inst: WeaponInst, rangeV: number, target: number, aimPt: { x: number; y: number } | null, ev: EventSink): void {
  const a = inst.aim;
  const sx = inst.x + Math.cos(a) * def.look.len;
  const sy = inst.y + Math.sin(a) * def.look.len;
  const fx = s.p.fx;
  // Точка цели: курсор (ручной режим) или выбранный враг
  const tx = aimPt ? aimPt.x : target >= 0 ? s.enemies[target]!.x : sx;
  const ty = aimPt ? aimPt.y : target >= 0 ? s.enemies[target]!.y : sy;
  switch (def.kind) {
    case 'bullet': {
      const pellets = def.pellets ?? 1;
      const spread = def.spread ?? 0;
      const speed = def.speed ?? 1000;
      const ballistic = def.tags.includes('ballistic');
      for (let i = 0; i < pellets; i++) {
        const angle = a + (pellets > 1 ? ((i - (pellets - 1) / 2) * spread) / (pellets - 1) : rnd(s.rng.combat, -spread, spread));
        const { dmg, crit } = rollWeaponDamage(s, def, inst);
        s.bullets.push({
          x: sx, y: sy, px: sx, py: sy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: rangeV / speed, damage: dmg, crit, color: def.color, friendly: true, r: def.bulletR ?? 3,
          pierce: (def.pierce ?? 1) + (ballistic ? fx.pierceBonus : 0), hit: [], weapon: def.id, source: '',
          explodeR: (def.explodeR ?? 0) * fx.explodeRadiusMult, burnChance: def.burnChance ?? 0, slowPct: def.slowPct ?? 0,
          ...(def.boomerang ? { boom: rangeV / speed / 2, life: rangeV / speed + 1.5 } : {}),
          ...(def.pull ? { pull: def.pull } : {}),
        });
      }
      ev.push({ t: 'burst', x: sx, y: sy, color: def.color, n: 3, force: 90 });
      break;
    }
    case 'swing': {
      const arc = def.arc ?? 0.9;
      enemyHash.queryCircle(inst.x, inst.y, rangeV + MAX_ENEMY_R, (i) => {
        const e = s.enemies[i]!;
        if (e.dead) return;
        const d = Math.hypot(e.x - inst.x, e.y - inst.y);
        if (d > rangeV + e.r) return;
        let da = Math.atan2(e.y - inst.y, e.x - inst.x) - a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > arc && d > e.r) return;
        const { dmg, crit } = rollWeaponDamage(s, def, inst);
        damageEnemy(s, e, dmg, crit, def.id, ev);
        knockBack(s, e, inst.x, inst.y, def.knock ?? 0);
        meleeExtras(s, def, e);
      });
      ev.push({ t: 'swing', x: inst.x, y: inst.y, a, arc, r: rangeV, color: def.color });
      break;
    }
    case 'chain': {
      if (target < 0) return;
      const hit = new Set<number>();
      const pts: number[] = [sx, sy];
      let cur = target;
      let mult = 1;
      for (let j = 0; j < (def.chains ?? 1) && cur >= 0; j++) {
        const e = s.enemies[cur]!;
        hit.add(e.id);
        pts.push(e.x, e.y);
        const { dmg, crit } = rollWeaponDamage(s, def, inst);
        damageEnemy(s, e, dmg * mult, crit, def.id, ev);
        mult *= 0.8;
        cur = nearestEnemy(s, e.x, e.y, def.chainRange ?? 120, hit);
      }
      ev.push({ t: 'beam', pts, color: def.color, life: 0.12 });
      break;
    }
    case 'trap':
    case 'artillery': {
      const { dmg, crit } = rollWeaponDamage(s, def, inst);
      const art = def.kind === 'artillery';
      // мина — бросается к цели (не дальше 90 px), снаряд — точно в цель
      const k = art ? 1 : Math.min(1, 90 / Math.max(1, Math.hypot(tx - inst.x, ty - inst.y)));
      s.traps.push({
        x: inst.x + (tx - inst.x) * k, y: inst.y + (ty - inst.y) * k, arm: def.arm ?? 0.5, life: art ? 5 : 10,
        damage: dmg, crit, r: (def.explodeR ?? 60) * fx.explodeRadiusMult, weapon: def.id, artillery: art,
      });
      break;
    }
    case 'turret': {
      const a2 = rnd(s.rng.combat, 0, TAU);
      const life = (def.turretLife ?? 6) * fx.turretLifeMult;
      s.turrets.push({
        x: s.p.x + Math.cos(a2) * 40, y: s.p.y + Math.sin(a2) * 40, life, total: life, cd: 0.2, rate: def.turretRate ?? 0.3,
        damage: rollWeaponDamage(s, def, inst).dmg, range: rangeV, weapon: `${inst.uid}`, aim: a,
      });
      ev.push({ t: 'sfx', id: 'turretDeploy' });
      return;
    }
    case 'beam': {
      const ex = sx + Math.cos(a) * rangeV;
      const ey = sy + Math.sin(a) * rangeV;
      const hits: number[] = [];
      enemyHash.queryRect(Math.min(sx, ex) - MAX_ENEMY_R, Math.min(sy, ey) - MAX_ENEMY_R, Math.max(sx, ex) + MAX_ENEMY_R, Math.max(sy, ey) + MAX_ENEMY_R, (i) => { hits.push(i); });
      hits.sort((x, y) => x - y);
      for (const i of hits) {
        const e = s.enemies[i]!;
        if (e.dead || segDistance(sx, sy, ex, ey, e.x, e.y) > e.r + 6) continue;
        const { dmg, crit } = rollWeaponDamage(s, def, inst);
        damageEnemy(s, e, dmg, crit, def.id, ev);
        knockBack(s, e, sx, sy, def.knock ?? 0);
        meleeExtras(s, def, e);
      }
      ev.push({ t: 'beam', pts: [sx, sy, ex, ey], color: def.color, life: def.dmgClass === 'melee' ? 0.08 : 0.15, straight: true });
      break;
    }
    default:
      break;
  }
  ev.push({ t: 'kick', a, v: def.kick });
  ev.push({ t: 'sfx', id: def.sfx });
}
