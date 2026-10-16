// F2.3 / F3.7 / §4 Settings: persisted to localStorage key 'gametool.settings'.
export interface Settings {
  sensitivity: number; // default 1.0
  fov: number;         // default 75 (D2)
  invertY: boolean;
  alwaysRun: boolean;  // default true
  lastPage: number;
}

const KEY = 'gametool.settings';
export const defaults: Settings = { sensitivity: 1.0, fov: 75, invertY: false, alwaysRun: true, lastPage: 0 };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      sensitivity: typeof s.sensitivity === 'number' ? Math.min(3, Math.max(0.1, s.sensitivity)) : defaults.sensitivity,
      fov: typeof s.fov === 'number' ? Math.min(110, Math.max(50, s.fov)) : defaults.fov,
      invertY: typeof s.invertY === 'boolean' ? s.invertY : defaults.invertY,
      alwaysRun: typeof s.alwaysRun === 'boolean' ? s.alwaysRun : defaults.alwaysRun,
      lastPage: Number.isInteger(s.lastPage) && (s.lastPage as number) >= 0 ? (s.lastPage as number) : 0,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode / quota: settings just won't persist */ }
}
