import * as THREE from 'three';
import { pixelTexture, rng, type TexName } from '../tex/pixel';
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
const GREEN = { x: 4, z: 26.5, rx: 24, rz: 9.5 };
// One plaster and three roof colours: each tint is its own merged mesh (draw call), so keep them few.
const PLASTER = '#FFF6E6';
const WALL = 3.0, PLINTH = 0.4, RISE = 2.1;
const R1 = '#86604E', R2 = '#4E7299', R3 = '#A84C40';
// Style pass 2: houses with a jettied upper floor (UPPER metres tall, overhanging front and back).
const JETTY = new Set<string>(['inn', 'scriptorium', 'cartographer', 'tailor']);
const UPPER = 1.9;
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
const SPOTS = layout();
const LOTS = RING.filter((s): s is Slot & { id: TownId } => s.id !== 'lane' && s.id !== 'cinema').map((s) => ({ ...s, ...SPOTS.get(s.id)!, wall: PLASTER, roof: s.roof! }));
/** v0.05: the camp's exit gate, at the west end of the coach road. Walking through it asks whether to retire. */
export const GATE = { x: -41, z: -4, half: 2.0 };
/** Keep-out for scattered props (trees, rocks, bushes, undergrowth): the ring and its lots, the lane, the road west. */
export const townClear = (x: number, z: number, pad: number) =>
  ((x - GREEN.x) / (GREEN.rx + 6 + pad)) ** 2 + ((z - GREEN.z) / (GREEN.rz + 6 + pad)) ** 2 < 1 || (Math.abs(x) < 2 + pad && z > 11 && z < 24)
  || (x < -10 + pad && x > GATE.x - 4 - pad && Math.abs(z - GATE.z) < 3 + pad);
/** Circles covering a rotated w × d footprint (the player only collides with circles and axis-aligned boxes). */
function footprint(colliders: Collider[], x: number, z: number, ry: number, w: number, d: number) {
  const nx = Math.ceil(w / 2.2), nz = Math.ceil(d / 2.2), cw = w / nx, cd = d / nz, r = Math.hypot(cw, cd) / 2, c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const lx = -w / 2 + cw * (i + 0.5), lz = -d / 2 + cd * (j + 0.5);
    colliders.push({ kind: 'circle', x: x + lx * c + lz * s, z: z - lx * s + lz * c, r });
  }
}

/** All the signs on one canvas (one row each), so the town's signs (and the exit gate's) are a single draw call. */
function signAtlas(rows: string[][]): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64 * rows.length;
  const g = c.getContext('2d')!;
  rows.forEach((lines, i) => {
    const y = i * 64;
    g.fillStyle = '#4A3222'; g.fillRect(0, y, 256, 64);
    g.strokeStyle = '#C9A36B'; g.lineWidth = 4; g.strokeRect(4, y + 4, 248, 56);
    g.fillStyle = '#F2E2B8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = lines.length > 1 ? '600 19px Georgia, serif' : '600 26px Georgia, serif';
    lines.forEach((t, k) => g.fillText(t, 128, y + 34 + (k - (lines.length - 1) / 2) * 22));
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

  // The green: a paved oval inside the ring (the lane up from the glade is a worn path in the ground, land.ts).
  const G = GREEN, oval = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  B.add(tex('paving'), oval, V(G.x, 0.02, G.z), V(G.rx - 3.6, 1, G.rz - 3.4));

  const signs: THREE.BufferGeometry[] = [];
  LOTS.forEach((L, li) => {
    const W = L.w, D = L.d, at = local(L);
    const plaster = tint('plaster', L.wall), roof = tint('roofTiles', L.roof), wood = tex('wood');
    B.add(tex('stone'), new THREE.BoxGeometry(W + 0.3, PLINTH, D + 0.3), at(0, PLINTH / 2, 0), undefined, L.ry);
    B.add(plaster, new THREE.BoxGeometry(W, WALL, D), at(0, PLINTH + WALL / 2, 0), undefined, L.ry);
    // Style pass 2: some houses have a jettied upper floor, overhanging the street front and back.
    const jetty = JETTY.has(L.id), Wt = jetty ? W + 0.3 : W, Dt = jetty ? D + 0.7 : D, top = PLINTH + WALL + (jetty ? UPPER : 0);
    if (jetty) {
      B.add(plaster, new THREE.BoxGeometry(Wt, UPPER, Dt), at(0, PLINTH + WALL + UPPER / 2, 0), undefined, L.ry);
      for (const z of [Dt / 2 + 0.02, -Dt / 2 - 0.02]) {
        B.add(wood, new THREE.BoxGeometry(Wt + 0.1, 0.22, 0.16), at(0, PLINTH + WALL + 0.08, z), undefined, L.ry);   // jetty beam
        B.add(wood, new THREE.BoxGeometry(Wt, 0.14, 0.1), at(0, top - 0.08, z), undefined, L.ry);
        for (const x of [-Wt / 2, -Wt / 6, Wt / 6, Wt / 2]) B.add(wood, new THREE.BoxGeometry(0.16, UPPER, 0.1), at(x * 0.97, PLINTH + WALL + UPPER / 2, z), undefined, L.ry);
      }
      // Brackets under the overhang.
      for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) for (const sd of [1, -1]) B.add(wood, new THREE.BoxGeometry(0.14, 0.14, 0.6), at(x, PLINTH + WALL - 0.18, sd * (D / 2 + 0.16)), undefined, L.ry, sd * 0.7);
      // Two lit windows upstairs on the front.
      for (const x of [-Wt * 0.28, Wt * 0.28]) {
        B.add(glow, new THREE.BoxGeometry(0.8, 0.8, 0.06), at(x, PLINTH + WALL + UPPER * 0.52, Dt / 2 + 0.03), undefined, L.ry);
        B.add(wood, new THREE.BoxGeometry(0.08, 0.8, 0.1), at(x, PLINTH + WALL + UPPER * 0.52, Dt / 2 + 0.06), undefined, L.ry);
      }
    }
    // Gable ends: a triangle of plaster on the front and back walls.
    const gable = new THREE.Shape([new THREE.Vector2(-Wt / 2, 0), new THREE.Vector2(Wt / 2, 0), new THREE.Vector2(0, RISE)]);
    // The ridge runs front to back, so the gables face the green.
    for (const z of [Dt / 2 - 0.1, -Dt / 2 - 0.1]) B.add(plaster, new THREE.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false }), at(0, top, z), undefined, L.ry);
    const half = Wt / 2 + 0.45, slope = Math.hypot(half, RISE), tilt = Math.atan2(RISE, half);
    for (const side of [-1, 1]) {
      B.add(roof, new THREE.BoxGeometry(slope + 0.1, 0.2, Dt + 0.8), at(side * half / 2, top + RISE / 2 + 0.1, 0), undefined, L.ry, 0, -side * tilt);
    }
    B.add(wood, new THREE.BoxGeometry(0.24, 0.24, Dt + 0.9), at(0, top + RISE + 0.12, 0), undefined, L.ry);   // ridge beam
    // Style pass 2: a crooked brick chimney through the roof (the smithy has its forge stack instead).
    if (L.id !== 'smithy' && L.id !== 'library') {
      const cx = (li % 2 ? 1 : -1) * half * 0.42, roofY = top + RISE * (1 - Math.abs(cx) / half), lean = (li % 3 - 1) * 0.07;
      B.add(tex('bricks'), new THREE.BoxGeometry(0.7, 1.7, 0.7), at(cx, roofY + 0.45, -Dt * 0.18), undefined, L.ry, 0, lean);
      B.add(tex('stone'), new THREE.BoxGeometry(0.9, 0.16, 0.9), at(cx - Math.sin(lean) * 0.85, roofY + 1.32, -Dt * 0.18), undefined, L.ry, 0, lean);
    }
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
    const sg = new THREE.PlaneGeometry(2.4, 0.6), uv = sg.attributes.uv as THREE.BufferAttribute, n = LOTS.length + 1;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (li + 1 - uv.getY(k)) / n);
    const sp = at(0, PLINTH + (jetty ? 2.55 : 2.75), D / 2 + 0.12);
    signs.push(sg.rotateY(L.ry).translate(sp.x, sp.y, sp.z));
    footprint(colliders, L.x, L.z, L.ry, W + 0.4, D + 0.4);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    door.position.copy(at(0, 1.3, D / 2 + 0.6)); door.rotation.y = L.ry; door.name = 'door:' + L.id;
    scene.add(door);
    doors[L.id] = door;
  });
  // v0.05: the exit gate at the west end of the coach road (a worn path): two posts, a beam, and its sign (the atlas's last row).
  for (const dz of [-GATE.half - 0.2, GATE.half + 0.2]) {
    B.box(tex('wood'), V(GATE.x, 1.6, GATE.z + dz), 0.32, 3.2, 0.32);
    colliders.push({ kind: 'circle', x: GATE.x, z: GATE.z + dz, r: 0.25 });
  }
  B.box(tex('wood'), V(GATE.x, 3.2, GATE.z), 0.34, 0.3, GATE.half * 2 + 1.4);
  for (const dz of [-0.9, 0.9]) B.box(tex('wood'), V(GATE.x, 2.95, GATE.z + dz), 0.05, 0.4, 0.05);   // sign chains
  const gs = new THREE.PlaneGeometry(2.8, 0.7), guv = gs.attributes.uv as THREE.BufferAttribute, rows = LOTS.length + 1;
  for (let k = 0; k < guv.count; k++) guv.setY(k, guv.getY(k) / rows);   // the bottom row of the atlas
  signs.push(gs.rotateY(Math.PI / 2).translate(GATE.x + 0.2, 2.45, GATE.z));
  const signMesh = new THREE.Mesh(mergeGeometries(signs), new THREE.MeshBasicMaterial({ map: signAtlas([...LOTS.map((l) => [`${ICONS[l.id]}  ${TOWN_NAMES[l.id]}`]), ['Temporary Exit -', 'Mind the dust']]), side: THREE.DoubleSide }));
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

  dressTown(scene, B, tex, colliders, local, ring);

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

// ---------- Style pass 2: storybook dressing (window boxes, pots, awnings, barrels, a well, bunting) ----------
// The painted bits are one merged mesh with vertex colours (one draw call); wood and stone go in the batch.
const FLOWERS = ['#E86A8A', '#F2C94C', '#F2F0E6', '#B07AD8', '#E8603A'];
const AWNING = ['#B8423A', '#F2E8D0'];
const BUNTING = ['#C8423A', '#F2C94C', '#4E7299', '#5E9A4A', '#F2E8D0'];
function dressTown(scene: THREE.Scene, B: Batch, tex: (n: TexName) => THREE.Material, colliders: Collider[], local: (L: Spot) => (lx: number, y: number, lz: number) => THREE.Vector3, ring: Spot[]) {
  const R = rng(6262), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const painted: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, hex: string, pos: THREE.Vector3, ry = 0, rx = 0, rz = 0) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    ng.rotateZ(rz).rotateX(rx).rotateY(ry).translate(pos.x, pos.y, pos.z);
    const c = new THREE.Color(hex), n = ng.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 0.92 + R() * 0.16; col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
    ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
    painted.push(ng);
  };
  const flowers = (at: (lx: number, y: number, lz: number) => THREE.Vector3, lx: number, y: number, lz: number, spread: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const p = at(lx + (R() - 0.5) * spread, y + R() * 0.06, lz + (R() - 0.5) * 0.12);
      paint(new THREE.IcosahedronGeometry(0.07 + R() * 0.03, 0), '#4E8A3A', p.clone().add(V(0, -0.04, 0)));
      paint(new THREE.IcosahedronGeometry(0.07, 0), FLOWERS[Math.floor(R() * FLOWERS.length)], p.clone().add(V(0, 0.05, 0)));
    }
  };
  LOTS.forEach((L, li) => {
    const at = local(L), W = L.w, D = L.d, planks = tex('planks');
    // Window boxes under the two front windows.
    for (const x of [-W * 0.36, W * 0.36]) {
      B.add(planks, new THREE.BoxGeometry(1.0, 0.2, 0.26), at(x, PLINTH + 1.04, D / 2 + 0.2), undefined, L.ry);
      flowers(at, x, PLINTH + 1.2, D / 2 + 0.2, 0.85, 4);
    }
    // Terracotta pots either side of the door.
    for (const x of [-0.98, 0.98]) {
      const p = at(x, 0, D / 2 + 0.4);
      paint(new THREE.CylinderGeometry(0.2, 0.15, 0.34, 7), '#B8643A', p.clone().setY(0.17));
      paint(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 7), '#9A4E2E', p.clone().setY(0.34));
      flowers(at, x, 0.42, D / 2 + 0.4, 0.2, 2);
      colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.22 });
    }
    // Striped awnings over the shop counter, the tailor's and the gallery's front windows.
    const awn = L.id === 'shop' ? [[2.0, 2.9]] : L.id === 'tailor' || L.id === 'gallery' ? [[-W * 0.36, 1.4], [W * 0.36, 1.4]] : [];
    for (const [cx, w] of awn) {
      const n = Math.round(w / 0.35), sw = w / n, dep = L.id === 'shop' ? 1.9 : 0.9, y = PLINTH + (L.id === 'shop' ? 2.3 : 2.35);
      for (let i = 0; i < n; i++) {
        const lx = cx - w / 2 + sw * (i + 0.5);
        paint(new THREE.BoxGeometry(sw, 0.05, dep), AWNING[i % 2], at(lx, y - dep * 0.18, D / 2 + dep / 2), L.ry, 0.36);
        paint(new THREE.ConeGeometry(sw / 2, 0.16, 3), AWNING[i % 2], at(lx, y - dep * 0.37 - 0.1, D / 2 + dep * 0.94), L.ry, Math.PI);   // scalloped edge
      }
      if (L.id === 'shop') for (const x of [cx - w / 2 + 0.05, cx + w / 2 - 0.05]) B.add(tex('wood'), new THREE.BoxGeometry(0.1, 1.95, 0.1), at(x, 0.97, D / 2 + dep - 0.05), undefined, L.ry);
    }
    // Barrels and a crate stacked against a side wall on some houses.
    if (li % 2 === 0 && L.id !== 'shop') {
      const side = li % 4 ? 1 : -1;
      for (const [k, dz] of [[0, -0.2], [1, -1.15]] as const) {
        const p = at(side * (W / 2 + 0.55), 0, D / 2 + dz);
        if (k === 0) {
          B.add(planks, new THREE.CylinderGeometry(0.36, 0.32, 0.9, 9), p.clone().setY(0.45), undefined, R() * 3);
          for (const y of [0.18, 0.72]) paint(new THREE.CylinderGeometry(0.375, 0.375, 0.05, 9), '#3A3A3E', p.clone().setY(y));
          colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.4, top: 0.9 });
        } else {
          B.add(planks, new THREE.BoxGeometry(0.7, 0.7, 0.7), p.clone().setY(0.35), undefined, L.ry + 0.2);
          colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.45, top: 0.7 });
        }
      }
    }
  });

  // A well on the green: a stone ring, posts, a little tiled roof, the winch and its bucket.
  const wx = GREEN.x, wz = GREEN.z + 0.5;
  B.add(tex('stone'), new THREE.CylinderGeometry(1.0, 1.08, 0.8, 10, 1, true), V(wx, 0.4, wz));
  B.add(tex('stone'), new THREE.TorusGeometry(0.98, 0.12, 4, 10).rotateX(Math.PI / 2), V(wx, 0.82, wz));
  paint(new THREE.CircleGeometry(0.92, 10).rotateX(-Math.PI / 2), '#2A3A4A', V(wx, 0.35, wz));   // water, down in the dark
  for (const dx of [-0.95, 0.95]) B.add(tex('wood'), new THREE.BoxGeometry(0.16, 1.9, 0.16), V(wx + dx, 1.25, wz));
  B.add(tex('wood'), new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6).rotateZ(Math.PI / 2), V(wx, 1.75, wz));   // winch
  paint(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), '#C9B48A', V(wx, 1.38, wz));   // rope
  paint(new THREE.CylinderGeometry(0.15, 0.12, 0.22, 7), '#6A4A2A', V(wx, 0.98, wz));   // bucket
  for (const sd of [-1, 1]) B.add(tex('roofTiles'), new THREE.BoxGeometry(1.0, 0.08, 1.5), V(wx + sd * 0.45, 2.35, wz), undefined, 0, 0, -sd * 0.6);
  colliders.push({ kind: 'circle', x: wx, z: wz, r: 1.15, top: 0.85 });

  // Bunting strung between the lamp posts, sagging a little, flags in turn.
  ring.forEach((_, i) => {
    const lamp = (k: number) => { const a = ring[k % ring.length], b = ring[(k + 1) % ring.length]; return V(GREEN.x + ((a.x + b.x) / 2 - GREEN.x) * 0.8, 2.75, GREEN.z + ((a.z + b.z) / 2 - GREEN.z) * 0.72); };
    const a = lamp(i), b = lamp(i + 1), len = a.distanceTo(b), n = Math.floor(len / 0.55);
    const ry = Math.atan2(b.x - a.x, b.z - a.z);
    for (let k = 0; k <= n; k++) {
      const t = k / n, sag = Math.sin(t * Math.PI) * 0.45, p = a.clone().lerp(b, t).add(V(0, -sag, 0));
      if (k < n) {   // the string, one short piece per flag
        const q = a.clone().lerp(b, (k + 1) / n).add(V(0, -Math.sin(((k + 1) / n) * Math.PI) * 0.45, 0)), d = q.distanceTo(p);
        paint(new THREE.BoxGeometry(0.02, 0.02, d), '#3A2E22', p.clone().lerp(q, 0.5), ry, Math.atan2(p.y - q.y, Math.hypot(q.x - p.x, q.z - p.z)));
      }
      if (k > 0 && k < n) {
        const flag = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.14, 0, 0, 0.14, 0, -0.3, 0]), 3));
        flag.computeVertexNormals();
        paint(flag, BUNTING[(k + i) % BUNTING.length], p.clone().add(V(0, -0.01, 0)), ry);
      }
    }
  });

  const mesh = new THREE.Mesh(mergeGeometries(painted), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.name = 'town-dressing'; mesh.raycast = () => {};
  scene.add(mesh);
}
