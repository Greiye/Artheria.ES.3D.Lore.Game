// A7: WebAudio-synthesized SFX — no audio files, matching A2/D6's no-external-assets approach.
// F1.2: four buses (Master/Music/SFX/Dialogue), each exactly one GainNode, 0-100 + mute.
// Browsers require a user gesture before an AudioContext makes sound, so resume() is called
// from the title screen's "Click to begin" handler.
export type Bus = 'master' | 'music' | 'sfx' | 'dialogue';
export type PlayKind = 'hum' | 'clap' | 'whistle' | 'drum' | 'lute' | 'violin' | 'ocarina';
/** v0.05 band: one note of a stem, at `beat` (0–15) of the 4-bar loop, `len` beats long. */
export interface BandNote { beat: number; midi: number; len: number; vel?: number }
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

  // ---------- v0.06 T3: positional audio ----------
  // Every in-world sound goes through a PannerNode at its world position: linear falloff from 1 m to `range`
  // (silent past it) and equal-power stereo panning by side. UI sounds (blips, the jingle, page turns, your own
  // footsteps) stay 2D. The listener sits at the player's eyes, facing where the camera looks.
  readonly listener = { x: 0, y: 1.7, z: 0, fx: 0, fz: -1 };
  /** Every positional source made so far (for tests and the debug overlay): name, where, how far it carries. */
  readonly sources: { name: string; x: number; y: number; z: number; range: number; panner: PannerNode | null }[] = [];
  setListener(x: number, y: number, z: number, fx: number, fz: number): void {
    const L = this.listener; L.x = x; L.y = y; L.z = z;
    const n = Math.hypot(fx, fz) || 1; L.fx = fx / n; L.fz = fz / n;
    const l = this.ctx?.listener;
    if (!l) return;
    if (l.positionX) {
      const t = this.ctx!.currentTime;
      l.positionX.setTargetAtTime(x, t, 0.03); l.positionY.setTargetAtTime(y, t, 0.03); l.positionZ.setTargetAtTime(z, t, 0.03);
      l.forwardX.setTargetAtTime(L.fx, t, 0.03); l.forwardY.setTargetAtTime(0, t, 0.03); l.forwardZ.setTargetAtTime(L.fz, t, 0.03);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {   // older Safari
      (l as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
      (l as unknown as { setOrientation(...a: number[]): void }).setOrientation(L.fx, 0, L.fz, 0, 1, 0);
    }
  }
  /** How loud a source at (x, y, z) with this range is for the listener now: the PannerNode's linear model. */
  gainAt(x: number, y: number, z: number, range: number): number {
    const L = this.listener, d = Math.hypot(x - L.x, y - L.y, z - L.z);
    return d <= 1 ? 1 : Math.max(0, 1 - (d - 1) / Math.max(0.01, range - 1));
  }
  /** -1 (left) … 1 (right): where the source sits for the listener. */
  panAt(x: number, z: number): number {
    const L = this.listener, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz) || 1;
    return (dx * -L.fz + dz * L.fx) / d;
  }
  /** A positional input on `bus`: connect a sound to the returned node. Null when there's no WebAudio. */
  spatial(name: string, x: number, y: number, z: number, range: number, bus: Bus = 'sfx'): AudioNode | null {
    if (!this.ensure() || !this.ctx || !this.bus) return null;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'linear';
    p.refDistance = 1; p.maxDistance = range; p.rolloffFactor = 1;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
    else (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
    p.connect(this.bus[bus]);
    const known = this.sources.find((q) => q.name === name);
    if (known) Object.assign(known, { x, y, z, range, panner: p });
    else this.sources.push({ name, x, y, z, range, panner: p });
    return p;
  }
  /** Route a <video>/<audio> element's sound through a positional node (the cinema's reels). */
  attachMedia(el: HTMLMediaElement, name: string, x: number, y: number, z: number, range: number): boolean {
    const out = this.spatial(name, x, y, z, range, 'music');
    if (!out || !this.ctx) return false;
    try { this.ctx.createMediaElementSource(el).connect(out); return true; } catch { return false; }
  }

  private noise(bus: Bus, dur: number, filterHz: number, q: number, peak: number, rate = 1, out?: AudioNode): void {
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
    src.connect(filt).connect(env).connect(out ?? this.bus[bus]);
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
  tune(steps: number[], pitches: number[], instrument: 'lute' | 'flute' | 'bells', bpm: number, loops = 1, out?: AudioNode | null): number {
    if (!this.ensure() || !this.ctx || !this.bus) return 0;
    const dest = out ?? this.bus.music;
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
        o.connect(g).connect(dest);
        o.start(t); o.stop(t + sh.attack + sh.decay + 0.05);
      });
    });
    return loops * steps.length * step;
  }

  // v0.04 campfire instruments: one note (or hit) on the chosen instrument, on the Music bus. `lastPlayed` is for tests.
  lastPlayed: { kind: PlayKind; midi: number } | null = null;
  play(kind: PlayKind, midi = 67, out?: AudioNode | null): boolean {
    this.lastPlayed = { kind, midi };
    if (!this.ensure() || !this.ctx) return false;
    this.voice(kind, midi, this.ctx.currentTime + 0.01, 0, 1, out ?? undefined);
    return true;
  }
  // One note at time `t`. `len` (seconds) holds the sustained voices (violin, ocarina, hum); 0 = their natural length.
  private voice(kind: PlayKind, midi: number, t: number, len: number, vel: number, dest?: AudioNode): void {
    const ctx = this.ctx!, out = dest ?? this.bus!.music;
    if (kind === 'drum' || kind === 'clap') {
      const hit = (dur: number, hz: number, q: number, peak: number, rate = 1) => {
        const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = rate;
        f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = q;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak * vel, t + dur * 0.15); g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(f).connect(g).connect(out); src.start(t); src.stop(t + dur + 0.02);
      };
      if (kind === 'drum') hit(0.22, 140 + (midi - 60) * 6, 2, 0.9, 0.6);
      else { hit(0.08, 1800, 1.5, 0.6); hit(0.12, 120, 1, 0.5, 0.5); }   // a clap and a stomp
      return;
    }
    const shape: Record<string, { type: OscillatorType; attack: number; decay: number; gain: number; vib: number; oct: number; lp?: number }> = {
      hum: { type: 'sine', attack: 0.08, decay: 0.7, gain: 0.22, vib: 4, oct: -12 },
      whistle: { type: 'sine', attack: 0.03, decay: 0.45, gain: 0.16, vib: 6, oct: 12 },
      lute: { type: 'triangle', attack: 0.004, decay: 0.7, gain: 0.24, vib: 0, oct: 0 },
      violin: { type: 'sawtooth', attack: 0.12, decay: 0.9, gain: 0.1, vib: 5, oct: 0, lp: 2200 },   // bowed: slow attack, a lowpass takes the buzz off
      ocarina: { type: 'sine', attack: 0.06, decay: 0.6, gain: 0.2, vib: 3, oct: 12, lp: 3000 },
    };
    const sh = shape[kind], hold = Math.max(0, len - sh.attack), end = t + sh.attack + hold + sh.decay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = sh.type;
    o.frequency.value = 440 * Math.pow(2, (midi + sh.oct - 69) / 12);
    if (sh.vib) {   // a little vibrato so a hum, a whistle or a bow sounds breathed, not beeped
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = sh.vib;
      lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(end + 0.05);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(sh.gain * vel, t + sh.attack);
    if (hold) g.gain.setValueAtTime(sh.gain * vel, t + sh.attack + hold);
    g.gain.exponentialRampToValueAtTime(0.001, end);
    let last: AudioNode = o;
    if (sh.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = sh.lp; o.connect(f); last = f; }
    last.connect(g).connect(out);
    o.start(t); o.stop(end + 0.05);
  }

  // v0.05 campfire band: the camp plays every stem of the song except yours, looping bar by bar while you sit.
  // `stems` maps each instrument to its notes over the 4-bar loop. `band.muted` is your stem (the camp leaves it
  // to you); `band.guide` plays it quietly anyway so a solo player hears the whole song. Returns a stop function.
  band = { on: false, muted: null as PlayKind | null, guide: false, kinds: [] as PlayKind[], get playing() { return this.on ? this.kinds.filter((k) => k !== this.muted) : []; } };
  playBand(stems: Partial<Record<PlayKind, BandNote[]>>, bpm = 84, out?: AudioNode | null): () => void {
    const kinds = this.band.kinds = Object.keys(stems) as PlayKind[];
    this.band.on = true;
    if (!this.ensure() || !this.ctx || !this.bus) return () => { this.band.on = false; };
    const beat = 60 / bpm, bar = beat * 4;
    let next = this.ctx.currentTime + 0.1, i = 0;
    const schedule = () => {
      const ctx = this.ctx!;
      while (next < ctx.currentTime + bar) {
        const b = i++ % 4;
        for (const k of kinds) {
          const mine = k === this.band.muted;
          if (mine && !this.band.guide) continue;
          for (const n of stems[k]!) if (n.beat >= b * 4 && n.beat < b * 4 + 4) this.voice(k, n.midi, next + (n.beat - b * 4) * beat, n.len * beat, (n.vel ?? 1) * (mine ? 0.35 : 0.55), out ?? undefined);
        }
        next += bar;
      }
    };
    schedule();
    const id = window.setInterval(schedule, 400);
    return () => { window.clearInterval(id); this.band.on = false; };
  }

  // v0.05 boot: the splash jingle (a rising open fifth and a bell on top), the title's flowing water and a menu blip.
  // Browsers keep audio locked until the first input, so on a cold load the jingle and water may stay silent
  // until then; `water()` starts as soon as it can and the title restarts it on that first input.
  jingle(): boolean {
    if (!this.ensure() || !this.ctx || !this.bus || this.ctx.state !== 'running') return false;
    const t0 = this.ctx.currentTime + 0.02;
    [[55, 0], [62, 0.12], [67, 0.24], [74, 0.36], [79, 0.5]].forEach(([midi, at], i) => {
      const o = this.ctx!.createOscillator(), g = this.ctx!.createGain(), t = t0 + at;
      o.type = i === 4 ? 'sine' : 'triangle';
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(i === 4 ? 0.16 : 0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + (i === 4 ? 1.1 : 0.5));
      o.connect(g).connect(this.bus!.music);
      o.start(t); o.stop(t + 1.2);
    });
    return true;
  }
  private waterStop: (() => void) | null = null;
  water(on: boolean): void {
    if (!on) { this.waterStop?.(); this.waterStop = null; return; }
    if (this.waterStop || !this.ensure() || !this.ctx || !this.bus || !this.noiseBuf) return;
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const lo = ctx.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 900;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.8;
    // Two slow, out-of-step wobbles make the burble of a stream rather than a steady hiss.
    const l1 = ctx.createOscillator(), g1 = ctx.createGain(); l1.frequency.value = 0.31; g1.gain.value = 260;
    const l2 = ctx.createOscillator(), g2 = ctx.createGain(); l2.frequency.value = 1.7; g2.gain.value = 120;
    l1.connect(g1).connect(bp.frequency); l2.connect(g2).connect(bp.frequency);
    const gain = ctx.createGain(); gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 2);
    src.connect(lo).connect(bp).connect(gain).connect(this.bus.sfx);
    src.start(); l1.start(); l2.start();
    this.waterStop = () => {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + 0.8);
      src.stop(t + 0.85); l1.stop(t + 0.85); l2.stop(t + 0.85);
    };
  }
  get waterOn() { return !!this.waterStop; }
  blip(): void {
    if (!this.ensure() || !this.ctx || !this.bus) return;
    const t = this.ctx.currentTime + 0.01, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(990, t + 0.08);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.bus.sfx); o.start(t); o.stop(t + 0.2);
  }

  // ---------- v0.06 T2 ambience voices (each one plays into a positional node) ----------
  /** A bird's call: two to four quick sweeping chirps. */
  chirp(out: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx, n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + 0.02 + i * (0.09 + Math.random() * 0.05), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), t);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.05);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
    }
  }
  /** Hammer on an anvil: a bright, inharmonic ring with a thud under it. */
  clang(out: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01, f0 = 820 + Math.random() * 80;
    for (const [m, a, d] of [[1, 0.16, 0.9], [2.76, 0.09, 0.5], [5.4, 0.05, 0.25]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f0 * m;
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.02);
    }
    this.noise('sfx', 0.06, 300, 1, 0.3, 0.7, out);
  }
  /** Townsfolk talking: a few syllables of voiced, wordless babble (formant-filtered buzz). */
  murmur(out: AudioNode, pitch = 1): void {
    if (!this.ctx) return;
    const ctx = this.ctx, n = 3 + Math.floor(Math.random() * 4);
    let t = ctx.currentTime + 0.02;
    for (let i = 0; i < n; i++) {
      const len = 0.09 + Math.random() * 0.12, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime((150 + Math.random() * 40) * pitch, t);
      o.frequency.linearRampToValueAtTime((130 + Math.random() * 60) * pitch, t + len);
      f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 900; f.Q.value = 4;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + len + 0.02);
      t += len + 0.03 + Math.random() * 0.08;
    }
  }
  /** A steady trickle of water into `out` (the well); returns a stop function. */
  trickle(out: AudioNode): () => void {
    if (!this.ctx || !this.noiseBuf) return () => undefined;
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 2.3; lg.gain.value = 500;
    l.connect(lg).connect(bp.frequency);
    const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1);
    src.connect(bp).connect(g).connect(out); src.start(); l.start();
    return () => { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.5); src.stop(t + 0.55); l.stop(t + 0.55); };
  }

  // PLACEHOLDER: not wired to a trigger yet (F4/F6 not built). Kept here so those versions
  // only need to call these, not build the synth — see docs/assumptions.md #30.
  crossbowTwang(): void { this.noise('sfx', 0.18, 1600, 4, 0.4); }
  reloadClick(): void { this.noise('sfx', 0.05, 3000, 6, 0.3); }
  goblinMurmur(): void { this.noise('sfx', 0.3, 400, 1, 0.25); }
}

export const audio = new AudioEngine();
