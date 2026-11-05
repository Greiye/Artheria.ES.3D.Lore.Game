import { storeSet } from './store';
import { DATA_V, upgrade } from './migrate';
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

export type Data = Record<string, string>;
interface SlotInfo { slot: number; active: boolean; empty: boolean; name: string; savedAt: number | null }

function readJSON<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
export function activeSlot(): number {
  const n = readJSON<{ active?: number }>(META, {}).active;
  return typeof n === 'number' && n >= 0 && n < SLOTS ? n : 0;
}
function setActive(i: number) { storeSet(META, JSON.stringify({ active: i })); }

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
function slotData(i: number): Data { return i === activeSlot() ? liveData() : readJSON<Data>(SLOT(i), {}); }

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

interface ProfileFile { game: 'Tales of Artheria'; kind: 'profile'; v: 1; dv?: number; name: string; exported: string; data: Data }
export function exportSlot(i: number): ProfileFile {
  return { game: 'Tales of Artheria', kind: 'profile', v: 1, dv: DATA_V, name: slotLabel(slotInfo(i)), exported: new Date().toISOString(), data: slotData(i) };
}
export function fileName(f: ProfileFile): string {
  return `artheria-profile-${(f.name || 'profile').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile'}.json`;
}
/** Read a profile file into slot i (replacing it). Returns an error message, or null when it worked. */
export function importInto(i: number, text: string): string | null {
  let f: Partial<ProfileFile>;
  try { f = JSON.parse(text); } catch { return "That file isn't a profile (it isn't JSON)."; }
  if (f?.kind !== 'profile' || f.v !== 1 || typeof f.data !== 'object' || !f.data) return "That file isn't a Tales of Artheria profile.";
  const data = upgrade(cleanData(f.data), typeof f.dv === 'number' ? f.dv : 1);
  try {
    if (i === activeSlot()) {
      clearSlot(i);
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    } else localStorage.setItem(SLOT(i), JSON.stringify(data));
  } catch { return 'No room to store it on this device.'; }
  return null;
}

function cleanData(raw: unknown): Data {
  const data: Data = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (isProfileKey(k) && typeof v === 'string') data[k] = v;
  return data;
}

// ---------- Lore-first round, item 3 (Mike 2026-11-05): lasting for years ----------
// The device's data version: every stored profile (live keys and the waiting slots) is upgraded to DATA_V on boot,
// so a save from years ago still opens. Profile and backup files carry their version and are upgraded on import.
const DV_KEY = 'gametool~datav';
export function storedDataVersion(): number {
  try { const n = Number(localStorage.getItem(DV_KEY)); return Number.isFinite(n) && n >= 1 ? n : 1; } catch { return DATA_V; }
}
/** Bring every profile on this device up to DATA_V. Runs once at boot, before anything reads a profile key. */
export function migrateDevice(): number {
  const from = storedDataVersion();
  if (from >= DATA_V) { storeSet(DV_KEY, String(Math.max(from, DATA_V))); return 0; }
  let n = 0;
  try {
    const live = liveData(), up = upgrade({ ...live }, from);
    for (const k of Object.keys(live)) if (!(k in up)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(up)) if (live[k] !== v) localStorage.setItem(k, v);
    n++;
    for (let i = 0; i < SLOTS; i++) {
      if (i === activeSlot()) continue;
      const raw = localStorage.getItem(SLOT(i));
      if (!raw) continue;
      localStorage.setItem(SLOT(i), JSON.stringify(upgrade(cleanData(JSON.parse(raw)), from)));
      n++;
    }
    localStorage.setItem(DV_KEY, String(DATA_V));
  } catch { /* blocked: the game reads what is there */ }
  return n;
}

/** One file with all three profiles and this device's settings (never the GitHub token). */
interface BackupFile { game: 'Tales of Artheria'; kind: 'backup'; v: 1; dv: number; exported: string; active: number; profiles: Data[]; device: Data }
const NOT_BACKED_UP = new Set(['gametool.github']);
const BACKUP_AT = 'gametool~backup.at';
export function exportAll(): BackupFile {
  const device: Data = {};
  try {
    for (let j = 0; j < localStorage.length; j++) {
      const k = localStorage.key(j);
      if (k && SHARED.has(k) && !NOT_BACKED_UP.has(k)) device[k] = localStorage.getItem(k) ?? '';
    }
  } catch { /* blocked */ }
  storeSet(BACKUP_AT, String(Date.now()));
  return { game: 'Tales of Artheria', kind: 'backup', v: 1, dv: DATA_V, exported: new Date().toISOString(), active: activeSlot(), profiles: Array.from({ length: SLOTS }, (_, i) => slotData(i)), device };
}
export const backupName = () => `artheria-backup-${new Date().toISOString().slice(0, 10)}.json`;
export function lastBackupAt(): number | null {
  try { const n = Number(localStorage.getItem(BACKUP_AT)); return n > 0 ? n : null; } catch { return null; }
}
/** Restore a backup: every profile and the device settings are replaced. Returns an error, or null. The caller reloads. */
export function importAll(text: string): string | null {
  let f: Partial<BackupFile>;
  try { f = JSON.parse(text); } catch { return "That file isn't a backup (it isn't JSON)."; }
  if ((f as { kind?: string })?.kind === 'profile') return 'That is one profile: use Import on a profile row.';
  if (f?.kind !== 'backup' || f.v !== 1 || !Array.isArray(f.profiles)) return "That file isn't a Tales of Artheria backup.";
  const from = typeof f.dv === 'number' ? f.dv : 1;
  const profiles = Array.from({ length: SLOTS }, (_, i) => upgrade(cleanData(f.profiles![i]), from));
  const active = typeof f.active === 'number' && f.active >= 0 && f.active < SLOTS ? f.active : 0;
  try {
    for (const k of Object.keys(liveData())) localStorage.removeItem(k);
    for (let i = 0; i < SLOTS; i++) localStorage.removeItem(SLOT(i));
    for (let i = 0; i < SLOTS; i++) {
      if (i === active) for (const [k, v] of Object.entries(profiles[i])) localStorage.setItem(k, v);
      else if (Object.keys(profiles[i]).length) localStorage.setItem(SLOT(i), JSON.stringify(profiles[i]));
    }
    setActive(active);
    if (f.device && typeof f.device === 'object') for (const [k, v] of Object.entries(f.device)) if (SHARED.has(k) && !NOT_BACKED_UP.has(k) && typeof v === 'string') localStorage.setItem(k, v);
    localStorage.setItem(DV_KEY, String(DATA_V));
  } catch { return 'No room to store it on this device.'; }
  return null;
}

/** Ask the browser not to clear our data when space runs low (granted quietly on installed apps; some ask). */
export async function askToKeepData(): Promise<boolean> {
  try { return (await navigator.storage?.persisted?.()) || !!(await navigator.storage?.persist?.()); } catch { return false; }
}
export async function dataKept(): Promise<boolean> {
  try { return !!(await navigator.storage?.persisted?.()); } catch { return false; }
}
