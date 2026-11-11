/**
 * Процедурный звук через WebAudio (перенесён из прототипа: tone + noise).
 * Все звуки идут через шину sfx → master, чтобы громкость регулировалась настройками.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  muted = false;
  private vol = { music: 0.5, sfx: 0.8 };
  /** Вызывается после создания контекста (запуск эмбиента). */
  onReady: ((e: AudioEngine) => void) | null = null;

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
        this.music = ctx.createGain();
        this.music.connect(this.master);
        this.applyVolumes();
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buf;
        this.onReady?.(this);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* аудио недоступно — игра продолжает работать без звука */
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (!m) this.init();
    this.applyVolumes();
  }

  setVolumes(music: number, sfx: number): void {
    this.vol = { music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.sfx || !this.music) return;
    const t0 = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(this.muted ? 0 : this.vol.sfx, t0, 0.02);
    this.music.gain.setTargetAtTime(this.muted ? 0 : this.vol.music * 0.6, t0, 0.05);
  }

  /** Общий буфер шума (для эмбиента). */
  get noise_(): AudioBuffer | null {
    return this.noiseBuffer;
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
