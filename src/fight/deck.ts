import { MOVES, LIMBS, STANCES, deckable, endStance, staminaCost, type Deck, type Limb, type Move, type Stance } from './engine';
import { storeSet } from '../store';

// B58 (Mike 2026-11-08): the Monk's combo decks. A deck gives every stance one move per limb button (4 x 4 slots);
// each move ends in a stance, so a string is a path through the stances. Moves come from a library: eight to start
// with, the rest learned by blocking or parrying a foe's move three times. Saved per profile (so it is in profile
// files and the full backup); a save from before this key simply gets the starter deck.
export const DECK_KEY = 'gametool.monkdeck';
export const LEARN_AT = 3, DECKS = 3;
export const STARTER = ['jab', 'straight', 'hammer', 'lowpalm', 'shin', 'push', 'sweep', 'axe'];
/** One starter string per stance: lp, rp, lk, rk. */
export const starterSlots = (): Deck => [
  ['jab', 'straight', 'shin', 'axe'],
  ['hammer', 'straight', 'push', 'axe'],
  ['lowpalm', 'straight', 'sweep', 'axe'],
  ['jab', 'straight', 'shin', 'axe'],
];
export interface NamedDeck { name: string; slots: Deck }
export interface DeckSave { v: 1; decks: NamedDeck[]; active: number; learned: string[]; seen: Record<string, number> }
export const LIMB_NAME: Record<Limb, string> = { lp: 'Left hand', rp: 'Right hand', lk: 'Left foot', rk: 'Right foot' };

const okMove = (id: unknown): id is string => typeof id === 'string' && !!MOVES[id] && deckable(MOVES[id]);
/** Read a stored deck save, mending anything missing or unknown (an old save gets the starter deck). */
export function cleanDecks(raw: unknown): DeckSave {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<DeckSave>;
  const learned = [...new Set([...STARTER, ...(Array.isArray(v.learned) ? v.learned.filter(okMove) : [])])];
  const decks: NamedDeck[] = (Array.isArray(v.decks) ? v.decks : []).slice(0, DECKS).map((d, i) => ({
    name: typeof d?.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 24) : `Deck ${i + 1}`,
    slots: STANCES.map((_, s) => LIMBS.map((_, l) => { const id = d?.slots?.[s]?.[l]; return okMove(id) && learned.includes(id) ? id : null; })),
  }));
  if (!decks.length) decks.push({ name: 'Deck 1', slots: starterSlots() });
  const seen: Record<string, number> = {};
  if (v.seen && typeof v.seen === 'object') for (const [k, n] of Object.entries(v.seen)) if (okMove(k) && Number(n) > 0) seen[k] = Math.min(LEARN_AT, Math.floor(Number(n)));
  return { v: 1, decks, active: Math.min(decks.length - 1, Math.max(0, Number(v.active) || 0)), learned, seen };
}
export function loadDecks(): DeckSave {
  try { return cleanDecks(JSON.parse(localStorage.getItem(DECK_KEY) ?? 'null')); } catch { return cleanDecks(null); }
}
export function saveDecks(s: DeckSave) { storeSet(DECK_KEY, JSON.stringify(s)); }
export const activeDeck = (s: DeckSave): Deck => s.decks[s.active].slots;

/** A foe's move was blocked or parried: count it, and learn it on the third time. Returns the move when learned. */
export function witness(s: DeckSave, id: string): Move | null {
  if (!okMove(id) || s.learned.includes(id)) return null;
  s.seen[id] = (s.seen[id] ?? 0) + 1;
  if (s.seen[id] < LEARN_AT) return null;
  s.learned.push(id); delete s.seen[id];
  return MOVES[id];
}

/** What the editor shows of a move. Speed is its wind-up in frames (lower is faster). */
export function moveCard(m: Move) {
  const tags = [m.track && 'round', m.launch && 'launch', m.knock && 'knockdown', m.wall && 'wall', m.crouch && 'ducks highs', m.lunge && 'steps in', m.block <= -10 && 'unsafe'].filter(Boolean) as string[];
  return { id: m.id, name: m.name, limb: m.limb as Limb, speed: m.startup, dmg: m.dmg, reach: m.reach, height: m.level, to: endStance(m), cost: staminaCost(m), tags, credit: m.credit ?? null };
}
/** The moves in the library that a limb can throw. */
export const movesFor = (s: DeckSave, limb: Limb) => s.learned.map((id) => MOVES[id]).filter((m) => m.limb === limb);

/** The string a deck gives from a stance for a run of presses: each move, and the stance it leaves you in. */
export function stringFrom(deck: Deck, from: Stance, presses: Limb[]): { stance: Stance; limb: Limb; move: Move }[] {
  const out: { stance: Stance; limb: Limb; move: Move }[] = [];
  let st = from;
  for (const limb of presses.slice(0, 4)) {
    const id = deck[st]?.[LIMBS.indexOf(limb)];
    if (!id || !MOVES[id]) break;
    out.push({ stance: st, limb, move: MOVES[id] });
    st = endStance(MOVES[id], st);
  }
  return out;
}
const SHORT: Record<Limb, string> = { lp: 'LP', rp: 'RP', lk: 'LK', rk: 'RK' };
const ST = ['FL', 'FR', 'BL', 'BR'];
/** The strings a deck produces, one per opener: keep pressing the same kind of follow-up the deck allows, e.g. "FL:LP → FR:RK → BL:LP". */
export function deckStrings(deck: Deck): string[] {
  const out: string[] = [];
  for (const s of [0, 1, 2, 3] as Stance[]) for (const limb of LIMBS) {
    // Follow each opener with the first filled slot that leads somewhere new, so the list shows the paths between stances.
    const path: Limb[] = [limb];
    let st = s, id = deck[st]?.[LIMBS.indexOf(limb)];
    if (!id) continue;
    const seen = new Set<number>([st]);
    for (let i = 0; i < 3; i++) {
      st = endStance(MOVES[id!], st);
      const next = LIMBS.find((l) => { const n = deck[st]?.[LIMBS.indexOf(l)]; return !!n && !seen.has(endStance(MOVES[n], st)); }) ?? LIMBS.find((l) => !!deck[st]?.[LIMBS.indexOf(l)]);
      if (!next) break;
      seen.add(st); path.push(next); id = deck[st]![LIMBS.indexOf(next)];
    }
    const str = stringFrom(deck, s, path);
    if (str.length > 1) out.push(str.map((x) => `${ST[x.stance]}:${SHORT[x.limb]}`).join(' → '));
  }
  return [...new Set(out)];
}
