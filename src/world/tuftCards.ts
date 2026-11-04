import * as THREE from 'three';
import { rng } from '../tex/pixel';
import { crossed, windify, type Tuft } from './foliage';

// Quad detail 1 (Mike 2026-11-04, Graphics thread: "quad-based detail", grass and flowers first): denser, more varied
// meadow tufts. One painted sheet of eight pixel-art cards (our own art, painted here at load): short grass, tall
// grass, seed-head grass, clover, and four wildflowers (daisies, buttercups, bluebells, poppies). Every tuft is two
// crossed quads like the other undergrowth, all in ONE instanced mesh (one draw call); each instance picks its card.
// Flowers grow in patches of one kind, as they do in a real meadow. Swayed by the same wind.
const CW = 32, CH = 32;
export const TUFT_CARDS = ['short', 'tall', 'seed', 'clover', 'daisy', 'buttercup', 'bluebell', 'poppy'] as const;
export type TuftCard = typeof TUFT_CARDS[number];
const N = TUFT_CARDS.length;
const BLADES = ['#3E6A26', '#4E8030', '#62973A', '#79AE46', '#93C658', '#AED86A'];

function paintSheet(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CW * N; c.height = CH;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, col: string) => { if (x < 0 || x >= CW || y < 0 || y >= CH) return; g.fillStyle = col; g.fillRect(cx0 + Math.round(x), Math.round(y), 1, 1); };
  let cx0 = 0;
  /** A blade from the ground up: dark at the root, lighter toward the tip, leaning as it rises. */
  const blade = (R: () => number, x: number, h: number, lean: number, light = 0) => {
    for (let i = 0; i < h; i++) {
      const t = i / h, k = Math.min(BLADES.length - 1, Math.floor(t * 4) + light);
      px(x + lean * t * t * h * 0.12, CH - 1 - i, BLADES[k]);
      if (i < h * 0.35 && R() < 0.5) px(x + 1 + lean * t * t * h * 0.12, CH - 1 - i, BLADES[Math.max(0, k - 1)]);   // a wider base
    }
  };
  const grassBase = (R: () => number, n: number, hMin: number, hMax: number, light = 0) => {
    for (let b = 0; b < n; b++) blade(R, 3 + R() * (CW - 6), hMin + R() * (hMax - hMin), (R() - 0.5) * 2.2, light);
  };
  /** A flower head on a thin stem: petals in a ring with a darker rim, a centre dot. */
  const flower = (x: number, y: number, petal: string, rim: string, mid: string, r = 1) => {
    for (let s = y + 1; s < CH; s++) px(x, s, '#4E8030');   // the stem
    for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) { const d = Math.hypot(dx, dy); if (d <= r + 1.2 && d > r + 0.3) px(x + dx, y + dy, rim); }
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dy) <= r + 0.3) px(x + dx, y + dy, petal);
    px(x, y, mid);
  };
  TUFT_CARDS.forEach((kind, k) => {
    const R = rng(7301 + k * 53); cx0 = k * CW;
    switch (kind) {
      case 'short': grassBase(R, 22, 6, 14); break;
      case 'tall': grassBase(R, 16, 16, 30, 1); break;
      case 'seed':
        grassBase(R, 14, 10, 22);
        for (let i = 0; i < 4; i++) {   // stems with tan seed heads
          const x = 5 + R() * 22, top = 2 + R() * 6;
          for (let y = top + 5; y < CH; y++) px(x, y, '#7A8E46');
          for (let y = top; y < top + 6; y++) { px(x, y, y % 2 ? '#C8A85E' : '#A88A44'); if (y % 2) px(x + 1, y, '#DCC27A'); }
        }
        break;
      case 'clover':
        grassBase(R, 8, 4, 9);
        for (let i = 0; i < 9; i++) {   // round three-lobed leaves, low
          const x = 4 + R() * 24, y = CH - 3 - R() * 7;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) { px(x + dx * 1.5, y + dy * 1.5, '#3E7A34'); px(x + dx * 1.5 + 1, y + dy * 1.5, '#5C9C44'); }
        }
        for (let i = 0; i < 3; i++) flower(6 + R() * 20, CH - 9 - R() * 5, R() < 0.5 ? '#F2E8F0' : '#E8A6C8', '#7A4A5E', '#F8D8E8');
        break;
      case 'daisy': grassBase(R, 12, 6, 14); for (let i = 0; i < 5; i++) flower(5 + R() * 22, 6 + R() * 12, '#F8F4E6', '#6A6050', '#F2C232', 1); break;
      case 'buttercup': grassBase(R, 12, 6, 16); for (let i = 0; i < 6; i++) flower(4 + R() * 24, 4 + R() * 14, '#F6D23A', '#8A6A18', '#FFF08A', 1); break;
      case 'bluebell':
        grassBase(R, 10, 8, 18);
        for (let i = 0; i < 4; i++) {   // arching stems, bells hanging down one side
          const x = 6 + R() * 20, top = 4 + R() * 8;
          for (let y = top; y < CH; y++) px(x, y, '#4E8030');
          for (let j = 0; j < 4; j++) { const by = top + 1 + j * 3; px(x + 1, by, '#5A6CC8'); px(x + 1, by + 1, '#3E4C9C'); px(x + 2, by + 1, '#7A8CE0'); }
        }
        break;
      case 'poppy': grassBase(R, 12, 8, 18); for (let i = 0; i < 4; i++) flower(5 + R() * 22, 3 + R() * 12, '#E2382C', '#6A1A14', '#2A1A12', 1.4); break;
    }
  });
  return c;
}

/** The meadow tufts: one instanced mesh, each instance one of the painted cards. */
export function tuftCards(scene: THREE.Scene, items: (Tuft & { card: TuftCard })[], size = 0.62): THREE.InstancedMesh {
  const tex = new THREE.CanvasTexture(paintSheet());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  windify(mat, 0.08);
  // Each instance's card: shift the u coordinate into its cell of the sheet.
  const wind = mat.onBeforeCompile, key = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    wind.call(mat, sh, r);
    sh.vertexShader = 'attribute float aCard;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n  vMapUv.x = (vMapUv.x + aCard) / ${N}.0;`);
  };
  mat.customProgramCacheKey = () => key.call(mat) + '+cards';
  const geo = crossed.clone();
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const cards = new Float32Array(items.length);
  const d = new THREE.Object3D();
  items.forEach((it, i) => {
    const tall = it.card === 'tall' || it.card === 'seed' ? 1.35 : 1;
    d.position.set(it.x, it.y ?? 0, it.z); d.rotation.set(0, it.ry, 0); d.scale.set(size * it.s, size * it.s * tall, size * it.s);
    d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    cards[i] = TUFT_CARDS.indexOf(it.card);
  });
  geo.setAttribute('aCard', new THREE.InstancedBufferAttribute(cards, 1));
  mesh.computeBoundingSphere();
  mesh.raycast = () => {};
  mesh.name = 'foliage:tuftCards';
  scene.add(mesh);
  return mesh;
}
