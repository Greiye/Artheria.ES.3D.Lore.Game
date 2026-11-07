// B57 morphology, PR 2 (Mike 2026-11-06, option 1): the parts every character is dressed from, made once and shared.
// Each catalog id (src/morph/spec.ts) is a procedural placeholder: a few low-poly pieces, each riding one bone of the
// shared skeleton (src/world/figure.ts RIG), authored for a 1.75 m figure with the bone's pivot at the origin. The
// cache builds a part's geometry the first time anyone wears it and hands every later wearer the same geometry, and
// one material per colour, so a crowd of fifty costs a few dozen geometries, not thousands. Real .glb parts
// (public/models/parts/<slot>_<id>.glb) replace placeholders in PR 5 behind the same ids.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RIG, HEAD, type BoneName } from '../world/figure';
import { CATALOG, type Slot } from './spec';

/** One rigid piece of a part: its geometry rides `bone` (positions relative to that bone's pivot). */
export interface Piece { bone: BoneName; geometry: THREE.BufferGeometry }

const piv = (b: BoneName) => new THREE.Vector3(...RIG[b][1]);
/** Shapes placed in figure space (metres, 1.75 m figure), then moved to `bone`'s pivot. */
class Shaper {
  private by = new Map<BoneName, THREE.BufferGeometry[]>();
  add(bone: BoneName, g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    if (rx || ry || rz) g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)));
    const p = piv(bone);
    g.translate(x - p.x, y - p.y, z - p.z);
    const list = this.by.get(bone) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    this.by.set(bone, list);
    return this;
  }
  box(bone: BoneName, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) { return this.add(bone, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
  ball(bone: BoneName, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, top = false) {
    const g = new THREE.SphereGeometry(r, 8, top ? 4 : 6, 0, Math.PI * 2, 0, top ? Math.PI / 2 : Math.PI);
    g.scale(sx, sy, sz);
    return this.add(bone, g, x, y, z);
  }
  cyl(bone: BoneName, rTop: number, rBot: number, h: number, x: number, y: number, z: number, sides = 6, rx = 0, rz = 0) { return this.add(bone, new THREE.CylinderGeometry(rTop, rBot, h, sides), x, y, z, rx, 0, rz); }
  cone(bone: BoneName, r: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0) { return this.add(bone, new THREE.ConeGeometry(r, h, 5), x, y, z, rx, 0, rz); }
  ring(bone: BoneName, r: number, tube: number, x: number, y: number, z: number) { return this.add(bone, new THREE.TorusGeometry(r, tube, 3, 10), x, y, z, Math.PI / 2); }
  pieces(): Piece[] {
    return [...this.by].map(([bone, gs]) => {
      for (const g of gs) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const geometry = mergeGeometries(gs)!;
      geometry.computeBoundingSphere();
      return { bone, geometry };
    });
  }
}

// The head: centre, half-sizes, and the front of the face.
const HY = HEAD.y, HW = HEAD.w / 2, HH = HEAD.h / 2, HD = HEAD.d / 2, FZ = HD + 0.004;
const SIDES: [BoneName, number][] = [['armN', -1], ['armP', 1]];
const LEGS: [BoneName, BoneName, number][] = [['thighN', 'shinN', -1], ['thighP', 'shinP', 1]];

/** The placeholder for `slot` `id` ('01'…). Variants differ in clear, readable ways (long hair, a brimmed hat…). */
function placeholder(slot: Slot, id: string): Piece[] {
  const n = Number(id) || 1, s = new Shaper();
  switch (slot) {
    case 'hair': {
      s.ball('head', HW * 1.12, 0, HY + HH * 0.15, -0.005, 1, 1.05, 1.08, true);   // every style starts from a cap
      if (n === 2) s.box('head', HW * 2.1, 0.3, 0.06, 0, HY - 0.08, -HD * 0.85);                                        // long
      if (n === 3) for (let i = 0; i < 5; i++) s.cone('head', 0.03, 0.09, (i - 2) * 0.035, HY + HH + 0.02, -0.02 + (i % 2) * 0.03, -0.2, (i - 2) * 0.25);   // spiky
      if (n === 4) s.ball('head', 0.045, 0, HY + HH + 0.07, -0.02);                                                     // topknot
      if (n === 5) s.box('head', HW * 2.2, 0.5, 0.07, 0, HY - 0.18, -HD * 0.8, 0.12);                                    // flowing
      if (n === 6) for (const k of [-1, 1]) s.box('head', 0.04, 0.17, HD * 1.6, k * HW * 1.02, HY - 0.04, -0.01);          // bob
      if (n === 7) s.box('head', 0.035, 0.07, HD * 2.1, 0, HY + HH + 0.02, -0.01);                                        // ridge
      if (n === 8) for (let i = 0; i < 7; i++) s.ball('head', 0.045, Math.sin(i * 0.9) * HW, HY + HH * 0.7 + (i % 2) * 0.03, Math.cos(i * 0.9) * HD * 0.8);   // curls
      break;
    }
    case 'brows': for (const k of [-1, 1]) s.box('head', 0.045, n === 2 ? 0.018 : 0.01, 0.012, k * 0.037, HY + 0.035, FZ, 0, 0, k * (n === 3 ? 0.25 : n === 4 ? -0.2 : 0.05)); break;
    case 'eyes': for (const k of [-1, 1]) s.ball('head', [0.014, 0.017, 0.012, 0.016][n - 1] ?? 0.014, k * 0.037, HY + 0.005, FZ - 0.004, n === 4 ? 1.4 : 1, n === 3 ? 0.6 : 1, 0.5); break;
    case 'nose': {
      if (n === 1) s.box('head', 0.025, 0.045, 0.03, 0, HY - 0.03, FZ + 0.01);
      if (n === 2) s.cone('head', 0.018, 0.05, 0, HY - 0.03, FZ + 0.015, -1.2);
      if (n === 3) s.ball('head', 0.02, 0, HY - 0.04, FZ + 0.01);
      if (n === 4) s.box('head', 0.03, 0.06, 0.04, 0, HY - 0.025, FZ + 0.015, 0.2);
      break;
    }
    case 'mouth': s.box('head', [0.045, 0.06, 0.035, 0.05][n - 1] ?? 0.045, n === 4 ? 0.016 : 0.009, 0.01, 0, HY - 0.075, FZ - 0.002, 0, 0, n === 3 ? 0.15 : 0); break;
    case 'beard': {
      if (n === 1) s.box('head', HW * 1.9, 0.07, 0.04, 0, HY - 0.09, HD * 0.7);                       // short
      if (n === 2) s.box('head', HW * 1.9, 0.16, 0.06, 0, HY - 0.12, HD * 0.65);                      // full
      if (n === 3) s.cone('head', 0.03, 0.08, 0, HY - 0.14, FZ - 0.01, Math.PI);                      // goatee
      if (n === 4) for (const k of [-1, 1]) s.box('head', 0.045, 0.014, 0.014, k * 0.024, HY - 0.06, FZ + 0.004, 0, 0, k * -0.25);   // moustache
      break;
    }
    case 'top': {
      const long = n === 3 ? 0.42 : n === 4 ? 0.5 : 0, wide = n === 4 ? 1.12 : 1;
      s.box('spine', 0.37 * wide, 0.5, 0.23, 0, 1.2, 0);                                              // the body of it
      if (long) s.cyl('hips', 0.2 * wide, 0.25 * wide, long, 0, 0.98 - long / 2, 0, 8);              // coat tails / robe
      if (n !== 2) for (const [b, k] of SIDES) s.cyl(b, 0.058, 0.052, n === 5 ? 0.16 : 0.3, k * 0.205, n === 5 ? 1.34 : 1.27, 0, 6);   // sleeves (a vest has none)
      if (n === 5) s.ring('spine', 0.085, 0.022, 0, 1.46, 0);                                          // collar
      if (n === 6) s.box('spine', 0.39, 0.06, 0.25, 0, 1.02, 0);                                        // belted jerkin
      break;
    }
    case 'bottom': {
      s.box('hips', 0.33, 0.16, 0.21, 0, 0.9, 0);
      if (n === 3) s.cyl('hips', 0.17, 0.27, 0.42, 0, 0.62, 0, 8);                                      // skirt
      else for (const [b, , k] of LEGS) s.cyl(b, n === 4 ? 0.09 : 0.075, n === 4 ? 0.085 : 0.065, n === 2 ? 0.2 : 0.42, k * 0.092, n === 2 ? 0.8 : 0.69, 0);   // trousers / shorts / baggy
      break;
    }
    case 'shoes': for (const [, b, k] of LEGS) {
      const x = k * 0.097;
      if (n === 1) { s.box(b, 0.1, 0.09, 0.2, x, 0.045, 0.04); s.cyl(b, 0.06, 0.06, 0.18, x, 0.18, 0); }      // boots
      if (n === 2) s.box(b, 0.095, 0.07, 0.21, x, 0.035, 0.04);                                                // shoes
      if (n === 3) s.box(b, 0.09, 0.02, 0.21, x, 0.01, 0.04);                                                  // sandals
      if (n === 4) { s.box(b, 0.09, 0.07, 0.18, x, 0.035, 0.03); s.cone(b, 0.04, 0.08, x, 0.03, 0.15, Math.PI / 2); }   // pointed
    } break;
    case 'hat': {
      const top = HY + HH;
      if (n === 1) s.ball('head', HW * 1.2, 0, top - 0.04, 0, 1, 0.7, 1.1, true).box('head', HW * 1.6, 0.012, 0.09, 0, top - 0.04, HD * 0.95);   // cap
      if (n === 2) s.cyl('head', 0.3, 0.3, 0.015, 0, top - 0.01, 0, 12).cyl('head', HW * 1.05, HW * 1.15, 0.1, 0, top + 0.04, 0, 10);       // wide brim
      if (n === 3) s.cyl('head', 0.24, 0.24, 0.015, 0, top - 0.01, 0, 12).cone('head', HW * 1.1, 0.32, 0, top + 0.15, -0.02, -0.15);          // pointed
      if (n === 4) s.ball('head', HW * 1.35, 0, HY + 0.01, -0.02, 1, 1.15, 1.2, true).box('head', HW * 2.5, 0.25, 0.08, 0, HY - 0.06, -HD * 1.05);   // hood
      break;
    }
    case 'accessory': {
      if (n === 1) s.ring('spine', 0.095, 0.03, 0, 1.44, 0.01);                                       // scarf
      if (n === 2) s.box('hips', 0.36, 0.05, 0.24, 0, 0.95, 0).box('hips', 0.08, 0.09, 0.05, 0.12, 0.9, 0.13);   // belt and pouch
      if (n === 3) s.ring('spine', 0.09, 0.008, 0, 1.4, 0.04).ball('spine', 0.018, 0, 1.32, 0.12);      // pendant
      if (n === 4) s.box('spine', 0.28, 0.34, 0.14, 0, 1.18, -0.19);                                     // pack
      break;
    }
  }
  return s.pieces();
}

/** Shared parts and materials. One per game (`partCache`); a test can make its own and dispose it. */
export class PartCache {
  private parts = new Map<string, Piece[]>();
  private mats = new Map<string, THREE.MeshLambertMaterial>();
  /** The pieces of `slot` `id`, built once; [] for an empty optional slot or an id not in the catalog. */
  pieces(slot: Slot, id: string): Piece[] {
    if (!id || !CATALOG[slot].ids.includes(id)) return [];
    const k = slot + ':' + id;
    let p = this.parts.get(k);
    if (!p) { p = placeholder(slot, id); this.parts.set(k, p); }
    return p;
  }
  /** One flat-shaded material per colour, shared by everyone wearing it. */
  material(color: string): THREE.MeshLambertMaterial {
    const k = color.toUpperCase();
    let m = this.mats.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: k, flatShading: true }); m.name = 'part:' + k; this.mats.set(k, m); }
    return m;
  }
  get stats() {
    let tris = 0;
    for (const ps of this.parts.values()) for (const p of ps) tris += p.geometry.attributes.position.count / 3;
    return { parts: this.parts.size, materials: this.mats.size, tris };
  }
  dispose() {
    for (const ps of this.parts.values()) for (const p of ps) p.geometry.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.parts.clear(); this.mats.clear();
  }
}
export const partCache = new PartCache();
