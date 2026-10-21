// A7: WebAudio-synthesized SFX — no audio files, matching A2/D6's no-external-assets approach.
// F1.2: four buses (Master/Music/SFX/Dialogue), each exactly one GainNode, 0-100 + mute.
// Browsers require a user gesture before an AudioContext makes sound, so resume() is called
// from the title screen's "Click to begin" handler.
export type Bus = 'master' | 'music' | 'sfx' | 'dialogue';
const BUSES: Bus[] = ['master', 'music', 'sfx', 'dialogue'];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private bus: Record<Bus, GainNode> | null = null;
  private noiseBuf: AudioBuffer | null = null;
  levels: Record<Bus, number> = { master: 70, music: 60, sfx: 80, dialogue: 90 };
  muted: Record<Bus, boolean> = { master: false, music: false, sfx: false, dialogue: false };
  private windGain: GainNode | null = null;

  private ensure(): boolean {
    if (this.ctx) return true;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false; // F1.2: no WebAudio support -> silently no-op, never throws
    this.ctx = new AC();
    this.bus = BUSES.reduce((acc, b) => {
      const g = this.ctx!.createGain();
      g.connect(b === 'master' ? this.ctx!.destination : acc.master);
      acc[b] = g;
      return acc;
    }, {} as Record<Bus, GainNode>);
    this.applyLevels();
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return true;
  }

  // F1.3: called once on the first user gesture (begin()); safe to call repeatedly.
  resume(): void {
    if (!this.ensure()) return;
    void this.ctx!.resume();
  }

  setLevel(b: Bus, pct: number): void { this.levels[b] = Math.max(0, Math.min(100, pct)); this.applyLevels(); }
  setMuted(b: Bus, m: boolean): void { this.muted[b] = m; this.applyLevels(); }
  private applyLevels(): void {
    if (!this.bus) return;
    for (const b of BUSES) this.bus[b].gain.value = this.muted[b] ? 0 : this.levels[b] / 100;
  }

  private noise(bus: Bus, dur: number, filterHz: number, q: number, peak: number): void {
    if (!this.ensure() || !this.ctx || !this.bus || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = filterHz; filt.Q.value = q;
    const env = this.ctx.createGain();
    const t = this.ctx.currentTime;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + dur * 0.15);
    env.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(filt).connect(env).connect(this.bus[bus]);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---------- A7 named sounds ----------
  footstep(): void { this.noise('sfx', 0.09, 900 + Math.random() * 300, 1.2, 0.35); }
  pageTurn(): void { this.noise('sfx', 0.22, 2200, 2, 0.22); }

  // Continuous ambient wind (F2.2). Idempotent: calling again while already running is a no-op.
  startWind(): void {
    if (!this.ensure() || !this.ctx || !this.bus || !this.noiseBuf || this.windGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 500;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 150;
    lfo.connect(lfoGain).connect(filt.frequency);
    const gain = this.ctx.createGain(); gain.gain.value = 0.12;
    src.connect(filt).connect(gain).connect(this.bus.sfx);
    src.start(); lfo.start();
    this.windGain = gain;
  }

  // PLACEHOLDER: not wired to a trigger yet (F4/F6 not built). Kept here so those versions
  // only need to call these, not build the synth — see docs/assumptions.md #30.
  crossbowTwang(): void { this.noise('sfx', 0.18, 1600, 4, 0.4); }
  reloadClick(): void { this.noise('sfx', 0.05, 3000, 6, 0.3); }
  goblinMurmur(): void { this.noise('sfx', 0.3, 400, 1, 0.25); }
}

export const audio = new AudioEngine();
