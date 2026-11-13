/**
 * Иконки для интерфейса (магазин, арсенал, HUD, уровни, статы) в стиле «детальный неон».
 * Рисуются кодом один раз и кешируются как data-URL (вставляются через <img>).
 * Оружие — тот же силуэт, что на орбите (WEAPON_ART); модули и статы — неоновые пиктограммы.
 */
import { ENEMY_ART, WEAPON_ART, paintEnemyMine, paintSawDisc, paintShieldPlate } from '../render/sprites';
import { ENEMIES, type EnemyType } from '../content/enemies';
import { RARITY_COLOR } from '../content/levelups';
import { moduleById } from '../content/modules';
import type { EffectKind } from '../content/modules';
import type { StatId } from '../content/stats';
import { weaponById } from '../content/weapons';
import { h } from './dom';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const cache = new Map<string, string>();

/** Нарисовать иконку 48×48 (логических px) в data-URL. */
function render(key: string, paint: (g: G) => void): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const scale = 2;
  const c = document.createElement('canvas');
  c.width = c.height = 48 * scale;
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paint(g);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

function frame(g: G, color: string): void {
  g.fillStyle = '#0b1318';
  g.fillRect(1, 1, 46, 46);
  g.strokeStyle = color;
  g.globalAlpha = 0.55;
  g.lineWidth = 1;
  g.strokeRect(1.5, 1.5, 45, 45);
  g.globalAlpha = 1;
  // уголки как у рамки терминала
  g.lineWidth = 2;
  for (const [x, y, sx, sy] of [[1, 1, 1, 1], [47, 1, -1, 1], [1, 47, 1, -1], [47, 47, -1, -1]] as const) {
    g.beginPath();
    g.moveTo(x + sx * 8, y);
    g.lineTo(x, y);
    g.lineTo(x, y + sy * 8);
    g.stroke();
  }
}

/** Неоновая обводка с вшитым свечением. */
function neon(g: G, color: string, w = 2.2): void {
  g.shadowColor = color;
  g.shadowBlur = 6;
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
  g.shadowBlur = 0;
}
function fillNeon(g: G, color: string): void {
  g.shadowColor = color;
  g.shadowBlur = 6;
  g.fillStyle = color;
  g.fill();
  g.shadowBlur = 0;
}

// ---------- пиктограммы (центр 24,24) ----------

const PICTO: Record<string, (g: G, c: string) => void> = {
  // статы
  maxHp(g, c) { g.beginPath(); g.moveTo(24, 36); g.bezierCurveTo(8, 26, 10, 12, 18, 13); g.bezierCurveTo(22, 13, 24, 17, 24, 18); g.bezierCurveTo(24, 17, 26, 13, 30, 13); g.bezierCurveTo(38, 12, 40, 26, 24, 36); neon(g, c); g.beginPath(); g.rect(22, 18, 4, 10); g.rect(19, 21, 10, 4); fillNeon(g, c); },
  regen(g, c) { g.beginPath(); g.arc(24, 24, 11, -0.4, Math.PI * 1.5); neon(g, c); g.beginPath(); g.moveTo(31, 9); g.lineTo(35, 15); g.lineTo(28, 15); g.closePath(); fillNeon(g, c); g.beginPath(); g.rect(22, 18, 4, 12); g.rect(18, 22, 12, 4); fillNeon(g, c); },
  lifesteal(g, c) { g.beginPath(); g.moveTo(24, 10); g.bezierCurveTo(30, 20, 34, 24, 34, 29); g.arc(24, 29, 10, 0, Math.PI); g.bezierCurveTo(14, 24, 18, 20, 24, 10); neon(g, c); g.beginPath(); g.arc(21, 29, 2.5, 0, TAU); fillNeon(g, c); },
  damage(g, c) { g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16; const r = i % 2 ? 7 : 15; g.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); } g.closePath(); neon(g, c); g.beginPath(); g.arc(24, 24, 4, 0, TAU); fillNeon(g, c); },
  meleeDmg(g, c) { g.beginPath(); g.moveTo(12, 36); g.lineTo(32, 16); g.lineTo(36, 12); g.lineTo(34, 18); g.lineTo(14, 38); g.closePath(); neon(g, c); g.beginPath(); g.moveTo(10, 30); g.lineTo(18, 38); neon(g, c, 3); },
  rangedDmg(g, c) { g.beginPath(); g.moveTo(10, 24); g.lineTo(28, 19); g.lineTo(38, 24); g.lineTo(28, 29); g.closePath(); neon(g, c); for (const y of [17, 31]) { g.beginPath(); g.moveTo(8, y); g.lineTo(16, y); neon(g, c, 1.5); } },
  energyDmg(g, c) { g.beginPath(); g.moveTo(27, 8); g.lineTo(15, 26); g.lineTo(23, 26); g.lineTo(20, 40); g.lineTo(33, 20); g.lineTo(25, 20); g.closePath(); fillNeon(g, c); },
  atkSpeed(g, c) { for (const x of [12, 22]) { g.beginPath(); g.moveTo(x, 13); g.lineTo(x + 10, 24); g.lineTo(x, 35); neon(g, c, 3); } },
  crit(g, c) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8 - Math.PI / 2; const r = i % 2 ? 6 : 16; g.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); } g.closePath(); fillNeon(g, c); },
  range(g, c) { for (const r of [14, 9, 4]) { g.beginPath(); g.arc(24, 24, r, 0, TAU); neon(g, c, 1.8); } g.beginPath(); g.moveTo(24, 6); g.lineTo(24, 12); g.moveTo(24, 36); g.lineTo(24, 42); g.moveTo(6, 24); g.lineTo(12, 24); g.moveTo(36, 24); g.lineTo(42, 24); neon(g, c, 1.5); },
  armor(g, c) { g.beginPath(); g.moveTo(24, 9); g.lineTo(37, 14); g.lineTo(35, 28); g.quadraticCurveTo(31, 36, 24, 40); g.quadraticCurveTo(17, 36, 13, 28); g.lineTo(11, 14); g.closePath(); neon(g, c); g.beginPath(); g.moveTo(24, 15); g.lineTo(24, 34); neon(g, c, 1.5); },
  dodge(g, c) { g.globalAlpha = 0.35; g.beginPath(); g.moveTo(18, 12); g.lineTo(28, 24); g.lineTo(18, 36); g.lineTo(8, 24); g.closePath(); neon(g, c, 1.5); g.globalAlpha = 1; g.beginPath(); g.moveTo(28, 12); g.lineTo(38, 24); g.lineTo(28, 36); g.lineTo(18, 24); g.closePath(); neon(g, c); },
  speed(g, c) { g.beginPath(); g.moveTo(14, 16); g.lineTo(36, 24); g.lineTo(14, 32); g.lineTo(20, 24); g.closePath(); neon(g, c); for (const y of [20, 28]) { g.beginPath(); g.moveTo(6, y); g.lineTo(12, y); neon(g, c, 1.5); } },
  luck(g, c) { for (const [x, y] of [[24, 17], [17, 24], [31, 24], [24, 31]] as const) { g.beginPath(); g.arc(x, y, 6, 0, TAU); neon(g, c, 1.8); } g.beginPath(); g.moveTo(26, 30); g.quadraticCurveTo(30, 38, 34, 40); neon(g, c, 1.8); },
  harvest(g, c) { g.beginPath(); for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; const r = i % 2 ? 11 : 15; g.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); } g.closePath(); neon(g, c); g.beginPath(); g.arc(24, 24, 5, 0, TAU); neon(g, c, 1.8); },
  magnet(g, c) { g.beginPath(); g.arc(24, 22, 10, Math.PI, 0); g.lineTo(34, 34); g.moveTo(14, 22); g.lineTo(14, 34); neon(g, c, 4); g.fillStyle = '#eef3ed'; g.fillRect(11, 32, 6, 4); g.fillRect(31, 32, 6, 4); },
  // эффекты модулей
  killExplode(g, c) { PICTO.damage!(g, c); for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; g.beginPath(); g.moveTo(24 + Math.cos(a) * 17, 24 + Math.sin(a) * 17); g.lineTo(24 + Math.cos(a) * 21, 24 + Math.sin(a) * 21); neon(g, c, 1.5); } },
  dashNova(g, c) { PICTO.speed!(g, c); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; g.beginPath(); g.arc(24 + Math.cos(a) * 18, 24 + Math.sin(a) * 18, 1.6, 0, TAU); fillNeon(g, c); } },
  waveShield(g, c) { PICTO.armor!(g, c); g.setLineDash([3, 3]); g.beginPath(); g.arc(24, 24, 19, 0, TAU); neon(g, c, 1.2); g.setLineDash([]); },
  hurtNova(g, c) { g.beginPath(); g.arc(24, 24, 7, 0, TAU); neon(g, c); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; g.beginPath(); g.moveTo(24 + Math.cos(a) * 10, 24 + Math.sin(a) * 10); g.lineTo(24 + Math.cos(a) * 18, 24 + Math.sin(a) * 18); neon(g, c, 2.4); } },
  burn(g, c) { g.beginPath(); g.moveTo(24, 8); g.bezierCurveTo(30, 18, 36, 22, 34, 31); g.arc(24, 31, 10, 0, Math.PI); g.bezierCurveTo(12, 24, 20, 20, 24, 8); neon(g, c); g.beginPath(); g.moveTo(24, 22); g.bezierCurveTo(28, 28, 29, 31, 27, 34); g.arc(24, 34, 3.5, 0, Math.PI); g.closePath(); fillNeon(g, c); },
  slow(g, c) { for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; g.beginPath(); g.moveTo(24 - Math.cos(a) * 15, 24 - Math.sin(a) * 15); g.lineTo(24 + Math.cos(a) * 15, 24 + Math.sin(a) * 15); neon(g, c); } g.beginPath(); g.arc(24, 24, 3, 0, TAU); fillNeon(g, c); },
  scrapHeal(g, c) { PICTO.harvest!(g, c); g.beginPath(); g.rect(22.5, 19, 3, 10); g.rect(19, 22.5, 10, 3); fillNeon(g, '#62ecd2'); },
  energyOnKill(g, c) { PICTO.energyDmg!(g, c); g.beginPath(); g.arc(24, 24, 18, 0, TAU); neon(g, c, 1.2); },
  lowHpDmg(g, c) { PICTO.maxHp!(g, c); g.beginPath(); g.moveTo(26, 13); g.lineTo(22, 22); g.lineTo(27, 25); g.lineTo(23, 34); neon(g, '#ff6d65', 1.8); },
  critArc(g, c) { PICTO.crit!(g, c); g.beginPath(); g.moveTo(36, 10); g.lineTo(31, 17); g.lineTo(35, 18); g.lineTo(30, 26); neon(g, '#8fd8ff', 1.8); },
  zap(g, c) { g.beginPath(); g.rect(19, 28, 10, 10); neon(g, c); g.beginPath(); g.moveTo(24, 28); g.lineTo(24, 18); neon(g, c); g.beginPath(); g.moveTo(24, 16); g.lineTo(16, 10); g.lineTo(20, 9); g.lineTo(12, 4); neon(g, '#8fd8ff', 1.6); g.beginPath(); g.moveTo(24, 16); g.lineTo(32, 10); g.lineTo(28, 9); g.lineTo(36, 4); neon(g, '#8fd8ff', 1.6); },
  dashReset(g, c) { g.beginPath(); g.arc(24, 24, 12, 0.3, Math.PI * 1.7); neon(g, c); g.beginPath(); g.moveTo(34, 14); g.lineTo(37, 22); g.lineTo(29, 20); g.closePath(); fillNeon(g, c); g.beginPath(); g.moveTo(19, 19); g.lineTo(29, 24); g.lineTo(19, 29); neon(g, c, 2); },
  scrapOnKill(g, c) { PICTO.harvest!(g, c); g.beginPath(); g.rect(33, 8, 3, 10); g.rect(29.5, 11.5, 10, 3); fillNeon(g, c); },
  dashPlus(g, c) { PICTO.speed!(g, c); g.beginPath(); g.rect(33, 6, 3, 11); g.rect(29, 10, 11, 3); fillNeon(g, c); },
  pulseBoost(g, c) { g.beginPath(); g.arc(24, 24, 5, 0, TAU); fillNeon(g, c); for (const r of [11, 17]) { g.beginPath(); g.arc(24, 24, r, 0, TAU); neon(g, c, r === 11 ? 2 : 1.4); } },
  killHeal(g, c) { PICTO.maxHp!(g, c); g.beginPath(); g.arc(24, 24, 19, 0, TAU); neon(g, c, 1.2); },
  execute(g, c) { g.beginPath(); g.arc(24, 24, 13, 0, TAU); neon(g, c); g.beginPath(); g.moveTo(24, 6); g.lineTo(24, 42); g.moveTo(6, 24); g.lineTo(42, 24); neon(g, c, 1.5); g.beginPath(); g.moveTo(18, 18); g.lineTo(30, 30); g.moveTo(30, 18); g.lineTo(18, 30); neon(g, '#ff6d65', 2.4); },
};

const STAT_COLOR: Partial<Record<StatId, string>> = {
  maxHp: '#62ecd2', regen: '#5fe0a0', lifesteal: '#ff6d8a', damage: '#ff7547', meleeDmg: '#eef3ed', rangedDmg: '#ffb86a',
  energyDmg: '#8fd8ff', atkSpeed: '#ffd166', crit: '#ffd166', range: '#b4a0ff', armor: '#8fb8c8', dodge: '#9fe8ff',
  speed: '#72e8d2', luck: '#9be26b', harvest: '#ffc163', magnet: '#ff8fb8',
};

export function statIconUrl(stat: StatId): string {
  return render(`stat:${stat}`, (g) => PICTO[stat]?.(g, STAT_COLOR[stat] ?? '#eef3ed'));
}

export function moduleIconUrl(id: string): string {
  const def = moduleById(id);
  const color = RARITY_COLOR[def.rarity]!;
  const kind: EffectKind | StatId = def.effect?.kind ?? def.mods[0]?.stat ?? 'damage';
  const tint = def.effect ? color : STAT_COLOR[kind as StatId] ?? color;
  return render(`mod:${id}`, (g) => {
    frame(g, color);
    PICTO[kind]?.(g, tint);
  });
}

export function weaponIconUrl(id: string, tier = 0): string {
  const def = weaponById(id);
  const tierColor = tier ? RARITY_COLOR[tier - 1]! : def.color;
  return render(`wpn:${id}:${tier}`, (g) => {
    frame(g, tierColor);
    g.save();
    if (def.kind === 'orbit') {
      g.translate(24, 24);
      g.scale(1.4, 1.4);
      if (def.blockBullets) { g.translate(4, 0); paintShieldPlate(g, def.color, true); } else paintSawDisc(g, def.color, true);
    } else {
      // силуэт оружия (ствол вдоль +x) по диагонали, масштаб ×1.7
      g.translate(14, 33);
      g.rotate(-Math.PI / 4.5);
      g.scale(1.7, 1.7);
      WEAPON_ART[id]?.(g, def.color, true);
    }
    g.restore();
  });
}

/** <img> иконки заданного размера (CSS px). */
export function iconImg(url: string, size: number, cls = 'icon'): HTMLImageElement {
  const img = h('img', cls);
  img.src = url;
  img.width = size;
  img.height = size;
  img.alt = '';
  img.draggable = false;
  return img;
}

/** Иконка врага для брифинга: тот же рисунок, что и в игре. */
export function enemyIconUrl(type: EnemyType): string {
  const def = ENEMIES[type];
  return render(`en:${type}`, (g) => {
    g.translate(24, 24);
    ENEMY_ART[type]?.(g, 13, def.color, true);
  });
}

/** Иконка вражеской мины для брифинга. */
export function enemyMineIconUrl(): string {
  return render('en:mine', (g) => { g.translate(24, 24); g.scale(1.3, 1.3); paintEnemyMine(g, true); });
}

/** Иконка брифинга о способностях. */
export function abilityIconUrl(): string {
  return render('ability', (g) => PICTO.pulseBoost!(g, '#62ecd2'));
}
