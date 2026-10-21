// A4: palette tokens from the owner's reference image (mossy green, stone grey, cyan rune glow).
// The four starting tokens are the spec values; the rest are derived tints so every color
// in the game comes from this one file.
export const palette = {
  moss: '#4F6B3A',
  stone: '#7A7D80',
  rune: '#3FE0E8',
  shadow: '#1E2420',

  mossLight: '#7C9A45',
  mossDark: '#3A5230',
  leaf: '#8FA83A',
  leafDark: '#5E7A2E',
  stoneLight: '#A4A7A6',
  stoneDark: '#565A5C',
  bark: '#D9D8CC',      // birch-like trunks from the reference
  wood: '#7A5236',
  woodDark: '#553823',
  clay: '#B0693F',
  parchment: '#EFE3C4',
  ink: '#2B2A24',
  sky: '#C9D6C0',       // F1.4 fog + background, palette-tinted so there are no black voids
  hemiGround: '#4F6B3A',
  sun: '#FFF4DC',
  sunset: '#E8833A',    // A5 (spec v0.02+): Act 1 sunset sky (F2.2)
  dusk: '#5B3A6B',
  // v0.03 F2.2 / D13: sunset light and the Ruined Library's fire-scarred stone (never pure black, F1.4).
  sunLight: '#FFB878',
  sunsetFog: '#C99A86',
  sunsetGlow: '#F2B36B',
  scorch: '#4A4240',
  scorchLight: '#6B5F58',
} as const;

export type Swatch = keyof typeof palette;

// A5: one 256 px palette-swatch texture. Each swatch is a 32x32 cell in an 8x8 grid;
// meshes pick a color by pointing their UVs at a cell centre.
export const SWATCH_ORDER = Object.keys(palette) as Swatch[];
const GRID = 8;

export function swatchUV(name: Swatch): [number, number] {
  const i = SWATCH_ORDER.indexOf(name);
  const cx = i % GRID, cy = Math.floor(i / GRID);
  return [(cx + 0.5) / GRID, 1 - (cy + 0.5) / GRID];
}

export function makeSwatchCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = palette.shadow;
  g.fillRect(0, 0, 256, 256);
  SWATCH_ORDER.forEach((name, i) => {
    g.fillStyle = palette[name];
    g.fillRect((i % GRID) * 32, Math.floor(i / GRID) * 32, 32, 32);
  });
  return c;
}
