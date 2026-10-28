import type { TimeOfDay } from './world/sky';

// v0.05: "Save and return to the menu" (pause menu) and retiring at the exit gate both save here, on this device.
// A save keeps where you stood, the time of day and what you carry. Retiring keeps the bag and the hour but not the
// spot: you left the area, so the next Begin starts you back at the glade.
export interface SaveGame { v: 1; at: number; pos: [number, number, number] | null; yaw: number; time: TimeOfDay; items: [string, number][] }
const KEY = 'gametool.save';

export function loadGame(): SaveGame | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SaveGame | null;
    return s && s.v === 1 ? s : null;
  } catch { return null; }
}
export function saveGame(s: Omit<SaveGame, 'v' | 'at'>): boolean {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, at: Date.now(), ...s })); return true; } catch { return false; }
}
