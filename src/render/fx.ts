import { TAU } from '../core/math';
import { Pool } from '../core/pool';
import { t } from '../i18n';
import type { SimEvent } from '../sim/events';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: string }
interface Ring { x: number; y: number; color: string; r: number; max: number; life: number; total: number }
interface Floater { x: number; y: number; text: string; color: string; life: number; big: boolean }
interface Beam { pts: number[]; color: string; life: number; total: number }
interface Swing { x: number; y: number; a: number; arc: number; r: number; color: string; life: number }

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** Визуальные эффекты. Живут вне сима, используют Math.random (не влияют на детерминизм). */
export class Fx {
  particles = new Pool<Particle>(2048, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0.65, r: 1, color: '' }));
  rings = new Pool<Ring>(128, () => ({ x: 0, y: 0, color: '', r: 0, max: 0, life: 0, total: 1 }));
  floaters = new Pool<Floater>(256, () => ({ x: 0, y: 0, text: '', color: '', life: 0, big: false }));
  beams = new Pool<Beam>(64, () => ({ pts: [], color: '', life: 0, total: 1 }));
  swings = new Pool<Swing>(64, () => ({ x: 0, y: 0, a: 0, arc: 0, r: 0, color: '', life: 0 }));
  /** Trauma ∈ [0,1] (Eiserloh): смещение = MAX_SHAKE · t² · shakeScale. */
  trauma = 0;
  /** Направленная отдача камеры (px), затухает. */
  kickX = 0;
  kickY = 0;
  flash = 0;
  /** Настройки: сила тряски 0..1, числа урона. */
  shakeScale = 1;
  damageNumbers = true;

  get shake(): number {
    return 14 * this.trauma * this.trauma * this.shakeScale;
  }

  burst(x: number, y: number, color: string, n = 15, force = 180): void {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU);
      const sp = rnd(30, force);
      const q = this.particles.spawn();
      q.x = x; q.y = y; q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp;
      q.life = rnd(0.18, 0.65); q.max = 0.65; q.r = rnd(1.5, 4); q.color = color;
    }
  }

  ring(x: number, y: number, color: string, max = 100, life = 0.4): void {
    const q = this.rings.spawn();
    q.x = x; q.y = y; q.color = color; q.r = 8; q.max = max; q.life = life; q.total = life;
  }

  floater(x: number, y: number, text: string, color = '#fff', big = false): void {
    const q = this.floaters.spawn();
    q.x = x; q.y = y; q.text = text; q.color = color; q.life = big ? 1 : 0.7; q.big = big;
  }

  addTrauma(v: number): void {
    this.trauma = Math.min(1, this.trauma + v);
  }

  consume(e: SimEvent): void {
    switch (e.t) {
      case 'burst': this.burst(e.x, e.y, e.color, e.n, e.force); break;
      case 'ring': this.ring(e.x, e.y, e.color, e.max, e.life); break;
      case 'floater':
        if (!this.damageNumbers && (e.key === 'float.dmg' || e.key === 'float.crit')) break;
        this.floater(e.x, e.y, t(e.key, { n: e.n }), e.color, e.big);
        break;
      // Значения shake пришли из шкалы прототипа (px до ~16) → trauma
      case 'shake': this.addTrauma(e.v / 30); break;
      case 'kick':
        this.addTrauma(e.v);
        this.kickX -= Math.cos(e.a) * e.v * 40 * this.shakeScale;
        this.kickY -= Math.sin(e.a) * e.v * 40 * this.shakeScale;
        break;
      case 'beam': {
        const q = this.beams.spawn();
        q.pts = e.pts; q.color = e.color; q.life = e.life; q.total = e.life;
        break;
      }
      case 'swing': {
        const q = this.swings.spawn();
        q.x = e.x; q.y = e.y; q.a = e.a; q.arc = e.arc; q.r = e.r; q.color = e.color; q.life = 0.12;
        break;
      }
      case 'flash': this.flash = e.v; break;
      default: break;
    }
  }

  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const kd = Math.exp(-dt * 18);
    this.kickX *= kd;
    this.kickY *= kd;
    this.flash = Math.max(0, this.flash - dt * 2);
    const ps = this.particles;
    for (let i = ps.count - 1; i >= 0; i--) {
      const q = ps.items[i]!;
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const k = Math.exp(-dt * 5);
      q.vx *= k;
      q.vy *= k;
      if (q.life <= 0) ps.kill(i);
    }
    const rs = this.rings;
    for (let i = rs.count - 1; i >= 0; i--) {
      const q = rs.items[i]!;
      q.life -= dt;
      q.r += (q.max - q.r) * dt * 9;
      if (q.life <= 0) rs.kill(i);
    }
    const fs = this.floaters;
    for (let i = fs.count - 1; i >= 0; i--) {
      const q = fs.items[i]!;
      q.life -= dt;
      q.y -= dt * 36;
      if (q.life <= 0) fs.kill(i);
    }
    for (const pool of [this.beams, this.swings] as Array<Pool<{ life: number }>>) {
      for (let i = pool.count - 1; i >= 0; i--) {
        const q = pool.items[i]!;
        q.life -= dt;
        if (q.life <= 0) pool.kill(i);
      }
    }
  }

  clear(): void {
    this.particles.clear();
    this.rings.clear();
    this.floaters.clear();
    this.beams.clear();
    this.swings.clear();
    this.trauma = 0;
    this.kickX = this.kickY = 0;
    this.flash = 0;
  }
}
