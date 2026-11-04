import * as THREE from 'three';
import { rng } from '../tex/pixel';
import { mergeCards } from './treeCards';

// Mike 2026-11-04 (Graphics thread, "Do the same crossed quads for bushes"): every meadow bush is two or three upright
// alpha-cutout cards crossed through its middle, like the trees (treeCards.ts), merged into one mesh: one draw call.
// The bush sheet is our own pixel art, painted here at load: a few fat leaf lumps per card in five greens with a dark
// rim, lit from the top left, some with berries or blossom. Keeps G4's chunky, simple look (big lumps, few colours).
// Bushes stay walk-through: no collider.
const CW = 32, CH = 24, CARDS = 6;
/** Bush cards on the sheet. */
export const BUSH_CARDS = CARDS;
const RIM = '#18301A', GREENS = ['#24461D', '#335E25', '#4A7D2F', '#66993A', '#88B84B'];
const DOTS = [null, '#C2382E', null, '#F2EBD0', null, '#E8B83A'];   // berries, blossom, or plain leaves

function paintSheet(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CW * CARDS; c.height = CH;
  const g = c.getContext('2d')!;
  for (let k = 0; k < CARDS; k++) {
    const R = rng(5101 + k * 37), ox = k * CW;
    // Lumps: a wide base and two to four rounder ones on top, all inside the cell and resting on its bottom row.
    const lumps: [number, number, number][] = [[16, CH - 6, 9 + R() * 2]];
    const n = 2 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) lumps.push([7 + R() * 18, CH - 10 - R() * 6, 5 + R() * 3]);
    const inside = (x: number, y: number) => y <= CH - 1 && lumps.some(([cx, cy, r]) => (x - cx) ** 2 + ((y - cy) * 1.15) ** 2 <= r * r);
    const shade = (x: number, y: number) => {
      // Which lump is on top here (the highest one), and where in it: light from the top left.
      let best = lumps[0];
      for (const L of lumps) if ((x - L[0]) ** 2 + ((y - L[1]) * 1.15) ** 2 <= L[2] ** 2 && L[1] < best[1]) best = L;
      const [cx, cy, r] = best, d = ((x - cx) * -0.6 + (y - cy) * -0.8) / r;   // +1 lit side, -1 shade side
      let v = 2 + Math.round(d * 1.6) - (y > CH - 4 ? 1 : 0);
      if (R() < 0.18) v += R() < 0.5 ? -1 : 1;   // leaf clusters
      return Math.max(0, Math.min(4, v));
    };
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || (y < CH - 1 && !inside(x, y + 1));
      g.fillStyle = edge ? RIM : GREENS[shade(x, y)];
      g.fillRect(ox + x, y, 1, 1);
    }
    const dot = DOTS[k];
    if (dot) for (let i = 0; i < 7; i++) {
      const x = 4 + Math.floor(R() * 24), y = 4 + Math.floor(R() * 14);
      if (inside(x, y) && inside(x + 1, y + 1) && inside(x - 1, y - 1)) { g.fillStyle = dot; g.fillRect(ox + x, y, 1, 1); }
    }
  }
  return c;
}

/** One bush: `planes` crossed cards (2 or 3) at x/z, `w` m wide, showing card `card`. */
export function bushCard(card: number, x: number, y: number, z: number, w: number, turn: number, planes: number): THREE.BufferGeometry[] {
  const H = w * (CH / CW), u0 = card / CARDS, u1 = (card + 1) / CARDS;
  const out: THREE.BufferGeometry[] = [];
  // Each quad twice, back to back and single-sided, with normals up (see cardTree): crossed cards light alike.
  for (let i = 0; i < planes * 2; i++) {
    const g = new THREE.PlaneGeometry(w, H).translate(0, H / 2, 0).rotateY(turn + (i * Math.PI) / planes).translate(x, y, z);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) ? u1 : u0);
    const n = g.attributes.normal as THREE.BufferAttribute;
    for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);
    out.push(g);
  }
  return out;
}

/** Merge bush cards into one mesh with the painted sheet and add it to the scene. */
export function bushMesh(scene: THREE.Scene, geos: THREE.BufferGeometry[]): THREE.Mesh {
  const tex = new THREE.CanvasTexture(paintSheet());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
  const mesh = new THREE.Mesh(mergeCards(geos), mat);
  mesh.name = 'bush-cards'; mesh.raycast = () => {};
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}
