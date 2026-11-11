import type { SfxId } from '../sim/events';
import type { AudioEngine } from './engine';

/**
 * Банк звуков: SfxId → патч. Чтобы заменить процедурный звук сэмплом,
 * достаточно подменить запись в PATCHES (интерфейс play не меняется).
 */
type Patch = (a: AudioEngine, v?: number) => void;

const PATCHES: Record<SfxId, Patch> = {
  start: (a) => a.tone(220, 0.2, 'sine', 0.1, 660),
  reload: (a) => a.tone(350, 0.05, 'triangle', 0.045, 170),
  reloadDone: (a) => a.tone(700, 0.05, 'triangle', 0.04),
  switch: (a, v = 0) => a.tone(260 + v * 100, 0.06, 'triangle', 0.035),
  dash: (a) => a.tone(190, 0.16, 'sawtooth', 0.045, 55),
  pulse: (a) => { a.tone(110, 0.55, 'sine', 0.24, 24); a.noise(0.2, 0.18); },
  'shoot.pulse': (a) => { a.tone(200, 0.06, 'square', 0.018, 65); a.noise(0.025, 0.04); },
  'shoot.scatter': (a) => { a.noise(0.15, 0.14); a.tone(90, 0.15, 'sawtooth', 0.06, 30); },
  'shoot.rail': (a) => { a.tone(700, 0.15, 'sawtooth', 0.04, 90); a.noise(0.055, 0.1); },
  kill: (a) => a.noise(0.045, 0.09),
  killBoss: (a) => a.noise(0.2, 0.09),
  hurt: (a) => a.tone(65, 0.2, 'sawtooth', 0.09, 30),
  gameover: (a) => a.tone(200, 0.6, 'triangle', 0.08, 35),
  upgradeOpen: (a) => a.tone(440, 0.2, 'sine', 0.06, 880),
  upgradeTake: (a) => a.tone(400, 0.2, 'triangle', 0.07, 900),
  pickup: (a) => a.tone(700, 0.12, 'sine', 0.035, 1100),
  bossSpawn: (a) => a.tone(75, 1, 'sawtooth', 0.07, 35),
  bossVolley: (a) => a.noise(0.065, 0.08),
};

export function playSfx(engine: AudioEngine, id: SfxId, v?: number): void {
  PATCHES[id](engine, v);
}
