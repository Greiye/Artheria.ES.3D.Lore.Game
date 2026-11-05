// Mike 2026-11-05: the roguelike descent. The Ruined Library is in flux (the witch in the ruins): every time you go
// down, the floors are new. Rumour says it goes 30 floors deep, with a dragon's hoard on the 30th. Go as deep as you
// can; books you find are carried, and only count once you climb out and hand them to Natalie. Die down there and the
// hero is gone: bag, crowns and carried books with them (your writing, sketches, forge designs and the gallery stay).
// Reach the hoard and climb back out alive and your drawing goes up on the Inn's survivors' wall; that hero retires.
// This file is the bookkeeping and the numbers; main.ts drives the floors, src/delve/walls.ts the Inn walls.

export const FLOORS = 30;

/** Which band of goblin tricks a floor is in (Mike: "smarter and more dangerous in interesting ways"):
 *  0: 1–3 today's goblins · 1: 4–8 packs flank, cowards fetch help, more snares · 2: 9–13 slingers, pot-lid
 *  guards, the wounded back off to mend · 3: 14–19 they drop from above, douse your torch, thieves go for your
 *  books · 4: 20–24 shamans mend and hex · 5: 25–29 captains with a double blow, and they learn your habits ·
 *  6: 30 the hoard and its keepers. Each band keeps the tricks before it. */
export function band(floor: number): number {
  return floor >= 30 ? 6 : floor >= 25 ? 5 : floor >= 20 ? 4 : floor >= 14 ? 3 : floor >= 9 ? 2 : floor >= 4 ? 1 : 0;
}
export const BAND_NOTE = [
  '', 'They hunt in packs down here: they flank you.', 'Slingers, and goblins behind pot lids. The wounded back off to mend.',
  'Something moves on the shelves above. Keep your torch close, and your books closer.', 'Shamans: they mend the others and hex you.',
  'Captains lead them, and they have been watching how you fight.', 'The hoard. Something keeps it.',
];
/** The roll budget for a floor's goblins (rarer, nastier rolls deeper down). */
export const budgetFor = (floor: number) => 4 + Math.round(floor * 0.45);
/** Health and damage creep up with depth, on top of the rolls. */
export const hpMul = (floor: number) => 1 + (floor - 1) * 0.07;
export const dmgBonus = (floor: number) => Math.floor((floor - 1) / 6);
/** How many goblins a room holds. */
export function countFor(floor: number, tag: string): number {
  if (tag === 'nest') return 2 + (floor >= 8 ? 1 : 0) + (floor >= 20 ? 1 : 0);
  return 1 + (floor >= 12 ? 1 : 0);
}
export const maxFoesFor = (floor: number) => Math.min(9, 5 + Math.floor(floor / 6));

export interface Descent {
  floor: number;
  /** Book ids found this run, not yet handed to Natalie. */
  books: string[];
  hoard: boolean;
  /** The goblins learn your habits (band 5): what you've been hitting them with this run. */
  swordHits: number; boltHits: number;
  started: string;
}
export interface Record_ { deepest: number; delivered: number; heroes: number; runs: number }
export interface Fallen { name: string; floor: number; books: number; by: string; at: string; words: string }
export interface Survivor { name: string; at: string; art: string | null; kavik?: boolean; line?: string }

const K = { run: 'gametool.descent', rec: 'gametool.descent.record', tally: 'gametool.tally', wall: 'gametool.survivors' };
const read = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

export const newDescent = (): Descent => ({ floor: 1, books: [], hoard: false, swordHits: 0, boltHits: 0, started: new Date().toISOString().slice(0, 10) });
export const loadDescent = () => read<Descent | null>(K.run, null);
export const saveDescent = (d: Descent | null) => write(K.run, d);
export const loadRecord = () => ({ deepest: 0, delivered: 0, heroes: 1, runs: 0, ...read<Partial<Record_>>(K.rec, {}) });
export const saveRecord = (r: Record_) => write(K.rec, r);
export const loadTally = () => read<Fallen[]>(K.tally, []);
export function addFallen(f: Fallen) { const t = loadTally(); t.unshift(f); write(K.tally, t.slice(0, 60)); }

/** Kavik's sketch is the only one up there to begin with. */
export const KAVIK: Survivor = { name: 'Kavik', at: '', art: null, kavik: true, line: 'Came up with a scorched sleeve and would not say how deep.' };
export const loadSurvivors = (): Survivor[] => [KAVIK, ...read<Survivor[]>(K.wall, [])];
export function addSurvivor(s: Survivor) { const w = read<Survivor[]>(K.wall, []); w.push(s); write(K.wall, w.slice(-24)); }

/** A charcoal sketch of Kavik on parchment: horns, a wrap, the obi bow. Drawn, so it costs no image file. */
export function drawKavik(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#EADBB4'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(40,30,30,.85)'; g.lineCap = 'round'; g.lineJoin = 'round';
  const s = Math.min(w, h) / 128, X = (x: number) => w / 2 + x * s, Y = (y: number) => h * 0.08 + y * s;
  const line = (pts: [number, number][], lw = 1.6) => { g.lineWidth = lw * s; g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1])); for (const p of pts.slice(1)) g.lineTo(X(p[0]), Y(p[1])); g.stroke(); };
  // Head and horns.
  g.lineWidth = 1.8 * s; g.beginPath(); g.ellipse(X(0), Y(26), 11 * s, 13 * s, 0, 0, Math.PI * 2); g.stroke();
  line([[-8, 16], [-14, 6], [-12, -2]], 2.2); line([[8, 16], [14, 6], [12, -2]], 2.2);
  line([[-4, 26], [-2, 26]], 1.4); line([[3, 26], [5, 26]], 1.4); line([[-2, 33], [2, 33]], 1.2);
  // Shoulders, wrap top, arms folded.
  line([[-10, 38], [-28, 46], [-32, 80]]); line([[10, 38], [28, 46], [32, 80]]);
  line([[-20, 50], [0, 62], [20, 50]], 1.3); line([[-22, 66], [22, 66]], 1.5); line([[-24, 72], [24, 70]], 1.3);
  // Obi and bow.
  line([[-26, 86], [26, 86]], 2); line([[-26, 92], [26, 92]], 2); line([[18, 89], [30, 82], [30, 96], [18, 89]], 1.4);
  // Hatching.
  for (let i = 0; i < 9; i++) line([[-30 + i * 2, 50 + i * 3], [-24 + i * 2, 44 + i * 3]], 0.8);
  g.fillStyle = 'rgba(40,30,30,.9)'; g.font = `italic ${Math.round(12 * s)}px Georgia, serif`; g.textAlign = 'center';
  g.fillText('Kavik', w / 2, h - 10 * s);
}
