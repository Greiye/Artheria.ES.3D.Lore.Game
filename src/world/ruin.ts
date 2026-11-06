import * as THREE from 'three';
import { Painter } from './decor';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../tex/pixel';
import type { Collider } from './index';
import { leafMaterial } from './foliage';

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

// ---------- 3 · Goblin signs: they've moved in ----------
// Bedrolls of sacking and straw, gnawed bones, a cart wheel they dragged in, and tally marks scratched in chalk on
// the walls (someone is counting something). One merged mesh.
export function buildGoblinSigns(group: THREE.Object3D, colliders: Collider[], floor: Floor): { pieces: number; spots: Keep[] } {
  const R = rng(6060), P = new Painter(6061), pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const spots: Keep[] = [];
  const place = (r: number, tries = 300, wallGap = 0.5): [number, number] | null => {
    for (let i = 0; i < tries; i++) {
      const x = (R() < 0.5 ? -1 : 1) * (2.4 + R() * 9.2), z = HALL.front - 3.5 - R() * 19;
      if (floor.free(x, z, r, wallGap)) { floor.take(x, z, r); spots.push({ x, z, r }); return [x, z]; }
    }
    return null;
  };
  const SACK = ['#8A7656', '#7A6A4E', '#6E5E44', '#94805C'], STRAW = ['#C9A85A', '#B8964A', '#D4B868'], BONE = ['#E4DCC8', '#D8CDB4', '#CFC2A6'];
  // Bedrolls: a lumpy sack mattress on a scatter of straw, a rolled blanket at the head.
  for (let n = 0; n < 5; n++) {
    const at = place(1.0); if (!at) break;
    const [x, z] = at, ry = R() * Math.PI * 2, c = Math.cos(ry), s = Math.sin(ry), L = (a: number, b: number, y: number) => V(x + a * c + b * s, y, z - a * s + b * c);
    for (let i = 0; i < 14; i++) P.add(new THREE.BoxGeometry(0.4 + R() * 0.3, 0.02, 0.03), pick(STRAW), L((R() - 0.5) * 1.8, (R() - 0.5) * 1.2, 0.012), ry + R() * 3);
    P.add(new THREE.BoxGeometry(1.25, 0.1, 0.62).translate(0, 0.05, 0), pick(SACK), L(0, 0, 0.02), ry, 0, 0.03);
    P.add(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 7).rotateX(Math.PI / 2).rotateY(Math.PI / 2), pick(SACK), L(-0.55, 0, 0.17), ry);
    if (R() < 0.6) P.add(new THREE.BoxGeometry(0.7, 0.03, 0.55), pick(['#6A2A22', '#3E4A5A', '#5A4A2A']), L(0.25, 0.05, 0.12), ry + 0.15, 0, 0.05);   // a stolen blanket
  }
  // Bones: little heaps of gnawed bones and a skull or two near the bedrolls and in corners.
  const bone = (len: number) => {
    const g = new THREE.CylinderGeometry(0.018, 0.018, len, 5).rotateZ(Math.PI / 2);
    return mergeGeometries([g, new THREE.SphereGeometry(0.035, 5, 4).translate(-len / 2, 0, 0), new THREE.SphereGeometry(0.035, 5, 4).translate(len / 2, 0, 0)].map((q) => { q.deleteAttribute('uv'); return q.index ? q.toNonIndexed() : q; }));
  };
  for (let n = 0; n < 7; n++) {
    const at = place(0.5, 200, 0.2); if (!at) break;
    const [x, z] = at;
    for (let i = 0; i < 6 + R() * 6; i++) P.add(bone(0.18 + R() * 0.22), pick(BONE), V(x + (R() - 0.5) * 0.7, 0.03 + R() * 0.05, z + (R() - 0.5) * 0.7), R() * 6, 0, (R() - 0.5) * 0.4);
    if (R() < 0.5) {   // a skull: a squashed sphere with dark sockets
      const sx = x + (R() - 0.5) * 0.3, sz = z + (R() - 0.5) * 0.3, ry = R() * 6;
      P.add(new THREE.SphereGeometry(0.11, 7, 5).scale(1, 0.85, 1.15), pick(BONE), V(sx, 0.09, sz), ry);
      for (const e of [-1, 1]) P.add(new THREE.SphereGeometry(0.028, 5, 4), '#2A221C', V(sx + Math.cos(ry) * e * 0.045 + Math.sin(ry) * 0.1, 0.1, sz - Math.sin(ry) * e * 0.045 + Math.cos(ry) * 0.1), ry);
    }
  }
  // A cart wheel, dragged in and propped against a wall (the cart's long gone).
  { const at = place(0.9, 300, 0.2);
    if (at) {
      const [x0, z0] = at, wallX = x0 < 0 ? HALL.minX : HALL.maxX, x = wallX + (x0 < 0 ? 0.35 : -0.35), z = z0, ry = Math.PI / 2;
      const rim = new THREE.TorusGeometry(0.62, 0.05, 5, 14);
      P.add(rim, '#5A3E26', V(x, 0.66, z), ry, 0, x0 < 0 ? 0.25 : -0.25);
      P.add(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).rotateX(Math.PI / 2), '#4A321F', V(x, 0.66, z), ry, 0, x0 < 0 ? 0.25 : -0.25);
      for (let k = 0; k < 8; k++) P.add(new THREE.BoxGeometry(0.04, 1.2, 0.04), '#6B4A2E', V(x, 0.66, z), ry, 0, k * Math.PI / 8 + (x0 < 0 ? 0.25 : -0.25));
      colliders.push({ kind: 'circle', x, z, r: 0.35 });
    } }
  // Tally marks in chalk on the walls: groups of four strokes and a slash, in rows, at goblin height.
  const chalk = '#E8E4D8';
  const tallies = (o: THREE.Vector3, along: THREE.Vector3, n: THREE.Vector3, t: number, y: number, count: number) => {
    const ry = Math.atan2(n.x, n.z);
    let a = 0;
    for (let i = 0; i < count; i++) {
      const g = i % 5, base = o.clone().addScaledVector(along, t + a).addScaledVector(n, 0.012).setY(y);
      if (g < 4) { P.add(new THREE.PlaneGeometry(0.025, 0.22), chalk, base.clone().addScaledVector(along, g * 0.06), ry, 0, (R() - 0.5) * 0.15); }
      else { P.add(new THREE.PlaneGeometry(0.025, 0.3), chalk, base.clone().addScaledVector(along, 0.09), ry, 0, -1.1); a += 0.36; }
    }
  };
  const W = HALL.maxX - HALL.minX, Lz = HALL.front - HALL.back;
  tallies(V(HALL.minX, 0, HALL.back), V(1, 0, 0), V(0, 0, 1), 8.2, 1.05, 23);
  tallies(V(HALL.minX, 0, HALL.back), V(1, 0, 0), V(0, 0, 1), 8.2, 0.75, 17);
  tallies(V(HALL.maxX, 0, HALL.front), V(-1, 0, 0), V(0, 0, -1), W - 8.6, 1.1, 32);
  tallies(V(HALL.minX, 0, HALL.front), V(0, 0, -1), V(1, 0, 0), Lz - 0.35, 1.6, 9);   // squeezed in at a back corner
  const m = P.mesh(group as THREE.Scene, 'library-goblin-signs');
  if (m) m.raycast = () => {};
  return { pieces: P.count, spots };
}

// ---------- 4 · Goblin life: how they live here ----------
// Cookfires, loot heaps, hammocks, chalk drawings, a throne of books with a chair on top, a rope bridge high across
// the hall, loose pages, broken chandeliers, a smashed stained-glass rose over the door, rugs thrown over rubble and
// dens made of collapsed shelving. Two merged meshes: the lit things, and what glows (fire, glass), unlit.
export function buildGoblinLife(group: THREE.Object3D, colliders: Collider[], floor: Floor): { pieces: number; glow: number; spots: Keep[]; throne: { x: number; z: number } | null } {
  const R = rng(7070), P = new Painter(7071), GL = new Painter(7072), pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const spots: Keep[] = [];
  const place = (r: number, wallGap = 0.5, tries = 300): [number, number] | null => {
    for (let i = 0; i < tries; i++) {
      const x = (R() < 0.5 ? -1 : 1) * (2.4 + R() * 9.2), z = HALL.front - 3.5 - R() * 19;
      if (floor.free(x, z, r, wallGap)) { floor.take(x, z, r); spots.push({ x, z, r }); return [x, z]; }
    }
    return null;
  };
  const STONE2 = ['#6A645F', '#77706A', '#5E5954'], WOOD2 = ['#5A3E26', '#6B4A2E', '#4A321F'], GOLD = ['#D8B048', '#C99A38', '#E8C860'];
  const CLOTH = ['#7A2A22', '#3E4A6A', '#5A6A2A', '#6A4A2A', '#5A2A4A'];
  let throneAt: { x: number; z: number } | null = null;
  // A throne: a heap of books with a high-backed chair on top, a ragged cloth over the back.
  { const spot = ([[HALL.maxX - 3.2, HALL.back + 2.4], [HALL.minX + 3.2, HALL.back + 2.4], [HALL.maxX - 3.6, HALL.back + 5.2], [HALL.minX + 3.6, HALL.back + 5.2], [HALL.maxX - 4.5, HALL.front - 12]] as const).find(([x, z]) => floor.free(x, z, 1.1, 0.2)) ?? place(1.1, 0.3);
    if (spot) {
      const [x, z] = spot; throneAt = { x, z };
      if (!spots.some((k) => k.x === x && k.z === z)) { floor.take(x, z, 1.4); spots.push({ x, z, r: 1.4 }); }
      for (let k = 0; k < 70; k++) { const a = R() * 6.28, d = R() * 0.9, y = Math.max(0, (0.9 - d) * 0.75 - R() * 0.15); P.add(new THREE.BoxGeometry(0.22, 0.06, 0.3), pick(['#7A1F1C', '#5A2A1A', '#3E4A2A', '#2A3A4A', '#6B4A2E', '#9A7A4A']), V(x + Math.cos(a) * d, y + 0.03, z + Math.sin(a) * d), R() * 6, (R() - 0.5) * 0.3); }
      const y = 0.7, wood = '#4A2A1A';
      P.add(new THREE.BoxGeometry(0.62, 0.08, 0.58), wood, V(x, y + 0.45, z), Math.PI * 0.85);
      P.add(new THREE.BoxGeometry(0.62, 1.2, 0.08), wood, V(x + Math.sin(Math.PI * 0.85) * -0.27, y + 1.05, z + Math.cos(Math.PI * 0.85) * -0.27), Math.PI * 0.85);
      for (const [a, b] of [[-0.27, -0.25], [0.27, -0.25], [-0.27, 0.25], [0.27, 0.25]]) P.add(new THREE.BoxGeometry(0.06, 0.45, 0.06), wood, V(x + a, y + 0.22, z + b), Math.PI * 0.85);
      for (const s of [-1, 1]) P.add(new THREE.ConeGeometry(0.05, 0.16, 5), '#D8B048', V(x + s * 0.25, y + 1.72, z - 0.25 * Math.cos(Math.PI * 0.85)), 0);
      P.add(new THREE.BoxGeometry(0.5, 0.7, 0.03), '#7A2A22', V(x + Math.sin(Math.PI * 0.85) * -0.32, y + 1.15, z + Math.cos(Math.PI * 0.85) * -0.32), Math.PI * 0.85, 0.08);
      colliders.push({ kind: 'circle', x, z, r: 0.95, top: 0.7 });
    } }
  // Cookfires: a ring of stones, crossed logs, a low flame, a spit with something on it, a pot beside.
  for (let n = 0; n < 2; n++) {
    const at = place(1.1); if (!at) break;
    const [x, z] = at;
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; P.add(new THREE.DodecahedronGeometry(0.12, 0).scale(1, 0.7, 1), pick(STONE2), V(x + Math.cos(a) * 0.42, 0.06, z + Math.sin(a) * 0.42), R() * 6); }
    for (let k = 0; k < 3; k++) P.add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6).rotateZ(Math.PI / 2), '#3A2A1C', V(x, 0.07, z), k * 1.05, 0, 0.12);
    GL.add(new THREE.ConeGeometry(0.2, 0.42, 6), '#F08A2A', V(x, 0.28, z), R());
    GL.add(new THREE.ConeGeometry(0.11, 0.3, 5), '#FFD060', V(x + 0.03, 0.24, z - 0.02), R());
    GL.add(new THREE.CircleGeometry(0.3, 7).rotateX(-Math.PI / 2), '#C0401A', V(x, 0.03, z));
    for (const s of [-1, 1]) P.add(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), '#4A321F', V(x + s * 0.55, 0.45, z), 0, 0, s * 0.12);
    P.add(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 5).rotateZ(Math.PI / 2), '#4A321F', V(x, 0.82, z));
    P.add(new THREE.SphereGeometry(0.12, 6, 4).scale(1.6, 1, 1), '#7A4A2A', V(x, 0.74, z));   // whatever's roasting
    P.add(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 8), '#2E2E34', V(x + 0.7, 0.11, z + 0.35));
    colliders.push({ kind: 'circle', x, z, r: 0.55 });
  }
  // Loot heaps: coins, cups, a dented helm, swords and stolen books, piled against the wall.
  for (let n = 0; n < 3; n++) {
    const at = place(0.8, 0.2); if (!at) break;
    const [x, z] = at;
    P.add(new THREE.SphereGeometry(0.45, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), '#B08A30', V(x, 0, z));
    for (let k = 0; k < 26; k++) { const a = R() * 6.28, d = R() * 0.5; P.add(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 6), pick(GOLD), V(x + Math.cos(a) * d, 0.02 + (0.5 - d) * 0.4 * R(), z + Math.sin(a) * d), R() * 6, (R() - 0.5) * 0.8); }
    P.add(new THREE.CylinderGeometry(0.06, 0.04, 0.12, 7), pick(GOLD), V(x + 0.2, 0.25, z - 0.1), 0, 0.3);
    P.add(new THREE.SphereGeometry(0.14, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#7A7A80', V(x - 0.25, 0.15, z + 0.1), 0, 0.5);
    P.add(new THREE.BoxGeometry(0.05, 0.02, 0.8), '#A8A8B0', V(x + 0.1, 0.12, z + 0.2), R() * 3, 0.2);
    for (let k = 0; k < 3; k++) P.add(new THREE.BoxGeometry(0.22, 0.05, 0.3), pick(['#7A1F1C', '#2A3A4A', '#3E4A2A']), V(x + (R() - 0.5) * 0.6, 0.16 + k * 0.05, z + (R() - 0.5) * 0.6), R() * 6);
    colliders.push({ kind: 'circle', x, z, r: 0.45, top: 0.3 });
  }
  // Hammocks: sacking slung between bookcase ends along the walls, sagging, a lump of blanket in one.
  const W = HALL.maxX - HALL.minX;
  for (const [x, z0, z1] of [[HALL.minX + 0.9, HALL.front - 6.2, HALL.front - 8.6], [HALL.maxX - 0.9, HALL.front - 13.4, HALL.front - 15.8], [HALL.minX + 0.9, HALL.front - 17.2, HALL.front - 19.6]] as const) {
    const len = Math.abs(z1 - z0), zc = (z0 + z1) / 2, segs = 6;
    for (let k = 0; k < segs; k++) {
      const t0 = k / segs, t1 = (k + 1) / segs, sag = (t: number) => 3.35 - Math.sin(t * Math.PI) * 0.55;
      const y0 = sag(t0), y1 = sag(t1), za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1;
      P.add(new THREE.BoxGeometry(0.55, 0.03, Math.hypot(zb - za, y1 - y0) + 0.02), pick(['#8A7656', '#7A6A4E']), V(x, (y0 + y1) / 2, (za + zb) / 2), 0, Math.atan2(y1 - y0, zb - za) * -1 * (z1 < z0 ? -1 : 1));
    }
    for (const zz of [z0, z1]) P.add(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 4), '#C8B48A', V(x, 3.6, zz), 0, 0.5);
    P.add(new THREE.SphereGeometry(0.22, 6, 4).scale(1.8, 0.6, 1), pick(CLOTH), V(x, 2.95, zc), Math.PI / 2);
    void len;
  }
  // Chalk drawings on the walls: goblins (big heads, long ears), a dragon, a stick figure with a sword, an X.
  const chalk = '#E8E4D8', line = (o: THREE.Vector3, along: THREE.Vector3, n: THREE.Vector3, ax: number, ay: number, bx: number, by: number) => {
    const a = o.clone().addScaledVector(along, ax).setY(o.y + ay), b = o.clone().addScaledVector(along, bx).setY(o.y + by);
    const mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(n, 0.013), len = a.distanceTo(b);
    P.add(new THREE.PlaneGeometry(0.03, len + 0.02), chalk, mid, Math.atan2(n.x, n.z), 0, -Math.atan2(bx - ax, by - ay));
  };
  const goblin = (o: THREE.Vector3, along: THREE.Vector3, n: THREE.Vector3, s: number) => {
    const L = (a: number, b: number, c: number, d: number) => line(o, along, n, a * s, b * s, c * s, d * s);
    for (let k = 0; k < 8; k++) { const a0 = (k / 8) * 6.28, a1 = ((k + 1) / 8) * 6.28; L(Math.cos(a0) * 0.22, 0.9 + Math.sin(a0) * 0.2, Math.cos(a1) * 0.22, 0.9 + Math.sin(a1) * 0.2); }
    L(-0.2, 0.95, -0.5, 1.15); L(0.2, 0.95, 0.5, 1.15);   // ears
    L(0, 0.7, 0, 0.3); L(0, 0.6, -0.25, 0.4); L(0, 0.6, 0.28, 0.5); L(0, 0.3, -0.15, 0); L(0, 0.3, 0.15, 0);
  };
  { const o = V(HALL.minX, 0.2, HALL.back), along = V(1, 0, 0), n = V(0, 0, 1);
    goblin(o.clone().addScaledVector(along, 3.4), along, n, 1); goblin(o.clone().addScaledVector(along, 4.1), along, n, 0.8); goblin(o.clone().addScaledVector(along, 4.7), along, n, 0.7);
    const st = o.clone().addScaledVector(along, 5.6), L = (a: number, b: number, c: number, d: number) => line(st, along, n, a, b, c, d);
    L(0, 0.55, 0, 1.1); L(0, 1.1, 0, 1.3); L(0, 0.55, -0.15, 0.1); L(0, 0.55, 0.15, 0.1); L(0, 0.95, 0.3, 1.25); L(0.3, 1.25, 0.6, 1.7);   // a hero with a sword
    L(0.75, 0.6, 1.15, 1.0); L(0.75, 1.0, 1.15, 0.6); }   // and an X over them
  { const o = V(HALL.maxX, 0.4, HALL.front), along = V(-1, 0, 0), n = V(0, 0, -1), d = o.clone().addScaledVector(along, 6.4), L = (a: number, b: number, c: number, e: number) => line(d, along, n, a, b, c, e);
    L(0, 0.6, 0.6, 0.9); L(0.6, 0.9, 1.2, 0.7); L(1.2, 0.7, 1.7, 0.95); L(1.7, 0.95, 1.95, 1.3); L(1.95, 1.3, 2.15, 1.1);   // a dragon: neck and head
    L(0.6, 0.9, 0.8, 1.6); L(0.8, 1.6, 1.2, 0.95); L(0.3, 0.75, 0, 0.35); L(1.2, 0.7, 1.3, 0.3); L(0.8, 0.8, 0.8, 0.4);
    goblin(d.clone().addScaledVector(along, 2.8), along, n, 0.6); }
  // A rope bridge high across the hall, from the top of one wall's cases to the other's, sagging, planks missing.
  { const z = HALL.front - 11.4, y = 7.2, segs = 26;
    for (let k = 0; k < segs; k++) {
      if (R() < 0.12) continue;
      const t = (k + 0.5) / segs, x = HALL.minX + 0.4 + t * (W - 0.8), sag = Math.sin(t * Math.PI) * 1.4;
      P.add(new THREE.BoxGeometry(0.16, 0.05, 0.7), pick(['#8A6A44', '#7A5A38', '#946E48']), V(x, y - sag, z), 0, 0, (R() - 0.5) * 0.15);
    }
    for (const dz of [-0.38, 0.38]) for (const dy of [0.02, 0.75]) for (let k = 0; k < segs; k++) {
      const t0 = k / segs, t1 = (k + 1) / segs, x0 = HALL.minX + 0.4 + t0 * (W - 0.8), x1 = HALL.minX + 0.4 + t1 * (W - 0.8);
      const y0 = y + dy - Math.sin(t0 * Math.PI) * 1.4, y1 = y + dy - Math.sin(t1 * Math.PI) * 1.4;
      P.add(new THREE.CylinderGeometry(0.015, 0.015, Math.hypot(x1 - x0, y1 - y0), 4).rotateZ(Math.PI / 2), '#B8A27A', V((x0 + x1) / 2, (y0 + y1) / 2, z + dz), 0, 0, Math.atan2(y1 - y0, x1 - x0));
    } }
  // Loose pages drifted across the floor.
  for (let k = 0; k < 110; k++) {
    const x = (R() * 2 - 1) * 12, z = HALL.front - 0.6 - R() * 22.4;
    P.add(new THREE.PlaneGeometry(0.16, 0.22).rotateX(-Math.PI / 2), R() < 0.8 ? '#E4D8B8' : '#CFC0A0', V(x, 0.008 + (k % 7) * 0.0006, z), R() * 6, (R() - 0.5) * 0.15);
  }
  // Broken chandeliers: one crashed on the floor (a bent iron ring, candles spilled), one still hanging askew.
  const chandelier = (at: THREE.Vector3, rx: number, rz: number) => {
    P.add(new THREE.TorusGeometry(0.6, 0.035, 4, 12).rotateX(Math.PI / 2).scale(1, 1, 0.85), '#2E2E34', at, 0, rx, rz);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28; P.add(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 5), '#E8DCC0', at.clone().add(V(Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.5)), 0, rx, rz); }
  };
  { const at = place(0.8); if (at) { chandelier(V(at[0], 0.05, at[1]), 0.15, -0.1); for (let k = 0; k < 4; k++) P.add(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 5).rotateZ(Math.PI / 2), '#E8DCC0', V(at[0] + (R() - 0.5) * 1.4, 0.03, at[1] + (R() - 0.5) * 1.4), R() * 6); } }
  { const at = V(-5.5, 5.6, HALL.front - 15); chandelier(at, 0.35, 0.2);
    P.add(new THREE.CylinderGeometry(0.012, 0.012, HALL.h - 6.0, 4), '#2E2E34', V(at.x, (HALL.h + 6.0) / 2, at.z)); }
  // The rose window over the door, smashed: lead tracery, a few panes left (they glow with the light behind),
  // and coloured shards on the floor below.
  { const cy = 5.6, cz = HALL.front - 0.02, r = 1.5, PANES = ['#C0302A', '#2A50B0', '#E0B030', '#3A9050', '#8A40A0'];
    GL.add(new THREE.CircleGeometry(r, 16).translate(0, 0, -0.03), '#9AB8D8', V(0, cy, cz), Math.PI);   // the sky through the empty frame
    for (let k = 0; k < 12; k++) {
      if (R() < 0.45) continue;   // smashed out
      const a0 = (k / 12) * 6.28, g = new THREE.CircleGeometry(r * (0.55 + R() * 0.4), 2, a0, 6.28 / 12 * (0.6 + R() * 0.35));
      GL.add(g.translate(0, 0, -0.02), pick(PANES), V(0, cy, cz), Math.PI);
    }
    P.add(new THREE.TorusGeometry(r, 0.07, 4, 20), '#3A3430', V(0, cy, cz - 0.04), Math.PI);
    for (let k = 0; k < 6; k++) P.add(new THREE.BoxGeometry(0.05, r * 2, 0.04), '#3A3430', V(0, cy, cz - 0.04), Math.PI, 0, (k / 6) * Math.PI);
    for (let k = 0; k < 40; k++) { const x = (R() - 0.5) * 4, z = HALL.front - 1 - R() * 2.6; if (Math.abs(x) < 1 && R() < 0.7) continue; GL.add(new THREE.CircleGeometry(0.04 + R() * 0.05, 3).rotateX(-Math.PI / 2), pick(PANES), V(x, 0.01, z), R() * 6); } }
  // Rugs thrown over rubble heaps, and dens of collapsed shelving with straw inside.
  for (let n = 0; n < 3; n++) {
    const at = place(0.9); if (!at) break;
    const [x, z] = at, col = pick(CLOTH), ry = R() * 6;
    P.add(new THREE.DodecahedronGeometry(0.45, 0).scale(1.3, 0.5, 1), '#6A645F', V(x, 0.18, z), ry);
    const g = new THREE.PlaneGeometry(1.6, 1.1, 6, 4).rotateX(-Math.PI / 2), p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i), d = Math.hypot(px / 0.8, pz / 0.55); p.setY(i, Math.max(0.02, 0.42 * (1 - d * d)) + (R() - 0.5) * 0.03); }
    g.computeVertexNormals();
    P.add(g, (c) => (Math.abs(c.x) > 0.72 ? "#B89048" : col), V(x, 0, z), ry);
    colliders.push({ kind: 'circle', x, z, r: 0.6, top: 0.4 });
  }
  for (let n = 0; n < 2; n++) {
    const at = place(1.0, 0.2); if (!at) break;
    const [x, z] = at, ry = R() * 6, c = Math.cos(ry), s = Math.sin(ry), L = (a: number, b: number, y: number) => V(x + a * c + b * s, y, z - a * s + b * c);
    for (let k = 0; k < 5; k++) P.add(new THREE.BoxGeometry(0.08, 1.5, 0.3 + R() * 0.15), pick(WOOD2), L(-0.45 + k * 0.22, 0.6, -0.2), ry, -0.55, (R() - 0.5) * 0.1);
    for (let k = 0; k < 5; k++) P.add(new THREE.BoxGeometry(0.08, 1.5, 0.3), pick(WOOD2), L(-0.45 + k * 0.22, 0.6, 0.3), ry, 0.55, (R() - 0.5) * 0.1);
    for (let k = 0; k < 10; k++) P.add(new THREE.BoxGeometry(0.35, 0.02, 0.03), '#C9A85A', L((R() - 0.5) * 0.9, 0.012, (R() - 0.5) * 0.5), ry + R() * 3);
    colliders.push({ kind: 'circle', x, z, r: 0.7 });
  }
  const m = P.mesh(group as THREE.Scene, 'library-goblin-life');
  if (m) m.raycast = () => {};
  const g = GL.mesh(group as THREE.Scene, 'library-goblin-glow');
  if (g) { g.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }); g.castShadow = false; g.raycast = () => {}; }
  return { pieces: P.count, glow: GL.count, spots, throne: throneAt };
}

// ---------- 6 · 2D quad ivy and plants ----------
// Mike 2026-11-06: "Add 2d quad ivy and plants." Painted cut-out quads (our own leaves, ferns and grass textures,
// alpha-tested, swaying in the shared wind): ivy curtains down the inside walls, vines hanging through the holes in
// the ceiling, ferns and grass in the floor's cracks and round the rubble, more where the sky comes in, and a
// fringe of growth round the outside of the hall. Three merged meshes (one per texture) inside, three outside.
export function buildQuadPlants(group: THREE.Object3D, scene: THREE.Scene, floor: Floor, holes: { x: number; z: number }[]): { inside: number; outside: number } {
  const R = rng(8080);
  const parts = { leaves: [] as THREE.BufferGeometry[], fern: [] as THREE.BufferGeometry[], grassBlades: [] as THREE.BufferGeometry[] };
  const out = { leaves: [] as THREE.BufferGeometry[], fern: [] as THREE.BufferGeometry[], grassBlades: [] as THREE.BufferGeometry[] };
  type K = keyof typeof parts;
  const quad = (bag: typeof parts, k: K, w: number, h: number, at: THREE.Vector3, ry: number, rx = 0, anchorTop = false) => {
    const g = new THREE.PlaneGeometry(w, h).translate(0, anchorTop ? -h / 2 : h / 2, 0);
    g.applyMatrix4(new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    bag[k].push(g);
  };
  const tuft = (bag: typeof parts, k: K, x: number, z: number, s: number) => { const a = R() * Math.PI; for (let i = 0; i < 2; i++) quad(bag, k, s * 1.1, s, V(x, 0.01, z), a + i * Math.PI / 2); };
  // Ivy curtains down the inside walls, from the top or from a hole, in the gaps between the high cases.
  const faces = [
    { o: V(HALL.minX + 0.03, 0, HALL.front), along: V(0, 0, -1), ry: Math.PI / 2, len: HALL.front - HALL.back },
    { o: V(HALL.maxX - 0.03, 0, HALL.back), along: V(0, 0, 1), ry: -Math.PI / 2, len: HALL.front - HALL.back },
    { o: V(HALL.minX, 0, HALL.back + 0.03), along: V(1, 0, 0), ry: 0, len: HALL.maxX - HALL.minX },
    { o: V(HALL.maxX, 0, HALL.front - 0.03), along: V(-1, 0, 0), ry: Math.PI, len: HALL.maxX - HALL.minX },
  ];
  for (const f of faces) for (let i = 0; i < Math.round(f.len / 2.2); i++) {
    const t = 0.6 + R() * (f.len - 1.2), h = 2 + R() * 4.5, w = 0.6 + R() * 1.1;
    quad(parts, R() < 0.8 ? 'leaves' : 'fern', w, h, f.o.clone().addScaledVector(f.along, t).setY(HALL.h - 0.1 - R() * 0.6), f.ry, 0, true);
  }
  // Vines through the ceiling: long strands hanging from each hole, a leafy tangle round its rim.
  for (const h of holes) {
    for (let k = 0; k < 5; k++) {
      const x = h.x + (R() - 0.5) * 1.6, z = h.z + (R() - 0.5) * 1.6, len = 1.5 + R() * 3.2, ry = R() * Math.PI;
      quad(parts, 'leaves', 0.35 + R() * 0.3, len, V(x, HALL.h, z), ry, 0, true);
      quad(parts, 'leaves', 0.35 + R() * 0.3, len * 0.8, V(x, HALL.h, z), ry + Math.PI / 2, 0, true);
    }
    // Where the sky comes in, things grow: a patch of grass and ferns on the floor below the hole.
    for (let k = 0; k < 7; k++) { const x = h.x + (R() - 0.5) * 2.4, z = h.z + (R() - 0.5) * 2.4; if (floor.free(x, z, 0.15, 0.2) || R() < 0.3) tuft(parts, R() < 0.5 ? 'grassBlades' : 'fern', x, z, 0.35 + R() * 0.4); }
  }
  // Grass and ferns in the floor's cracks, at the walls' foot and round the rubble.
  for (let k = 0; k < 90; k++) {
    const wallFoot = R() < 0.5;
    const x = wallFoot ? (R() < 0.5 ? HALL.minX + 0.5 + R() * 0.5 : HALL.maxX - 0.5 - R() * 0.5) : (R() * 2 - 1) * 11.5;
    const z = wallFoot && R() < 0.3 ? (R() < 0.5 ? HALL.back + 0.5 : HALL.front - 0.5) : HALL.front - 0.6 - R() * 22.4;
    if (Math.abs(x) < 1.3) continue;
    tuft(parts, R() < 0.6 ? 'grassBlades' : 'fern', x, z, 0.22 + R() * 0.35);
  }
  // Outside: a fringe of ferns and grass along the hall's walls, and ivy hanging off the top of the front.
  for (let k = 0; k < 70; k++) {
    const side = Math.floor(R() * 3);
    const x = side === 0 ? HALL.minX - 1.2 - R() * 0.8 : side === 1 ? HALL.maxX + 1.2 + R() * 0.8 : (R() * 2 - 1) * 12.5;
    const z = side === 2 ? HALL.back - 1.2 - R() * 0.8 : HALL.front - R() * 23;
    tuft(out, R() < 0.5 ? 'fern' : 'grassBlades', x, z, 0.4 + R() * 0.6);
  }
  for (let k = 0; k < 10; k++) { const x = (R() < 0.5 ? -1 : 1) * (3 + R() * 9); quad(out, 'leaves', 0.7 + R() * 1.2, 1.5 + R() * 3, V(x, 8.6, HALL.front + 0.48), 0, 0, true); }

  const mats = new Map<K, THREE.Material>();
  const mat = (k: K) => mats.get(k) ?? (mats.set(k, (() => { const m = leafMaterial(k); m.side = THREE.DoubleSide; return m; })()), mats.get(k)!);
  let inside = 0, outside = 0;
  for (const [bag, parent, name] of [[parts, group, 'library-plants'], [out, scene, 'library-plants-outside']] as const) {
    for (const k of Object.keys(bag) as K[]) {
      if (!bag[k].length) continue;
      const m = new THREE.Mesh(mergeGeometries(bag[k]), mat(k));
      m.name = `${name}-${k}`; m.raycast = () => {}; m.castShadow = false; m.receiveShadow = true;
      parent.add(m);
      if (parent === group) inside += bag[k].length; else outside += bag[k].length;
    }
  }
  return { inside, outside };
}

// ---------- 7 · Flooding ----------
// Mike 2026-11-06: "There's flooding too." Shallow, still water has pooled across the low end of the hall: a few
// irregular sheets of painted water a hand deep, dark wet stone round their edges, bookcases toppled into them and
// half under, and books floating. You can wade through (it's ankle deep, nothing blocks). Under a ceiling hole the
// water catches the sky. Two meshes: the wet stone and wreckage (merged), and the water (one transparent mesh).
function waterTexture(R: () => number): THREE.CanvasTexture {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3E5E62'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) { g.fillStyle = R() < 0.5 ? 'rgba(90,130,130,.35)' : 'rgba(30,50,55,.35)'; g.fillRect(Math.floor(R() * S), Math.floor(R() * S), 2 + Math.floor(R() * 10), 1); }   // still, painted ripples
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(200,225,220,.35)'; g.fillRect(Math.floor(R() * S), Math.floor(R() * S), 3 + Math.floor(R() * 6), 1); }   // glints
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  return t;
}
export const FLOOD_Y = 0.11;
export function buildFlood(group: THREE.Object3D, floor: Floor): { pools: { x: number; z: number; r: number }[]; water: THREE.Mesh } {
  const R = rng(9191), P = new Painter(9192);
  const pools: { x: number; z: number; r: number }[] = [];
  // The low end: the back half of the hall, mostly to the left (the stairs keep their own dry kerb).
  const want = [[-7.5, -33.5, 3.4], [-3.2, -38.6, 2.4], [-9.2, -26.5, 2.2], [9.6, -24.8, 1.8]] as const;
  const shapes: THREE.BufferGeometry[] = [];
  const blob = (x: number, z: number, r: number, k = 1) => {
    const sh = new THREE.Shape(), n = 14;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, rr = r * k * (0.72 + R() * 0.38); const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; if (i === 0) sh.moveTo(px, pz); else if (i < n) sh.lineTo(px, pz); }
    return new THREE.ShapeGeometry(sh, 1).rotateX(Math.PI / 2);
  };
  for (const [x, z, r] of want) {
    pools.push({ x, z, r }); floor.take(x, z, r * 0.95);
    const wet = blob(x, z, r, 1.18);   // the wet stone ring, under the water's edge
    wet.translate(0, 0.014, 0);
    P.add(wet, '#3A3836', V(0, 0, 0));
    const w = blob(x, z, r);
    w.translate(0, FLOOD_Y, 0);
    shapes.push(w);
  }
  // ShapeGeometry in world XZ: UVs from position (1 tile per 2.5 m).
  const geo = mergeGeometries(shapes.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
  const p = geo.attributes.position as THREE.BufferAttribute, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 2.5; uv[i * 2 + 1] = p.getZ(i) / 2.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const water = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: waterTexture(R), transparent: true, opacity: 0.78, depthWrite: false, shininess: 60, specular: 0x557070, side: THREE.DoubleSide }));
  water.name = 'library-flood'; water.renderOrder = 2; water.raycast = () => {};
  // Bookcases toppled into the water, half under; books floating round them; a chair on its side.
  for (const [x, z, ry] of [[-7.2, -33.0, 0.5], [-3.6, -38.8, -0.9]] as const) {
    const c = Math.cos(ry), s = Math.sin(ry), at = (a: number, b: number, y: number) => V(x + a * c + b * s, y, z - a * s + b * c);
    P.add(new THREE.BoxGeometry(2.8, 0.45, 0.06), '#3E2A1A', at(0, 0.06, 0), ry, Math.PI / 2 - 0.12);
    for (const e of [-1.37, 1.37]) P.add(new THREE.BoxGeometry(0.06, 0.45, 0.42), '#4A321F', at(e, 0.1, 0.18), ry, 0, 0);
    for (let k = 0; k < 4; k++) P.add(new THREE.BoxGeometry(2.7, 0.42, 0.04), '#4A321F', at(0, 0.08, -0.2 + k * 0.14 + 0.2), ry, 0.12);
    for (let k = 0; k < 9; k++) P.add(new THREE.BoxGeometry(0.2, 0.05, 0.28), ['#7A1F1C', '#2A3A4A', '#3E4A2A', '#6B4A2E'][k % 4], at((R() - 0.5) * 3.2, FLOOD_Y - 0.01, (R() - 0.5) * 2.2 + 0.6), ry + R() * 3, (R() - 0.5) * 0.15);
    floor.take(x, z, 1.6);
  }
  // Stepping stones someone laid across the widest pool.
  for (let k = 0; k < 5; k++) P.add(new THREE.CylinderGeometry(0.22 + R() * 0.08, 0.26, 0.16, 7), '#6E6862', V(-9.8 + k * 0.85, 0.08, -31.4 - k * 0.55), R() * 3);
  const m = P.mesh(group as THREE.Scene, 'library-flood-wet');
  if (m) { m.raycast = () => {}; m.receiveShadow = true; }
  group.add(water);
  return { pools, water };
}
