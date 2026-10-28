import * as THREE from 'three';

// Painted textures, made at load time from a few colours plus soft clustered noise. No image files ship.
// Rebuild R1 started these as Vintage Story-style pixel textures; storybook restyle S3 brightened the ramps
// toward the "Echoes of Avalon" palette and filters them smoothly, so they read hand-painted. Every tile is TILE px and covers
// 1 m (TEXELS_PER_M), so props, walls and ground share one texel density.
// PLACEHOLDER: hand-painted texture atlas once one is designed.

const TILE = 32;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = ([r, g, b]: RGB, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

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
    const t = Math.min(0.999, Math.max(0, n1[i] * 0.6 + n2[i] * 0.4 + (R() - 0.5) * j * 0.4));   // S3: soft, little per-texel speckle
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
    mottle(g, W, H, ['#5C8A36', '#689A3C', '#74A742', '#82B44A', '#92C055'], R, { cells: 4 });
    for (let i = 0; i < 8; i++) px(g, Math.floor(R() * W), Math.floor(R() * H), '#A8CC66');
  },
  dirt(g, W, H, R) {
    mottle(g, W, H, ['#8A6A44', '#987650', '#A6845C', '#B49268', '#C2A076'], R, { cells: 5 });
    for (let i = 0; i < 6; i++) px(g, Math.floor(R() * W), Math.floor(R() * H), '#D2BC98');
  },
  paving(g, W, H, R) {
    mottle(g, W, H, ['#A89C88', '#B4A894', '#C0B4A0', '#CCC0AC', '#D8CCB8'], R, { cells: 6 });
    g.fillStyle = '#7A6E5E';
    // Four irregular slabs per tile with dark grout lines and moss in the cracks.
    const mx = 14 + Math.floor(R() * 5), my = 13 + Math.floor(R() * 6);
    g.fillRect(0, my, W, 1); g.fillRect(mx, 0, 1, my); g.fillRect((mx + 16) % W, my, 1, H - my);
    g.fillRect(0, 0, W, 1); g.fillRect(0, 0, 1, H);
    for (let i = 0; i < 14; i++) px(g, Math.floor(R() * W), R() < 0.5 ? my + (R() < 0.5 ? 1 : -1) : Math.floor(R() * H), R() < 0.6 ? '#74A742' : '#689A3C');
  },
  stone(g, W, H, R) {
    mottle(g, W, H, ['#968C7E', '#A49A8A', '#B2A896', '#C0B6A2', '#CEC4B0'], R, { cells: 4 });
    for (let i = 0; i < 4; i++) { const x = Math.floor(R() * W), y = Math.floor(R() * H); px(g, x, y, '#7E7466'); px(g, x + 1, y, '#7E7466'); }
  },
  mossStone(g, W, H, R) {
    PAINTERS.stone(g, W, H, R);
    const n = valueNoise(W, H, 3, R);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const m = n[y * W + x] + (1 - y / H) * 0.35;   // moss gathers on top
      if (m > 0.8) px(g, x, y, R() < 0.5 ? '#74A742' : '#82B44A');
    }
  },
  bricks(g, W, H, R) {
    // Ashlar blocks, then scorched: soot climbs from the bottom and the fire's heat browns the stone.
    mottle(g, W, H, ['#A0907A', '#AE9E86', '#BCAC94', '#C8B8A0', '#D4C4AC'], R, { cells: 6 });
    g.fillStyle = '#6E604E';
    for (let row = 0; row < H; row += 8) {
      g.fillRect(0, row, W, 1);
      const off = (row / 8) % 2 ? 8 : 0;
      for (let x = off; x < W; x += 16) g.fillRect(x, row, 1, 8);
    }
    // Soot: a light, patchy darkening (texel noise, not stencilled blobs).
    const n = valueNoise(W, H, 6, R);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (n[y * W + x] + (R() - 0.5) * 0.25 > 0.78) px(g, x, y, '#4E4236', 0.12);
  },
  bark(g, W, H, R) {
    mottle(g, W, H, ['#5A4030', '#6A4C38', '#7A5A42', '#8A684C'], R, { cells: 3, jitter: 0.3 });
    // Vertical furrows.
    for (let x = 0; x < W; x += 3 + Math.floor(R() * 3)) for (let y = 0; y < H; y++) if (R() < 0.8) px(g, x, y, '#4A3426');
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
    mottle(g, W, H, ['#3E6E2C', '#4C7E32', '#5A8E3A', '#6A9E42', '#7EB04E'], R, { cells: 5, jitter: 0.35, alpha: (x, y) => (holes[y * W + x] + (R() - 0.5) * 0.3 < 0.3 ? 0 : 1) });
    for (let i = 0; i < 8; i++) px(g, Math.floor(R() * W), Math.floor(R() * H), '#C08A2E');   // a few autumn leaves
  },
  leavesLight(g, W, H, R) {
    const holes = valueNoise(W, H, 8, R);
    mottle(g, W, H, ['#5E8E34', '#6E9E3C', '#80AE46', '#94C052', '#A8CE60'], R, { cells: 5, jitter: 0.35, alpha: (x, y) => (holes[y * W + x] + (R() - 0.5) * 0.3 < 0.3 ? 0 : 1) });
  },
  grassBlades(g, W, H, R) {
    g.clearRect(0, 0, W, H);
    const cols = ['#64923A', '#70A040', '#7CAC46', '#88B84E', '#96C258', '#AED06A'];
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
    mottle(g, W, H, ['#7A5236', '#865C3E', '#926646', '#9E7050'], R, { cells: 2, jitter: 0.25 });
    g.fillStyle = '#4A3020';
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
    mottle(g, W, H, ['#7A5236', '#865C3E', '#946848', '#A07452'], R, { cells: 2, jitter: 0.2 });
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x++) if (R() < 0.35) px(g, x, y, '#5E3F28');
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

const cache = new Map<TexName, THREE.Texture>();
const canvases = new Map<TexName, HTMLCanvasElement>();
function paint(name: TexName): HTMLCanvasElement {
  let c = canvases.get(name);
  if (c) return c;
  const [W, H] = SIZE[name] ?? [TILE, TILE];
  c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  let seed = 7;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  PAINTERS[name](g, W, H, rng(seed));
  canvases.set(name, c);
  return c;
}

// Cut-out textures (blades, ferns, leaves): smooth filtering would blend the black of the transparent
// texels into every edge and mip, so those texels take their nearest painted neighbour's colour (alpha 0).
function dilated(c: HTMLCanvasElement): THREE.DataTexture | null {
  const W = c.width, H = c.height;
  const src = c.getContext('2d')!.getImageData(0, 0, W, H).data;
  let holes = false;
  for (let i = 3; i < src.length; i += 4) if (src[i] < 255) { holes = true; break; }
  if (!holes) return null;
  const d = new Uint8Array(src.length);
  const filled = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (src[i * 4 + 3] > 0) { filled[i] = 1; d.set(src.subarray(i * 4, i * 4 + 4), i * 4); }
  for (let pass = 0, todo = true; todo && pass < Math.max(W, H); pass++) {
    todo = false;
    const prev = filled.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (prev[i]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = ((y + dy + H) % H) * W + (x + dx + W) % W;
        if (!prev[j]) continue;
        d[i * 4] = d[j * 4]; d[i * 4 + 1] = d[j * 4 + 1]; d[i * 4 + 2] = d[j * 4 + 2]; d[i * 4 + 3] = 0;
        filled[i] = 1; break;
      }
      if (!filled[i]) todo = true;
    }
  }
  // ImageData rows run top-down; texture rows bottom-up.
  const out = new Uint8Array(d.length), row = W * 4;
  for (let y = 0; y < H; y++) out.set(d.subarray(y * row, (y + 1) * row), (H - 1 - y) * row);
  const t = new THREE.DataTexture(out, W, H);
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function pixelTexture(name: TexName): THREE.Texture {
  let t = cache.get(name);
  if (t) return t;
  const c = paint(name);
  t = dilated(c) ?? new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // S3: smooth filtering (painted, not pixel-crisp); mipmapped far away so distant ground doesn't shimmer.
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  cache.set(name, t);
  return t;
}

// "Fast leaves" (Vintage Story's own option): the alpha holes filled with deep shade, so the mesh can be
// opaque. Opaque leaf blocks keep early depth rejection, which matters a lot for fill-rate on phones.
const solidCache = new Map<TexName, THREE.Texture>();
export function solidTexture(name: TexName, shadeHex = '#36602A'): THREE.Texture {
  let t = solidCache.get(name);
  if (t) return t;
  const src = paint(name);
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!;
  g.fillStyle = shadeHex; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
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


