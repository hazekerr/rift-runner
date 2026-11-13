/**
 * Банк спрайтов «детальный неон»: каждый объект рисуется кодом один раз в offscreen-canvas
 * (со свечением, вшитым в картинку), дальше рендер только копирует его через drawImage.
 * Это и детальнее, и дешевле, чем рисовать пути с shadowBlur каждый кадр.
 * Подмена на рисованный арт: положить картинку под тем же ключом через SpriteBank.put().
 */
const TAU = Math.PI * 2;
type G = CanvasRenderingContext2D;

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Половина размера в мировых пикселях: рисовать в (-half, -half, 2·half, 2·half). */
  half: number;
}

export class SpriteBank {
  private cache = new Map<string, Sprite>();
  /** Вшивать свечение (качество «высокое»). */
  glow = true;
  /** Масштаб растра (DPR). */
  scale = 1;

  clear(): void {
    this.cache.clear();
  }

  /** Подменить спрайт готовой картинкой (рисованный арт). */
  put(key: string, img: CanvasImageSource, half: number): void {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(half * 2 * this.scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    this.cache.set(key, { canvas: c, half });
  }

  get(key: string, half: number, paint: (g: G, glow: boolean) => void): Sprite {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    const px = Math.ceil(half * 2 * this.scale);
    c.width = c.height = px;
    const g = c.getContext('2d')!;
    g.translate(px / 2, px / 2);
    g.scale(this.scale, this.scale);
    g.lineJoin = 'round';
    paint(g, this.glow);
    const s = { canvas: c, half };
    this.cache.set(key, s);
    return s;
  }

  /** Белый силуэт спрайта — для вспышки попадания. */
  white(key: string, base: Sprite): Sprite {
    const k = `${key}:white`;
    const hit = this.cache.get(k);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = base.canvas.width;
    c.height = base.canvas.height;
    const g = c.getContext('2d')!;
    g.drawImage(base.canvas, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    const s = { canvas: c, half: base.half };
    this.cache.set(k, s);
    return s;
  }
}

// ---------------- примитивы ----------------

function poly(g: G, r: number, n: number, rot = 0, cx = 0, cy = 0): void {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
}

function pts(g: G, p: ReadonlyArray<readonly [number, number]>): void {
  g.beginPath();
  p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/** Корпус: тёмная заливка с градиентом + неоновый контур (свечение по желанию). */
function hull(g: G, color: string, glow: boolean, fill = '#1d1a20', width = 2): void {
  const grad = g.createLinearGradient(-20, -20, 20, 20);
  grad.addColorStop(0, shade(fill, 18));
  grad.addColorStop(1, fill);
  g.fillStyle = grad;
  g.fill();
  if (glow) { g.shadowColor = color; g.shadowBlur = 10; }
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
  g.shadowBlur = 0;
}

/** Светящееся ядро. */
function core(g: G, x: number, y: number, r: number, color: string, glow: boolean): void {
  if (glow) { g.shadowColor = color; g.shadowBlur = r * 2.4; }
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.45, mix(color, '#ffffff', 0.45));
  grad.addColorStop(1, color);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.shadowBlur = 0;
}

function line(g: G, color: string, w: number, ...p: number[]): void {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(p[0]!, p[1]!);
  for (let i = 2; i + 1 < p.length; i += 2) g.lineTo(p[i]!, p[i + 1]!);
  g.stroke();
}

function rect(g: G, x: number, y: number, w: number, h: number, fill: string, stroke?: string, lw = 1): void {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(x, y, w, h); }
}

function hex2rgb(h: string): [number, number, number] {
  const v = parseInt(h.slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function shade(h: string, d: number): string {
  const [r, g, b] = hex2rgb(h);
  const c = (x: number): string => Math.max(0, Math.min(255, x + d)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex2rgb(a);
  const [r2, g2, b2] = hex2rgb(b);
  const c = (x: number, y: number): string => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
const alpha = (h: string, a: number): string => `${h}${Math.round(a * 255).toString(16).padStart(2, '0')}`;

// ---------------- враги (смотрят вдоль +x, R — базовый радиус) ----------------

export type EnemyArt = (g: G, R: number, c: string, glow: boolean) => void;

export const ENEMY_ART: Record<string, EnemyArt> = {
  drone(g, R, c, glow) {
    // три моторные гондолы с размытыми винтами
    for (let k = 0; k < 3; k++) {
      const a = Math.PI + (k - 1) * 2.1;
      const x = Math.cos(a) * R * 1.02;
      const y = Math.sin(a) * R * 1.02;
      g.fillStyle = alpha(c, 0.12);
      g.beginPath(); g.arc(x, y, R * 0.42, 0, TAU); g.fill();
      g.beginPath(); g.arc(x, y, R * 0.24, 0, TAU);
      hull(g, c, false, '#2a1a1a', 1.2);
      line(g, alpha(c, 0.5), 1, x - R * 0.36, y, x + R * 0.36, y);
    }
    poly(g, R, 6);
    hull(g, c, glow, '#2b1a1a');
    poly(g, R * 0.62, 6, Math.PI / 6);
    g.strokeStyle = alpha(c, 0.45); g.lineWidth = 1; g.stroke();
    rect(g, R * 0.25, -3, R * 0.95, 6, '#3d2420', c);
    rect(g, R * 1.05, -2, 4, 4, '#ffd2c6');
    core(g, -R * 0.05, 0, R * 0.26, c, glow);
  },
  runner(g, R, c, glow) {
    // сопло позади
    if (glow) { g.shadowColor = '#ff9a5a'; g.shadowBlur = 12; }
    g.fillStyle = '#ff9a5a';
    pts(g, [[-R * 0.75, -R * 0.25], [-R * 1.35, 0], [-R * 0.75, R * 0.25]]);
    g.fill();
    g.shadowBlur = 0;
    pts(g, [[R + 4, 0], [-R * 0.9, -R * 0.95], [-R * 0.55, 0], [-R * 0.9, R * 0.95]]);
    hull(g, c, glow, '#2a2814');
    line(g, alpha(c, 0.6), 1, -R * 0.45, -R * 0.55, R * 0.4, -R * 0.12);
    line(g, alpha(c, 0.6), 1, -R * 0.45, R * 0.55, R * 0.4, R * 0.12);
    core(g, R * 0.25, 0, R * 0.22, c, glow);
  },
  gunner(g, R, c, glow) {
    rect(g, -R * 1.05, -R * 0.45, R * 0.4, R * 0.9, '#2a2036', c); // короб боезапаса
    poly(g, R, 6);
    hull(g, c, glow, '#211a2c');
    // спаренный ствол
    rect(g, R * 0.1, -6, R * 1.35, 4.5, '#3b2a52', c);
    rect(g, R * 0.1, 1.5, R * 1.35, 4.5, '#3b2a52', c);
    rect(g, R * 1.38, -6.5, 3, 13, c);
    // сенсор
    g.fillStyle = '#120d18';
    g.beginPath(); g.arc(-R * 0.15, 0, R * 0.36, 0, TAU); g.fill();
    core(g, -R * 0.1, 0, R * 0.2, c, glow);
  },
  tank(g, R, c, glow) {
    // гусеницы
    for (const s of [-1, 1]) {
      rect(g, -R, s > 0 ? R * 0.62 : -R, R * 2, R * 0.38, '#2e2416', c, 1.5);
      g.strokeStyle = alpha(c, 0.5);
      g.lineWidth = 1;
      for (let x = -R + 4; x < R; x += 6) { g.beginPath(); g.moveTo(x, s > 0 ? R * 0.62 : -R); g.lineTo(x, s > 0 ? R : -R * 0.62); g.stroke(); }
    }
    g.beginPath(); g.rect(-R * 0.85, -R * 0.62, R * 1.7, R * 1.24);
    hull(g, c, glow, '#2e2416');
    // заклёпки
    g.fillStyle = alpha(c, 0.7);
    for (const [x, y] of [[-0.7, -0.48], [0.7, -0.48], [-0.7, 0.48], [0.7, 0.48]] as const) { g.beginPath(); g.arc(x * R, y * R, 1.6, 0, TAU); g.fill(); }
    // башня и ствол
    rect(g, R * 0.15, -4, R * 1.15, 8, '#4a3720', c);
    rect(g, R * 1.2, -5, 4, 10, c);
    g.beginPath(); g.arc(0, 0, R * 0.46, 0, TAU);
    hull(g, c, false, '#3b2d1a', 1.5);
    core(g, 0, 0, R * 0.22, c, glow);
  },
  splitter(g, R, c, glow) {
    pts(g, [[R + 2, 0], [0, -R - 2], [-R - 2, 0], [0, R + 2]]);
    hull(g, c, glow, '#2c1a24');
    // трещина раскола
    if (glow) { g.shadowColor = c; g.shadowBlur = 8; }
    line(g, '#ffd0e4', 1.6, -R * 0.2, -R * 0.95, R * 0.1, -R * 0.3, -R * 0.15, R * 0.2, R * 0.12, R * 0.95);
    g.shadowBlur = 0;
    core(g, R * 0.35, 0, R * 0.18, c, glow);
    core(g, -R * 0.45, 0, R * 0.14, c, glow);
  },
  shard(g, R, c, glow) {
    pts(g, [[R + 2, 0], [0, -R], [-R, 0], [0, R]]);
    hull(g, c, glow, '#2c1a24', 1.5);
    line(g, alpha(c, 0.6), 1, -R * 0.5, 0, R * 0.6, 0);
  },
  miner(g, R, c, glow) {
    poly(g, R, 5);
    hull(g, c, glow, '#1c2a16');
    // минный отсек сзади
    g.beginPath(); g.arc(-R * 0.35, 0, R * 0.42, 0, TAU);
    hull(g, c, false, '#26381c', 1.2);
    for (let k = 0; k < 4; k++) { const a = (k * TAU) / 4 + 0.4; line(g, alpha(c, 0.7), 1, -R * 0.35, 0, -R * 0.35 + Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42); }
    // антенна
    line(g, c, 1.2, R * 0.4, -R * 0.2, R * 1.15, -R * 0.75);
    core(g, R * 1.15, -R * 0.75, 2.2, c, glow);
    rect(g, R * 0.3, -2.5, R * 0.8, 5, '#2e4422', c);
  },
  healer(g, R, c, glow) {
    poly(g, R, 8, Math.PI / 8);
    hull(g, c, glow, '#16271f');
    g.fillStyle = alpha(c, 0.7);
    for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; g.beginPath(); g.arc(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78, 1.5, 0, TAU); g.fill(); }
    if (glow) { g.shadowColor = c; g.shadowBlur = 12; }
    g.fillStyle = '#d9ffe9';
    g.fillRect(-2.5, -R * 0.55, 5, R * 1.1);
    g.fillRect(-R * 0.55, -2.5, R * 1.1, 5);
    g.shadowBlur = 0;
  },
  swarm(g, R, c, glow) {
    line(g, alpha(c, 0.55), 1.2, -R * 0.2, -R * 0.3, -R * 0.9, -R * 1.25);
    line(g, alpha(c, 0.55), 1.2, -R * 0.2, R * 0.3, -R * 0.9, R * 1.25);
    pts(g, [[R + 2, 0], [-R * 0.8, -R * 0.75], [-R * 0.4, 0], [-R * 0.8, R * 0.75]]);
    hull(g, c, glow, '#2a2614', 1.4);
    core(g, R * 0.2, 0, R * 0.25, c, glow);
  },
  boss(g, R, c, glow) {
    // бронеплиты
    for (let k = 0; k < 8; k++) {
      const a0 = (k * TAU) / 8 + 0.06;
      const a1 = ((k + 1) * TAU) / 8 - 0.06;
      g.beginPath();
      g.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
      g.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
      g.lineTo(Math.cos(a1) * R * 0.7, Math.sin(a1) * R * 0.7);
      g.lineTo(Math.cos(a0) * R * 0.7, Math.sin(a0) * R * 0.7);
      g.closePath();
      hull(g, c, glow && k % 2 === 0, '#3c1f30', 1.6);
    }
    poly(g, R * 0.68, 8, Math.PI / 8);
    hull(g, c, false, '#2a1522', 1.5);
    // три ствола
    for (const y of [-R * 0.38, 0, R * 0.38]) {
      rect(g, R * 0.45, y - 3.5, R * 0.75, 7, '#4a2234', c);
      rect(g, R * 1.15, y - 4.5, 4, 9, c);
    }
    g.fillStyle = alpha(c, 0.8);
    for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8 + TAU / 16; g.beginPath(); g.arc(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85, 2, 0, TAU); g.fill(); }
    core(g, 0, 0, R * 0.26, c, glow);
  },
  heart(g, R, c, glow) {
    // шипастый 12-угольник: чередование радиусов
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i * TAU) / 24;
      const r = i % 2 ? R * 0.82 : R * 1.04;
      if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    hull(g, c, glow, '#2e0f1c', 2.4);
    // «вены» разлома
    g.strokeStyle = alpha(c, 0.55);
    g.lineWidth = 1.4;
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6 + 0.3;
      g.beginPath();
      g.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
      g.quadraticCurveTo(Math.cos(a + 0.5) * R * 0.6, Math.sin(a + 0.5) * R * 0.6, Math.cos(a + 0.2) * R * 0.85, Math.sin(a + 0.2) * R * 0.85);
      g.stroke();
    }
    poly(g, R * 0.5, 12);
    hull(g, c, false, '#3c1222', 1.5);
    core(g, 0, 0, R * 0.3, c, glow);
  },
};

/** Половина размера холста спрайта врага (с запасом под стволы и свечение). */
export const enemyHalf = (R: number): number => Math.ceil(R * 1.45 + 7);

// ---------------- оператор ----------------

export function paintPlayer(g: G, glow: boolean): void {
  const c = '#72e8d2';
  // кормовые сопла
  for (const y of [-8, 8]) rect(g, -19, y - 3, 6, 6, '#163236', c);
  poly(g, 17, 6, Math.PI / 6);
  hull(g, c, glow, '#183a3c');
  poly(g, 11, 6, Math.PI / 6);
  g.strokeStyle = alpha(c, 0.45);
  g.lineWidth = 1;
  g.stroke();
  // плечевые огни
  if (glow) { g.shadowColor = '#62ecd2'; g.shadowBlur = 8; }
  g.fillStyle = '#6aefd5';
  g.fillRect(-4, -14, 8, 3);
  g.fillRect(-4, 11, 8, 3);
  g.shadowBlur = 0;
  // кабина
  core(g, -2, 0, 6.5, '#9ff5e4', glow);
}

// ---------------- оружие на орбите (ствол вдоль +x) ----------------

export const WEAPON_ART: Record<string, (g: G, c: string, glow: boolean) => void> = {
  pulse(g, c, glow) { rect(g, -6, -3, 18, 6, '#1b2a30', c); for (const x of [0, 4, 8]) line(g, alpha(c, 0.8), 1, x, -3, x, 3); rect(g, 12, -2, 5, 4, c); if (glow) core(g, 17, 0, 1.6, c, glow); },
  scatter(g, c) { rect(g, -6, -5, 10, 10, '#2a2116', c); rect(g, 4, -4, 10, 3, '#3a2c18', c); rect(g, 4, 1, 10, 3, '#3a2c18', c); rect(g, -2, 4, 6, 3, c); },
  rail(g, c, glow) { rect(g, -6, -2, 26, 4, '#1d1830', c); for (const x of [2, 8, 14]) { g.strokeStyle = c; g.lineWidth = 1.2; g.strokeRect(x, -4, 3, 8); } if (glow) core(g, 21, 0, 1.8, c, glow); },
  blade(g, c, glow) { rect(g, -6, -2, 6, 4, '#3a4448'); rect(g, 0, -5, 2, 10, '#9fb2b6'); if (glow) { g.shadowColor = c; g.shadowBlur = 6; } g.fillStyle = '#e8f3f2'; pts(g, [[2, -2.5], [22, 0], [2, 2.5]]); g.fill(); g.shadowBlur = 0; },
  nailer(g, c) { g.beginPath(); g.arc(-2, 0, 5, 0, TAU); g.fillStyle = '#2b3438'; g.fill(); g.strokeStyle = c; g.lineWidth = 1; g.stroke(); rect(g, 2, -2, 12, 4, '#3a4448', c); },
  arc(g, c, glow) { rect(g, -6, -4, 8, 8, '#16283a', c); line(g, c, 1.5, 2, -3, 12, -5); line(g, c, 1.5, 2, 3, 12, 5); if (glow) core(g, 12, 0, 2, c, glow); },
  rocket(g, c) { rect(g, -7, -5, 20, 10, '#2e2018', c); rect(g, 13, -4, 3, 8, c); rect(g, -4, -6, 6, 2, '#ff9a5a'); },
  flamer(g, c, glow) { g.beginPath(); g.arc(-3, 0, 5, 0, TAU); g.fillStyle = '#3a2410'; g.fill(); g.strokeStyle = c; g.lineWidth = 1.2; g.stroke(); rect(g, 2, -2, 10, 4, '#4a3020', c); if (glow) core(g, 13, 0, 2, '#ffb347', glow); },
  cryo(g, c, glow) { rect(g, -6, -3, 18, 6, '#16303a', c); line(g, c, 1, 4, -3, 8, -7); line(g, c, 1, 4, 3, 8, 7); if (glow) core(g, 13, 0, 2.2, c, glow); },
  mine(g, c) { rect(g, -6, -6, 12, 12, '#2a2510', c); line(g, c, 2, -6, 6, 6, -6); },
  mortar(g, c) { rect(g, -6, -6, 8, 12, '#2a1a12', c); rect(g, 2, -5, 10, 10, '#3a2016', c); rect(g, 11, -5, 2, 10, c); },
  turret(g, c, glow) { poly(g, 7, 4, Math.PI / 4); hull(g, c, glow, '#10232a', 1.2); rect(g, 0, -1.5, 10, 3, c); },
  saw(g, c) { g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fillStyle = '#2b3438'; g.fill(); g.strokeStyle = c; g.lineWidth = 1; g.stroke(); },
  laser(g, c, glow) { rect(g, -6, -3, 14, 6, '#2a1428', c); pts(g, [[8, -4], [18, 0], [8, 4]]); g.fillStyle = '#4a1c44'; g.fill(); g.strokeStyle = c; g.stroke(); if (glow) core(g, 18, 0, 1.8, c, glow); },
};

/** Диск пилы (вращается при отрисовке). */
export function paintSawDisc(g: G, c: string, glow: boolean): void {
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16;
    const r = i % 2 ? 10 : 14;
    if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  hull(g, c, glow, '#1b2a30', 1.5);
  g.beginPath(); g.arc(0, 0, 4, 0, TAU);
  g.fillStyle = c;
  g.fill();
}

export function paintTurret(g: G, glow: boolean): void {
  const c = '#62ecd2';
  for (const [x, y] of [[-10, -10], [10, -10], [-10, 10], [10, 10]] as const) line(g, alpha(c, 0.7), 2, 0, 0, x, y);
  poly(g, 11, 8, Math.PI / 8);
  hull(g, c, glow, '#10232a');
  core(g, 0, 0, 3.5, c, glow);
}

/** Ствол турели (вращается отдельно). */
export function paintTurretGun(g: G): void {
  rect(g, 0, -3, 16, 6, '#1b3a40', '#62ecd2');
  rect(g, 14, -3.5, 3, 7, '#62ecd2');
}

export function paintScrap(g: G, size: number, glow: boolean): void {
  const c = '#ffc163';
  if (glow) { g.shadowColor = c; g.shadowBlur = 6; }
  // шестигранная гайка
  poly(g, size, 6, Math.PI / 6);
  g.fillStyle = '#8a5a1e';
  g.fill();
  g.strokeStyle = c;
  g.lineWidth = 1.2;
  g.stroke();
  g.shadowBlur = 0;
  g.beginPath(); g.arc(0, 0, size * 0.42, 0, TAU);
  g.fillStyle = '#2a1a08';
  g.fill();
}

export function paintPickup(g: G, kind: 'heal' | 'energy', glow: boolean): void {
  const c = kind === 'heal' ? '#62ecd2' : '#b4a0ff';
  if (glow) { g.shadowColor = c; g.shadowBlur = 14; }
  poly(g, 12, 4, Math.PI / 4);
  g.fillStyle = c;
  g.fill();
  g.shadowBlur = 0;
  poly(g, 9, 4, Math.PI / 4);
  g.strokeStyle = '#ffffff88';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#0b1b20';
  if (kind === 'heal') { g.fillRect(-6, -2, 12, 4); g.fillRect(-2, -6, 4, 12); }
  else pts(g, [[1, -7], [-5, 1], [0, 1], [-1, 7], [5, -1], [0, -1]]), g.fill();
}

/** Вражеская мина: шипастая сфера цвета опасности (не путать с зелёными аптечками). */
export function paintEnemyMine(g: G, glow: boolean): void {
  const c = '#ff5a4a';
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    const r = i % 2 ? 7 : 12;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  hull(g, c, glow, '#2a0f0c', 1.6);
  g.beginPath();
  g.arc(0, 0, 4.5, 0, Math.PI * 2);
  g.fillStyle = '#1a0806';
  g.fill();
}

export function paintMine(g: G, glow: boolean): void {
  const c = '#ffd166';
  poly(g, 8, 6);
  hull(g, c, glow, '#2a2510', 1.5);
  core(g, 0, 0, 2.5, c, glow);
}
