/**
 * Процедурный звук через WebAudio (перенесён из прототипа: tone + noise).
 * Все звуки идут через шину sfx → master, чтобы громкость регулировалась настройками.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private master: GainNode | null = null;
  sfx: GainNode | null = null;
  muted = false;

  /** Вызывать из обработчика жеста пользователя (анлок аудио в браузере). */
  init(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.connect(ctx.destination);
        this.sfx = ctx.createGain();
        this.sfx.connect(this.master);
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buf;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* аудио недоступно — игра продолжает работать без звука */
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (!m) this.init();
  }

  tone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.05, end = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || this.muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (end) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + duration);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      o.connect(g);
      g.connect(this.sfx);
      o.start();
      o.stop(t0 + duration);
    } catch {
      /* игнор */
    }
  }

  noise(vol = 0.08, dur = 0.09): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.noiseBuffer || this.muted) return;
    try {
      const s = ctx.createBufferSource();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      const t0 = ctx.currentTime;
      s.buffer = this.noiseBuffer;
      f.type = 'lowpass';
      f.frequency.value = 2000;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.sfx);
      s.start();
      s.stop(t0 + dur);
    } catch {
      /* игнор */
    }
  }
}
