import type { AudioEngine } from './engine';

/**
 * Процедурный эмбиент: низкий пад из двух расстроенных пил + саб + шумовой «ветер разлома».
 * Интенсивность 0..1 (меню ≈0.1, магазин ≈0.2, бой — по числу врагов, босс — 1)
 * открывает фильтр, поднимает шум и добавляет пульс. Структура позволяет подменить на сэмпл-трек.
 */
export class Ambient {
  private nodes: { filter: BiquadFilterNode; noiseGain: GainNode; pulseGain: GainNode; lfo: OscillatorNode; pad: GainNode } | null = null;
  private intensity = 0;

  start(engine: AudioEngine): void {
    const ctx = engine.ctx;
    const out = engine.music;
    if (!ctx || !out || this.nodes) return;
    const pad = ctx.createGain();
    pad.gain.value = 0.18;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 4;
    for (const [f, type, g] of [[55, 'sawtooth', 0.5], [55.4, 'sawtooth', 0.5], [27.5, 'sine', 0.9], [82.4, 'triangle', 0.2]] as const) {
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
    // медленное «дыхание» фильтра
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    // ветер разлома: зацикленный шум через полосовой фильтр
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.02;
    const buf = engine.noise_;
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 0.8;
      src.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(out);
      src.start();
    }
    // пульс: амплитудная модуляция пада в бою
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0;
    const pulse = ctx.createOscillator();
    pulse.type = 'square';
    pulse.frequency.value = 2; // 120 BPM
    pulse.connect(pulseGain);
    pulseGain.connect(pad.gain);
    pulse.start();
    this.nodes = { filter, noiseGain, pulseGain, lfo, pad };
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
    n.filter.frequency.setTargetAtTime(300 + target * 1500, t0, 0.8);
    n.noiseGain.gain.setTargetAtTime(0.015 + target * 0.05, t0, 0.8);
    n.pulseGain.gain.setTargetAtTime(target > 0.45 ? (target - 0.45) * 0.12 : 0, t0, 0.8);
  }
}
