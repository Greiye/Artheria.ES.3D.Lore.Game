import * as THREE from 'three';
import { rng } from '../tex/pixel';
import { figureLight } from './figure';

// Quad detail 3 (Mike 2026-11-04, Graphics thread: quad-based detail, clouds and distant hills): big painted sprite
// cards for depth. Two rings of rolling-hill cards stand between the forest edge and the mountains (the far ring
// paler and bluer, aerial perspective), and pixel-art clouds drift slowly round the sky. Our own art, painted at load.
// Each ring and the clouds are one merged mesh apiece: three draw calls. Tinted by the hour, so they dim at night.
const HW = 128, HH = 32, HILLS = 3;     // hill cards: 128 x 32 px each
const CWD = 64, CHT = 32, CLOUDS = 4;   // cloud cards: 64 x 32 px each

function paintHills(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = HW * HILLS; c.height = HH * 2;   // row 0 near (greener), row 1 far (bluer)
  const g = c.getContext('2d')!;
  for (let row = 0; row < 2; row++) for (let k = 0; k < HILLS; k++) {
    const R = rng(2203 + k * 17 + row * 101), ox = k * HW, oy = row * HH;
    const [body, light, dark, tree] = row === 0 ? ['#4E7350', '#628A5E', '#3E5E42', '#2E4A34'] : ['#7D978F', '#8EA8A0', '#6C867E', '#5E7870'];
    // A rolling ridge line from a few sine humps; the left and right edges meet at the same height so cards tile.
    const p1 = R() * 6, p2 = R() * 6, a1 = 4 + R() * 4, a2 = 2 + R() * 3;
    const ridge = (x: number) => HH * 0.45 - a1 * Math.sin((x / HW) * Math.PI * 2 + p1) - a2 * Math.sin((x / HW) * Math.PI * 6 + p2) + 4;
    for (let x = 0; x < HW; x++) {
      const top = Math.round(ridge(x)), slope = ridge(x + 1) - ridge(x);
      for (let y = top; y < HH; y++) {
        g.fillStyle = y === top ? (slope < 0 ? light : dark) : (y < top + 3 && slope < 0 ? light : body);
        if (y > top + 2 && R() < 0.04) g.fillStyle = dark;
        g.fillRect(ox + x, oy + y, 1, 1);
      }
      if (R() < 0.35) {   // little pixel trees along the ridge
        const h = 2 + Math.floor(R() * 3);
        g.fillStyle = tree; g.fillRect(ox + x, oy + top - h, 1, h); if (R() < 0.5) g.fillRect(ox + x + 1, oy + top - h + 1, 1, h - 1);
      }
    }
  }
  return c;
}

function paintClouds(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = CWD * CLOUDS; c.height = CHT;
  const g = c.getContext('2d')!;
  for (let k = 0; k < CLOUDS; k++) {
    const R = rng(808 + k * 29), ox = k * CWD;
    // Puffs: a flat bottom and three to five round lumps on top, lit from above, shaded under.
    const puffs: [number, number, number][] = [];
    const n = 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) puffs.push([10 + (i + 0.5) * (44 / n) + (R() - 0.5) * 4, 18 - R() * 6, 6 + R() * 5]);
    const inside = (x: number, y: number) => y <= 24 && puffs.some(([cx, cy, r]) => (x - cx) ** 2 + ((y - cy) * 1.3) ** 2 <= r * r) || (y > 18 && y <= 24 && x > 8 && x < 56);
    for (let y = 0; y < CHT; y++) for (let x = 0; x < CWD; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x, y - 1), under = y > 20;
      g.fillStyle = edge ? '#FFFFFF' : under ? '#C8D2E2' : y > 16 ? '#E2E8F2' : '#F4F7FB';
      g.fillRect(ox + x, y, 1, 1);
    }
  }
  return c;
}

function sheet(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

/** Quads facing the middle of the map, merged. `cell` picks u0..u1 / v0..v1 on the sheet. */
function ring(cards: { x: number; y: number; z: number; w: number; h: number; u: [number, number]; v: [number, number]; up?: boolean }[]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (const c of cards) {
    const len = Math.hypot(c.x, c.z) || 1, nx = -c.x / len, nz = -c.z / len;   // facing in
    const rx = -nz, rz = nx, b = pos.length / 3;   // the card's right
    const hw = c.w / 2;
    pos.push(c.x - rx * hw, c.y, c.z - rz * hw, c.x + rx * hw, c.y, c.z + rz * hw, c.x + rx * hw, c.y + c.h, c.z + rz * hw, c.x - rx * hw, c.y + c.h, c.z - rz * hw);
    uv.push(c.u[0], c.v[0], c.u[1], c.v[0], c.u[1], c.v[1], c.u[0], c.v[1]);
    for (let i = 0; i < 4; i++) c.up ? nrm.push(0, 1, 0) : nrm.push(nx * 0.6, 0.8, nz * 0.6);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export interface SkyCards { hills: THREE.Mesh[]; clouds: THREE.Mesh; update(t: number): void }

export function buildSkyCards(scene: THREE.Scene): SkyCards {
  const R = rng(5511);
  const hillTex = sheet(paintHills()), cloudTex = sheet(paintClouds());
  // Unlit, tinted by the hour like the characters (figureLight.shade: white by day, dim blue at night), so a card's
  // back face (seen from outside the ring) never goes dark.
  const hillMat = new THREE.MeshBasicMaterial({ map: hillTex, alphaTest: 0.5, fog: false, side: THREE.DoubleSide, color: figureLight.shade.value });
  const hills: THREE.Mesh[] = [];
  // Two rings: near (r ~ 82 m, greener, lower) and far (r ~ 100 m, bluer, taller), cards overlapping round the circle.
  for (const [row, r, h, w] of [[1, 104, 50, 84], [0, 88, 40, 70]] as const) {   // tall enough to rise over the forest edge
    const cards = [];
    for (let a = R() * 0.3; a < Math.PI * 2; a += (w * 0.8) / r) {
      const k = Math.floor(R() * HILLS), rr = r + (R() - 0.5) * 6;
      cards.push({ x: Math.cos(a) * rr, y: -14 - R() * 2, z: Math.sin(a) * rr, w: w * (0.9 + R() * 0.3), h: h * (0.85 + R() * 0.3),
        u: [k / HILLS, (k + 1) / HILLS] as [number, number], v: row === 0 ? [0.5, 1] as [number, number] : [0, 0.5] as [number, number] });
    }
    const m = new THREE.Mesh(ring(cards), hillMat);
    m.name = row === 0 ? 'hill-cards-near' : 'hill-cards-far'; m.raycast = () => {};
    m.renderOrder = -1;
    scene.add(m); hills.push(m);
  }
  const cloudCards = [];
  for (let i = 0; i < 30; i++) {
    const a = R() * Math.PI * 2, r = 55 + R() * 65, k = Math.floor(R() * CLOUDS), s = 0.8 + R() * 0.8;
    cloudCards.push({ x: Math.cos(a) * r, y: 30 + R() * 22, z: Math.sin(a) * r, w: 34 * s, h: 17 * s, u: [k / CLOUDS, (k + 1) / CLOUDS] as [number, number], v: [0, 1] as [number, number], up: true });
  }
  const clouds = new THREE.Mesh(ring(cloudCards), new THREE.MeshBasicMaterial({ map: cloudTex, alphaTest: 0.5, fog: false, side: THREE.DoubleSide, color: figureLight.shade.value }));
  clouds.name = 'cloud-cards'; clouds.raycast = () => {};
  scene.add(clouds);
  return {
    hills, clouds,
    update(t: number) { clouds.rotation.y = t * 0.004; },   // a slow drift round the sky
  };
}
