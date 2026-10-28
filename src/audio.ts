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

  private noise(bus: Bus, dur: number, filterHz: number, q: number, peak: number, rate = 1): void {
    if (!this.ensure() || !this.ctx || !this.bus || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = rate;
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
  // v0.04: every step a little different, pitched ±12% (the noise plays faster or slower, and the filter follows).
  lastStepPitch = 1;
  footstep(): void {
    const k = this.lastStepPitch = 0.88 + Math.random() * 0.24;
    this.noise('sfx', 0.09 / k, (900 + Math.random() * 300) * k, 1.2, 0.3 + Math.random() * 0.1, k);
  }
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

  // §6.1 song: the music box plays an arpeggio of the song's chord line on the Music bus.
  // Returns the number of notes scheduled (0 when audio is unavailable).
  arpeggio(chordLine: string): number {
    if (!this.ensure() || !this.ctx || !this.bus) return 0;
    const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const chords = chordLine.split(/\s+/).map((c) => /^([A-G])([#b]?)(m?)/.exec(c)).filter((m): m is RegExpExecArray => !!m);
    const t0 = this.ctx.currentTime + 0.05;
    let n = 0;
    chords.forEach((m, ci) => {
      const root = 60 + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
      const tones = [root, root + (m[3] ? 3 : 4), root + 7, root + 12];
      tones.forEach((midi, i) => {
        const t = t0 + ci * 0.8 + i * 0.18;
        const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
        o.type = 'triangle';
        o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g).connect(this.bus!.music);
        o.start(t); o.stop(t + 0.65);
        n++;
      });
    });
    return n;
  }

  // B11 bard tunes: play an 8-step pattern (bitmask per step over `pitches`, MIDI) on the Music bus.
  // `loops` repeats it; returns the scheduled length in seconds (0 when audio is unavailable).
  tune(steps: number[], pitches: number[], instrument: 'lute' | 'flute' | 'bells', bpm: number, loops = 1): number {
    if (!this.ensure() || !this.ctx || !this.bus) return 0;
    const step = 60 / bpm / 2, t0 = this.ctx.currentTime + 0.05;
    const shape: Record<string, { type: OscillatorType; attack: number; decay: number; gain: number }> = {
      lute: { type: 'triangle', attack: 0.005, decay: 0.55, gain: 0.22 },
      flute: { type: 'sine', attack: 0.06, decay: step * 1.6, gain: 0.2 },
      bells: { type: 'square', attack: 0.002, decay: 0.9, gain: 0.07 },
    };
    const sh = shape[instrument] ?? shape.lute;
    for (let l = 0; l < loops; l++) steps.forEach((mask, i) => {
      pitches.forEach((midi, r) => {
        if (!(mask & (1 << r))) return;
        const t = t0 + (l * steps.length + i) * step;
        const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
        o.type = sh.type;
        o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(sh.gain, t + sh.attack);
        g.gain.exponentialRampToValueAtTime(0.001, t + sh.attack + sh.decay);
        o.connect(g).connect(this.bus!.music);
        o.start(t); o.stop(t + sh.attack + sh.decay + 0.05);
      });
    });
    return loops * steps.length * step;
  }

  // PLACEHOLDER: not wired to a trigger yet (F4/F6 not built). Kept here so those versions
  // only need to call these, not build the synth — see docs/assumptions.md #30.
  crossbowTwang(): void { this.noise('sfx', 0.18, 1600, 4, 0.4); }
  reloadClick(): void { this.noise('sfx', 0.05, 3000, 6, 0.3); }
  goblinMurmur(): void { this.noise('sfx', 0.3, 400, 1, 0.25); }
}

export const audio = new AudioEngine();
