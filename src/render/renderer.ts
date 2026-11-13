import { TAU, clamp, lerp } from '../core/math';
import { ARENA_CENTER, WORLD, makeArena, type ObstacleDef } from '../content/arena';
import { AURA_COLOR, AURA_GLYPH, ELITE, ENEMIES, MINE, RUNNER_DASH } from '../content/enemies';
import { PALETTE } from '../content/palette';
import { weaponById } from '../content/weapons';
import { isBoss } from '../content/enemies';
import { bladePos } from '../sim/weapons';
import { ENEMY_ART, enemyHalf, paintEnemyMine, paintMine, paintPickup, paintPlayer, paintSawDisc, paintScrap, paintTurret, paintTurretGun, SpriteBank, WEAPON_ART, type Sprite } from './sprites';
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
  /** Вспышки разрешены (белая вспышка врага при попадании). */
  flashes: boolean;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** Число заранее повёрнутых направлений спрайта врага. */
const ROT_BINS = 24;

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  W = 0;
  H = 0;
  DPR = 1;
  private menuObstacles: ObstacleDef[] = makeArena();
  private arenaLayer: HTMLCanvasElement | null = null;
  /** Качество «экономия»: DPR 1 и без shadowBlur. */
  lowQuality = false;
  get glow(): boolean {
    return !this.lowQuality;
  }

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    this.W = innerWidth;
    this.H = innerHeight;
    this.DPR = this.lowQuality ? 1 : Math.min(devicePixelRatio || 1, 2);
    // sprites объявлен ниже как поле: при первом resize из конструктора его ещё нет
    if (this.sprites && (this.sprites.scale !== this.DPR || this.sprites.glow !== !this.lowQuality)) {
      this.sprites.scale = this.DPR;
      this.sprites.glow = !this.lowQuality;
      this.sprites.clear();
    }
    this.canvas.width = Math.round(this.W * this.DPR);
    this.canvas.height = Math.round(this.H * this.DPR);
    this.arenaLayer = null;
  }

  private vignetteLayer: HTMLCanvasElement | null = null;

  /** Виньетка: градиент на весь экран дорог — рисуем один раз на размер окна. */
  private vignette(): HTMLCanvasElement {
    if (this.vignetteLayer && this.vignetteLayer.width === Math.round(this.W / 2) && this.vignetteLayer.height === Math.round(this.H / 2)) return this.vignetteLayer;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.W / 2));
    c.height = Math.max(1, Math.round(this.H / 2));
    const g = c.getContext('2d')!;
    const w = c.width;
    const h = c.height;
    const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, '#03080b00');
    grad.addColorStop(1, '#03080ba0');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    this.vignetteLayer = c;
    return c;
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

  private flashes = true;
  /** Смещение камеры текущего кадра (для прямого setTransform). */
  private ox = 0;
  private oy = 0;

  /** Сбросить кеш статичной арены (смена языка или качества). */
  invalidate(): void {
    this.arenaLayer = null;
  }

  draw(s: SimState | null, alpha: number, fx: Fx, cam: Camera, view: ViewState): void {
    this.flashes = view.flashes;
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
    this.ox = ox;
    this.oy = oy;
    ctx.save();
    ctx.translate(ox, oy);
    this.drawArena();
    this.drawObstacles(s ? s.obstacles : this.menuObstacles);
    if (s) {
      this.drawScraps(s, alpha, now);
      this.drawPickups(s, alpha, now);
      this.drawMines(s, now);
      this.drawTraps(s, now);
      this.drawSpawns(s);
      this.drawTelegraphs(s, now);
      this.drawTurrets(s);
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

    if (!this.lowQuality) ctx.drawImage(this.vignette(), 0, 0, W, H);

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
    for (const sc of s.scraps) {
      const x = lerp(sc.px, sc.x, alpha);
      const y = lerp(sc.py, sc.y, alpha);
      const size = sc.v >= 8 ? 6 : sc.v >= 3 ? 4.5 : 3.4;
      const spr = this.sprites.get(`scrap:${size}`, size + 6, (g, glow) => paintScrap(g, size, glow));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(now * 0.002 + sc.x * 0.05);
      ctx.drawImage(spr.canvas, -spr.half, -spr.half, spr.half * 2, spr.half * 2);
      ctx.restore();
    }
  }

  private drawTraps(s: SimState, now: number): void {
    const ctx = this.ctx;
    for (const tr of s.traps) {
      if (tr.artillery) {
        // точка падения снаряда видна заранее, кольцо сжимается к моменту взрыва
        const k = Math.max(0, tr.arm / 0.7);
        ctx.strokeStyle = '#ff7547';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, tr.r, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, tr.r * (1 - k), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        const armed = tr.arm <= 0;
        const spr = this.sprites.get('mine', 14, (g, glow) => paintMine(g, glow));
        ctx.globalAlpha = armed ? 0.75 + 0.25 * Math.sin(now * 0.02) : 0.5;
        ctx.drawImage(spr.canvas, tr.x - spr.half, tr.y - spr.half, spr.half * 2, spr.half * 2);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffd16655';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, 24, 0, TAU);
        ctx.stroke();
      }
    }
  }

  private drawTurrets(s: SimState): void {
    const ctx = this.ctx;
    const base = this.sprites.get('turret', 16, (g, glow) => paintTurret(g, glow));
    const gun = this.sprites.get('turretGun', 20, (g) => paintTurretGun(g));
    for (const tu of s.turrets) {
      ctx.drawImage(base.canvas, tu.x - base.half, tu.y - base.half, base.half * 2, base.half * 2);
      ctx.save();
      ctx.translate(tu.x, tu.y);
      ctx.rotate(tu.aim);
      ctx.drawImage(gun.canvas, -gun.half, -gun.half, gun.half * 2, gun.half * 2);
      ctx.restore();
      ctx.strokeStyle = '#62ecd288';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tu.x, tu.y, 17, -Math.PI / 2, -Math.PI / 2 + TAU * (tu.life / tu.total));
      ctx.stroke();
    }
  }

  /** Телеграфы боссов: показывают ровно ту геометрию, которой будет атака; на исполнении скрыты. */
  private drawTelegraphs(s: SimState, now: number): void {
    const ctx = this.ctx;
    for (const e of s.enemies) {
      const tl = e.tele;
      if (!tl || e.ai >= 20) continue;
      const k = 1 - tl.t / tl.total;
      const blink = 0.55 + 0.45 * Math.sin(now * 0.03);
      ctx.strokeStyle = '#ff3d6e';
      ctx.fillStyle = '#ff3d6e';
      if (tl.kind === 'ring') {
        // кольцо не «раздувается»: стоит на месте, заполняется дугой к моменту залпа
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, tl.r, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, tl.r, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
        this.aimLines(e.x, e.y, tl, k, blink, tl.r);
      } else if (tl.kind === 'circle') {
        ctx.globalAlpha = 0.12 + 0.18 * k;
        ctx.beginPath();
        ctx.arc(tl.x, tl.y, tl.r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = blink;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(tl.x, tl.y, tl.r * k, 0, TAU);
        ctx.stroke();
      } else if (tl.kind === 'corridor') {
        // коридор рывка: ширина = диаметр босса, от точки старта; заливка бежит к концу, шевроны — направление
        const w = tl.r;
        const len = tl.len + tl.r;
        ctx.save();
        ctx.translate(tl.x, tl.y);
        ctx.rotate(tl.a);
        ctx.globalAlpha = 0.1;
        ctx.fillRect(0, -w, len, w * 2);
        ctx.globalAlpha = 0.22;
        ctx.fillRect(0, -w, len * k, w * 2);
        ctx.globalAlpha = 0.5 + 0.4 * blink;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.strokeRect(0, -w, len, w * 2);
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        for (let x = w + 30; x < len - 10; x += 55) {
          ctx.globalAlpha = x / len < k ? 0.9 : 0.35;
          ctx.beginPath();
          ctx.moveTo(x - 12, -14);
          ctx.lineTo(x + 2, 0);
          ctx.lineTo(x - 12, 14);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        this.aimLines(e.x, e.y, tl, k, blink, 0);
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Линии прицела телеграфа: постоянная толщина (по r для лазеров), яркость растёт к выстрелу. */
  private aimLines(x: number, y: number, tl: { a: number; spread: number; count: number; len: number; r: number }, k: number, blink: number, from: number): void {
    const ctx = this.ctx;
    ctx.lineWidth = tl.r > 0 && from === 0 ? tl.r * 2 * (0.35 + 0.65 * k) : 3;
    for (let i = 0; i < tl.count; i++) {
      const a = tl.a + (i - (tl.count - 1) / 2) * tl.spread;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      ctx.globalAlpha = (0.45 + 0.5 * k) * (0.75 + 0.25 * blink);
      ctx.beginPath();
      ctx.moveTo(x + c * from, y + sn * from);
      ctx.lineTo(x + c * tl.len, y + sn * tl.len);
      ctx.stroke();
    }
  }

  private drawSpawns(s: SimState): void {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    for (const sp of s.spawns) {
      ctx.globalAlpha = 0.35 + Math.sin(sp.t * 30) * 0.2;
      ctx.strokeStyle = isBoss(sp.type) ? '#ff5f78' : sp.elite ? AURA_COLOR[sp.elite] : '#ff755e';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, (isBoss(sp.type) ? 60 : 22) + (1 - Math.min(1, sp.t / 0.85)) * 20, 0, TAU);
      ctx.moveTo(sp.x - 10, sp.y);
      ctx.lineTo(sp.x + 10, sp.y);
      ctx.moveTo(sp.x, sp.y - 10);
      ctx.lineTo(sp.x, sp.y + 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Вражеские мины: пунктирная зона взрыва, дуга взвода, мигающий огонёк; цвет опасности. */
  private drawMines(s: SimState, now: number): void {
    const ctx = this.ctx;
    const C = '#ff5a4a';
    const spr = this.sprites.get('enemyMine', 16, (g, glow) => paintEnemyMine(g, glow));
    for (const m of s.mines) {
      const armed = m.arm <= 0;
      ctx.globalAlpha = armed ? 0.1 + 0.06 * Math.sin(now * 0.02) : 0.05;
      ctx.fillStyle = C;
      ctx.beginPath();
      ctx.arc(m.x, m.y, MINE.radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = armed ? 0.75 : 0.4;
      ctx.strokeStyle = C;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 7]);
      ctx.lineDashOffset = -now * 0.02;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      if (!armed) {
        // дуга взвода: заполняется, пока мина не встанет на боевой взвод
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 18, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - m.arm / MINE.arm));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(spr.canvas, m.x - spr.half, m.y - spr.half, spr.half * 2, spr.half * 2);
      if (armed && Math.sin(now * 0.025) > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2.6, 0, TAU);
        ctx.fill();
      }
    }
  }

  private drawPickups(s: SimState, alpha: number, now: number): void {
    const ctx = this.ctx;
    for (const item of s.pickups) {
      const spr = this.sprites.get(`pickup:${item.type}`, 24, (g, glow) => paintPickup(g, item.type, glow));
      ctx.globalAlpha = item.life < 3 ? (Math.sin(now * 0.015) + 1) / 2 : 1;
      const bob = Math.sin(now * 0.004 + item.x) * 2;
      ctx.drawImage(spr.canvas, lerp(item.px, item.x, alpha) - spr.half, lerp(item.py, item.y, alpha) - spr.half + bob, spr.half * 2, spr.half * 2);
    }
    ctx.globalAlpha = 1;
  }

  readonly sprites = new SpriteBank();

  private enemySprite(type: keyof typeof ENEMIES): Sprite {
    const def = ENEMIES[type];
    return this.sprites.get(`e:${type}`, enemyHalf(def.r), (g, glow) => ENEMY_ART[type]!(g, def.r, def.color, glow));
  }

  private drawEnemies(s: SimState, alpha: number): void {
    const ctx = this.ctx;
    // Отсечение за экраном (арена больше вьюпорта) и LOD для толпы (план 2.0: до 600 врагов)
    const x0 = -this.ox - 160;
    const y0 = -this.oy - 160;
    const x1 = -this.ox + this.W + 160;
    const y1 = -this.oy + this.H + 160;
    const crowd = s.enemies.length > 250;
    if (!crowd) {
      // все тени одним путём
      ctx.fillStyle = '#05090c77';
      ctx.beginPath();
      for (const e of s.enemies) {
        const ex = lerp(e.px, e.x, alpha) + 4;
        const ey = lerp(e.py, e.y, alpha) + 8;
        if (ex < x0 || ex > x1 || ey < y0 || ey > y1) continue;
        ctx.moveTo(ex + e.r * 1.1, ey);
        ctx.ellipse(ex, ey, e.r * 1.1, e.r * 0.8, 0, 0, TAU);
      }
      ctx.fill();
    }
    const D = this.DPR;
    for (const e of s.enemies) {
      const ex = lerp(e.px, e.x, alpha);
      const ey = lerp(e.py, e.y, alpha);
      if (ex < x0 || ex > x1 || ey < y0 || ey > y1) continue;
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
        // радиус ауры — тонкое кольцо (заливка R150 у сотни элит после босса съедала кадр)
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = AURA_COLOR[e.elite];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ex, ey, ELITE.auraRange, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const spr = this.enemySprite(e.type);
      const k = e.r / def.r;
      const h = spr.half * k;
      if (!isBoss(e.type)) {
        // обычные враги: заранее повёрнутый спрайт (24 направления), без матрицы
        let bin = Math.round((e.a / TAU) * ROT_BINS) % ROT_BINS;
        if (bin < 0) bin += ROT_BINS;
        const key = `e:${e.type}`;
        ctx.drawImage(this.sprites.rotated(key, spr, bin, ROT_BINS).canvas, ex - h, ey - h, h * 2, h * 2);
        if (e.hit > 0 && this.flashes) {
          ctx.globalAlpha = Math.min(1, e.hit / 0.06) * 0.85;
          const w = this.sprites.white(key, spr);
          ctx.drawImage(this.sprites.rotated(`${key}:white`, w, bin, ROT_BINS).canvas, ex - h, ey - h, h * 2, h * 2);
          ctx.globalAlpha = 1;
        }
        if (e.elite) {
          ctx.strokeStyle = AURA_COLOR[e.elite];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ex, ey, e.r + 5, 0, TAU);
          ctx.stroke();
        }
      } else {
        // боссы (их 1–2): поворот матрицей, плюс кольца фаз
        const cos = Math.cos(e.a);
        const sin = Math.sin(e.a);
        ctx.setTransform(cos * D, sin * D, -sin * D, cos * D, (ex + this.ox) * D, (ey + this.oy) * D);
        ctx.drawImage(spr.canvas, -h, -h, h * 2, h * 2);
        if (e.hit > 0 && this.flashes) {
          ctx.globalAlpha = Math.min(1, e.hit / 0.06) * 0.85;
          ctx.drawImage(this.sprites.white(`e:${e.type}`, spr).canvas, -h, -h, h * 2, h * 2);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = s.overtime ? '#ffffff' : '#ff8597';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 8, e.phase, e.phase + Math.PI * 1.5);
        ctx.stroke();
        if (e.type === 'heart') {
          // пульсирующее ядро, число колец = фаза
          const ph = Math.max(1, e.vx);
          for (let q = 0; q < ph; q++) {
            ctx.beginPath();
            ctx.arc(0, 0, e.r * (0.45 + 0.12 * q) + Math.sin(e.phase * 6) * 2, 0, TAU);
            ctx.stroke();
          }
        }
        ctx.setTransform(D, 0, 0, D, this.ox * D, this.oy * D);
      }
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
      if (e.hp < e.maxHp && !isBoss(e.type)) {
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
    // вражеские снаряды: ореол, тело, белое ядро — тремя проходами пачкой по цвету
    const groups = new Map<string, number[]>();
    for (const b of s.bullets) {
      if (b.friendly) continue;
      let arr = groups.get(b.color);
      if (!arr) { arr = []; groups.set(b.color, arr); }
      arr.push(lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha), b.r);
    }
    for (const [color, arr] of groups) {
      ctx.fillStyle = color;
      for (const [k, a] of [[4, 0.35], [0, 1]] as const) {
        ctx.globalAlpha = a;
        ctx.beginPath();
        for (let i = 0; i < arr.length; i += 3) {
          const r = arr[i + 2]! + k;
          ctx.moveTo(arr[i]! + r, arr[i + 1]!);
          ctx.arc(arr[i]!, arr[i + 1]!, r, 0, TAU);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe5ff';
      ctx.beginPath();
      for (let i = 0; i < arr.length; i += 3) {
        const r = arr[i + 2]! * 0.5;
        ctx.moveTo(arr[i]! + r, arr[i + 1]!);
        ctx.arc(arr[i]!, arr[i + 1]!, r, 0, TAU);
      }
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
      if (q.straight) {
        ctx.lineWidth = 6 * (q.life / q.total) + 1;
        ctx.beginPath();
        ctx.moveTo(q.pts[0]!, q.pts[1]!);
        ctx.lineTo(q.pts[2]!, q.pts[3]!);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        continue;
      }
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
    ctx.fillStyle = '#03090a88';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 9, 19, 12, 0, 0, TAU);
    ctx.fill();
    if (p.inv > 0) {
      ctx.strokeStyle = p.dashTime > 0 ? '#aaffef' : '#62ecd277';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, TAU);
      ctx.stroke();
    }
    if (p.shield > 0) {
      ctx.strokeStyle = '#8fd8ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const body = this.sprites.get('player', 30, (g, glow) => paintPlayer(g, glow));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.inv > 0 && Math.sin(s.time * 35) > 0 ? 0.65 : 1;
    ctx.drawImage(body.canvas, -body.half, -body.half, body.half * 2, body.half * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
    // Оружие на орбите: у каждого свой силуэт и цвет
    const dx = x - p.x;
    const dy = y - p.y;
    for (const w of p.weapons) {
      const def = weaponById(w.id);
      if (def.kind === 'orbit') {
        const disc = this.sprites.get('saw', 18, (g, glow) => paintSawDisc(g, def.color, glow));
        for (let k = 0; k < (def.blades ?? 2); k++) {
          const b = bladePos(s, w, def, k);
          ctx.save();
          ctx.translate(b.x + dx, b.y + dy);
          ctx.rotate(s.time * 20);
          ctx.drawImage(disc.canvas, -disc.half, -disc.half, disc.half * 2, disc.half * 2);
          ctx.restore();
        }
        continue;
      }
      const art = WEAPON_ART[w.id];
      const spr = this.sprites.get(`w:${w.id}`, 26, (g, glow) => art?.(g, def.color, glow));
      ctx.save();
      ctx.translate(w.x + dx, w.y + dy);
      ctx.rotate(w.aim);
      const recoil = w.flash > 0 ? -3 : 0;
      ctx.drawImage(spr.canvas, recoil - spr.half, -spr.half, spr.half * 2, spr.half * 2);
      // пипы тира
      ctx.fillStyle = def.color;
      for (let k = 0; k < w.tier; k++) ctx.fillRect(recoil - 4 + k * 4, 8, 2, 2);
      if (w.flash > 0) {
        ctx.globalAlpha = w.flash / 0.08;
        ctx.beginPath();
        ctx.arc(recoil + def.look.len + 3, 0, 4, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
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
