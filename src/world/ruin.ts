import * as THREE from 'three';
import { Painter } from './decor';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../tex/pixel';
import type { Collider } from './index';

// Mike 2026-11-06 (Graphics thread, "All"): the Ruined Library looks its age. Mostly ruin and goblin life, with a
// little magic (about one thing in ten). Every kind is low-poly 3D in flat vertex colours, merged into one mesh per
// kind (src/world/decor.ts Painter), so the whole pass costs a handful of draw calls and stays cheap on phones.
// Inside pieces join the library's group, so they only draw when the camera is near the hall (main.ts).

/** Inner faces of the hall's walls (src/library.ts HALL) and its height (world/index.ts LIB). */
export const HALL = { minX: -12.6, maxX: 12.6, front: -18.4, back: -41.6, h: 8.35 };

/** Spots that must stay clear: things you use (their position and a radius). */
export interface Keep { x: number; z: number; r: number }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Is (x, z) inside the hall, off the walk lines and clear of furniture, things you use, and what's placed already? */
export class Floor {
  readonly taken: Keep[] = [];
  constructor(private colliders: Collider[], private keep: Keep[]) {}
  free(x: number, z: number, r: number, wallGap = 0.5): boolean {
    if (x - r < HALL.minX + wallGap || x + r > HALL.maxX - wallGap || z + r > HALL.front - wallGap || z - r < HALL.back + wallGap) return false;
    if (Math.abs(x) < 1.7 + r) return false;                       // the aisle, door to altar
    if (z > HALL.front - 3.2 && Math.abs(x) < 3.5 + r) return false;   // inside the door
    for (const k of [...this.keep, ...this.taken]) if (Math.hypot(x - k.x, z - k.z) < k.r + r) return false;
    for (const c of this.colliders) {
      if (c.kind === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; continue; }
      const wall = c.maxX - c.minX > 20 || c.maxZ - c.minZ > 20;   // the hall's own walls (handled above)
      if (wall) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return false;
    }
    return true;
  }
  take(x: number, z: number, r: number) { this.taken.push({ x, z, r }); }
}

const STONE = ['#77706A', '#6A645F', '#827B73', '#5E5954'];
const MOSS = ['#4F6B34', '#5C7A3A', '#3F5A2C'];
const WOOD = ['#5A3E26', '#6B4A2E', '#4A321F'];

/** 1 · The ruin pass: fallen stone, broken shelves, cracked and holed walls, a fallen beam, scorch and grit. */
export function buildRuin(group: THREE.Object3D, colliders: Collider[], floor: Floor): { pieces: number } {
  const R = rng(4711), pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const P = new Painter(4712);
  const rock = (s: number) => new THREE.DodecahedronGeometry(s, 0).scale(1, 0.62 + R() * 0.3, 0.8 + R() * 0.4);
  const block = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  /** A ragged hole outline (a jittered disc in the XY plane). */
  const jagged = (w: number, h: number) => {
    const g = new THREE.CircleGeometry(0.5, 9), p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 1; i < p.count; i++) { const k = 0.7 + R() * 0.5; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
    return g.scale(w, h, 1);
  };

  // Rubble heaps where the upper walls came down: big blocks, a skirt of smaller stones, a little moss.
  const heaps: [number, number][] = [];
  for (let tries = 0; heaps.length < 7 && tries < 400; tries++) {
    const sideWall = R() < 0.65, x = sideWall ? (R() < 0.5 ? HALL.minX + 1.4 + R() * 2.2 : HALL.maxX - 1.4 - R() * 2.2) : (R() * 2 - 1) * 9;
    const z = sideWall ? HALL.front - 3 - R() * 20 : (R() < 0.5 ? HALL.back + 1.6 : HALL.front - 4.2);
    if (!floor.free(x, z, 1.3, 0.3)) continue;
    floor.take(x, z, 1.5); heaps.push([x, z]);
    for (let i = 0; i < 3; i++) {
      const w = 0.6 + R() * 0.7, h = 0.35 + R() * 0.35, d = 0.4 + R() * 0.4;
      P.add(block(w, h, d), pick(STONE), V(x + (R() - 0.5) * 1.1, h / 2 + i * 0.12, z + (R() - 0.5) * 1.1), R() * 6, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4);
    }
    for (let i = 0; i < 12; i++) { const s = 0.08 + R() * 0.2, a = R() * Math.PI * 2, d = 0.7 + R() * 0.9; P.add(rock(s), pick(STONE), V(x + Math.cos(a) * d, s * 0.4, z + Math.sin(a) * d), R() * 6); }
    for (let i = 0; i < 4; i++) P.add(new THREE.BoxGeometry(0.3 + R() * 0.4, 0.04, 0.3 + R() * 0.4), pick(MOSS), V(x + (R() - 0.5) * 1.2, 0.5 + R() * 0.2, z + (R() - 0.5) * 1.2), R() * 6, (R() - 0.5) * 0.4);
    colliders.push({ kind: 'circle', x, z, r: 0.9, top: 0.75 });
  }

  // Toppled bookcases: a frame on its back or side, its shelves snapped, planks spilled.
  for (let n = 0, tries = 0; n < 3 && tries < 300; tries++) {
    const x = (R() < 0.5 ? -1 : 1) * (3.5 + R() * 6), z = HALL.front - 5 - R() * 17, ry = (R() < 0.5 ? 0 : Math.PI / 2) + (R() - 0.5) * 0.5;
    if (!floor.free(x, z, 1.6)) continue;
    floor.take(x, z, 1.7); n++;
    const w = pick(WOOD), lean = R() < 0.5;
    const frame = new THREE.Group();
    // On its back (lean = false) or tipped against a heap of its own books (lean = true).
    const tilt = lean ? 0.35 : Math.PI / 2 - 0.04;
    const c = Math.cos(ry), s = Math.sin(ry), at = (lx: number, ly: number, lz: number) => V(x + lx * c + lz * s, ly, z - lx * s + lz * c);
    P.add(block(2.6, 0.06, 0.45), w, at(0, 0.24 + (lean ? 0.4 : 0), 0), ry, 0, lean ? tilt : 0);
    for (const e of [-1.27, 1.27]) P.add(block(0.06, lean ? 0.9 : 0.45, 0.45), w, at(e, lean ? 0.45 : 0.24, 0), ry, 0, lean ? tilt : 0);
    P.add(block(1.1, 0.05, 0.42), w, at(-0.6, 0.06, 0.1), ry + 0.2, 0, 0.1);   // a snapped shelf
    for (let i = 0; i < 5; i++) P.add(block(0.5 + R() * 0.7, 0.04, 0.08 + R() * 0.06), pick(WOOD), at((R() - 0.5) * 2.4, 0.03, (R() - 0.5) * 1.4), ry + R() * 3);
    void frame;
    colliders.push({ kind: 'circle', x, z, r: 1.2, top: 0.5 });
  }

  // Cracked walls: dark zig-zag cracks and holes where bricks fell out, on all four inner faces.
  const crack = (o: THREE.Vector3, along: THREE.Vector3, n: THREE.Vector3, len: number) => {
    let p = o.clone();
    const up = V(0, 1, 0), segs = 4 + Math.floor(R() * 4), ry = Math.atan2(n.x, n.z);
    for (let i = 0; i < segs; i++) {
      const d = len / segs, ang = (R() - 0.5) * 1.2 - Math.PI / 2;   // mostly downward, wandering
      const step = along.clone().multiplyScalar(Math.cos(ang) * d * 0.6).addScaledVector(up, Math.sin(ang) * d);
      const mid = p.clone().addScaledVector(step, 0.5).addScaledVector(n, 0.02);
      P.add(new THREE.PlaneGeometry(0.025 + R() * 0.025, step.length() + 0.03), '#3B2F27', mid, ry, 0, -Math.atan2(step.dot(along), -step.y));
      p = p.add(step);
    }
  };
  const faces: { o: THREE.Vector3; along: THREE.Vector3; n: THREE.Vector3; len: number }[] = [
    { o: V(HALL.minX, 0, HALL.front), along: V(0, 0, -1), n: V(1, 0, 0), len: HALL.front - HALL.back },
    { o: V(HALL.maxX, 0, HALL.back), along: V(0, 0, 1), n: V(-1, 0, 0), len: HALL.front - HALL.back },
    { o: V(HALL.maxX, 0, HALL.front), along: V(-1, 0, 0), n: V(0, 0, -1), len: HALL.maxX - HALL.minX },
    { o: V(HALL.minX, 0, HALL.back), along: V(1, 0, 0), n: V(0, 0, 1), len: HALL.maxX - HALL.minX },
  ];
  for (const f of faces) {
    for (let i = 0; i < Math.round(f.len / 4); i++) crack(f.o.clone().addScaledVector(f.along, 1 + R() * (f.len - 2)).setY(3.2 + R() * 4.5), f.along, f.n, 1.2 + R() * 2.2);
    for (let i = 0; i < Math.round(f.len / 7); i++) {   // missing bricks: a dark recess and a few loose bricks below it
      const t = 1.5 + R() * (f.len - 3), y = 3 + R() * 4.6, at = f.o.clone().addScaledVector(f.along, t).setY(y).addScaledVector(f.n, 0.015);
      const w = 0.4 + R() * 0.7, h = 0.3 + R() * 0.35, ry = Math.atan2(f.n.x, f.n.z);
      P.add(jagged(w, h), '#2A2320', at, ry);
      P.add(jagged(w + 0.16, h + 0.14), '#4A3E35', at.clone().addScaledVector(f.n, -0.006), ry);
      // the bricks that fell out, at the wall's foot
      for (let k = 0; k < 4; k++) P.add(block(0.22, 0.07, 0.11), R() < 0.5 ? '#8A5A3E' : '#5C5650', f.o.clone().addScaledVector(f.along, t + (R() - 0.5) * 1.2).setY(0.035).addScaledVector(f.n, 0.25 + R() * 0.6), R() * 6);
    }
  }

  // A roof beam came down: one end on the floor, the other still caught high on the wall.
  {
    const x0 = -6.5, z0 = HALL.back + 4.5;
    if (floor.free(x0, z0, 1.2)) {
      floor.take(x0, z0, 1.6);
      const len = 7.2, tilt = 0.62;
      P.add(block(0.42, 0.46, len), '#6E5440', V(x0 - 2.6, (len / 2) * Math.sin(tilt) * 0.95, z0), Math.PI / 2, tilt);
      for (let i = 0; i < 6; i++) P.add(block(0.08 + R() * 0.1, 0.06, 0.3 + R() * 0.6), '#6E5440', V(x0 + (R() - 0.5) * 1.6, 0.04, z0 + (R() - 0.5) * 1.6), R() * 6);
      colliders.push({ kind: 'circle', x: x0, z: z0, r: 0.6, top: 0.5 });
    }
  }

  // Scorch on the flagstones (the fire) and grit everywhere.
  for (let i = 0; i < 8; i++) {
    const x = (R() * 2 - 1) * 11, z = HALL.front - 1 - R() * 22, r = 0.5 + R() * 1.0;
    const g = new THREE.CircleGeometry(r, 9), p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 1; k < p.count; k++) { const j = 0.6 + R() * 0.5; p.setXY(k, p.getX(k) * j, p.getY(k) * j); }
    P.add(g.rotateX(-Math.PI / 2).scale(1, 1, 0.6 + R() * 0.6), R() < 0.5 ? '#6A625B' : '#736A62', V(x, 0.012 + i * 0.0004, z), R() * 6);
  }
  for (let i = 0; i < 160; i++) {
    const x = (R() * 2 - 1) * 12, z = HALL.front - 0.5 - R() * 22.6, s = 0.03 + R() * 0.07;
    if (Math.abs(x) < 1.2 && R() < 0.6) continue;
    P.add(rock(s), pick(STONE), V(x, s * 0.35, z), R() * 6);
  }
  const m = P.mesh(group as THREE.Scene, 'library-ruin');
  if (m) { m.castShadow = true; m.receiveShadow = true; m.raycast = () => {}; }
  return { pieces: P.count };
}

// ---------- 2 · Books on every wall ----------
// "The walls have countless books": tall cases climb every wall above the lore shelves, up to the broken ceiling.
// The books are a painted strip of spines (four rows of an atlas, our own pixel painting) on a recessed plane per
// shelf, so thousands of books cost a few triangles; the cases are flat-coloured wood in one merged mesh. Here and
// there a stretch has been pulled out (goblins) and a few volumes lean in the gap.
const SPINES = ['#7A1F1C', '#5A2A1A', '#3E4A2A', '#2A3A4A', '#6B4A2E', '#8A6A3A', '#4A2A3A', '#3A3028', '#9A7A4A', '#5E5A50', '#2E2A3A', '#6A3020'];
function spineAtlas(R: () => number): THREE.CanvasTexture {
  const W = 512, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H * 4;
  const g = c.getContext('2d')!;
  for (let row = 0; row < 4; row++) {
    const y0 = row * H;
    g.fillStyle = '#16110D'; g.fillRect(0, y0, W, H);
    let x = 0;
    while (x < W) {
      if (R() < 0.04 + row * 0.03) { x += 10 + R() * 40; continue; }   // a gap where books were taken
      const w = 5 + Math.floor(R() * 10), h = Math.floor(H * (0.62 + R() * 0.34)), col = SPINES[Math.floor(R() * SPINES.length)];
      const lean = R() < 0.06 ? (R() < 0.5 ? -1 : 1) * (3 + R() * 5) : 0;
      g.save(); g.translate(x + w / 2, y0 + H); g.transform(1, 0, lean / h, 1, 0, 0);
      g.fillStyle = col; g.fillRect(-w / 2, -h, w, h);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(w / 2 - 1, -h, 1, h);                      // the spine's shadow side
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(-w / 2, -h, 1, h);
      if (R() < 0.6) { g.fillStyle = R() < 0.5 ? '#C9A24A' : '#D8C8A0'; const b = h * (0.15 + R() * 0.1); g.fillRect(-w / 2, -h + b, w, 1); g.fillRect(-w / 2, -h * 0.25, w, 1); }
      if (R() < 0.3) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-w / 2, -h, w, Math.floor(h * 0.2)); }   // dust and soot at the top
      g.restore();
      x += w + (R() < 0.3 ? 1 : 0);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function buildWallBooks(group: THREE.Object3D): { cases: number; rows: number; mesh: THREE.Mesh } {
  const R = rng(5150), P = new Painter(5151);
  const strips: THREE.BufferGeometry[] = [];
  const ROW = 0.62, DEEP = 0.4, TEXM = 2.2;   // shelf pitch, case depth, metres of books one atlas width covers
  let cases = 0;
  // A case against a wall: from y0 to y1, `len` long, centred `t` along the face.
  const bookcase = (o: THREE.Vector3, along: THREE.Vector3, n: THREE.Vector3, t: number, len: number, y0: number, y1: number) => {
    cases++;
    const ry = Math.atan2(n.x, n.z), c = o.clone().addScaledVector(along, t);
    const at = (a: number, y: number, d: number) => c.clone().addScaledVector(along, a).addScaledVector(n, d).setY(y);
    const wood = R() < 0.5 ? '#4A321F' : '#563B25';
    P.add(new THREE.BoxGeometry(len, y1 - y0, 0.04), '#2A1E14', at(0, (y0 + y1) / 2, 0.02), ry);   // back
    for (const s of [-1, 1]) P.add(new THREE.BoxGeometry(0.08, y1 - y0, DEEP), wood, at(s * (len / 2 - 0.04), (y0 + y1) / 2, DEEP / 2), ry);
    P.add(new THREE.BoxGeometry(len + 0.12, 0.12, DEEP + 0.06), wood, at(0, y1, DEEP / 2), ry);   // cornice
    for (let y = y0; y < y1 - 0.2; y += ROW) {
      P.add(new THREE.BoxGeometry(len - 0.1, 0.045, DEEP), wood, at(0, y, DEEP / 2), ry);
      const h = Math.min(ROW - 0.06, y1 - y - 0.08), row = Math.floor(R() * 4), u0 = R();
      // A plane of spines just behind the shelf's lip, its UVs in metres (so every book is the same size).
      const g = new THREE.PlaneGeometry(len - 0.16, h);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (len - 0.16) / TEXM, (3 - row + uv.getY(i) * (h / (ROW - 0.06))) / 4);
      g.rotateY(ry).translate(...at(0, y + 0.025 + h / 2, DEEP * 0.72).toArray() as [number, number, number]);
      strips.push(g);
    }
  };
  const L = HALL.front - HALL.back, Wd = HALL.maxX - HALL.minX;
  // Side walls: over the lore shelves (2.7 m up) to just under the ceiling, the whole length.
  for (const [o, along, n] of [[V(HALL.minX, 0, HALL.front), V(0, 0, -1), V(1, 0, 0)], [V(HALL.maxX, 0, HALL.back), V(0, 0, 1), V(-1, 0, 0)]] as const) {
    for (let t = 0.4; t + 3 <= L; t += 3.6) bookcase(o, along, n, t + 1.5, 3, 2.86, 7.6);
  }
  // The back wall: high cases over the pictures, full height at the corners (clear of the altar and the exit).
  { const o = V(HALL.minX, 0, HALL.back), along = V(1, 0, 0), n = V(0, 0, 1);
    for (const t of [1.6, Wd - 1.6]) bookcase(o, along, n, t, 2.8, 0.05, 7.6);
    for (let t = 4.2; t < Wd - 3; t += 3.4) bookcase(o, along, n, t, 3, 3.7, 7.6); }
  // The front wall: either side of the door, high (the lanterns and the crate stay clear below).
  { const o = V(HALL.maxX, 0, HALL.front), along = V(-1, 0, 0), n = V(0, 0, -1);
    for (let t = 1.6; t < Wd - 1; t += 3.4) { if (Math.abs(HALL.maxX - t) < 3.2) continue; bookcase(o, along, n, t, 3, 2.9, 7.6); } }
  const geo = mergeGeometries(strips);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: spineAtlas(R) }));
  mesh.name = 'library-wall-books'; mesh.receiveShadow = true; mesh.raycast = () => {};
  group.add(mesh);
  const wood = P.mesh(group as THREE.Scene, 'library-bookcases');
  if (wood) wood.raycast = () => {};
  return { cases, rows: strips.length, mesh };
}
