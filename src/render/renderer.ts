import { TAU, clamp, lerp } from '../core/math';
import { ARENA_CENTER, WORLD, makeArena, type ObstacleDef } from '../content/arena';
import { ENEMIES } from '../content/enemies';
import { PALETTE } from '../content/palette';
import { GUNS } from '../content/weapons';
import { t } from '../i18n';
import type { SimState } from '../sim/state';
import type { Camera } from './camera';
import type { Fx } from './fx';

export interface ViewState {
  /** Показывать прицел и комбо (идёт бой, не тач). */
  crosshair: boolean;
  mouseX: number;
  mouseY: number;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  W = 0;
  H = 0;
  DPR = 1;
  private menuObstacles: ObstacleDef[] = makeArena();

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    this.W = innerWidth;
    this.H = innerHeight;
    this.DPR = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.DPR);
    this.canvas.height = Math.round(this.H * this.DPR);
  }

  private pathPoly(x: number, y: number, r: number, n: number, rotation = 0): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rotation + (i * TAU) / n;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  draw(s: SimState | null, alpha: number, fx: Fx, cam: Camera, view: ViewState): void {
    const { ctx, W, H } = this;
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, W, H);
    const now = performance.now();
    const cx = s ? cam.ix(alpha) : ARENA_CENTER.x + Math.sin(now * 0.0001) * 80;
    const cy = s ? cam.iy(alpha) : ARENA_CENTER.y;
    const sh = fx.shake * fx.shakeScale;
    const ox = W / 2 - cx + (sh ? rnd(-sh, sh) : 0);
    const oy = H / 2 - cy + (sh ? rnd(-sh, sh) : 0);
    ctx.save();
    ctx.translate(ox, oy);
    this.drawArena();
    this.drawObstacles(s ? s.obstacles : this.menuObstacles);
    if (s) {
      this.drawSpawns(s);
      this.drawPickups(s, alpha, now);
      this.drawEnemies(s, alpha);
      this.drawBullets(s, alpha);
      this.drawPlayer(s, alpha);
    }
    this.drawFx(fx);
    ctx.restore();

    const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    vignette.addColorStop(0, '#03080b00');
    vignette.addColorStop(1, '#03080ba0');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    if (s && view.crosshair) this.drawCrosshair(s, view);
  }

  private drawArena(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(25, 25, WORLD.w - 50, WORLD.h - 50);
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 25; x < WORLD.w; x += 60) { ctx.moveTo(x, 25); ctx.lineTo(x, WORLD.h - 25); }
    for (let y = 25; y < WORLD.h; y += 60) { ctx.moveTo(25, y); ctx.lineTo(WORLD.w - 25, y); }
    ctx.stroke();
    ctx.strokeStyle = PALETTE.wall;
    ctx.lineWidth = 2;
    ctx.strokeRect(25, 25, WORLD.w - 50, WORLD.h - 50);
    ctx.strokeStyle = PALETTE.orange;
    ctx.lineWidth = 3;
    const corners: Array<[number, number, number, number]> = [
      [25, 25, 1, 1], [WORLD.w - 25, 25, -1, 1], [25, WORLD.h - 25, 1, -1], [WORLD.w - 25, WORLD.h - 25, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 65, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * 65);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(ARENA_CENTER.x, ARENA_CENTER.y);
    ctx.strokeStyle = '#1c3039';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 175, 0, TAU);
    ctx.arc(0, 0, 183, 0, TAU);
    ctx.stroke();
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#172a33';
    ctx.textAlign = 'center';
    ctx.font = '900 105px Segoe UI, Arial, sans-serif';
    ctx.fillText('RR', 0, 30);
    ctx.restore();
    ctx.fillStyle = '#344d58';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(t('arena.sector'), 65, 70);
    ctx.fillText(t('arena.footer'), WORLD.w - 340, WORLD.h - 55);
  }

  private drawObstacles(obstacles: ReadonlyArray<ObstacleDef>): void {
    const ctx = this.ctx;
    for (const o of obstacles) {
      ctx.fillStyle = '#050a0e77';
      ctx.fillRect(o.x + 7, o.y + 10, o.w, o.h);
      ctx.fillStyle = o.crate ? '#302b23' : '#1d303b';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = o.crate ? '#8e6844' : '#3a5663';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = o.crate ? '#9b6e42' : '#486672';
      ctx.fillRect(o.x + 5, o.y + 5, o.w - 10, 3);
      if (o.crate) {
        ctx.strokeStyle = '#6b5137';
        ctx.beginPath();
        ctx.moveTo(o.x + 8, o.y + 12);
        ctx.lineTo(o.x + o.w - 8, o.y + o.h - 8);
        ctx.moveTo(o.x + o.w - 8, o.y + 12);
        ctx.lineTo(o.x + 8, o.y + o.h - 8);
        ctx.stroke();
      } else {
        ctx.fillStyle = PALETTE.cyan;
        ctx.fillRect(o.x + o.w - 12, o.y + o.h - 12, 5, 5);
      }
    }
  }

  private drawSpawns(s: SimState): void {
    const ctx = this.ctx;
    for (const sp of s.spawns) {
      ctx.globalAlpha = 0.35 + Math.sin(sp.t * 30) * 0.2;
      ctx.strokeStyle = sp.type === 'boss' ? '#ff5f78' : '#ff755e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 22 + (1 - sp.t / 0.85) * 20, 0, TAU);
      ctx.moveTo(sp.x - 10, sp.y);
      ctx.lineTo(sp.x + 10, sp.y);
      ctx.moveTo(sp.x, sp.y - 10);
      ctx.lineTo(sp.x, sp.y + 10);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawPickups(s: SimState, alpha: number, now: number): void {
    const ctx = this.ctx;
    for (const item of s.pickups) {
      ctx.save();
      ctx.translate(lerp(item.px, item.x, alpha), lerp(item.py, item.y, alpha));
      ctx.globalAlpha = item.life < 3 ? (Math.sin(now * 0.015) + 1) / 2 : 1;
      ctx.shadowBlur = 15;
      ctx.shadowColor = item.type === 'heal' ? PALETTE.cyan : PALETTE.violet;
      ctx.fillStyle = ctx.shadowColor;
      this.pathPoly(0, 0, 12, 4, Math.PI / 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b1b20';
      if (item.type === 'heal') {
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillRect(-2, -6, 4, 12);
      } else {
        ctx.beginPath();
        ctx.moveTo(1, -7); ctx.lineTo(-5, 1); ctx.lineTo(0, 1); ctx.lineTo(-1, 7); ctx.lineTo(5, -1); ctx.lineTo(0, -1);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawEnemies(s: SimState, alpha: number): void {
    const ctx = this.ctx;
    for (const e of s.enemies) {
      const ex = lerp(e.px, e.x, alpha);
      const ey = lerp(e.py, e.y, alpha);
      const color = ENEMIES[e.type].color;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.fillStyle = '#05090c77';
      ctx.beginPath();
      ctx.ellipse(4, 8, e.r * 1.1, e.r * 0.8, 0, 0, TAU);
      ctx.fill();
      ctx.rotate(e.a);
      ctx.shadowColor = color;
      ctx.shadowBlur = e.hit > 0 ? 20 : 7;
      ctx.strokeStyle = e.hit > 0 ? '#fff' : color;
      ctx.fillStyle = e.hit > 0 ? '#eee' : e.type === 'boss' ? '#3c1f30' : '#29232a';
      ctx.lineWidth = e.type === 'boss' ? 3 : 2;
      if (e.type === 'runner') this.pathPoly(0, 0, e.r + 3, 3, 0);
      else if (e.type === 'tank') { ctx.beginPath(); ctx.rect(-e.r, -e.r, e.r * 2, e.r * 2); }
      else this.pathPoly(0, 0, e.r, e.type === 'boss' ? 8 : 6, e.phase * 0.3);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.fillRect(e.r * 0.15, -4, e.r + 7, 8);
      ctx.beginPath();
      ctx.arc(0, 0, e.type === 'boss' ? 12 : 5, 0, TAU);
      ctx.fill();
      if (e.type === 'boss') {
        ctx.strokeStyle = '#ff8597';
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 8, e.phase, e.phase + Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.restore();
      if (e.hp < e.maxHp && e.type !== 'boss') {
        ctx.fillStyle = '#152027';
        ctx.fillRect(ex - 20, ey - e.r - 13, 40, 3);
        ctx.fillStyle = color;
        ctx.fillRect(ex - 20, ey - e.r - 13, (40 * e.hp) / e.maxHp, 3);
      }
    }
  }

  private drawBullets(s: SimState, alpha: number): void {
    const ctx = this.ctx;
    for (const b of s.bullets) {
      const bx = lerp(b.px, b.x, alpha);
      const by = lerp(b.py, b.y, alpha);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.r * 1.4;
      ctx.shadowBlur = 8;
      ctx.shadowColor = b.color;
      ctx.beginPath();
      const len = b.friendly ? Math.min(40, Math.hypot(b.vx, b.vy) * 0.02) : 11;
      const a = Math.atan2(b.vy, b.vx);
      ctx.moveTo(bx - Math.cos(a) * len, by - Math.sin(a) * len);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (!b.friendly) {
        ctx.fillStyle = '#ffe5ff';
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, TAU);
        ctx.fill();
      }
    }
  }

  private drawPlayer(s: SimState, alpha: number): void {
    const ctx = this.ctx;
    const p = s.p;
    const x = lerp(p.px, p.x, alpha);
    const y = lerp(p.py, p.y, alpha);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#03090a88';
    ctx.beginPath();
    ctx.ellipse(3, 9, 19, 12, 0, 0, TAU);
    ctx.fill();
    if (p.inv > 0) {
      ctx.strokeStyle = p.dashTime > 0 ? '#aaffef' : '#62ecd277';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, TAU);
      ctx.stroke();
    }
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.inv > 0 && Math.sin(s.time * 35) > 0 ? 0.65 : 1;
    ctx.fillStyle = '#264e50';
    ctx.strokeStyle = '#72e8d2';
    ctx.lineWidth = 2;
    this.pathPoly(0, 0, 17, 6, Math.PI / 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bfd5ce';
    ctx.fillRect(5, -7, 25, 7);
    ctx.fillStyle = GUNS[p.gun]!.color;
    ctx.fillRect(22, -7, 10, 7);
    ctx.fillStyle = '#6aefd5';
    ctx.fillRect(1, -10, 8, 4);
    ctx.fillStyle = '#e7f5e9';
    ctx.beginPath();
    ctx.arc(-3, 0, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (p.reload > 0) {
      const total = GUNS[p.gun]!.reload / p.reloadSpeed;
      ctx.strokeStyle = '#ffb06c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 29, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.reload / total));
      ctx.stroke();
    }
  }

  private drawFx(fx: Fx): void {
    const ctx = this.ctx;
    const rs = fx.rings;
    for (let i = 0; i < rs.count; i++) {
      const q = rs.items[i]!;
      ctx.globalAlpha = q.life / q.total;
      ctx.lineWidth = 3;
      ctx.strokeStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const ps = fx.particles;
    for (let i = 0; i < ps.count; i++) {
      const q = ps.items[i]!;
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.r / 2, q.y - q.r / 2, q.r, q.r);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    const fs = fx.floaters;
    for (let i = 0; i < fs.count; i++) {
      const q = fs.items[i]!;
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawCrosshair(s: SimState, view: ViewState): void {
    const ctx = this.ctx;
    const { mouseX: x, mouseY: y } = view;
    const cooling = s.p.cool > 0;
    ctx.strokeStyle = cooling ? '#ffb586' : '#d2f4e9';
    ctx.lineWidth = 1.5;
    const gap = cooling ? 8 : 5;
    ctx.beginPath();
    ctx.moveTo(x - gap - 6, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + 6, y);
    ctx.moveTo(x, y - gap - 6); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + 6);
    ctx.stroke();
    ctx.fillStyle = PALETTE.orange;
    ctx.fillRect(x - 1, y - 1, 2, 2);
    if (s.combo > 2 && s.comboTime > 0) {
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffb383';
      ctx.textAlign = 'center';
      ctx.fillText(t('hud.combo', { m: Math.min(5, 1 + Math.floor(s.combo / 6)), n: s.combo }), this.W / 2, this.H - 36);
    }
  }
}
