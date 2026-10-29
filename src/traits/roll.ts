import { mulberry32 } from '../dungeon/gen';

// Trait roll tables (docs/trait-roll-tables.md, Mike approved 2026-10-29). An archetype plus its tables (JSON in
// src/data/traits/) gives many variants. Each table is a die and rows covering result ranges, so the weights read
// like a printed tabletop table. Rows carry tags, requires/excludes, a threat cost against the archetype's budget,
// and optional links to other tables. The player never sees the dice, only the result.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Mods = Record<string, number | string | boolean>;
export interface Row {
  range: [number, number]; id: string; label?: string; rarity?: Rarity; tags?: string[];
  requires?: string[]; excludes?: string[]; threat?: number; mods?: Mods; epithet?: string;
  roll?: string;                         // also roll on this table
  sets?: Record<string, string>;         // forces a row of a later table
  limits?: Record<string, string[]>;     // a later table may only pick rows carrying one of these tags
  socket?: string;
}
export interface Table { die: string; rows: Row[]; times?: number }
export interface Archetype {
  archetype: string;
  base: { height: number; hp: number; speed: number; budget: number };
  order: string[];
  epithetOrder: string[];
  tables: Record<string, Table>;
  names?: string[];
  epithets?: string[];
}
export interface Pick { table: string; row: Row; sub?: Row }
export interface Variant {
  archetype: string;
  seed: number;
  picks: Pick[];
  tags: Set<string>;
  threat: number;
  rarity: Rarity;
  /** Summed mods: numbers add, except scale and width which multiply; strings and flags take the last. */
  mods: Mods;
  name: string;
  title: string | null;
  /** The name, plus the title for Rare and Legendary. */
  display: string;
}

const RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
const MULT = new Set(['scale', 'width']);

/** Rolls a die string like `d20`, `2d6` or a plain `3`. */
export function rollDie(die: string, R: () => number): number {
  const m = /^(\d*)d(\d+)$/.exec(die.trim());
  if (!m) return Number(die) || 0;
  let n = 0;
  for (let i = 0; i < (Number(m[1]) || 1); i++) n += 1 + Math.floor(R() * Number(m[2]));
  return n;
}

/** A seed for one spawn: new every run, the same within a run. */
export const seedOf = (run: number, index: number) => {
  let h = Math.imul(run ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(index + 1, 0xC2B2AE35);
  h ^= h >>> 15; h = Math.imul(h, 0x27D4EB2F); h ^= h >>> 13;
  return (h >>> 0) || 1;
};

const tagsOf = (table: string, r: Row) => [`${table}:${r.id}`, ...(r.tags ?? [])];

export function roll(arch: Archetype, seed: number, opts: { budget?: number } = {}): Variant {
  const R = mulberry32(seed);
  const budget = opts.budget ?? arch.base.budget;
  const fate = rollDie('d100', R) >= 96;   // Legendary rows only when the fate roll passes
  // One slot per roll: a table with `times: 2` fills two slots.
  const slots: string[] = arch.order.flatMap((t) => Array.from({ length: arch.tables[t].times ?? 1 }, () => t));
  const picks: (Pick | null)[] = slots.map(() => null);

  const others = (k: number) => picks.filter((p, i): p is Pick => !!p && i !== k);
  const fits = (k: number, r: Row) => {
    const table = slots[k], P = others(k), have = new Set(P.flatMap((p) => [...tagsOf(p.table, p.row), ...(p.sub ? tagsOf(p.row.roll!, p.sub) : [])]));
    const mine = tagsOf(table, r);
    if (r.rarity === 'legendary' && !fate) return false;
    if ((r.requires ?? []).some((t) => !have.has(t))) return false;
    if ((r.excludes ?? []).some((t) => have.has(t.replace(/^tag:/, '')))) return false;
    for (const p of P) {
      if ((p.row.excludes ?? []).some((t) => mine.includes(t.replace(/^tag:/, '')))) return false;
      const lim = p.row.limits?.[table];
      if (lim && !lim.some((t) => mine.includes(t))) return false;
      const set = p.row.sets?.[table];
      if (set && r.id !== set) return false;
      // A second roll on the same table drops duplicates (it becomes the table's first, empty row).
      if (p.table === table && p.row.id === r.id && r.id !== arch.tables[table].rows[0].id) return false;
    }
    return true;
  };
  const rowFor = (table: string, n: number) => arch.tables[table].rows.find((r) => n >= r.range[0] && n <= r.range[1]) ?? arch.tables[table].rows[0];
  const pickFor = (k: number, cheapest = false): Pick => {
    const table = slots[k], T = arch.tables[table];
    let row: Row | null = null;
    if (!cheapest) {
      // Reroll on conflict (up to 3 times), then take the first row in table order that fits.
      for (let tries = 0; tries < 4 && !row; tries++) { const r = rowFor(table, rollDie(T.die, R)); if (fits(k, r)) row = r; }
    }
    if (!row) {
      const ok = T.rows.filter((r) => fits(k, r));
      row = cheapest ? [...ok].sort((a, b) => (a.threat ?? 0) - (b.threat ?? 0))[0] ?? T.rows[0] : ok[0] ?? T.rows[0];
    }
    const sub = row.roll ? rowFor(row.roll, rollDie(arch.tables[row.roll].die, R)) : undefined;
    return { table, row, sub };
  };
  // After a slot changes, later slots that no longer fit are rolled again.
  const settle = (from: number) => { for (let j = from; j < slots.length; j++) if (picks[j] && !fits(j, picks[j]!.row)) picks[j] = pickFor(j); };
  slots.forEach((_, k) => { picks[k] = pickFor(k); });
  const threatOf = () => picks.reduce((s, p) => s + (p!.row.threat ?? 0), 0);
  // The threat budget: over it, the most expensive slot rolls again (6 tries), then falls back to its cheapest row.
  for (let guard = 0; threatOf() > budget && guard < 24; guard++) {
    let k = 0;
    picks.forEach((p, i) => { if ((p!.row.threat ?? 0) > (picks[k]!.row.threat ?? 0)) k = i; });
    picks[k] = pickFor(k, guard >= 6);
    settle(k + 1);
  }
  const done = picks as Pick[];
  const tags = new Set(done.flatMap((p) => tagsOf(p.table, p.row)));
  const mods: Mods = {};
  for (const p of done) for (const [key, v] of Object.entries(p.row.mods ?? {})) {
    if (typeof v === 'number') mods[key] = MULT.has(key) ? ((mods[key] as number) ?? 1) * v : ((mods[key] as number) ?? 0) + v;
    else mods[key] = v;
  }
  const rarity = done.reduce<Rarity>((a, p) => (RANK[p.row.rarity ?? 'common'] > RANK[a] ? p.row.rarity! : a), 'common');
  // Every goblin has a name; Rare and Legendary ones also earn a title, from their traits first.
  const name = arch.names?.length ? arch.names[Math.floor(R() * arch.names.length)] : '';
  let title: string | null = null;
  if (RANK[rarity] >= RANK.rare) {
    for (const t of arch.epithetOrder) { const p = done.find((x) => x.table === t && x.row.epithet); if (p) { title = p.row.epithet!; break; } }
    title ??= arch.epithets?.length ? arch.epithets[Math.floor(R() * arch.epithets.length)] : null;
  }
  return { archetype: arch.archetype, seed, picks: done, tags, threat: threatOf(), rarity, mods, name, title, display: title ? `${name} ${title}` : name };
}

/** The picked row of a table (the first, for tables rolled more than once). */
export const pickOf = (v: Variant, table: string) => v.picks.find((p) => p.table === table)?.row;
export const has = (v: Variant, table: string, id: string) => v.picks.some((p) => p.table === table && p.row.id === id);
export const num = (v: Variant, key: string, dflt = 0) => (typeof v.mods[key] === 'number' ? (v.mods[key] as number) : dflt);
