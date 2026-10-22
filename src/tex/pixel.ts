import * as THREE from 'three';

// Rebuild R1 (docs/vision.md): Vintage Story-style pixel textures, painted at load time from a few
// colours plus clustered per-texel noise. No image files ship. Every tile is TILE px and covers
// 1 m (TEXELS_PER_M), so props, walls and ground share one texel density.
// PLACEHOLDER: hand-painted texture atlas once one is designed.

export const TILE = 32;
export const TEXELS_PER_M = 32;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = ([r, g, b]: RGB, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const shade = (c: RGB, k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise on a W x H grid, `cells` lattice points across: soft clusters, not salt-and-pepper.
function valueNoise(W: number, H: number, cells: number, R: () => number): Float32Array {
  const cy = Math.max(1, Math.round(cells * H / W));
  const lat = Array.from({ length: cells * cy }, () => R());
  const at = (x: number, y: number) => lat[((y % cy) + cy) % cy * cells + ((x % cells) + cells) % cells];
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = x / W * cells, fy = y / H * cy, ix = Math.floor(fx), iy = Math.floor(fy);
    const sx = fx - ix, sy = fy - iy, u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * u;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * u;
    out[y * W + x] = a + (b - a) * v;
  }
  return out;
}

// Mottled fill: two noise octaves + per-texel jitter pick from a dark→light ramp (the Vintage Story look).
function mottle(g: CanvasRenderingContext2D, W: number, H: number, ramp: string[], R: () => number, opts: { cells?: number; jitter?: number; alpha?: (x: number, y: number) => number } = {}) {
  const n1 = valueNoise(W, H, opts.cells ?? 4, R), n2 = valueNoise(W, H, (opts.cells ?? 4) * 2, R);
  const cols = ramp.map(hex), img = g.getImageData(0, 0, W, H), d = img.data, j = opts.jitter ?? 0.22;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const t = Math.min(0.999, Math.max(0, n1[i] * 0.6 + n2[i] * 0.4 + (R() - 0.5) * j));
    const c = cols[Math.floor(t * cols.length)];
    const a = opts.alpha ? opts.alpha(x, y) : 1;
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
}

const px = (g: CanvasRenderingContext2D, x: number, y: number, c: RGB | string, a = 1) => {
  g.fillStyle = typeof c === 'string' ? c : css(c, a); g.fillRect(x, y, 1, 1);
};

// Each painter draws one tile. Colour ramps run dark → light.
const PAINTERS = {
  grass(g, W, H, R) {
    mottle(g, W, H, ['#3E5A26', '#4B6B2C', '#587A32', '#68893A', '#7C9A45'], R, { cells: 4 });
    for (let i = 0; i < 18; i++) px(g, Math.floor(R() * W), Math.floor(R() * H), R() < 0.5 ? '#97B055' : '#33491F');
  },
  dirt(g, W, H, R) {
    mottle(g, W, H, ['#4E3B28', '#5E4730', '#6E5538', '#7E6443', '#8C7150'], R, { cells: 5 });
    for (let i = 0; i < 10; i++) px(g, Math.floor(R() * W), Math.floor(R() * H), '#9A9389');
  },
  paving(g, W, H, R) {
    mottle(g, W, H, ['#6E6F68', '#7E7F77', '#8E8E85', '#9C9B90', '#ABA99C'], R, { cells: 6 });
    g.fillStyle = '#4A4A44';
    // Four irregular slabs per tile with dark grout lines and moss in the cracks.
    const mx = 14 + Math.floor(R() * 5), my = 13 + Math.floor(R() * 6);
    g.fillRect(0, my, W, 1); g.fillRect(mx, 0, 1, my); g.fillRect((mx + 16) % W, my, 1, H - my);
    g.fillRect(0, 0, W, 1); g.fillRect(0, 0, 1, H);
    for (let i = 0; i < 14; i++) px(g, Math.floor(R() * W), R() < 0.5 ? my + (R() < 0.5 ? 1 : -1) : Math.floor(R() * H), R() < 0.6 ? '#587A32' : '#4B6B2C');
  },
  stone(g, W, H, R) {
    mottle(g, W, H, ['#5A5C5A', '#686B68', '#777A76', '#868883', '#979892'], R, { cells: 4 });
    for (let i = 0; i < 6; i++) { const x = Math.floor(R() * W), y = Math.floor(R() * H); px(g, x, y, '#4A4C4A'); px(g, x + 1, y, '#4A4C4A'); }
  },
  mossStone(g, W, H, R) {
    PAINTERS.stone(g, W, H, R);
    const n = valueNoise(W, H, 3, R);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const m = n[y * W + x] + (1 - y / H) * 0.35;   // moss gathers on top
      if (m > 0.78) px(g, x, y, R() < 0.5 ? '#5E7A2E' : '#6F8C38');
    }
  },
  bricks(g, W, H, R) {
    // Ashlar blocks, then scorched: soot climbs from the bottom and the fire's heat browns the stone.
    mottle(g, W, H, ['#5A544E', '#68615A', '#766E65', '#847A70', '#92877B'], R, { cells: 6 });
    g.fillStyle = '#2E2A28';
    for (let row = 0; row < H; row += 8) {
      g.fillRect(0, row, W, 1);
      const off = (row / 8) % 2 ? 8 : 0;
      for (let x = off; x < W; x += 16) g.fillRect(x, row, 1, 8);
    }
    // Soot: a light, patchy darkening (texel noise, not stencilled blobs).
    const n = valueNoise(W, H, 6, R);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (n[y * W + x] + (R() - 0.5) * 0.25 > 0.7) px(g, x, y, '#2E2A28', 0.18);
  },
  bark(g, W, H, R) {
    mottle(g, W, H, ['#3A2A1C', '#4A3624', '#5A432C', '#6A5034'], R, { cells: 3, jitter: 0.3 });
    // Vertical furrows.
    for (let x = 0; x < W; x += 3 + Math.floor(R() * 3)) for (let y = 0; y < H; y++) if (R() < 0.8) px(g, x, y, '#2C2016');
    for (let i = 0; i < 12; i++) px(g, Math.floor(R() * W), Math.floor(R() * H), '#5E7A2E');
  },
  birch(g, W, H, R) {
    mottle(g, W, H, ['#BDBAAE', '#CCC9BD', '#D9D8CC', '#E6E4DA'], R, { cells: 3 });
    // Horizontal black lenticels, the birch tell.
    for (let i = 0; i < 16; i++) {
      const y = Math.floor(R() * H), x = Math.floor(R() * W), w = 2 + Math.floor(R() * 5);
      g.fillStyle = R() < 0.7 ? '#2B2A24' : '#55544C'; g.fillRect(x, y, w, 1);
    }
  },
  leaves(g, W, H, R) {
    // Alpha-cut leaf mass: ~30% holes so canopies read as blocks of foliage, not solid cubes.
    const holes = valueNoise(W, H, 8, R);
    mottle(g, W, H, ['#2E4A1E', '#3C5C24', '#4B6E2A', '#5E8232', '#749A3C'], R, { cells: 5, jitter: 0.35, alpha: (x, y) => (holes[y * W + x] + (R() - 0.5) * 0.3 < 0.3 ? 0 : 1) });
    for (let i = 0; i < 8; i++) px(g, Math.floor(R() * W), Math.floor(R() * H), '#C08A2E');   // a few autumn leaves
  },
  leavesLight(g, W, H, R) {
    const holes = valueNoise(W, H, 8, R);
    mottle(g, W, H, ['#4E6E26', '#5F822E', '#719636', '#86AA42', '#9BBC52'], R, { cells: 5, jitter: 0.35, alpha: (x, y) => (holes[y * W + x] + (R() - 0.5) * 0.3 < 0.3 ? 0 : 1) });
  },
  grassBlades(g, W, H, R) {
    g.clearRect(0, 0, W, H);
    const cols = ['#3E5A26', '#4B6B2C', '#587A32', '#68893A', '#7C9A45', '#97B055'];
    for (let b = 0; b < 14; b++) {
      let x = 2 + R() * (W - 4);
      const h = H * (0.45 + R() * 0.55), lean = (R() - 0.5) * 0.5;
      for (let y = 0; y < h; y++) {
        const c = cols[Math.min(cols.length - 1, Math.floor(y / h * cols.length + R() * 1.2))];
        px(g, Math.floor(x), H - 1 - y, c);
        x += lean * (y / h);
      }
    }
  },
  fern(g, W, H, R) {
    g.clearRect(0, 0, W, H);
    for (let f = 0; f < 3; f++) {
      const base = W / 2 + (f - 1) * 6, lean = (f - 1) * 0.35;
      for (let y = 0; y < H - 2; y++) {
        const x = base + lean * y, spread = Math.max(0, (1 - Math.abs(y / H - 0.45) * 1.8)) * 7;
        px(g, Math.floor(x), H - 1 - y, '#3C5C24');
        for (let s = 1; s <= spread; s++) {
          if ((y + s) % 2) continue;
          px(g, Math.floor(x - s), H - 1 - y - Math.floor(s / 3), s % 3 ? '#5E8232' : '#4B6E2A');
          px(g, Math.floor(x + s), H - 1 - y - Math.floor(s / 3), s % 3 ? '#749A3C' : '#5E8232');
        }
      }
    }
  },
  flowers(g, W, H, R) {
    PAINTERS.grassBlades(g, W, H, R);
    for (let i = 0; i < 4; i++) {
      const x = 4 + Math.floor(R() * (W - 8)), y = 4 + Math.floor(R() * (H * 0.4)), c = R() < 0.5 ? '#F1EEDC' : '#F2C94C';
      px(g, x, y, c); px(g, x + 1, y, c); px(g, x - 1, y, c); px(g, x, y - 1, c); px(g, x, y + 1, c); px(g, x, y, '#E39A2E');
    }
  },
  planks(g, W, H, R) {
    mottle(g, W, H, ['#4A3020', '#553823', '#62412A', '#6E4A30'], R, { cells: 2, jitter: 0.25 });
    g.fillStyle = '#2C1C12';
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 1, H);
    for (let x = 4; x < W; x += 8) for (let y = 0; y < H; y += 1) if (R() < 0.12) px(g, x, y, '#7A5236');
  },
  door(g, W, H, R) {
    PAINTERS.planks(g, W, H, R);
    // Iron bands + studs + a ring pull (the door is tall: this tile is stretched over 1.8 x 3.4 m).
    for (const y of [Math.floor(H * 0.18), Math.floor(H * 0.78)]) {
      g.fillStyle = '#3A3A3A'; g.fillRect(0, y, W, 3); g.fillStyle = '#5A5A58'; g.fillRect(0, y, W, 1);
      for (let x = 2; x < W; x += 6) px(g, x, y + 1, '#8A8A86');
    }
    g.fillStyle = '#6E6E6A'; g.fillRect(W - 9, Math.floor(H * 0.5), 4, 1); g.fillRect(W - 9, Math.floor(H * 0.5) + 3, 4, 1);
    g.fillRect(W - 9, Math.floor(H * 0.5), 1, 4); g.fillRect(W - 6, Math.floor(H * 0.5), 1, 4);
  },
  wood(g, W, H, R) {
    mottle(g, W, H, ['#5E3F28', '#6A4830', '#7A5236', '#875D3E'], R, { cells: 2, jitter: 0.2 });
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x++) if (R() < 0.35) px(g, x, y, '#4A3020');
  },
  parchment(g, W, H, R) {
    mottle(g, W, H, ['#D9CBA6', '#E3D6B4', '#EFE3C4', '#F5ECD4'], R, { cells: 3, jitter: 0.12 });
    g.fillStyle = '#8A7E66';
    for (let y = 6; y < H - 4; y += 4) g.fillRect(4, y, W - 8 - Math.floor(R() * 8), 1);
  },
  cover(g, W, H, R) {
    mottle(g, W, H, ['#7E3A22', '#8E4628', '#9E522E', '#B0693F'], R, { cells: 3, jitter: 0.15 });
    g.fillStyle = '#F2C94C'; g.fillRect(2, 2, W - 4, 1); g.fillRect(2, H - 3, W - 4, 1);
  },
} satisfies Record<string, (g: CanvasRenderingContext2D, W: number, H: number, R: () => number) => void>;

export type TexName = keyof typeof PAINTERS;
const SIZE: Partial<Record<TexName, [number, number]>> = { door: [32, 64], grassBlades: [32, 32], fern: [32, 32] };

const cache = new Map<TexName, THREE.CanvasTexture>();
export function pixelTexture(name: TexName): THREE.CanvasTexture {
  let t = cache.get(name);
  if (t) return t;
  const [W, H] = SIZE[name] ?? [TILE, TILE];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  let seed = 7;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  PAINTERS[name](g, W, H, rng(seed));
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Crisp texels up close (the pixel look); mipmapped far away so distant ground doesn't shimmer.
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.anisotropy = 4;
  cache.set(name, t);
  return t;
}

// "Fast leaves" (Vintage Story's own option): the alpha holes filled with deep shade, so the mesh can be
// opaque. Opaque leaf blocks keep early depth rejection, which matters a lot for fill-rate on phones.
const solidCache = new Map<TexName, THREE.CanvasTexture>();
export function solidTexture(name: TexName, shadeHex = '#1F3316'): THREE.CanvasTexture {
  let t = solidCache.get(name);
  if (t) return t;
  const src = pixelTexture(name).image as HTMLCanvasElement;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!;
  g.fillStyle = shadeHex; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0);
  t = pixelTexture(name).clone();
  t.image = c;
  t.needsUpdate = true;
  solidCache.set(name, t);
  return t;
}

// Painted-light helper for unlit (Mega Man Legends-style) meshes: a soft radial blob shadow.
let blobTex: THREE.CanvasTexture | null = null;
export function blobShadowTexture(): THREE.CanvasTexture {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  grd.addColorStop(0, 'rgba(20,24,16,0.55)'); grd.addColorStop(1, 'rgba(20,24,16,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

// Soft vertical light shaft for god rays (white core, fades at both ends and both edges).
let shaftTex: THREE.CanvasTexture | null = null;
export function shaftTexture(): THREE.CanvasTexture {
  if (shaftTex) return shaftTex;
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(32, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 32; x++) {
    const ex = Math.sin(Math.PI * x / 31), ey = Math.sin(Math.PI * y / 127);
    const a = Math.pow(ex, 2) * Math.pow(ey, 0.7);
    const i = (y * 32 + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 236; img.data[i + 2] = 190; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  shaftTex = new THREE.CanvasTexture(c);
  shaftTex.colorSpace = THREE.SRGBColorSpace;
  return shaftTex;
}

export { shade, hex };
