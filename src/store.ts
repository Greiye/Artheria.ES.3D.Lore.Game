// localStorage that never throws: private windows, full quota or blocked site data just mean nothing is saved
// (the game still runs). Profiles (src/profiles.ts) swap whole key sets underneath, so callers use plain keys.
export function storeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode, quota or blocked */ }
}
