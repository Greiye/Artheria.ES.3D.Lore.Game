// F2.3 / F3.7 / §4 Settings: persisted to localStorage key 'gametool.settings'. §0 rule 7 (H7):
// a schemaVersion tags the blob so a later format change can migrate instead of discarding it.
export type Preset = 'low' | 'medium' | 'high';
export type FpsCap = 30 | 60 | 0; // 0 = uncapped (F1.1 "∞")

export interface AudioSettings {
  master: number; music: number; sfx: number; dialogue: number; // F1.2: 0-100 per bus
  muteMaster: boolean; muteMusic: boolean; muteSfx: boolean; muteDialogue: boolean;
}

export interface Settings {
  schemaVersion: 1;
  sensitivity: number; // default 1.0
  fov: number;         // F1.1: 60-100 (D2)
  invertY: boolean;
  alwaysRun: boolean;  // default true
  view: 'follow' | 'first';   // storybook restyle S1: starting camera, follow (Dark Cloud 2 style) by default
  chars: 'hybrid' | 'sprite';   // restyle S2c: 3D bodies with pixel faces (default) or RO-style pixel sprites
  lastPage: number;
  // F1.1 graphics
  preset: Preset;
  renderScale: number; // 50-100 (%)
  shadows: boolean;
  postFx: boolean;     // rebuild R1: bloom on glows/sun (replaces the legacy toon outlines)
  fogDistance: number;  // far-plane distance, 20-120 m; near is derived (F1.1)
  fpsCap: FpsCap;
  // F1.2 audio
  audio: AudioSettings;
}

// F1.1: each preset is a bundle of starting values for the sliders/toggles above it.
// Picking a preset just fills the sliders — the owner can still fine-tune afterward.
export const PRESETS: Record<Preset, Pick<Settings, 'renderScale' | 'shadows' | 'postFx' | 'fogDistance' | 'fpsCap'>> = {
  low: { renderScale: 50, shadows: false, postFx: false, fogDistance: 45, fpsCap: 30 },
  medium: { renderScale: 75, shadows: false, postFx: false, fogDistance: 85, fpsCap: 60 },
  high: { renderScale: 100, shadows: true, postFx: true, fogDistance: 120, fpsCap: 0 },
};

const KEY = 'gametool.settings';
const defaultAudio: AudioSettings = { master: 70, music: 60, sfx: 80, dialogue: 90, muteMaster: false, muteMusic: false, muteSfx: false, muteDialogue: false };
export const defaults: Settings = {
  schemaVersion: 1,
  sensitivity: 1.0, fov: 75, invertY: false, alwaysRun: true, view: 'follow', chars: 'hybrid', lastPage: 0,
  preset: 'medium', ...PRESETS.medium,
  audio: { ...defaultAudio },
};

const clamp = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function loadAudio(a: unknown): AudioSettings {
  const s = (a && typeof a === 'object' ? a : {}) as Partial<AudioSettings>;
  return {
    master: clamp(s.master, 0, 100, defaultAudio.master),
    music: clamp(s.music, 0, 100, defaultAudio.music),
    sfx: clamp(s.sfx, 0, 100, defaultAudio.sfx),
    dialogue: clamp(s.dialogue, 0, 100, defaultAudio.dialogue),
    muteMaster: bool(s.muteMaster, false),
    muteMusic: bool(s.muteMusic, false),
    muteSfx: bool(s.muteSfx, false),
    muteDialogue: bool(s.muteDialogue, false),
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredCloneSettings(defaults);
    const s = JSON.parse(raw) as Partial<Settings>;
    const preset: Preset = s.preset === 'low' || s.preset === 'medium' || s.preset === 'high' ? s.preset : defaults.preset;
    return {
      schemaVersion: 1,
      sensitivity: clamp(s.sensitivity, 0.1, 3, defaults.sensitivity),
      fov: clamp(s.fov, 60, 100, defaults.fov),
      invertY: bool(s.invertY, defaults.invertY),
      alwaysRun: bool(s.alwaysRun, defaults.alwaysRun),
      view: s.view === 'first' ? 'first' : 'follow',
      chars: s.chars === 'sprite' ? 'sprite' : 'hybrid',
      lastPage: Number.isInteger(s.lastPage) && (s.lastPage as number) >= 0 ? (s.lastPage as number) : 0,
      preset,
      renderScale: clamp(s.renderScale, 50, 100, PRESETS[preset].renderScale),
      shadows: bool(s.shadows, PRESETS[preset].shadows),
      // Saved before the rebuild: the old outlines toggle carries over as the post-effects choice.
      postFx: bool(s.postFx ?? (s as { outlines?: unknown }).outlines, PRESETS[preset].postFx),
      fogDistance: clamp(s.fogDistance, 20, 120, PRESETS[preset].fogDistance),
      fpsCap: (s.fpsCap === 30 || s.fpsCap === 60 || s.fpsCap === 0) ? s.fpsCap : PRESETS[preset].fpsCap,
      audio: loadAudio(s.audio),
    };
  } catch {
    return structuredCloneSettings(defaults);
  }
}

function structuredCloneSettings(s: Settings): Settings {
  return { ...s, audio: { ...s.audio } };
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode / quota: settings just won't persist */ }
}
