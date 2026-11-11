import { TAU } from '../core/math';
import { range as rnd } from '../core/rng';
import { tierAtkSpeed } from '../content/balance';
import { weaponById, type WeaponDef } from '../content/weapons';
import { damageEnemy, rollWeaponDamage } from './combat';
import type { EventSink } from './events';
import type { TickInput } from './input';
import { cooldownOf } from './stats';
import type { SimState, WeaponInst } from './state';
import { enemyHash, MAX_ENEMY_R, nearestEnemy } from './world';

const ORBIT_R = 34;

export function weaponRange(s: SimState, def: WeaponDef): number {
  const bonus = s.p.stats.range * (def.kind === 'swing' ? 0.5 : 1);
  return Math.max(40, def.range + bonus);
}

export function weaponCooldown(s: SimState, def: WeaponDef, inst: WeaponInst): number {
  return cooldownOf(def.cooldown, s.p.stats.atkSpeed + tierAtkSpeed(inst.tier));
}

/** Позиции на орбите, наведение и стрельба всех оружий. */
export function updateWeapons(s: SimState, inp: TickInput, dt: number, ev: EventSink): void {
  const p = s.p;
  const n = p.weapons.length;
  const manual = inp.fire;
  for (let k = 0; k < n; k++) {
    const inst = p.weapons[k]!;
    const def = weaponById(inst.id);
    const oa = s.time * 0.8 + (k * TAU) / n;
    inst.x = p.x + (n > 1 ? Math.cos(oa) * ORBIT_R : 0);
    inst.y = p.y + (n > 1 ? Math.sin(oa) * ORBIT_R : 0);
    inst.cd -= dt;
    inst.flash = Math.max(0, inst.flash - dt);
    const rangeV = weaponRange(s, def);

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
    fire(s, def, inst, rangeV, target, ev);
    inst.cd = weaponCooldown(s, def, inst);
    inst.flash = 0.08;
  }
}

function fire(s: SimState, def: WeaponDef, inst: WeaponInst, rangeV: number, target: number, ev: EventSink): void {
  const a = inst.aim;
  const sx = inst.x + Math.cos(a) * def.look.len;
  const sy = inst.y + Math.sin(a) * def.look.len;
  if (def.kind === 'bullet') {
    const pellets = def.pellets ?? 1;
    const spread = def.spread ?? 0;
    const speed = def.speed ?? 1000;
    for (let i = 0; i < pellets; i++) {
      const angle = a + (pellets > 1 ? ((i - (pellets - 1) / 2) * spread) / (pellets - 1) : rnd(s.rng.combat, -spread, spread));
      const { dmg, crit } = rollWeaponDamage(s, def, inst);
      s.bullets.push({
        x: sx, y: sy, px: sx, py: sy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: rangeV / speed, damage: dmg, crit, color: def.color, friendly: true, r: def.bulletR ?? 3,
        pierce: def.pierce ?? 1, hit: [], weapon: def.id, source: '',
      });
    }
    ev.push({ t: 'burst', x: sx, y: sy, color: def.color, n: 3, force: 90 });
  } else if (def.kind === 'swing') {
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
    });
    ev.push({ t: 'swing', x: inst.x, y: inst.y, a, arc, r: rangeV, color: def.color });
  } else if (def.kind === 'chain' && target >= 0) {
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
  }
  ev.push({ t: 'kick', a, v: def.kick });
  ev.push({ t: 'sfx', id: def.sfx });
}
