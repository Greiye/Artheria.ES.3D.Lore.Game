import type { LoreEntry } from '../lore';
import { entryMarkdown } from '../submit';

// B11 + B8 data: a tune (8 steps over a pentatonic scale, so any pattern sounds fine) and the ballads
// the bard makes from a campfire telling. All saved on this device.
export const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];   // C D E G A c d e
export const NOTE_NAMES = ['C', 'D', 'E', 'G', 'A', 'c', 'd', 'e'];
export const INSTRUMENTS = ['lute', 'flute', 'bells'] as const;
export type Instrument = typeof INSTRUMENTS[number];
export interface Tune { instrument: Instrument; bpm: number; steps: number[] }   // steps: bitmask over SCALE rows
export const DEFAULT_TUNE: Tune = { instrument: 'lute', bpm: 100, steps: [1, 4, 16, 4, 2, 8, 32, 1] };

export const encodeTune = (t: Tune) => `${t.instrument} ${t.bpm} ${t.steps.map((m) => m.toString(16).padStart(2, '0')).join('')}`;
export function decodeTune(s: string | undefined): Tune {
  const m = /^(lute|flute|bells) (\d{2,3}) ([0-9a-f]{16})$/.exec((s ?? '').trim());
  if (!m) return structuredClone(DEFAULT_TUNE);
  return { instrument: m[1] as Instrument, bpm: Math.max(60, Math.min(180, Number(m[2]))), steps: m[3].match(/../g)!.map((h) => parseInt(h, 16)) };
}
// A chord line for the music box (§6.1 arpeggio) from the tune's lowest note per half.
function tuneChords(t: Tune): string {
  const CH = ['C', 'Dm', 'Em', 'G', 'Am', 'C', 'Dm', 'Em'];
  const low = (mask: number) => { for (let r = 0; r < 8; r++) if (mask & (1 << r)) return r; return 0; };
  return [0, 2, 4, 6].map((i) => CH[low(t.steps[i] || t.steps[i + 1])]).join(' ');
}

export interface Telling { start: string; middle: string; end: string }
export interface Ballad { id: string; title: string; tune: string; verses: string[][]; telling: Telling; chainOf?: string; created: string }
const KEY = 'gametool.ballads';
export function loadBallads(): Ballad[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function saveBallad(b: Ballad) {
  try { localStorage.setItem(KEY, JSON.stringify([b, ...loadBallads().filter((o) => o.id !== b.id)].slice(0, 20))); } catch { /* full */ }
}

// The bard's craft, by template: split each turn into short lines, pair them into verses, add Natalie's
// couplet between turns and a refrain built from the title. Nothing is invented about the player's story.
const lines = (s: string) => s.replace(/\s+/g, ' ').trim().split(/(?<=[.!?;])\s+|,\s+(?=\w{3,})/).map((l) => l.trim().replace(/[.;,]$/, '')).filter(Boolean);
export function composeBallad(t: Telling, natalie: string[], title: string, tune: Tune, chainOf?: Ballad): Ballad {
  const cap = (l: string) => l[0].toUpperCase() + l.slice(1);
  const refrain = [`Sing it low, sing ${title.toLowerCase().replace(/^the /, 'the ')}`, 'and the road remembers'];
  const verse = (s: string) => lines(s).slice(0, 6).map(cap);
  const verses: string[][] = [];
  if (chainOf) verses.push([`Where ${chainOf.title} left off,`, cap(lines(chainOf.telling.end).slice(-1)[0] ?? 'the road went on')]);
  for (const [i, part] of [t.start, t.middle, t.end].entries()) {
    const v = verse(part);
    if (v.length) verses.push(v);
    if (natalie[i]) verses.push([`(Natalie:) ${natalie[i]}`]);
    if (i === 1) verses.push(refrain);
  }
  verses.push(refrain);
  return { id: 'bd' + Date.now().toString(36), title, tune: encodeTune(tune), verses, telling: t, chainOf: chainOf?.id, created: new Date().toISOString().slice(0, 10) };
}

function balladBody(b: Ballad): string {
  const t = decodeTune(b.tune);
  return `# ${b.title}\n\nchords: ${tuneChords(t)}\ntune: ${b.tune}\n\n${b.verses.map((v) => v.join('  \n')).join('\n\n')}\n`;
}
export function balladEntry(b: Ballad, author: string): LoreEntry {
  const body = balladBody(b);
  return { id: 'ballad:' + b.id, title: b.title, contributor: author, credit_as: author || 'you', type: 'song', tier: 'work', words: body.split(/\s+/).length,
    created: b.created, tags: ['ballad', 'campfire'], replyTo: [], links_out: [], links_in: [], dedications: [], body };
}
export function balladMarkdown(b: Ballad, author: string): string {
  return entryMarkdown({ title: b.title, author, type: 'song', tags: ['ballad', 'campfire'], body: balladBody(b), extra: { tune: b.tune } });
}
