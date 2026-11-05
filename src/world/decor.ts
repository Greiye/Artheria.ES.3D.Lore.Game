import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../tex/pixel';
import { wind } from './foliage';
import type { Collider } from './index';
import { heightAt } from './terrain';
import { PATHS } from './land';

// Medieval decorations (Mike 2026-11-05, Graphics thread: "Add all decorations"). Real low-poly 3D, painted with
// flat vertex colours (our own palette, no textures), every kind merged into one mesh: a draw call or two each, so
// they stay cheap on phones. Cloth (flags, banners) moves in the shared wind in the vertex shader; it stays out of
// the ink-outline hull, which is baked once and would not move with it.

/** What the decorations need to know about the town: each lot's frame and the plaza. */
export interface DecorLot { id: string; x: number; z: number; ry: number; w: number; d: number; jetty: boolean; at: (lx: number, y: number, lz: number) => THREE.Vector3 }
export interface DecorTown { lots: DecorLot[]; green: { x: number; z: number; rx: number; rz: number }; gate: { x: number; z: number; half: number }; plinth: number; wall: number; colliders: Collider[] }

/** Flat vertex-coloured parts merged into one mesh. A colour can be a hex or a function of the triangle's centre
 *  in the part's own frame (for stripes and two-colour flags). `flap` marks cloth: a direction and an amount. */
export class Painter {
  private parts: THREE.BufferGeometry[] = [];
  private R: () => number;
  constructor(seed: number, private cloth = false) { this.R = rng(seed); }
  add(geo: THREE.BufferGeometry, col: string | ((c: THREE.Vector3) => string), pos: THREE.Vector3, ry = 0, rx = 0, rz = 0, flap?: (p: THREE.Vector3) => number) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const p = g.attributes.position as THREE.BufferAttribute, n = p.count;
    const color = new Float32Array(n * 3), amt = new Float32Array(n), c = new THREE.Color(), mid = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < n; i += 3) {
      mid.set(0, 0, 0);
      for (let k = 0; k < 3; k++) mid.add(v.fromBufferAttribute(p, i + k));
      mid.multiplyScalar(1 / 3);
      c.set(typeof col === 'string' ? col : col(mid));
      const j = 0.94 + this.R() * 0.12;
      for (let k = 0; k < 3; k++) { color[(i + k) * 3] = c.r * j; color[(i + k) * 3 + 1] = c.g * j; color[(i + k) * 3 + 2] = c.b * j; amt[i + k] = flap ? flap(v.fromBufferAttribute(p, i + k)) : 0; }
    }
    const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    if (this.cloth) {
      // The cloth's own facing (its local +Z) in the world: the way it billows.
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
      const flapA = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { flapA[i * 4] = dir.x; flapA[i * 4 + 1] = dir.y; flapA[i * 4 + 2] = dir.z; flapA[i * 4 + 3] = amt[i]; }
      g.setAttribute('aFlap', new THREE.BufferAttribute(flapA, 4));
    }
    this.parts.push(g);
  }
  get count() { return this.parts.length; }
  mesh(scene: THREE.Scene, name: string): THREE.Mesh | null {
    if (!this.parts.length) return null;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: this.cloth ? THREE.DoubleSide : THREE.FrontSide });
    if (this.cloth) {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uWind = wind;
        sh.vertexShader = 'uniform float uWind;\nattribute vec4 aFlap;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  float flapW = sin(uWind * 3.4 + aFlap.w * 5.0 + position.x * 0.7 + position.z * 0.5) * 0.7 + sin(uWind * 5.3 + aFlap.w * 9.0) * 0.3;
  transformed += aFlap.xyz * flapW * aFlap.w * 0.16;`);
      };
      mat.customProgramCacheKey = () => 'decor-cloth';
    }
    const mesh = new THREE.Mesh(mergeGeometries(this.parts), mat);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = !this.cloth;
    mesh.raycast = () => {};
    scene.add(mesh);
    return mesh;
  }
}

// Heraldic colours for the town's cloth: deep red, royal blue, forest green, plum, with gold and cream for charges.
const CLOTH = ['#9A2A22', '#2E4A8A', '#3E6A30', '#5E3A7A', '#B0582A'];
const GOLD = '#D2A640', CREAM = '#EEE2C2', POLE = '#5A3C22', IRON = '#2E2E34';

/** 1. Banners over the doorways and flags on poles round the plaza and at the gate. */
export function buildBanners(scene: THREE.Scene, T: DecorTown): { statics: THREE.Mesh[]; cloth: THREE.Mesh[] } {
  const cloth = new Painter(7101, true), wood = new Painter(7102), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // A hanging banner: 0.56 × 1.3 m with a swallowtail foot, a gold band at the top and a charge (a diamond).
  const banner = (W = 0.56, H = 1.3) => {
    const g = new THREE.PlaneGeometry(W, H, 2, 6).translate(0, -H / 2, 0);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) + H) < 1e-4 && Math.abs(p.getX(i)) < 1e-4) p.setY(i, -H + 0.22);   // the notch
    return g;
  };
  // A pair flanking each door, between the door's sign and the windows (narrow enough to clear both).
  T.lots.forEach((L, li) => {
    const main = CLOTH[li % CLOTH.length], H = 1.25, W = 0.42, top = T.plinth + T.wall - 0.22, z = L.d / 2 + 0.15;
    const col = (m: THREE.Vector3) => {
      if (m.y > -0.22 && m.y < -0.1) return GOLD;                                                    // band
      if (Math.abs(m.x) + Math.abs(m.y + 0.64) < 0.15) return li % 2 ? GOLD : CREAM;                 // diamond charge
      return main;
    };
    for (const sd of [-1, 1]) {
      const x = sd * (1.48 + Math.max(0, (L.w - 6) * 0.18));
      cloth.add(banner(W, H), col, L.at(x, top - 0.04, z), L.ry, 0.04, 0, (p) => Math.min(1, -p.y / H) * 0.35);
      wood.add(new THREE.CylinderGeometry(0.025, 0.025, W + 0.16, 5).rotateZ(Math.PI / 2), POLE, L.at(x, top, z), L.ry);
      for (const s of [-1, 1]) {
        wood.add(new THREE.SphereGeometry(0.04, 5, 3), GOLD, L.at(x + s * (W / 2 + 0.09), top, z));
        wood.add(new THREE.BoxGeometry(0.04, 0.04, 0.12), IRON, L.at(x + s * (W / 2 - 0.02), top, z - 0.06), L.ry);   // wall pins
      }
    }
  });
  // Flagpoles on the green, between the fountain and the houses, each with a two-colour flag.
  const G = T.green, flag = (len: number, h: number) => new THREE.PlaneGeometry(len, h, 6, 2).translate(len / 2, -h / 2, 0);
  const pole = (x: number, z: number, h: number, i: number) => {
    wood.add(new THREE.CylinderGeometry(0.05, 0.08, h, 6), POLE, V(x, h / 2, z));
    wood.add(new THREE.SphereGeometry(0.1, 6, 4), GOLD, V(x, h + 0.06, z));
    wood.add(new THREE.CylinderGeometry(0.22, 0.26, 0.2, 6), '#7A7268', V(x, 0.1, z));   // a stone foot
    const a = CLOTH[i % CLOTH.length], b = i % 2 ? GOLD : CREAM, len = 1.4, fh = 0.8, ry = 0.6 + i * 1.3;
    cloth.add(flag(len, fh), (m) => (m.y > -fh / 2) ? a : (m.x < len * 0.33 ? a : b), V(x, h - 0.12, z), ry, 0, 0, (p) => p.x / len);
    T.colliders.push({ kind: 'circle', x, z, r: 0.28 });
  };
  [55, 125, 235, 305].forEach((deg, i) => {
    const t = (deg * Math.PI) / 180;
    pole(G.x + (G.rx - 3.6) * 0.62 * Math.sin(t), G.z - (G.rz - 3.4) * 0.62 * Math.cos(t), 5.2, i);
  });
  // Pennants on the gate posts: long triangles streaming from short poles on top.
  const GT = T.gate;
  [-GT.half - 0.2, GT.half + 0.2].forEach((dz, i) => {
    wood.add(new THREE.CylinderGeometry(0.035, 0.04, 1.1, 5), POLE, V(GT.x, 3.2 + 0.55, GT.z + dz));
    wood.add(new THREE.SphereGeometry(0.06, 5, 3), GOLD, V(GT.x, 3.2 + 1.12, GT.z + dz));
    const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, -0.36, 0, 1.3, -0.18, 0]), 3));
    tri.computeVertexNormals();
    cloth.add(tri, (m) => m.x < 0.5 ? CLOTH[i] : GOLD, V(GT.x, 3.2 + 1.05, GT.z + dz), -Math.PI / 2 + (i ? 0.3 : -0.3), 0, 0, (p) => p.x / 1.3);
  });
  return { statics: [wood.mesh(scene, 'decor-banner-poles')!], cloth: [cloth.mesh(scene, 'decor-banners')!] };
}

/** 2. Market stalls on the green: a counter under a striped awning, goods piled on top. */
export function buildStalls(scene: THREE.Scene, T: DecorTown): THREE.Mesh[] {
  const P = new Painter(7201), G = T.green, V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const STRIPES: [string, string][] = [['#A8352A', CREAM], ['#2E4A8A', CREAM], ['#3E6A30', '#E6D49A']];
  const GOODS = ['#D04A2E', '#E8A23A', '#7AA23A', '#B03A5A', '#E8D45A'];   // apples, oranges, pears, plums, lemons
  const BOLTS = ['#5E3A7A', '#2E6A8A', '#B0582A', '#D8C8A0'];
  [168, 192, 214].forEach((deg, i) => {
    const t = (deg * Math.PI) / 180, x = G.x + (G.rx - 3.6) * 0.8 * Math.sin(t), z = G.z - (G.rz - 3.4) * 0.8 * Math.cos(t);
    const ry = Math.atan2(G.x - x, G.z - z), c = Math.cos(ry), s = Math.sin(ry);
    const at = (lx: number, y: number, lz: number) => V(x + lx * c + lz * s, y, z - lx * s + lz * c);
    const W = 2.2, D = 1.0, [a, b] = STRIPES[i];
    // Counter: a plank box with a darker skirt and a top board.
    P.add(new THREE.BoxGeometry(W, 0.82, D * 0.7), '#7A5430', at(0, 0.41, 0.1), ry);
    P.add(new THREE.BoxGeometry(W + 0.08, 0.06, D * 0.78), '#98703E', at(0, 0.85, 0.1), ry);
    for (let k = 0; k < 6; k++) P.add(new THREE.BoxGeometry(W / 6 - 0.02, 0.7, 0.03), k % 2 ? '#6A4828' : '#5A3C20', at(-W / 2 + W / 12 + k * W / 6, 0.4, 0.1 + D * 0.35 + 0.02), ry);
    // Four posts, the back pair taller so the awning slopes toward the customer.
    for (const [px, pz, h] of [[-W / 2, 0.55, 2.0], [W / 2, 0.55, 2.0], [-W / 2, -0.45, 2.35], [W / 2, -0.45, 2.35]] as const) P.add(new THREE.BoxGeometry(0.08, h, 0.08), '#5A3C22', at(px, h / 2, pz), ry);
    // The awning: stripes front to back, tilted, with a scalloped valance along the front.
    const n = 7, sw = (W + 0.3) / n, tilt = Math.atan2(0.35, 1.3);
    for (let k = 0; k < n; k++) {
      const lx = -(W + 0.3) / 2 + sw * (k + 0.5), col = k % 2 ? b : a;
      P.add(new THREE.BoxGeometry(sw, 0.04, 1.4), col, at(lx, 2.2, 0.1), ry, tilt);
      P.add(new THREE.ConeGeometry(sw / 2, 0.18, 3), col, at(lx, 1.94, 0.82), ry, Math.PI);
    }
    // Goods: heaps of fruit in crates, bolts of cloth, a few pots, depending on the stall.
    for (let k = 0; k < 4; k++) {
      const lx = -W / 2 + 0.32 + k * 0.52;
      if (i === 1) { P.add(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 6).rotateZ(Math.PI / 2), BOLTS[k], at(lx, 0.98, 0.0), ry); P.add(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 6).rotateZ(Math.PI / 2), BOLTS[(k + 2) % 4], at(lx, 0.98, 0.24), ry); continue; }
      if (i === 2 && k % 2) { P.add(new THREE.CylinderGeometry(0.1, 0.13, 0.24, 7), '#B8643A', at(lx, 1.0, 0.1), ry); continue; }
      P.add(new THREE.BoxGeometry(0.44, 0.1, 0.4), '#8A6238', at(lx, 0.93, 0.12), ry);   // a shallow crate
      for (let f = 0; f < 5; f++) P.add(new THREE.IcosahedronGeometry(0.07, 0), GOODS[(k + i) % GOODS.length], at(lx + (f % 3 - 1) * 0.12, 1.02 + (f > 2 ? 0.08 : 0), 0.12 + (f % 2 ? 0.08 : -0.08)), ry);
    }
    for (const lx of [-W / 4, W / 4]) { const p = at(lx, 0, 0.05); T.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.62, top: 0.88 }); }
  });
  return [P.mesh(scene, 'decor-stalls')!];
}

/** 3. Wall lanterns: an iron bracket with a scroll on each side wall near the front, a caged lantern hanging from it.
 *  The glass glows (unlit, like the door lanterns) and every lantern joins the night halos and lights. */
export function buildWallLanterns(scene: THREE.Scene, T: DecorTown, lanterns: THREE.Vector3[]): THREE.Mesh[] {
  const iron = new Painter(7301), glass = new Painter(7302);
  for (const L of T.lots) {
    for (const sd of [-1, 1]) {
      // In the lot's frame the side wall is at x = ±w/2; the bracket sticks out along ±x. Turn the parts so their
      // local +x points out from the wall.
      const lz = L.d / 2 - 0.7, y = T.plinth + 2.55, ry = L.ry + (sd > 0 ? 0 : Math.PI);
      const out = (k: number, dy = 0) => L.at(sd * (L.w / 2 + k), y + dy, lz);
      iron.add(new THREE.BoxGeometry(0.12, 0.2, 0.05), IRON, out(0.03, -0.05), ry);                          // wall plate
      iron.add(new THREE.BoxGeometry(0.62, 0.035, 0.035), IRON, out(0.33), ry);                              // arm
      iron.add(new THREE.BoxGeometry(0.42, 0.03, 0.03), IRON, out(0.2, -0.16), ry, 0, 0.62);   // brace
      iron.add(new THREE.TorusGeometry(0.075, 0.012, 4, 8, Math.PI * 1.5), IRON, out(0.42, 0.08), ry);      // scroll
      iron.add(new THREE.SphereGeometry(0.025, 4, 3), IRON, out(0.64));                                       // knob
      iron.add(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 3), IRON, out(0.56, -0.08));                   // chain
      const ly = -0.33, c = out(0.56, ly);
      iron.add(new THREE.ConeGeometry(0.13, 0.12, 6), IRON, c.clone().setY(c.y + 0.17));                    // cap
      iron.add(new THREE.SphereGeometry(0.025, 4, 3), IRON, c.clone().setY(c.y + 0.25));                    // ring
      iron.add(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 6), IRON, c.clone().setY(c.y + 0.11));         // top band
      iron.add(new THREE.CylinderGeometry(0.1, 0.07, 0.05, 6), IRON, c.clone().setY(c.y - 0.12));           // base
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; iron.add(new THREE.BoxGeometry(0.015, 0.22, 0.015), IRON, c.clone().add(new THREE.Vector3(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1))); }
      glass.add(new THREE.CylinderGeometry(0.09, 0.08, 0.2, 6), '#FFC878', c);
      lanterns.push(c.clone());
    }
  }
  const g = glass.mesh(scene, 'decor-lantern-glass')!;
  g.material = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.7, 1.7, 1.7) });
  g.castShadow = false;
  return [iron.mesh(scene, 'decor-lantern-iron')!, g];
}

function segDist(x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
/** Is (x, z) within r (+ half a path's width) of a footpath? */
function onPath(x: number, z: number, r: number) { return PATHS.some((line) => line.some((p, i) => i > 0 && segDist(x, z, line[i - 1], p) < r + 1.4)); }
/** Clear of paths and of everything with a collider. */
function isFree(T: DecorTown, x: number, z: number, r: number) {
  return !onPath(x, z, r) && !T.colliders.some((c) => c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + r
    : x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r);
}

/** 4. Rustic clutter behind the houses: split-log woodpiles against the back walls, a hand cart, stacked hay bales. */
export function buildRustic(scene: THREE.Scene, T: DecorTown): THREE.Mesh[] {
  const P = new Painter(7401), R = rng(7402), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const free = (x: number, z: number, r: number) => isFree(T, x, z, r);
  const LOG = ['#6A4A2C', '#7A5634', '#5E3E24'], END = '#C8A06A', HAY = ['#D8B65A', '#C8A44A', '#E2C46C'], STRING = '#8A6A3A';
  // A woodpile: rows of split logs (6-sided), pale cut ends facing out, under a little plank roof.
  const woodpile = (L: DecorLot) => {
    const len = 1.9, lz = -L.d / 2 - 0.42, ry = L.ry, base = L.at(0.4, 0, lz), y0 = heightAt(base.x, base.z);
    if (onPath(base.x, base.z, 1.0)) return false;
    for (let row = 0; row < 4; row++) for (let k = 0; k < 7 - row; k++) {
      const lx = 0.4 - len / 2 + 0.14 + (k + row * 0.5) * 0.27, p = L.at(lx, y0 + 0.13 + row * 0.23, lz);
      P.add(new THREE.CylinderGeometry(0.12, 0.12, 0.62, 6), LOG[Math.floor(R() * 3)], p, ry + Math.PI / 2, Math.PI / 2, (R() - 0.5) * 0.1);
      for (const e of [-1, 1]) P.add(new THREE.CircleGeometry(0.11, 6), END, L.at(lx, y0 + 0.13 + row * 0.23, lz + e * 0.315), ry + (e < 0 ? Math.PI : 0));
    }
    for (const lx of [0.4 - len / 2 - 0.05, 0.4 + len / 2 + 0.05]) P.add(new THREE.BoxGeometry(0.08, 1.2, 0.08), '#5A3C22', L.at(lx, y0 + 0.6, lz - 0.3), ry);
    P.add(new THREE.BoxGeometry(len + 0.4, 0.05, 0.9), '#6A4828', L.at(0.4, y0 + 1.22, lz + 0.05), ry, -0.18);
    for (const lx of [-0.3, 0.5, 1.2]) { const c = L.at(lx, 0, lz); T.colliders.push({ kind: 'circle', x: c.x, z: c.z, r: 0.38, top: 1.0 }); }
    return true;
  };
  // A hay bale: a straw box with two strings round it.
  const bale = (x: number, y: number, z: number, ry: number) => {
    P.add(new THREE.BoxGeometry(0.9, 0.45, 0.5), HAY[Math.floor(R() * 3)], V(x, y + 0.225, z), ry);
    for (const o of [-0.22, 0.22]) P.add(new THREE.BoxGeometry(0.03, 0.47, 0.52), STRING, V(x + Math.cos(ry) * o, y + 0.225, z - Math.sin(ry) * o), ry);
  };
  const hayStack = (x: number, z: number, ry: number) => {
    const y = heightAt(x, z), c = Math.cos(ry), sn = Math.sin(ry);
    for (const [a, b, h] of [[-0.48, 0, 0], [0.48, 0, 0], [0, 0.55, 0], [-0.48, 0.55, 0], [0.48, 0.55, 0], [0, 0.27, 0.45], [-0.45, 0.27, 0.45]] as const) bale(x + a * c + b * sn, y + h, z - a * sn + b * c, ry);
    T.colliders.push({ kind: 'circle', x, z, r: 0.95, top: 0.9 });
  };
  // A two-wheeled hand cart: plank bed with sides, spoked wheels, shafts resting on the ground, a load of hay.
  const cart = (x: number, z: number, ry: number) => {
    const y = heightAt(x, z), c = Math.cos(ry), sn = Math.sin(ry), at = (lx: number, ly: number, lz: number) => V(x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c);
    P.add(new THREE.BoxGeometry(1.2, 0.07, 1.8), '#7A5430', at(0, 0.62, 0), ry, 0.08);
    for (const sx of [-0.6, 0.6]) P.add(new THREE.BoxGeometry(0.05, 0.3, 1.8), '#6A4828', at(sx, 0.78, 0), ry, 0.08);
    P.add(new THREE.BoxGeometry(1.2, 0.3, 0.05), '#6A4828', at(0, 0.84, -0.9), ry, 0.08);
    for (const sx of [-0.68, 0.68]) {
      P.add(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 8).rotateZ(Math.PI / 2), '#4A3220', at(sx, 0.42, -0.1), ry);
      P.add(new THREE.CylinderGeometry(0.43, 0.43, 0.035, 8).rotateZ(Math.PI / 2), IRON, at(sx * 1.03, 0.42, -0.1), ry);   // the iron tyre
      for (let k = 0; k < 4; k++) P.add(new THREE.BoxGeometry(0.03, 0.78, 0.04), '#6A4828', at(sx * 1.05, 0.42, -0.1), ry, (k / 4) * Math.PI);
      P.add(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 6).rotateZ(Math.PI / 2), '#3A2A1A', at(sx * 1.08, 0.42, -0.1), ry);
    }
    P.add(new THREE.BoxGeometry(1.5, 0.06, 0.06), '#5A3C22', at(0, 0.42, -0.1), ry);   // axle
    for (const sx of [-0.45, 0.45]) P.add(new THREE.BoxGeometry(0.06, 0.06, 1.5), '#6A4828', at(sx, 0.35, 1.45), ry, -0.4);   // shafts
    for (let k = 0; k < 3; k++) P.add(new THREE.BoxGeometry(0.9, 0.4, 0.5), HAY[k % 3], at(0, 0.88, -0.55 + k * 0.55), ry + (R() - 0.5) * 0.15, 0.08);
    T.colliders.push({ kind: 'circle', x, z, r: 0.95, top: 1.1 }, { kind: 'circle', x: at(0, 0, 1.3).x, z: at(0, 0, 1.3).z, r: 0.4, top: 0.5 });
  };
  for (const L of T.lots) if (['smithy', 'inn', 'dojo', 'cartographer', 'library'].includes(L.id)) woodpile(L);
  // Carts and hay a few steps out behind some houses, where the ground is free.
  let carts = 0, stacks = 0;
  const SPOTS: [number, number][] = [[-1.2, -2.6], [1.6, -2.8], [-2.6, -2.4], [2.8, -2.4], [0.2, -3.2]];
  for (const L of T.lots) {
    const wantCart = ['inn', 'smithy', 'tailor', 'gallery'].includes(L.id), wantHay = ['inn', 'dojo', 'scriptorium', 'shop'].includes(L.id);
    let cartDone = !wantCart, hayDone = !wantHay;
    for (const [lx, dz] of SPOTS) {
      const p = L.at(lx, 0, -L.d / 2 + dz);
      if (!cartDone && free(p.x, p.z, 1.2)) { cart(p.x, p.z, L.ry + 0.5 + R()); carts++; cartDone = true; }
      else if (!hayDone && free(p.x, p.z, 1.1)) { hayStack(p.x, p.z, L.ry + R()); stacks++; hayDone = true; }
    }
  }
  const m = P.mesh(scene, 'decor-rustic')!;
  m.userData = { carts, stacks };
  return [m];
}

/** 5. Wayside pieces: stone wells with a little roof and a windlass, and signposts where the footpaths set off. */
export function buildWayside(scene: THREE.Scene, T: DecorTown): THREE.Mesh[] {
  const P = new Painter(7501), R = rng(7502), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const STONE = ['#8A8478', '#7A746A', '#9A948A', '#6E685E'], MOSS = '#5E7A3A', WOOD = '#6A4828', DARK = '#4A3220', ROOF = '#7A4A32';
  const well = (x: number, z: number, ry: number) => {
    const y = heightAt(x, z), c = Math.cos(ry), sn = Math.sin(ry), at = (lx: number, ly: number, lz: number) => V(x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c);
    // A ring of rough stones in three courses, staggered, a mossy coping, dark water inside.
    for (let row = 0; row < 3; row++) for (let k = 0; k < 10; k++) {
      const a = ((k + (row % 2) * 0.5) / 10) * Math.PI * 2;
      P.add(new THREE.BoxGeometry(0.42, 0.26, 0.24), STONE[Math.floor(R() * 4)], at(Math.sin(a) * 0.72, 0.13 + row * 0.26, Math.cos(a) * 0.72), ry + a, 0, (R() - 0.5) * 0.08);
    }
    P.add(new THREE.TorusGeometry(0.72, 0.1, 4, 10).rotateX(Math.PI / 2), MOSS, at(0, 0.82, 0), ry);
    P.add(new THREE.CircleGeometry(0.62, 10).rotateX(-Math.PI / 2), '#1E2A30', at(0, 0.5, 0), ry);
    // Two posts, a crossbeam with the windlass and its crank, a rope and bucket, a small gabled roof.
    for (const sx of [-0.85, 0.85]) P.add(new THREE.BoxGeometry(0.12, 2.0, 0.12), WOOD, at(sx, 1.0, 0), ry);
    P.add(new THREE.CylinderGeometry(0.07, 0.07, 1.62, 6).rotateZ(Math.PI / 2), '#8A6A40', at(0, 1.55, 0), ry);
    P.add(new THREE.BoxGeometry(0.04, 0.3, 0.04), IRON, at(0.92, 1.45, 0), ry);
    P.add(new THREE.BoxGeometry(0.2, 0.04, 0.04), IRON, at(1.0, 1.31, 0), ry);
    P.add(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 3), '#A08A5A', at(0.1, 1.15, 0), ry);
    P.add(new THREE.CylinderGeometry(0.13, 0.1, 0.22, 7), '#7A5430', at(0.1, 0.72, 0), ry);
    for (const sd of [-1, 1]) P.add(new THREE.BoxGeometry(2.0, 0.05, 0.85), ROOF, at(0, 2.18, sd * 0.33), ry, sd * 0.62);
    P.add(new THREE.BoxGeometry(2.0, 0.1, 0.1), DARK, at(0, 2.42, 0), ry);
    T.colliders.push({ kind: 'circle', x, z, r: 0.92, top: 0.85 });
  };
  // A signpost: a post with one or two arrow boards pointing along the path, a cap on top.
  const sign = (x: number, z: number, dirs: number[]) => {
    const y = heightAt(x, z);
    P.add(new THREE.BoxGeometry(0.12, 1.9, 0.12), WOOD, V(x, y + 0.95, z));
    P.add(new THREE.ConeGeometry(0.12, 0.14, 4), DARK, V(x, y + 1.97, z), Math.PI / 4);
    dirs.forEach((a, i) => {
      const yy = y + 1.62 - i * 0.3, ry = a - Math.PI / 2, c = Math.cos(ry), sn = Math.sin(ry), at = (lx: number) => V(x + lx * c, yy, z - lx * sn);
      P.add(new THREE.BoxGeometry(0.7, 0.2, 0.04), i % 2 ? '#9A7A4E' : '#B08C5A', at(0.38), ry);
      P.add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 3).rotateX(Math.PI / 2), i % 2 ? '#9A7A4E' : '#B08C5A', at(0.78), ry, 0, -Math.PI / 2);   // the point
      P.add(new THREE.BoxGeometry(0.4, 0.04, 0.045), '#5A3C22', at(0.36), ry);   // a carved line
    });
    T.colliders.push({ kind: 'circle', x, z, r: 0.18 });
  };
  // Signposts at the start of every footpath, set beside it and pointing along it.
  let signs = 0, wells = 0;
  PATHS.forEach((line, i) => {
    const [a, b] = [line[0], line[1]], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    for (const side of [1, -1]) {
      const x = a[0] + dx / l * 0.9 - dz / l * 1.5 * side, z = a[1] + dz / l * 0.9 + dx / l * 1.5 * side;
      if (Math.hypot(x, z) < 3 || !T.colliders.every((c) => c.kind !== 'circle' || Math.hypot(x - c.x, z - c.z) > c.r + 0.4)) continue;
      sign(x, z, i % 3 === 0 ? [ang, ang + 2.2] : [ang]); signs++; break;
    }
  });
  // Wells: beside the lane up to town and out by the footbridge path, wherever the ground is clear.
  for (const [x, z] of [[4.2, 12.5], [-3.6, 13.5], [-27, 23], [-26, 30.5], [33, 30], [12, 1.5]] as [number, number][]) {
    if (wells >= 2 || !isFree(T, x, z, 1.4)) continue;
    well(x, z, R() * Math.PI); wells++;
  }
  const m = P.mesh(scene, 'decor-wayside')!;
  m.userData = { signs, wells };
  return [m];
}
