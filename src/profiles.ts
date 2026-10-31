// B24 save slots and profiles (Mike 2026-10-31): three profiles on this device, no cloud. A profile is
// everything the game keeps under "gametool.*" except the device's own settings (below). The live profile's
// data stays in the live keys the game already reads; the other two wait in "gametool~slot.N". Switching
// profile files the live keys away, puts the chosen profile's back, and reloads the page. Export / import
// is one JSON file per profile, like "Submit": nothing leaves the device unless you take the file.
export const SLOTS = 3;
const META = 'gametool~profiles';
const SLOT = (i: number) => `gametool~slot.${i}`;
/** Device-wide, never part of a profile (and never exported: the GitHub token lives here). */
const SHARED = new Set(['settings', 'keys', 'intro', 'version', 'hometip', 'upright', 'rotateask', 'github', 'coached', 'coachtest', 'autoq']
  .map((k) => `gametool.${k}`));
export const isProfileKey = (k: string) => k.startsWith('gametool.') && !SHARED.has(k);

type Data = Record<string, string>;
export interface SlotInfo { slot: number; active: boolean; empty: boolean; name: string; savedAt: number | null }

function readJSON<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
export function activeSlot(): number {
  const n = readJSON<{ active?: number }>(META, {}).active;
  return typeof n === 'number' && n >= 0 && n < SLOTS ? n : 0;
}
function setActive(i: number) { try { localStorage.setItem(META, JSON.stringify({ active: i })); } catch { /* blocked */ } }

function liveData(): Data {
  const out: Data = {};
  try {
    for (let j = 0; j < localStorage.length; j++) {
      const k = localStorage.key(j);
      if (k && isProfileKey(k)) out[k] = localStorage.getItem(k) ?? '';
    }
  } catch { /* blocked */ }
  return out;
}
export function slotData(i: number): Data { return i === activeSlot() ? liveData() : readJSON<Data>(SLOT(i), {}); }

function nameOf(d: Data): string {
  const tryName = (k: string) => { try { const v = JSON.parse(d[k] ?? 'null'); return typeof v?.name === 'string' ? v.name.trim() : ''; } catch { return ''; } };
  return tryName('gametool.character') || tryName('gametool.forge.character');
}
export function slotInfo(i: number): SlotInfo {
  const d = slotData(i);
  let savedAt: number | null = null;
  try { const s = JSON.parse(d['gametool.save'] ?? 'null'); if (typeof s?.at === 'number') savedAt = s.at; } catch { /* none */ }
  return { slot: i, active: i === activeSlot(), empty: Object.keys(d).length === 0, name: nameOf(d), savedAt };
}
export const slotLabel = (s: SlotInfo) => s.name || `Profile ${s.slot + 1}`;

/** Move to another profile. The caller reloads the page so every system reads the new keys. */
export function switchTo(i: number): boolean {
  const cur = activeSlot();
  if (i === cur || i < 0 || i >= SLOTS) return false;
  try {
    const live = liveData();
    localStorage.setItem(SLOT(cur), JSON.stringify(live));
    for (const k of Object.keys(live)) localStorage.removeItem(k);
    const next = readJSON<Data>(SLOT(i), {});
    for (const [k, v] of Object.entries(next)) if (isProfileKey(k)) localStorage.setItem(k, v);
    localStorage.removeItem(SLOT(i));
    setActive(i);
    return true;
  } catch { return false; }
}

/** Forget a profile. Clearing the live one empties the live keys (the caller reloads). */
export function clearSlot(i: number): void {
  try {
    if (i === activeSlot()) for (const k of Object.keys(liveData())) localStorage.removeItem(k);
    else localStorage.removeItem(SLOT(i));
  } catch { /* blocked */ }
}

export interface ProfileFile { game: 'Tales of Artheria'; kind: 'profile'; v: 1; name: string; exported: string; data: Data }
export function exportSlot(i: number): ProfileFile {
  return { game: 'Tales of Artheria', kind: 'profile', v: 1, name: slotLabel(slotInfo(i)), exported: new Date().toISOString(), data: slotData(i) };
}
export function fileName(f: ProfileFile): string {
  return `artheria-profile-${(f.name || 'profile').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile'}.json`;
}
/** Read a profile file into slot i (replacing it). Returns an error message, or null when it worked. */
export function importInto(i: number, text: string): string | null {
  let f: Partial<ProfileFile>;
  try { f = JSON.parse(text); } catch { return "That file isn't a profile (it isn't JSON)."; }
  if (f?.kind !== 'profile' || f.v !== 1 || typeof f.data !== 'object' || !f.data) return "That file isn't a Tales of Artheria profile.";
  const data: Data = {};
  for (const [k, v] of Object.entries(f.data)) if (isProfileKey(k) && typeof v === 'string') data[k] = v;
  try {
    if (i === activeSlot()) {
      clearSlot(i);
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    } else localStorage.setItem(SLOT(i), JSON.stringify(data));
  } catch { return 'No room to store it on this device.'; }
  return null;
}
