import * as THREE from 'three';
import { pixelTexture, type TexName } from '../tex/pixel';
import { Batch } from './batch';
import { buildFigure } from './figure';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from './index';

// v0.04: a small storybook town south of the glade, down the path from the spawn point. One building per
// tool, scattered round an oval green at odd angles (Mike, 2026-10-28: "make it feel lively"): the library
// (lore book), smithy (weapon forge), tailor (character mirror), scriptorium (sketchbook), cartographer (living
// map), dojo, gallery, the general store (the shopkeeper) and an inn (sleep). The projectionist's screen takes
// one gap in the ring and the lane from the glade another. Buildings are shells: E at a door opens the tool.
export type TownId = 'library' | 'smithy' | 'tailor' | 'scriptorium' | 'cartographer' | 'dojo' | 'gallery' | 'shop' | 'inn';
export const TOWN_NAMES: Record<TownId, string> = {
  library: 'Library', smithy: 'Smithy', tailor: 'Tailor', scriptorium: 'Scriptorium', cartographer: 'Cartographer',
  dojo: 'Dojo', gallery: 'Gallery', shop: 'General Store', inn: 'Inn',
};
const ICONS: Record<TownId, string> = { library: '❦', smithy: '⚒', tailor: '✂', scriptorium: '✒', cartographer: '⌖', dojo: '☯', gallery: '▣', shop: '⚖', inn: '☾' };
// The green: an oval ring of lots round (C.x, C.z). Everything stays inside the flat middle (|x|, |z| < 42).
export const GREEN = { x: 4, z: 26.5, rx: 24, rz: 9.5 };
// One plaster and three roof colours: each tint is its own merged mesh (draw call), so keep them few.
const PLASTER = '#EFE2C6';
const WALL = 3.0, PLINTH = 0.4, RISE = 2.1;
const R1 = '#5A4A44', R2 = '#3E5A7A', R3 = '#7A3A3A';
// Clockwise round the ring from the lane (north, toward the glade). `off` pushes a lot out (+) or in (−) from
// the ring and `turn` skews it off facing the green, so no two sit square to each other.
type Slot = { id: TownId | 'lane' | 'cinema'; w: number; d: number; off: number; turn: number; roof?: string };
const RING: Slot[] = [
  { id: 'lane', w: 3.2, d: 0, off: 0, turn: 0 },
  { id: 'shop', w: 6.6, d: 5.6, off: 0.5, turn: 0.2, roof: R3 },
  { id: 'smithy', w: 7, d: 6, off: -0.7, turn: -0.24, roof: R1 },
  { id: 'inn', w: 7.6, d: 6.4, off: 1.0, turn: 0.14, roof: R2 },
  { id: 'cinema', w: 3.2, d: 0, off: -1.2, turn: 0 },
  { id: 'gallery', w: 6.8, d: 5.8, off: -0.4, turn: -0.18, roof: R3 },
  { id: 'scriptorium', w: 6.2, d: 5.6, off: 0.8, turn: 0.26, roof: R1 },
  { id: 'library', w: 8.4, d: 6.6, off: 0.3, turn: -0.06, roof: R2 },
  { id: 'cartographer', w: 6, d: 5.4, off: -0.5, turn: -0.22, roof: R3 },
  { id: 'dojo', w: 7.2, d: 6.2, off: -0.2, turn: 0.17, roof: R1 },
  { id: 'tailor', w: 6.4, d: 5.6, off: -2.2, turn: -0.2, roof: R2 },
];
const GAP = 1.6;   // between neighbours along the ring
interface Spot { x: number; z: number; ry: number }
/** Lay the ring out by arc length so every slot gets its width plus a gap, starting with the lane due north. */
function layout(): Map<Slot['id'], Spot> {
  const G = GREEN, N = 720, pts: [number, number][] = [], len = [0];
  const P = (t: number): [number, number] => [G.x + G.rx * Math.sin(t), G.z - G.rz * Math.cos(t)];
  for (let i = 0; i <= N; i++) { pts.push(P((i / N) * Math.PI * 2)); if (i) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
  const total = len[N], want = RING.reduce((a, s) => a + s.w + GAP, 0), k = total / want;
  // The lane sits where the path from the glade (x = 0) meets the ring.
  let at = len[Math.round(N * (1 - Math.asin((G.x - 0) / G.rx) / (Math.PI * 2))) % N] - (RING[0].w + GAP) * k / 2;
  const out = new Map<Slot['id'], Spot>();
  for (const s of RING) {
    const mid = (((at + (s.w + GAP) * k / 2) % total) + total) % total;
    let i = 0; while (i < N && len[i + 1] < mid) i++;
    const [x0, z0] = pts[i];
    const nx = (x0 - G.x) / G.rx ** 2, nz = (z0 - G.z) / G.rz ** 2, nl = Math.hypot(nx, nz);   // outward normal
    const x = x0 + nx / nl * s.off, z = z0 + nz / nl * s.off;
    out.set(s.id, { x, z, ry: Math.atan2(G.x - x, G.z - z) + s.turn });
    at += (s.w + GAP) * k;
  }
  return out;
}
export const SPOTS = layout();
const LOTS = RING.filter((s): s is Slot & { id: TownId } => s.id !== 'lane' && s.id !== 'cinema').map((s) => ({ ...s, ...SPOTS.get(s.id)!, wall: PLASTER, roof: s.roof! }));
/** Keep-out for scattered props (trees, rocks, bushes, undergrowth): the ring and its lots, and the lane. */
export const townClear = (x: number, z: number, pad: number) =>
  ((x - GREEN.x) / (GREEN.rx + 6 + pad)) ** 2 + ((z - GREEN.z) / (GREEN.rz + 6 + pad)) ** 2 < 1 || (Math.abs(x) < 2 + pad && z > 11 && z < 24);
/** Circles covering a rotated w × d footprint (the player only collides with circles and axis-aligned boxes). */
function footprint(colliders: Collider[], x: number, z: number, ry: number, w: number, d: number) {
  const nx = Math.ceil(w / 2.2), nz = Math.ceil(d / 2.2), cw = w / nx, cd = d / nz, r = Math.hypot(cw, cd) / 2, c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const lx = -w / 2 + cw * (i + 0.5), lz = -d / 2 + cd * (j + 0.5);
    colliders.push({ kind: 'circle', x: x + lx * c + lz * s, z: z - lx * s + lz * c, r });
  }
}

/** All the signs on one canvas (one row each), so the town's signs are a single draw call. */
function signAtlas(ids: TownId[]): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64 * ids.length;
  const g = c.getContext('2d')!;
  ids.forEach((id, i) => {
    const y = i * 64;
    g.fillStyle = '#4A3222'; g.fillRect(0, y, 256, 64);
    g.strokeStyle = '#C9A36B'; g.lineWidth = 4; g.strokeRect(4, y + 4, 248, 56);
    g.fillStyle = '#F2E2B8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 26px Georgia, serif';
    g.fillText(`${ICONS[id]}  ${TOWN_NAMES[id]}`, 128, y + 34);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export interface Town {
  doors: Record<TownId, THREE.Object3D>;
  shopkeeper: THREE.Object3D;
  shopkeeperHit: THREE.Object3D;
  /** Where the projectionist's screen stands (main.ts hangs the screen and places the projectionist). */
  cinema: Spot;
}

export function buildTown(scene: THREE.Scene, B: Batch, tex: (n: TexName) => THREE.Material, colliders: Collider[]): Town {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const tinted = new Map<string, THREE.MeshLambertMaterial>();
  const tint = (t: TexName, color: string) => tinted.get(t + color) ?? (tinted.set(t + color, new THREE.MeshLambertMaterial({ map: pixelTexture(t), color })), tinted.get(t + color)!);
  const glow = new THREE.MeshBasicMaterial({ color: '#F2C27A' });
  const doors = {} as Record<TownId, THREE.Object3D>;
  const local = (L: Spot) => { const c = Math.cos(L.ry), s = Math.sin(L.ry); return (lx: number, y: number, lz: number) => V(L.x + lx * c + lz * s, y, L.z - lx * s + lz * c); };

  // The green: a paved oval inside the ring, and the dirt lane up from the glade.
  const G = GREEN, oval = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  B.add(tex('paving'), oval, V(G.x, 0.02, G.z), V(G.rx - 3.6, 1, G.rz - 3.4));
  B.box(tex('dirt'), V(0, 0.012, 17.5), 2.2, 0.02, 13);

  const signs: THREE.BufferGeometry[] = [];
  LOTS.forEach((L, li) => {
    const W = L.w, D = L.d, at = local(L);
    const plaster = tint('stone', L.wall), roof = tint('planks', L.roof), wood = tex('wood');
    B.add(tex('stone'), new THREE.BoxGeometry(W + 0.3, PLINTH, D + 0.3), at(0, PLINTH / 2, 0), undefined, L.ry);
    B.add(plaster, new THREE.BoxGeometry(W, WALL, D), at(0, PLINTH + WALL / 2, 0), undefined, L.ry);
    // Gable ends: a triangle of plaster on the front and back walls.
    const gable = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, RISE)]);
    // The ridge runs front to back, so the gables face the green.
    for (const z of [D / 2 - 0.1, -D / 2 - 0.1]) B.add(plaster, new THREE.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false }), at(0, PLINTH + WALL, z), undefined, L.ry);
    const half = W / 2 + 0.45, slope = Math.hypot(half, RISE), tilt = Math.atan2(RISE, half);
    for (const side of [-1, 1]) {
      B.add(roof, new THREE.BoxGeometry(slope + 0.1, 0.2, D + 0.8), at(side * half / 2, PLINTH + WALL + RISE / 2 + 0.1, 0), undefined, L.ry, 0, -side * tilt);
    }
    B.add(wood, new THREE.BoxGeometry(0.24, 0.24, D + 0.9), at(0, PLINTH + WALL + RISE + 0.12, 0), undefined, L.ry);   // ridge beam
    // Timber frame: corner posts, a mid rail and a top rail on the front.
    for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) B.add(wood, new THREE.BoxGeometry(0.24, WALL, 0.24), at(x, PLINTH + WALL / 2, z), undefined, L.ry);
    for (const y of [PLINTH + 1.55, PLINTH + WALL - 0.1]) B.add(wood, new THREE.BoxGeometry(W, 0.18, 0.12), at(0, y, D / 2 + 0.04), undefined, L.ry);
    for (const x of [-W / 4, W / 4]) B.add(wood, new THREE.BoxGeometry(0.16, WALL, 0.12), at(x, PLINTH + WALL / 2, D / 2 + 0.04), undefined, L.ry);
    // Door, step and two lit windows.
    B.add(tex('door'), new THREE.BoxGeometry(1.2, 2.2, 0.1), at(0, PLINTH + 1.1, D / 2 + 0.05), undefined, L.ry);
    B.add(tex('stone'), new THREE.BoxGeometry(1.8, 0.2, 0.7), at(0, 0.1, D / 2 + 0.45), undefined, L.ry);
    for (const x of [-W * 0.36, W * 0.36]) {
      B.add(glow, new THREE.BoxGeometry(0.9, 0.9, 0.06), at(x, PLINTH + 1.7, D / 2 + 0.03), undefined, L.ry);
      B.add(wood, new THREE.BoxGeometry(1.08, 0.12, 0.14), at(x, PLINTH + 1.2, D / 2 + 0.06), undefined, L.ry);
      B.add(wood, new THREE.BoxGeometry(0.08, 0.9, 0.1), at(x, PLINTH + 1.7, D / 2 + 0.07), undefined, L.ry);
    }
    if (L.id === 'smithy') {   // a stone chimney for the forge
      B.add(tex('bricks'), new THREE.BoxGeometry(0.9, 2.6, 0.9), at(-W / 2 + 1.2, PLINTH + WALL + 1.5, -1.2), undefined, L.ry);
      B.add(tex('stone'), new THREE.BoxGeometry(1.4, 0.3, 1.4), at(W / 2 + 0.9, 0.15, D / 2 - 0.6), undefined, L.ry);   // quench trough
      const q = at(W / 2 + 0.9, 0, D / 2 - 0.6); colliders.push({ kind: 'circle', x: q.x, z: q.z, r: 0.8, top: 0.3 });
    }
    if (L.id === 'library') {   // a stone canopy over the door: the grandest front on the green
      B.add(tex('stone'), new THREE.BoxGeometry(2.2, 0.3, 1.2), at(0, PLINTH + 2.55, D / 2 + 0.55), undefined, L.ry);
    }
    if (L.id === 'shop') {   // a market counter in front, with crates
      B.add(wood, new THREE.BoxGeometry(2.4, 0.9, 0.7), at(2.0, 0.45, D / 2 + 1.6), undefined, L.ry);
      B.add(tex('planks'), new THREE.BoxGeometry(0.6, 0.6, 0.6), at(-2.3, 0.3, D / 2 + 1.0), undefined, L.ry + 0.3);
      B.add(tex('planks'), new THREE.BoxGeometry(0.5, 0.5, 0.5), at(-2.2, 0.85, D / 2 + 1.0), undefined, L.ry - 0.2);
      for (const lx of [1.4, 2.6]) { const cp = at(lx, 0, D / 2 + 1.6); colliders.push({ kind: 'circle', x: cp.x, z: cp.z, r: 0.62, top: 0.9 }); }
    }
    // Hanging sign over the door: its row of the shared atlas.
    const sg = new THREE.PlaneGeometry(2.4, 0.6), uv = sg.attributes.uv as THREE.BufferAttribute, n = LOTS.length;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (li + 1 - uv.getY(k)) / n);
    const sp = at(0, PLINTH + 2.75, D / 2 + 0.12);
    signs.push(sg.rotateY(L.ry).translate(sp.x, sp.y, sp.z));
    footprint(colliders, L.x, L.z, L.ry, W + 0.4, D + 0.4);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    door.position.copy(at(0, 1.3, D / 2 + 0.6)); door.rotation.y = L.ry; door.name = 'door:' + L.id;
    scene.add(door);
    doors[L.id] = door;
  });
  const signMesh = new THREE.Mesh(mergeGeometries(signs), new THREE.MeshBasicMaterial({ map: signAtlas(LOTS.map((l) => l.id)) }));
  signMesh.name = 'town-signs'; signMesh.raycast = () => {};
  scene.add(signMesh);

  // The projectionist's stand: two posts and a frame (the screen itself is hung by main.ts).
  const cin = SPOTS.get('cinema')!, ca = local(cin);
  for (const x of [-1.25, 1.25]) { B.add(tex('wood'), new THREE.BoxGeometry(0.12, 2.8, 0.12), ca(x, 1.4, 0), undefined, cin.ry); const p = ca(x, 0, 0); colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.2 }); }
  B.add(tex('wood'), new THREE.BoxGeometry(2.6, 1.6, 0.08), ca(0, 1.95, -0.03), undefined, cin.ry);
  const cm = ca(0, 0, 0); colliders.push({ kind: 'circle', x: cm.x, z: cm.z, r: 0.3 });

  // Lamp posts between the lots, a little in from the ring (glowing lanterns; no extra lights).
  const ring = RING.map((s) => SPOTS.get(s.id)!);
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const x = G.x + ((a.x + b.x) / 2 - G.x) * 0.8, z = G.z + ((a.z + b.z) / 2 - G.z) * 0.72;
    B.add(tex('wood'), new THREE.CylinderGeometry(0.07, 0.09, 2.8, 6), V(x, 1.4, z));
    B.add(glow, new THREE.BoxGeometry(0.26, 0.34, 0.26), V(x, 2.9, z));
    colliders.push({ kind: 'circle', x, z, r: 0.15 });
  });

  // The shopkeeper stands behind the counter, facing the green.
  const shop = LOTS.find((l) => l.id === 'shop')!, sa = local(shop);
  const sk = sa(2.0, 0, shop.d / 2 + 0.95);
  const shopkeeper = buildFigure({ skin: '#D8A880', hair: '#B8B0A0', primary: '#6A4A2A', secondary: '#E8D8B0', boots: '#3A2A1E', accent: '#C9A36B', hairStyle: 'short', build: 1.2 }, 1.7);
  shopkeeper.position.copy(sk); shopkeeper.rotation.y = shop.ry; shopkeeper.name = 'standee:shopkeeper';
  scene.add(shopkeeper);
  colliders.push({ kind: 'circle', x: sk.x, z: sk.z, r: 0.35 });
  const shopkeeperHit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  shopkeeperHit.position.copy(sa(2.0, 0.9, shop.d / 2 + 2.55)); shopkeeperHit.rotation.y = shop.ry; shopkeeperHit.name = 'shopkeeper';
  scene.add(shopkeeperHit);
  return { doors, shopkeeper, shopkeeperHit, cinema: cin };
}
