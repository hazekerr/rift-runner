import type { SfxId } from '../sim/events';
import type { AudioEngine } from './engine';

/**
 * Банк звуков: SfxId → патч. Чтобы заменить процедурный звук сэмплом,
 * достаточно подменить запись в PATCHES (интерфейс playSfx не меняется).
 * p — множитель высоты (рандом ±5%, чтобы очереди не звучали одним сэмплом).
 */
type Patch = (a: AudioEngine, p: number, v?: number) => void;

const PATCHES: Record<SfxId, Patch> = {
  start: (a) => a.tone(220, 0.2, 'sine', 0.1, 660),
  dash: (a, p) => a.tone(190 * p, 0.16, 'sawtooth', 0.045, 55),
  pulse: (a) => { a.tone(110, 0.55, 'sine', 0.24, 24); a.noise(0.2, 0.18); },
  'shoot.pulse': (a, p) => { a.tone(200 * p, 0.06, 'square', 0.014, 65); a.noise(0.02, 0.04); },
  'shoot.scatter': (a, p) => { a.noise(0.13, 0.14); a.tone(90 * p, 0.15, 'sawtooth', 0.05, 30); },
  'shoot.rail': (a, p) => { a.tone(700 * p, 0.15, 'sawtooth', 0.035, 90); a.noise(0.05, 0.1); },
  'shoot.nailer': (a, p) => { a.tone(900 * p, 0.03, 'square', 0.008, 400); a.noise(0.015, 0.025); },
  'shoot.arc': (a, p) => { a.tone(1300 * p, 0.09, 'sawtooth', 0.02, 2200); a.noise(0.03, 0.06); },
  swing: (a, p) => { a.noise(0.05, 0.08); a.tone(420 * p, 0.07, 'triangle', 0.025, 160); },
  kill: (a) => a.noise(0.035, 0.07),
  killElite: (a) => { a.noise(0.14, 0.15); a.tone(120, 0.25, 'sawtooth', 0.06, 40); },
  killBoss: (a) => { a.noise(0.25, 0.3); a.tone(80, 0.8, 'sawtooth', 0.09, 25); },
  hurt: (a) => a.tone(65, 0.2, 'sawtooth', 0.09, 30),
  dodge: (a) => a.tone(900, 0.08, 'sine', 0.04, 1500),
  gameover: (a) => a.tone(200, 0.6, 'triangle', 0.08, 35),
  victory: (a) => { a.tone(330, 0.3, 'triangle', 0.08, 660); a.tone(495, 0.6, 'triangle', 0.06, 990); },
  scrap: (a, p) => a.tone(1200 * p, 0.04, 'sine', 0.018, 1600),
  pickup: (a) => a.tone(700, 0.12, 'sine', 0.035, 1100),
  levelUp: (a) => { a.tone(523, 0.12, 'triangle', 0.05, 784); a.tone(784, 0.2, 'triangle', 0.04, 1046); },
  choose: (a) => a.tone(400, 0.2, 'triangle', 0.07, 900),
  reroll: (a) => a.tone(300, 0.1, 'square', 0.03, 600),
  waveEnd: (a) => a.tone(440, 0.25, 'sine', 0.06, 880),
  waveStart: (a) => a.tone(220, 0.2, 'sine', 0.06, 440),
  bossSpawn: (a) => a.tone(75, 1, 'sawtooth', 0.07, 35),
  bossVolley: (a) => a.noise(0.065, 0.08),
  bossLeave: (a) => a.tone(300, 1, 'sine', 0.07, 40),
  mineArm: (a) => a.tone(1500, 0.05, 'square', 0.015),
  mineBoom: (a) => { a.noise(0.12, 0.2); a.tone(70, 0.25, 'sine', 0.08, 30); },
  split: (a) => a.tone(600, 0.08, 'triangle', 0.03, 300),
  error: (a) => a.tone(120, 0.12, 'square', 0.04),
  'shoot.rocket': (a, p) => { a.noise(0.06, 0.12); a.tone(160 * p, 0.22, 'sawtooth', 0.03, 60); },
  'shoot.flamer': (a) => a.noise(0.02, 0.06),
  'shoot.cryo': (a, p) => a.tone(1600 * p, 0.08, 'sine', 0.02, 900),
  'shoot.mortar': (a, p) => { a.tone(140 * p, 0.12, 'triangle', 0.05, 70); a.noise(0.04, 0.06); },
  'shoot.laser': (a, p) => a.tone(1100 * p, 0.2, 'sawtooth', 0.03, 300),
  explode: (a) => { a.noise(0.1, 0.18); a.tone(80, 0.2, 'sine', 0.06, 30); },
  turretDeploy: (a) => { a.tone(500, 0.08, 'square', 0.03, 900); a.tone(900, 0.06, 'square', 0.02); },
  teleWarn: (a) => a.tone(880, 0.12, 'square', 0.025, 660),
  bossLaser: (a) => { a.tone(220, 0.45, 'sawtooth', 0.07, 110); a.noise(0.08, 0.3); },
  bossSlam: (a) => { a.noise(0.25, 0.3); a.tone(55, 0.5, 'sine', 0.12, 25); },
  synergy: (a) => { a.tone(660, 0.1, 'triangle', 0.05, 990); a.tone(990, 0.18, 'triangle', 0.04, 1320); },
  unlock: (a) => { a.tone(440, 0.15, 'triangle', 0.06, 880); a.tone(660, 0.3, 'triangle', 0.05, 1320); },
};

const recent = new Map<SfxId, number[]>();
const MAX_SAME = 3;
const WINDOW_MS = 50;

export function playSfx(engine: AudioEngine, id: SfxId, v?: number): void {
  const now = performance.now();
  const times = (recent.get(id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_SAME) return;
  times.push(now);
  recent.set(id, times);
  PATCHES[id](engine, 0.95 + Math.random() * 0.1, v);
}
