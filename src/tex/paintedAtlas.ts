import * as THREE from 'three';
import { rng } from './pixel';

// Restyle S2g (Tree of Savior pipeline): a hand-painted diffuse atlas per character, generated at load.
// One tile per colour the figure uses, painted by material kind: cloth gets folds and soft strokes, hair
// gets strands, leather gets scuffs and stitching, metal gets a sheen, skin stays soft. Every tile darkens
// toward its edges, so each face of a part reads as painted occlusion. The light from painted() rides
// on top in the vertex colours. 512 px, cached by the set of tiles, so identical figures share one atlas.

export type PaintKind = 'cloth' | 'skin' | 'hair' | 'leather' | 'metal';
export interface Tile { color: string; kind: PaintKind }
export interface Atlas { texture: THREE.CanvasTexture; rect(color: string): [number, number, number, number] }

const SIZE = 512, PAD = 3;
const cache = new Map<string, Atlas>();

const shade = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

function paintTile(g: CanvasRenderingContext2D, x0: number, y0: number, s: number, t: Tile, R: () => number) {
  g.save();
  g.beginPath(); g.rect(x0, y0, s, s); g.clip();
  g.fillStyle = t.color; g.fillRect(x0, y0, s, s);
  const stroke = (col: string, a: number, w: number, x1: number, y1: number, x2: number, y2: number, bend = 0) => {
    g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0 + x1 * s, y0 + y1 * s);
    g.quadraticCurveTo(x0 + ((x1 + x2) / 2 + bend) * s, y0 + (y1 + y2) / 2 * s, x0 + x2 * s, y0 + y2 * s);
    g.stroke();
  };
  if (t.kind === 'cloth') {
    for (let i = 0; i < 26; i++) {   // soft brush strokes, mostly vertical, a shade either way
      const x = R(), y = R();
      stroke(shade(t.color, R() < 0.5 ? 1.18 : 0.82), 0.32, s * (0.06 + R() * 0.08), x, y, x + (R() - 0.5) * 0.2, y + 0.2 + R() * 0.3);
    }
    for (let i = 0; i < 4; i++) {    // fold lines with a lit edge beside them
      const x = 0.15 + R() * 0.7, b = (R() - 0.5) * 0.25;
      stroke(shade(t.color, 0.6), 0.6, Math.max(2, s * 0.035), x, 0.05 + R() * 0.2, x + (R() - 0.5) * 0.15, 0.7 + R() * 0.3, b);
      stroke(shade(t.color, 1.3), 0.45, Math.max(1.5, s * 0.02), x + 0.03, 0.08 + R() * 0.2, x + 0.03 + (R() - 0.5) * 0.15, 0.65 + R() * 0.3, b);
    }
  } else if (t.kind === 'hair') {
    for (let i = 0; i < 34; i++) {   // strands
      const x = R();
      stroke(shade(t.color, R() < 0.5 ? 1.2 : 0.75), 0.4, Math.max(1, s * (0.012 + R() * 0.02)), x, -0.05, x + (R() - 0.5) * 0.12, 1.05, (R() - 0.5) * 0.1);
    }
    g.globalAlpha = 0.25; g.fillStyle = '#FFFFFF'; g.fillRect(x0, y0 + s * 0.22, s, s * 0.05);   // shine band
  } else if (t.kind === 'leather') {
    for (let i = 0; i < 40; i++) { g.globalAlpha = 0.25; g.fillStyle = shade(t.color, R() < 0.5 ? 1.3 : 0.7); g.fillRect(x0 + R() * s, y0 + R() * s, 1 + R() * 3, 1 + R() * 2); }
    g.globalAlpha = 0.5; g.strokeStyle = shade(t.color, 1.45); g.lineWidth = Math.max(1, s * 0.012); g.setLineDash([s * 0.04, s * 0.03]);
    g.strokeRect(x0 + s * 0.1, y0 + s * 0.1, s * 0.8, s * 0.8); g.setLineDash([]);   // stitching
  } else if (t.kind === 'metal') {
    const grad = g.createLinearGradient(x0, y0, x0 + s, y0 + s);
    grad.addColorStop(0, shade(t.color, 0.8)); grad.addColorStop(0.45, shade(t.color, 1.45)); grad.addColorStop(0.55, shade(t.color, 1.1)); grad.addColorStop(1, shade(t.color, 0.75));
    g.globalAlpha = 0.85; g.fillStyle = grad; g.fillRect(x0, y0, s, s);
  } else {
    for (let i = 0; i < 10; i++) { const x = R(), y = R(); stroke(shade(t.color, R() < 0.5 ? 1.05 : 0.95), 0.25, s * 0.15, x, y, x + 0.1, y + 0.1); }
  }
  // Painted occlusion toward every edge of the tile (= every face of the part).
  g.globalAlpha = 1;
  const ao = t.kind === 'skin' ? 0.12 : 0.32;
  for (const [ax, ay, bx, by] of [[0, 0, 0, 1], [0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0]]) {
    const grad = g.createLinearGradient(x0 + ax * s, y0 + ay * s, x0 + (ax + (bx - ax) * 0.22) * s, y0 + (ay + (by - ay) * 0.22) * s);
    grad.addColorStop(0, `rgba(30,20,30,${ao})`); grad.addColorStop(1, 'rgba(30,20,30,0)');
    g.fillStyle = grad; g.fillRect(x0, y0, s, s);
  }
  g.restore();
}

export function paintedAtlas(tiles: Tile[]): Atlas {
  const key = tiles.map((t) => t.color + t.kind).join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const n = Math.max(1, Math.ceil(Math.sqrt(tiles.length))), s = Math.floor(SIZE / n);
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const rects = new Map<string, [number, number, number, number]>();
  tiles.forEach((t, i) => {
    const x = (i % n) * s, y = Math.floor(i / n) * s;
    let seed = 11;
    for (const ch of t.color + t.kind) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    paintTile(g, x, y, s, t, rng(seed));
    // UV rect inside the padding (v runs bottom-up in UV space, top-down on the canvas).
    rects.set(t.color, [(x + PAD) / SIZE, 1 - (y + s - PAD) / SIZE, (s - 2 * PAD) / SIZE, (s - 2 * PAD) / SIZE]);
  });
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const atlas: Atlas = { texture, rect: (color) => rects.get(color) ?? [0, 0, 1 / SIZE, 1 / SIZE] };
  cache.set(key, atlas);
  return atlas;
}

/** Squeeze a part's 0..1 UVs into its tile. */
export function toTile(geo: THREE.BufferGeometry, r: [number, number, number, number]) {
  const uv = geo.attributes.uv;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + THREE.MathUtils.clamp(uv.getX(i), 0, 1) * r[2], r[1] + THREE.MathUtils.clamp(uv.getY(i), 0, 1) * r[3]);
  uv.needsUpdate = true;
}
