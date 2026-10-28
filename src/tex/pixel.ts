import * as THREE from 'three';

// Painted textures, made at load time from a few colours with soft washes and brush strokes. No image files ship.
// Rebuild R1 started these as Vintage Story-style pixel textures; style pass 1 repaints them fully painted
// (Mega Man Legends-style flat colour with a hand-painted feel). Every tile is TILE px and covers 1 m, so props,
// walls and ground share one texel density.

const TILE = 64;

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

// Style pass 1 ("fully painted", Mike 2026-10-28): every tile is painted with soft washes and brush strokes,
// MML-style flat colour with a hand-painted feel. No per-texel speckle. Tiles are 64 px per metre.

const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// Smooth wash: two soft noise octaves blend smoothly along a dark → light ramp (no banding, no speckle).
function wash(g: CanvasRenderingContext2D, W: number, H: number, ramp: string[], R: () => number, opts: { cells?: number; alpha?: (x: number, y: number) => number } = {}) {
  const n1 = valueNoise(W, H, opts.cells ?? 3, R), n2 = valueNoise(W, H, (opts.cells ?? 3) * 3, R);
  const cols = ramp.map(hex), img = g.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const t = Math.min(0.999, Math.max(0, n1[i] * 0.75 + n2[i] * 0.25)) * (cols.length - 1);
    const k = Math.floor(t), c = lerpRGB(cols[k], cols[Math.min(cols.length - 1, k + 1)], t - k);
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = (opts.alpha ? opts.alpha(x, y) : 1) * 255;
  }
  g.putImageData(img, 0, 0);
}

// Draw `fn` at (x, y) and at its wrapped copies, so strokes that cross an edge tile seamlessly.
function wrapped(W: number, H: number, x: number, y: number, r: number, fn: (x: number, y: number) => void) {
  for (const ox of [0, -W, W]) for (const oy of [0, -H, H]) {
    if (x + ox + r < 0 || x + ox - r > W || y + oy + r < 0 || y + oy - r > H) continue;
    fn(x + ox, y + oy);
  }
}
// A soft round dab (radial falloff): the basic painted blot.
function dab(g: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, r: number, col: string, a: number) {
  const c = hex(col);
  wrapped(W, H, x, y, r, (cx, cy) => {
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, css(c, a)); grd.addColorStop(0.6, css(c, a * 0.6)); grd.addColorStop(1, css(c, 0));
    g.fillStyle = grd; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  });
}
// A tapered brush stroke from (x, y) along angle `ang`, `len` long and `w` wide at its base.
function stroke(g: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, ang: number, len: number, w: number, col: string, a = 1, bend = 0) {
  const c = hex(col), dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  wrapped(W, H, x, y, len + w, (sx, sy) => {
    const ex = sx + dx * len + nx * bend, ey = sy + dy * len + ny * bend, mx = sx + dx * len * 0.5 + nx * bend * 0.6, my = sy + dy * len * 0.5 + ny * bend * 0.6;
    g.fillStyle = css(c, a);
    g.beginPath();
    g.moveTo(sx + nx * w / 2, sy + ny * w / 2);
    g.quadraticCurveTo(mx + nx * w * 0.3, my + ny * w * 0.3, ex, ey);
    g.quadraticCurveTo(mx - nx * w * 0.3, my - ny * w * 0.3, sx - nx * w / 2, sy - ny * w / 2);
    g.closePath(); g.fill();
  });
}
// An irregular rounded blob (stones, cobbles, leaf clumps), lit from the top left.
function blob(g: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, rx: number, ry: number, R: () => number, base: string, light: string, dark: string) {
  const pts = Array.from({ length: 9 }, (_, i) => { const t = i / 9 * Math.PI * 2, k = 0.82 + R() * 0.3; return [Math.cos(t) * rx * k, Math.sin(t) * ry * k]; });
  const path = (cx: number, cy: number) => {
    g.beginPath();
    pts.forEach(([px0, py0], i) => { const [qx, qy] = pts[(i + 1) % pts.length]; const mx = (px0 + qx) / 2, my = (py0 + qy) / 2; if (!i) g.moveTo(cx + (pts[8][0] + px0) / 2, cy + (pts[8][1] + py0) / 2); g.quadraticCurveTo(cx + px0, cy + py0, cx + mx, cy + my); });
    g.closePath();
  };
  const r = Math.max(rx, ry);
  wrapped(W, H, x, y, r, (cx, cy) => {
    const grd = g.createLinearGradient(cx - rx * 0.7, cy - ry * 0.8, cx + rx * 0.6, cy + ry * 0.9);
    grd.addColorStop(0, light); grd.addColorStop(0.45, base); grd.addColorStop(1, dark);
    path(cx, cy); g.fillStyle = grd; g.fill();
  });
}
const scatter = (n: number, W: number, H: number, R: () => number, fn: (x: number, y: number, i: number) => void) => { for (let i = 0; i < n; i++) fn(R() * W, R() * H, i); };

// Each painter paints one tile. Colour ramps run dark → light.
const PAINTERS = {
  grass(g, W, H, R) {
    wash(g, W, H, ['#4E8434', '#5E9638', '#6EA63E', '#80B448'], R, { cells: 3 });
    // Clumps: darker pools at the roots, lighter tips catching the sun.
    scatter(10, W, H, R, (x, y) => dab(g, W, H, x, y, 6 + R() * 7, '#3E6E2A', 0.35));
    const greens = ['#5A9234', '#6AA23C', '#7CB446', '#90C454', '#A6D264'];
    scatter(150, W, H, R, (x, y) => stroke(g, W, H, x, y, -Math.PI / 2 + (R() - 0.5) * 0.9, 3 + R() * 5, 1.4 + R(), greens[Math.floor(R() * greens.length)], 0.85, (R() - 0.5) * 2));
    // A few flowers: little painted dots with a warm centre.
    scatter(3, W, H, R, (x, y) => { const c = R() < 0.5 ? '#F6F0DA' : '#F4CE52'; for (let k = 0; k < 4; k++) dab(g, W, H, x + Math.cos(k * 1.57) * 1.3, y + Math.sin(k * 1.57) * 1.3, 1.3, c, 1); dab(g, W, H, x, y, 1, '#E4962E', 1); });
  },
  dirt(g, W, H, R) {
    wash(g, W, H, ['#88653F', '#97734B', '#A68258', '#B49166'], R, { cells: 4 });
    scatter(8, W, H, R, (x, y) => dab(g, W, H, x, y, 5 + R() * 8, R() < 0.5 ? '#7E5C3A' : '#BC9C72', 0.28));
    scatter(5, W, H, R, (x, y) => { const s = 1 + R() * 1.4; blob(g, W, H, x, y, s * 1.2, s, R, '#A08A6C', '#BCA684', '#7A6448'); });
  },
  paving(g, W, H, R) {
    // Cobbles: irregular rounded stones of mixed sizes on a grout bed, a few moss tufts in the joints.
    wash(g, W, H, ['#6A6254', '#766E60', '#82796A'], R, { cells: 3 });
    const tones = [['#ADA18C', '#C8BEA8', '#8A7F6C'], ['#A39884', '#BEB4A0', '#81776A'], ['#B4A892', '#CEC4AE', '#90856F'], ['#9E9684', '#B8B09E', '#7E7666']];
    const n = 5;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const cw = W / n, ch = H / n, x = (c + 0.5 + (r % 2) * 0.5) * cw + (R() - 0.5) * cw * 0.3, y = (r + 0.5) * ch + (R() - 0.5) * ch * 0.3;
      const t = tones[Math.floor(R() * tones.length)], k = 0.4 + R() * 0.1;
      blob(g, W, H, x, y, cw * k * (0.9 + R() * 0.25), ch * k * (0.85 + R() * 0.2), R, t[0], t[1], t[2]);
    }
    scatter(6, W, H, R, (x, y) => dab(g, W, H, x, y, 1.4 + R() * 1.4, '#6EA040', 0.7));
  },
  stone(g, W, H, R) {
    wash(g, W, H, ['#8E8476', '#9E9484', '#AEA492', '#BEB4A0'], R, { cells: 3 });
    scatter(9, W, H, R, (x, y) => dab(g, W, H, x, y, 5 + R() * 9, R() < 0.5 ? '#80766A' : '#CEC4B0', 0.35));
    // Chisel facets: short light/dark strokes, and a couple of hairline cracks.
    scatter(18, W, H, R, (x, y) => stroke(g, W, H, x, y, R() * Math.PI, 3 + R() * 5, 1.4, R() < 0.5 ? '#C8BEAA' : '#857B6C', 0.45));
    scatter(2, W, H, R, (x, y) => stroke(g, W, H, x, y, 0.4 + R() * 2.2, 10 + R() * 12, 0.9, '#5E564A', 0.6, (R() - 0.5) * 6));
  },
  mossStone(g, W, H, R) {
    PAINTERS.stone(g, W, H, R);
    // Moss gathers on top, in soft painted cushions.
    scatter(26, W, H, R, (x, y) => { if (R() > 1.15 - y / H * 0.9) return; dab(g, W, H, x, y * 0.6, 4 + R() * 6, R() < 0.5 ? '#5E9638' : '#78AE44', 0.75); });
    scatter(16, W, H * 0.6, R, (x, y) => dab(g, W, H, x, y, 1.6, '#A0CC62', 0.7));
  },
  plaster(g, W, H, R) {
    // Lime plaster: pale wash and rain streaks running down. (A bare-stone patch read as paw prints when tiled.)
    wash(g, W, H, ['#CDBFA4', '#D8CBB0', '#E2D6BC', '#EAE0C8'], R, { cells: 3 });
    scatter(6, W, H, R, (x, y) => dab(g, W, H, x, y, 6 + R() * 10, R() < 0.6 ? '#B8A88A' : '#F2EAD6', 0.3));
    scatter(10, W, H, R, (x, y) => stroke(g, W, H, x, y, Math.PI / 2 + (R() - 0.5) * 0.1, 10 + R() * 18, 1.6 + R() * 1.4, '#A8987C', 0.18));
  },
  roofTiles(g, W, H, R) {
    // Two-tone slate shingles: overlapping rounded tiles with a shadowed lower lip (tinted by the lot colour).
    g.fillStyle = '#6E6458'; g.fillRect(0, 0, W, H);
    const rows = 6, per = 5;
    for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < per; c++) {
      const cw = W / per, ch = H / rows, x = (c + 0.5 + (r % 2) * 0.5) * cw + (R() - 0.5) * 1.5, y = (r + 0.6) * ch;
      const light = R() < 0.5;
      blob(g, W, H, x, y, cw * 0.52, ch * 0.62, R, light ? '#D8D0C4' : '#C6BCB0', light ? '#F2ECE2' : '#E2DACE', '#8C8276');
    }
    scatter(5, W, H, R, (x, y) => dab(g, W, H, x, y, 2 + R() * 2, '#7EA850', 0.45));
  },
  bricks(g, W, H, R) {
    // Ashlar blocks with soft bevels, then a light, patchy soot from the fire's heat.
    g.fillStyle = '#6A5E4E'; g.fillRect(0, 0, W, H);
    const rows = 4, bw = W / 2;
    for (let r = 0; r < rows; r++) for (let c = -1; c < 2; c++) {
      const bh = H / rows, x = c * bw + (r % 2) * bw / 2 + bw / 2, y = r * bh + bh / 2;
      const tone = ['#B4A48C', '#C2B29A', '#AA9A82', '#CCBCA4'][Math.floor(R() * 4)];
      wrapped(W, H, x, y, bw, (cx, cy) => {
        const grd = g.createLinearGradient(cx, cy - bh / 2, cx, cy + bh / 2);
        grd.addColorStop(0, '#DCCCB4'); grd.addColorStop(0.2, tone); grd.addColorStop(1, '#8E7E68');
        g.fillStyle = grd; g.beginPath(); g.roundRect(cx - bw / 2 + 1, cy - bh / 2 + 1, bw - 2, bh - 2, 2.5); g.fill();
      });
    }
    scatter(6, W, H, R, (x, y) => dab(g, W, H, x, y, 6 + R() * 8, '#4E4236', 0.16));
  },
  bark(g, W, H, R) {
    wash(g, W, H, ['#4E382A', '#5E4432', '#6E523C', '#7E6046'], R, { cells: 3 });
    // Long vertical furrows with lit ridges between them, and a little moss.
    for (let x = 0; x < W; x += 5 + R() * 4) {
      stroke(g, W, H, x, H + 4, -Math.PI / 2 + (R() - 0.5) * 0.08, H + 8, 2.2, '#3A281E', 0.75, (R() - 0.5) * 3);
      stroke(g, W, H, x + 2.4, R() * H, -Math.PI / 2, 8 + R() * 14, 1.4, '#8E6C50', 0.55);
    }
    scatter(5, W, H, R, (x, y) => dab(g, W, H, x, y, 2 + R() * 3, '#5E7A2E', 0.6));
  },
  birch(g, W, H, R) {
    wash(g, W, H, ['#BDB9AC', '#CCC8BC', '#DAD7CC', '#E8E6DC'], R, { cells: 3 });
    scatter(14, W, H, R, (x, y) => stroke(g, W, H, x, y, (R() - 0.5) * 0.15, 3 + R() * 9, 1.6 + R() * 1.4, R() < 0.7 ? '#2E2C26' : '#5A584E', 0.85));
  },
  leaves(g, W, H, R) {
    // Leaf clumps with a cut-out edge: overlapping painted blobs, darker underneath, catching light on top.
    g.clearRect(0, 0, W, H);
    scatter(22, W, H, R, (x, y) => { const s = 5 + R() * 6; blob(g, W, H, x, y, s, s * 0.85, R, '#4C7E32', '#7EB04E', '#2E5422'); });
    scatter(30, W, H, R, (x, y) => stroke(g, W, H, x, y, -0.8 + R() * 0.5, 2 + R() * 3, 1.6, R() < 0.8 ? '#8CC058' : '#C08A2E', 0.8));
  },
  leavesLight(g, W, H, R) {
    g.clearRect(0, 0, W, H);
    scatter(22, W, H, R, (x, y) => { const s = 5 + R() * 6; blob(g, W, H, x, y, s, s * 0.85, R, '#6E9E3C', '#A4CC5E', '#46702A'); });
    scatter(30, W, H, R, (x, y) => stroke(g, W, H, x, y, -0.8 + R() * 0.5, 2 + R() * 3, 1.6, '#B4D872', 0.8));
  },
  grassBlades(g, W, H, R) {
    // Tapered blades, dark at the root and sunlit at the tip.
    g.clearRect(0, 0, W, H);
    const tips = ['#9CCC5C', '#AED86A', '#BCE07A', '#8EC452'];
    for (let b = 0; b < 16; b++) {
      const x = 4 + R() * (W - 8), h = H * (0.45 + R() * 0.5), ang = -Math.PI / 2 + (R() - 0.5) * 0.5, bend = (R() - 0.5) * 8, w = 3 + R() * 2;
      const grd = g.createLinearGradient(0, H, 0, H - h);
      grd.addColorStop(0, '#4E8030'); grd.addColorStop(0.55, '#74AA42'); grd.addColorStop(1, tips[Math.floor(R() * tips.length)]);
      const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, ex = x + dx * h + nx * bend, ey = H + dy * h + ny * bend;
      g.fillStyle = grd; g.beginPath();
      g.moveTo(x + nx * w / 2, H + ny * w / 2);
      g.quadraticCurveTo(x + dx * h * 0.5 + nx * (bend * 0.6 + w * 0.3), H + dy * h * 0.5 + ny * (bend * 0.6 + w * 0.3), ex, ey);
      g.quadraticCurveTo(x + dx * h * 0.5 + nx * (bend * 0.6 - w * 0.3), H + dy * h * 0.5 + ny * (bend * 0.6 - w * 0.3), x - nx * w / 2, H - ny * w / 2);
      g.closePath(); g.fill();
    }
  },
  fern(g, W, H, R) {
    g.clearRect(0, 0, W, H);
    for (let f = 0; f < 3; f++) {
      const bx = W / 2 + (f - 1) * 12, ang = -Math.PI / 2 + (f - 1) * 0.4, len = H * (0.8 + R() * 0.15);
      stroke(g, W * 10, H * 10, bx, H, ang, len, 2, '#3C5C24', 1);
      for (let k = 1; k < 9; k++) {
        const t = k / 9, px0 = bx + Math.cos(ang) * len * t, py0 = H + Math.sin(ang) * len * t, l = (1 - Math.abs(t - 0.4) * 1.4) * 12;
        for (const side of [-1, 1]) stroke(g, W * 10, H * 10, px0, py0, ang + side * 1.15, Math.max(2, l), 3, side < 0 ? '#567C2E' : '#6E9838', 1);
      }
    }
  },
  flowers(g, W, H, R) {
    PAINTERS.grassBlades(g, W, H, R);
    scatter(4, W - 16, H * 0.4, R, (x0, y0) => {
      const x = x0 + 8, y = y0 + 6, c = R() < 0.5 ? '#F6F0DA' : '#F4CE52';
      for (let k = 0; k < 5; k++) dab(g, W * 10, H * 10, x + Math.cos(k * 1.26) * 2.4, y + Math.sin(k * 1.26) * 2.4, 2.2, c, 1);
      dab(g, W * 10, H * 10, x, y, 1.6, '#E4962E', 1);
    });
  },
  planks(g, W, H, R) {
    // Boards with dark gaps and flowing grain.
    const n = 4, bw = W / n;
    for (let i = 0; i < n; i++) {
      const tone = ['#7E563A', '#8A6042', '#966A4A', '#86603E'][Math.floor(R() * 4)];
      g.fillStyle = tone; g.fillRect(i * bw, 0, bw, H);
      for (let k = 0; k < 5; k++) stroke(g, W, H, i * bw + 2 + R() * (bw - 4), R() * H, Math.PI / 2 + (R() - 0.5) * 0.06, 14 + R() * 30, 1.2, R() < 0.5 ? '#5E3E28' : '#A88060', 0.5, (R() - 0.5) * 3);
      if (R() < 0.4) dab(g, W, H, i * bw + bw / 2, R() * H, 2.2, '#4A3020', 0.7);   // a knot
      g.fillStyle = '#3E2818'; g.fillRect(i * bw, 0, 1.5, H);
      g.fillStyle = 'rgba(255,230,190,0.18)'; g.fillRect(i * bw + 1.5, 0, 1.5, H);
    }
  },
  door(g, W, H, R) {
    PAINTERS.planks(g, W, H, R);
    // Iron bands + studs + a ring pull (the door tile is stretched over 1.8 x 3.4 m).
    for (const y of [Math.floor(H * 0.18), Math.floor(H * 0.78)]) {
      g.fillStyle = '#34322E'; g.fillRect(0, y, W, 6); g.fillStyle = '#5E5C56'; g.fillRect(0, y, W, 2);
      for (let x = 4; x < W; x += 12) dab(g, W, H, x, y + 3, 1.8, '#A4A49C', 1);
    }
    g.strokeStyle = '#6E6E6A'; g.lineWidth = 2; g.beginPath(); g.arc(W - 13, H * 0.5 + 5, 5, 0, Math.PI * 2); g.stroke();
  },
  wood(g, W, H, R) {
    wash(g, W, H, ['#76503A', '#845C40', '#926848', '#9E7452'], R, { cells: 2 });
    scatter(16, W, H, R, (x, y) => stroke(g, W, H, x, y, (R() - 0.5) * 0.08, 14 + R() * 24, 1.2, R() < 0.6 ? '#5E3F28' : '#AE8460', 0.45, (R() - 0.5) * 3));
  },
  parchment(g, W, H, R) {
    wash(g, W, H, ['#D9CBA6', '#E3D6B4', '#EFE3C4', '#F5ECD4'], R, { cells: 3 });
    g.fillStyle = '#8A7E66';
    for (let y = 12; y < H - 8; y += 8) g.fillRect(8, y, W - 16 - Math.floor(R() * 16), 1.5);
  },
  cover(g, W, H, R) {
    wash(g, W, H, ['#7E3A22', '#8E4628', '#9E522E', '#B0693F'], R, { cells: 3 });
    g.fillStyle = '#F2C94C'; g.fillRect(4, 4, W - 8, 2); g.fillRect(4, H - 6, W - 8, 2);
  },
} satisfies Record<string, (g: CanvasRenderingContext2D, W: number, H: number, R: () => number) => void>;

export type TexName = keyof typeof PAINTERS;
const SIZE: Partial<Record<TexName, [number, number]>> = { door: [64, 128] };

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


