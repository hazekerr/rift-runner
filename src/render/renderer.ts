import { TAU, clamp, lerp } from '../core/math';
import { ARENA_CENTER, WORLD, makeArena, type ObstacleDef } from '../content/arena';
import { AURA_COLOR, AURA_GLYPH, ENEMIES, MINE, RUNNER_DASH } from '../content/enemies';
import { PALETTE } from '../content/palette';
import { weaponById } from '../content/weapons';
import { t } from '../i18n';
import type { Enemy, SimState } from '../sim/state';
import type { Camera } from './camera';
import type { Fx } from './fx';

export interface ViewState {
  crosshair: boolean;
  mouseX: number;
  mouseY: number;
  hitboxes: boolean;
  /** Ручной огонь активен (подсветка прицела). */
  manual: boolean;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  W = 0;
  H = 0;
  DPR = 1;
  private menuObstacles: ObstacleDef[] = makeArena();
  private arenaLayer: HTMLCanvasElement | null = null;

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
    this.arenaLayer = null;
  }

  private pathPoly(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, rotation = 0): void {
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
    const sh = fx.shake;
    const ox = Math.round(W / 2 - cx + fx.kickX + (sh ? rnd(-sh, sh) : 0));
    const oy = Math.round(H / 2 - cy + fx.kickY + (sh ? rnd(-sh, sh) : 0));
    ctx.save();
    ctx.translate(ox, oy);
    this.drawArena();
    this.drawObstacles(s ? s.obstacles : this.menuObstacles);
    if (s) {
      this.drawScraps(s, alpha, now);
      this.drawPickups(s, alpha, now);
      this.drawMines(s, now);
      this.drawSpawns(s);
      this.drawEnemies(s, alpha);
      this.drawBullets(s, alpha, true);
      this.drawWeaponFx(fx);
      this.drawParticles(fx);
      this.drawBullets(s, alpha, false);
      this.drawPlayer(s, alpha);
      if (view.hitboxes) this.drawHitboxes(s);
    } else this.drawParticles(fx);
    this.drawFloaters(fx);
    ctx.restore();

    const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    vignette.addColorStop(0, '#03080b00');
    vignette.addColorStop(1, '#03080ba0');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    if (s && view.crosshair) this.drawCrosshair(s, view);
  }

  /** Статичная арена в offscreen-слой (пол, сетка, надписи): рисуется один раз. */
  private drawArena(): void {
    if (!this.arenaLayer) {
      const layer = document.createElement('canvas');
      const scale = this.DPR;
      layer.width = Math.round(WORLD.w * scale);
      layer.height = Math.round(WORLD.h * scale);
      const c = layer.getContext('2d')!;
      c.scale(scale, scale);
      c.fillStyle = PALETTE.floor;
      c.fillRect(25, 25, WORLD.w - 50, WORLD.h - 50);
      c.strokeStyle = PALETTE.grid;
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 25; x < WORLD.w; x += 60) { c.moveTo(x, 25); c.lineTo(x, WORLD.h - 25); }
      for (let y = 25; y < WORLD.h; y += 60) { c.moveTo(25, y); c.lineTo(WORLD.w - 25, y); }
      c.stroke();
      c.strokeStyle = PALETTE.wall;
      c.lineWidth = 2;
      c.strokeRect(25, 25, WORLD.w - 50, WORLD.h - 50);
      c.strokeStyle = PALETTE.orange;
      c.lineWidth = 3;
      const corners: Array<[number, number, number, number]> = [
        [25, 25, 1, 1], [WORLD.w - 25, 25, -1, 1], [25, WORLD.h - 25, 1, -1], [WORLD.w - 25, WORLD.h - 25, -1, -1],
      ];
      for (const [x, y, sx, sy] of corners) {
        c.beginPath();
        c.moveTo(x + sx * 65, y);
        c.lineTo(x, y);
        c.lineTo(x, y + sy * 65);
        c.stroke();
      }
      c.save();
      c.translate(ARENA_CENTER.x, ARENA_CENTER.y);
      c.strokeStyle = '#1c3039';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 175, 0, TAU);
      c.arc(0, 0, 183, 0, TAU);
      c.stroke();
      c.rotate(-Math.PI / 4);
      c.fillStyle = '#172a33';
      c.textAlign = 'center';
      c.font = '900 105px Segoe UI, Arial, sans-serif';
      c.fillText('RR', 0, 30);
      c.restore();
      c.fillStyle = '#344d58';
      c.font = '10px monospace';
      c.textAlign = 'left';
      c.fillText(t('arena.sector'), 65, 70);
      c.fillText(t('arena.footer'), WORLD.w - 340, WORLD.h - 55);
      this.arenaLayer = layer;
    }
    this.ctx.drawImage(this.arenaLayer, 0, 0, WORLD.w, WORLD.h);
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

  private drawScraps(s: SimState, alpha: number, now: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#ffc163';
    ctx.strokeStyle = '#6b4a1e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const sc of s.scraps) {
      const x = lerp(sc.px, sc.x, alpha);
      const y = lerp(sc.py, sc.y, alpha);
      const r = sc.v >= 8 ? 6 : sc.v >= 3 ? 4.5 : 3.2;
      const a = now * 0.003 + sc.x * 0.05;
      // ромб-болт
      ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a + 1.57) * r * 0.6, y + Math.sin(a + 1.57) * r * 0.6);
      ctx.lineTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
      ctx.lineTo(x - Math.cos(a + 1.57) * r * 0.6, y - Math.sin(a + 1.57) * r * 0.6);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }

  private drawSpawns(s: SimState): void {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    for (const sp of s.spawns) {
      ctx.globalAlpha = 0.35 + Math.sin(sp.t * 30) * 0.2;
      ctx.strokeStyle = sp.type === 'boss' ? '#ff5f78' : sp.elite ? AURA_COLOR[sp.elite] : '#ff755e';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, (sp.type === 'boss' ? 50 : 22) + (1 - Math.min(1, sp.t / 0.85)) * 20, 0, TAU);
      ctx.moveTo(sp.x - 10, sp.y);
      ctx.lineTo(sp.x + 10, sp.y);
      ctx.moveTo(sp.x, sp.y - 10);
      ctx.lineTo(sp.x, sp.y + 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawMines(s: SimState, now: number): void {
    const ctx = this.ctx;
    for (const m of s.mines) {
      const armed = m.arm <= 0;
      // зона поражения видна заранее (телеграф)
      ctx.globalAlpha = armed ? 0.18 + 0.12 * Math.sin(now * 0.02) : 0.1;
      ctx.fillStyle = '#9be26b';
      ctx.beginPath();
      ctx.arc(m.x, m.y, MINE.radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#9be26b';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = armed && Math.sin(now * 0.03) > 0 ? '#ffffff' : '#9be26b';
      this.pathPoly(ctx, m.x, m.y, 7, 4, Math.PI / 4);
      ctx.fill();
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
      this.pathPoly(ctx, 0, 0, 12, 4, Math.PI / 4);
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

  private enemyBody(e: Enemy): void {
    const ctx = this.ctx;
    const def = ENEMIES[e.type];
    if (def.sides === 0) { ctx.beginPath(); ctx.rect(-e.r, -e.r, e.r * 2, e.r * 2); }
    else if (def.sides === 3) this.pathPoly(ctx, 0, 0, e.r + 3, 3, 0);
    else if (def.sides === 4) this.pathPoly(ctx, 0, 0, e.r + 2, 4, 0);
    else this.pathPoly(ctx, 0, 0, e.r, def.sides, e.phase * 0.3);
  }

  private drawEnemies(s: SimState, alpha: number): void {
    const ctx = this.ctx;
    for (const e of s.enemies) {
      const ex = lerp(e.px, e.x, alpha);
      const ey = lerp(e.py, e.y, alpha);
      const def = ENEMIES[e.type];
      const color = def.color;
      // телеграф рывка раннера
      if (e.type === 'runner' && e.ai === 1) {
        const k = 1 - e.aiT / RUNNER_DASH.windup;
        ctx.strokeStyle = `rgba(255,237,135,${0.25 + 0.5 * k})`;
        ctx.lineWidth = 2 + 4 * k;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + e.vx * RUNNER_DASH.speed * RUNNER_DASH.time, ey + e.vy * RUNNER_DASH.speed * RUNNER_DASH.time);
        ctx.stroke();
      }
      if (e.elite) {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = AURA_COLOR[e.elite];
        ctx.beginPath();
        ctx.arc(ex, ey, 150, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(ex, ey);
      ctx.fillStyle = '#05090c77';
      ctx.beginPath();
      ctx.ellipse(4, 8, e.r * 1.1, e.r * 0.8, 0, 0, TAU);
      ctx.fill();
      ctx.rotate(e.a);
      const glow = e.hit > 0 || e.elite || e.type === 'boss';
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = e.hit > 0 ? 18 : 10; }
      ctx.strokeStyle = e.hit > 0 ? '#fff' : color;
      ctx.fillStyle = e.hit > 0 ? '#eee' : e.type === 'boss' ? '#3c1f30' : '#29232a';
      ctx.lineWidth = e.type === 'boss' || e.elite ? 3 : 2;
      this.enemyBody(e);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      if (e.type === 'healer') {
        ctx.fillRect(-3, -9, 6, 18);
        ctx.fillRect(-9, -3, 18, 6);
      } else {
        ctx.fillRect(e.r * 0.15, -3.5, e.r + 6, 7);
        ctx.beginPath();
        ctx.arc(0, 0, e.type === 'boss' ? 12 : Math.max(3, e.r * 0.3), 0, TAU);
        ctx.fill();
      }
      if (e.type === 'boss') {
        ctx.strokeStyle = s.overtime ? '#ffffff' : '#ff8597';
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 8, e.phase, e.phase + Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.restore();
      if (e.shielded) {
        ctx.strokeStyle = AURA_COLOR.shield;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ex, ey, e.r + 5, 0, TAU);
        ctx.stroke();
      }
      if (e.elite) {
        // глиф ауры: роль читается не только цветом
        ctx.fillStyle = AURA_COLOR[e.elite];
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(AURA_GLYPH[e.elite], ex, ey - e.r - 16);
      }
      if (e.hp < e.maxHp && e.type !== 'boss') {
        const w = Math.max(24, e.r * 2.4);
        ctx.fillStyle = '#152027';
        ctx.fillRect(ex - w / 2, ey - e.r - 11, w, 3);
        ctx.fillStyle = color;
        ctx.fillRect(ex - w / 2, ey - e.r - 11, (w * Math.max(0, e.hp)) / e.maxHp, 3);
      }
    }
  }

  /** friendly=true — наши трассеры (пачкой по цвету, без shadowBlur); false — вражеские поверх эффектов. */
  private drawBullets(s: SimState, alpha: number, friendly: boolean): void {
    const ctx = this.ctx;
    if (friendly) {
      const byColor = new Map<string, number[]>();
      for (const b of s.bullets) {
        if (!b.friendly) continue;
        let arr = byColor.get(b.color);
        if (!arr) { arr = []; byColor.set(b.color, arr); }
        arr.push(lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha), b.vx, b.vy, b.r);
      }
      ctx.lineCap = 'round';
      for (const [color, arr] of byColor) {
        for (const pass of [0, 1]) {
          ctx.strokeStyle = color;
          ctx.globalAlpha = pass ? 1 : 0.25;
          ctx.beginPath();
          let lw = 2;
          for (let i = 0; i < arr.length; i += 5) {
            const bx = arr[i]!, by = arr[i + 1]!, vx = arr[i + 2]!, vy = arr[i + 3]!;
            lw = arr[i + 4]! * (pass ? 1.4 : 3.2);
            const sp = Math.hypot(vx, vy) || 1;
            const len = Math.min(34, sp * 0.02);
            ctx.moveTo(bx - (vx / sp) * len, by - (vy / sp) * len);
            ctx.lineTo(bx, by);
          }
          ctx.lineWidth = lw;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
      return;
    }
    for (const b of s.bullets) {
      if (b.friendly) continue;
      const bx = lerp(b.px, b.x, alpha);
      const by = lerp(b.py, b.y, alpha);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(bx, by, b.r + 4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe5ff';
      ctx.beginPath();
      ctx.arc(bx, by, b.r * 0.5, 0, TAU);
      ctx.fill();
    }
  }

  private drawWeaponFx(fx: Fx): void {
    const ctx = this.ctx;
    const sw = fx.swings;
    for (let i = 0; i < sw.count; i++) {
      const q = sw.items[i]!;
      ctx.globalAlpha = q.life / 0.12;
      ctx.strokeStyle = q.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r * 0.85, q.a - q.arc, q.a + q.arc);
      ctx.stroke();
      ctx.globalAlpha *= 0.15;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.arc(q.x, q.y, q.r, q.a - q.arc, q.a + q.arc);
      ctx.closePath();
      ctx.fill();
    }
    const bs = fx.beams;
    for (let i = 0; i < bs.count; i++) {
      const q = bs.items[i]!;
      ctx.globalAlpha = q.life / q.total;
      ctx.strokeStyle = q.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let j = 0; j + 3 < q.pts.length; j += 2) {
        const x1 = q.pts[j]!, y1 = q.pts[j + 1]!, x2 = q.pts[j + 2]!, y2 = q.pts[j + 3]!;
        ctx.moveTo(x1, y1);
        // ломаная молния
        for (let k = 1; k < 5; k++) {
          const tt = k / 5;
          ctx.lineTo(lerp(x1, x2, tt) + rnd(-7, 7), lerp(y1, y2, tt) + rnd(-7, 7));
        }
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
    this.pathPoly(ctx, 0, 0, 17, 6, Math.PI / 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6aefd5';
    ctx.fillRect(1, -10, 8, 4);
    ctx.fillStyle = '#e7f5e9';
    ctx.beginPath();
    ctx.arc(-3, 0, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Оружие на орбите: у каждого свой силуэт и цвет
    const dx = x - p.x;
    const dy = y - p.y;
    for (const w of p.weapons) {
      const def = weaponById(w.id);
      ctx.save();
      ctx.translate(w.x + dx, w.y + dy);
      ctx.rotate(w.aim);
      const recoil = w.flash > 0 ? -3 : 0;
      ctx.fillStyle = '#1b2a30';
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(recoil - 5, -def.look.w / 2, def.look.len + 5, def.look.w);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.fillRect(recoil + def.look.len - 5, -def.look.w / 2, 5, def.look.w);
      // пипы тира
      for (let k = 0; k < w.tier; k++) ctx.fillRect(recoil - 4 + k * 4, def.look.w / 2 + 2, 2, 2);
      if (w.flash > 0) {
        ctx.globalAlpha = w.flash / 0.08;
        ctx.beginPath();
        ctx.arc(recoil + def.look.len + 3, 0, 4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawHitboxes(s: SimState): void {
    const ctx = this.ctx;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(s.p.x, s.p.y, s.p.r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#ff0055';
    for (const e of s.enemies) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = '#ffff00';
    for (const b of s.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); }
  }

  private drawParticles(fx: Fx): void {
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
    const ps = fx.particles;
    for (let i = 0; i < ps.count; i++) {
      const q = ps.items[i]!;
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.r / 2, q.y - q.r / 2, q.r, q.r);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloaters(fx: Fx): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    const fs = fx.floaters;
    for (let i = 0; i < fs.count; i++) {
      const q = fs.items[i]!;
      ctx.font = q.big ? 'bold 16px monospace' : 'bold 11px monospace';
      ctx.globalAlpha = Math.min(1, q.life * 2.5);
      ctx.fillStyle = '#05090c';
      ctx.fillText(q.text, q.x + 1, q.y + 1);
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawCrosshair(s: SimState, view: ViewState): void {
    const ctx = this.ctx;
    const { mouseX: x, mouseY: y } = view;
    ctx.strokeStyle = view.manual ? '#ffb586' : '#d2f4e9';
    ctx.lineWidth = 1.5;
    const gap = view.manual ? 8 : 5;
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
      ctx.fillText(t('hud.combo', { m: Math.min(5, 1 + Math.floor(s.combo / 6)), n: s.combo }), this.W / 2, this.H - 120);
    }
  }
}
