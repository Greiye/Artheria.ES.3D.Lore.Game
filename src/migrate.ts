import type { Data } from './profiles';

// Lore-first round, item 3 (Mike 2026-11-05): friends should be able to open their saves for years. Every change to
// how a profile is stored gets a step here instead of breaking old saves. DATA_V is the current shape; step i turns
// a version i+1 profile into version i+2. Saves from before this file are version 1. Never edit a shipped step:
// add a new one and bump DATA_V. Profiles (src/profiles.ts) run these on boot and on every import.
export const DATA_V = 3;
const STEPS: ((d: Data) => void)[] = [
  // 1 → 2 (lore-first item 4): the first day gained a "read" step after "up", so a day part-way through moves on one.
  (d) => {
    const v = JSON.parse(d['gametool.firstday'] ?? 'null');
    if (v && typeof v.step === 'number' && !v.done && v.step >= 1) d['gametool.firstday'] = JSON.stringify({ ...v, step: v.step + 1 });
  },
  // 2 → 3 (Mike 2026-11-09, "Initial crowns = 500"): crowns stopped being unlimited, so a saved hero's purse is topped
  // up to the starting 500 (a richer purse is left as it is).
  (d) => {
    const s = JSON.parse(d['gametool.save'] ?? 'null');
    if (!s || !Array.isArray(s.items)) return;
    const items = (s.items as [string, number][]).filter(([id]) => id !== 'crown'), had = (s.items as [string, number][]).find(([id]) => id === 'crown')?.[1] ?? 0;
    items.unshift(['crown', Math.max(500, Number(had) || 0)]);
    d['gametool.save'] = JSON.stringify({ ...s, items });
  },
];

/** Upgrade one profile's key set from version `from` to DATA_V (mutates and returns it). */
export function upgrade(d: Data, from: number): Data {
  for (let v = Math.max(1, from); v < DATA_V; v++) {
    try { STEPS[v - 1]?.(d); } catch { /* a step that can't read old data leaves it as it was */ }
  }
  return d;
}
