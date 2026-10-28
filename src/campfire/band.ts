import type { BandNote, PlayKind } from '../audio';

// v0.05 §4.2: the campfire song, split into stems. Four bars (C, Am, F, G) at 84 bpm, looping. Each instrument
// carries one part; nobody's part is the whole song. You pick one instrument and the camp plays the rest.
const CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];   // root, third, fifth
const bars = (f: (ch: number[], bar: number) => BandNote[]) => CHORDS.flatMap((ch, b) => f(ch, b).map((n) => ({ ...n, beat: n.beat + b * 4 })));

export const STEMS: Record<PlayKind, BandNote[]> = {
  // Lute: the strummed chord backdrop (down on 1, a quick down-up on 3).
  lute: bars((ch) => [0, 2, 2.5, 3].flatMap((beat) => [...ch, ch[0] + 12].map((m, k) => ({ beat: beat + k * 0.02, midi: m + 12, len: 0, vel: beat ? 0.7 : 1 })))),
  // Hand drum: low on 1 and the "and" of 2, a high slap on 4.
  drum: bars(() => [{ beat: 0, midi: 55, len: 0 }, { beat: 1.5, midi: 55, len: 0, vel: 0.7 }, { beat: 2, midi: 55, len: 0 }, { beat: 3, midi: 64, len: 0, vel: 0.8 }]),
  // Clapping and stomping: the backbeat on 2 and 4.
  clap: bars(() => [{ beat: 1, midi: 60, len: 0 }, { beat: 3, midi: 60, len: 0 }]),
  // Humming: the chord's third, held two beats at a time (a low vocal pad).
  hum: bars((ch) => [{ beat: 0, midi: ch[1] + 12, len: 1.8 }, { beat: 2, midi: ch[2] + 12, len: 1.8 }]),
  // Violin: one long bowed note per bar, the fifth an octave up.
  violin: bars((ch) => [{ beat: 0, midi: ch[2] + 12, len: 3.6, vel: 0.9 }]),
  // Whistling: the call, in bars 1 and 3.
  whistle: bars((ch, b) => b % 2 ? [] : [{ beat: 0, midi: ch[0] + 12, len: 0 }, { beat: 0.5, midi: ch[1] + 12, len: 0 }, { beat: 1, midi: ch[2] + 12, len: 0 }, { beat: 2, midi: ch[1] + 12, len: 0 }]),
  // Ocarina: the answer, in bars 2 and 4, long breathy notes.
  ocarina: bars((ch, b) => b % 2 ? [{ beat: 0, midi: ch[2] + 12, len: 1.4 }, { beat: 2, midi: ch[1] + 12, len: 1.8 }] : []),
};
