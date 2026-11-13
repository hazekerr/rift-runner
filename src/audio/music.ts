import type { AudioEngine } from './engine';

/**
 * Процедурный эмбиент — тихий фон, а не трек. Отзыв v1.1: прежний пад из расстроенных пил с квадратным
 * пульсом 120 BPM утомлял за пару волн. Теперь: мягкий аккорд из синусов и треугольника (ля-минор,
 * без биений), закрытый фильтр и едва слышный «ветер разлома». Интенсивность 0..1 лишь чуть открывает
 * фильтр и поднимает ветер — без ритма и без резких частот. По умолчанию музыка выключена (настройки).
 */
export class Ambient {
  private nodes: { filter: BiquadFilterNode; noiseGain: GainNode; pad: GainNode } | null = null;
  private intensity = 0;

  start(engine: AudioEngine): void {
    const ctx = engine.ctx;
    const out = engine.music;
    if (!ctx || !out || this.nodes) return;
    const pad = ctx.createGain();
    pad.gain.value = 0.12;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.5;
    // A1, A2, C3, E3: мягкий минорный аккорд, без расстройки (нет биений)
    for (const [f, type, g] of [[55, 'sine', 0.8], [110, 'triangle', 0.25], [130.81, 'sine', 0.18], [164.81, 'sine', 0.14]] as const) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      og.gain.value = g;
      o.connect(og);
      og.connect(filter);
      o.start();
    }
    filter.connect(pad);
    pad.connect(out);
    // очень медленное «дыхание» громкости (≈ 14 с), без ритма
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(pad.gain);
    lfo.start();
    // ветер разлома: шум через низкий полосовой фильтр, на грани слышимости
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.008;
    const buf = engine.noise_;
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 400;
      bp.Q.value = 0.7;
      src.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(out);
      src.start();
    }
    this.nodes = { filter, noiseGain, pad };
  }

  /** Плавно сменить интенсивность (вызывать раз в кадр). */
  setIntensity(engine: AudioEngine, v: number): void {
    const n = this.nodes;
    const ctx = engine.ctx;
    if (!n || !ctx) return;
    const target = Math.max(0, Math.min(1, v));
    if (Math.abs(target - this.intensity) < 0.02) return;
    this.intensity = target;
    const t0 = ctx.currentTime;
    n.filter.frequency.setTargetAtTime(420 + target * 380, t0, 1.5);
    n.noiseGain.gain.setTargetAtTime(0.008 + target * 0.012, t0, 1.5);
  }
}
