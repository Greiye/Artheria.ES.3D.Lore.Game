// v0.04: on-screen button names that match the controller in the player's hands.
// Standard Gamepad API button indices; labels per family, detected from the pad's id string.
export type PadFamily = 'xbox' | 'playstation' | 'nintendo';

export function padFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  if (/054c|playstation|dualsense|dualshock|wireless controller/.test(s)) return 'playstation';
  if (/057e|nintendo|pro controller|joy-con/.test(s)) return 'nintendo';
  return 'xbox';
}

const NAMES: Record<PadFamily, string[]> = {
  //          0     1     2     3     4      5      6      7      8         9          10    11    12   13   14   15
  xbox:        ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '▲', '▼', '◀', '▶'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', '▲', '▼', '◀', '▶'],
  nintendo:    ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', '▲', '▼', '◀', '▶'],
};

export const glyph = (family: PadFamily, button: number) => NAMES[family][button] ?? '?';
