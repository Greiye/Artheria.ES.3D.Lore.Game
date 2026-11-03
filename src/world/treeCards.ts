import * as THREE from 'three';
import { rng } from '../tex/pixel';
import cardsUrl from '../art/trees/tree-cards.png?url';
import cards from '../art/trees/tree-cards.json';

// Mike 2026-11-03: crossed-quad trees on every preset (they replace public/models/forest-trees.glb). Each tree is
// two or three upright alpha-cutout quads crossed through its trunk, showing one card from
// src/art/trees/tree-cards.png. The cards are the trees of the "Low Poly Forest Tree Pack" by 99.Miles
// (CC BY 4.0; credited in Extras > Inspirations and public/models/CREDITS.md), drawn side-on by
// scripts/bake-tree-cards.mjs. Trees stand in loose clusters, so the hills read as a forest from any side.
// Every card shares one texture and the whole forest is one merged mesh: one draw call.
interface ForestCards { mesh: THREE.Mesh; trees: number; clusters: number }
const [CW, CH] = cards.cell as [number, number];
const N = cards.fill.length, COLS = cards.cols, ROWS = Math.ceil(N / COLS);

/** One tree: `planes` quads (2 or 3) round the trunk at x/z, `h` m tall, showing card `card`. */
function tree(card: number, x: number, y: number, z: number, h: number, turn: number, planes: number): THREE.BufferGeometry[] {
  const H = h / cards.fill[card], W = H * (CW / CH);
  const u0 = (card % COLS) / COLS, u1 = u0 + 1 / COLS, v1 = 1 - Math.floor(card / COLS) / ROWS, v0 = v1 - 1 / ROWS;   // row 0 at the top
  const out: THREE.BufferGeometry[] = [];
  // Each quad twice, back to back and single-sided: a double-sided quad flips its normal on the back face, which
  // would light the back of every card from below (black).
  for (let i = 0; i < planes * 2; i++) {
    const g = new THREE.PlaneGeometry(W, H).translate(0, H / 2, 0).rotateY(turn + (i * Math.PI) / planes).translate(x, y, z);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? v1 : v0);
    // Lit from above whichever way a quad faces, so crossed cards shade alike instead of one going dark.
    const n = g.attributes.normal as THREE.BufferAttribute;
    for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);
    out.push(g);
  }
  return out;
}

/**
 * Plant clusters of card trees in the band `from`–`to` metres out (the square distance the hills use), about
 * `count` trees in all, skipping wherever `keepOut` says.
 */
export function plantForestCards(scene: THREE.Scene, heightAt: (x: number, z: number) => number,
  keepOut: (x: number, z: number) => boolean, count = 80, from = 45, to = 64): ForestCards {
  const R = rng(9907), geos: THREE.BufferGeometry[] = [];
  let trees = 0, clusters = 0;
  for (let i = 0; i < count * 6 && trees < count; i++) {
    const cx = (R() * 2 - 1) * to, cz = (R() * 2 - 1) * to;
    if (Math.max(Math.abs(cx), Math.abs(cz)) < from || keepOut(cx, cz)) continue;
    clusters++;
    const n = 2 + Math.floor(R() * 4);   // 2 to 5 trees, a few metres apart
    for (let j = 0; j < n && trees < count; j++) {
      const a = R() * Math.PI * 2, r = j ? 1.5 + R() * 3 : 0, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (keepOut(x, z)) continue;
      geos.push(...tree(Math.floor(R() * N), x, heightAt(x, z) - 0.05, z, 6 + R() * 5, R() * Math.PI, R() < 0.5 ? 2 : 3));
      trees++;
    }
  }
  const tex = new THREE.TextureLoader().load(cardsUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;   // chunky up close, like the pixel shadows
  // A little over white: the baked cards are unlit and read dark once the hills' light falls on them again.
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15), alphaTest: 0.5 });
  const merged = mergeAll(geos);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'forest-cards'; mesh.raycast = () => {};
  mesh.castShadow = true;
  scene.add(mesh);
  return { mesh, trees, clusters };
}

function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Plane geometries are all alike (indexed, position/normal/uv), so a plain concatenation is enough.
  let v = 0, idx = 0;
  for (const g of geos) { v += g.attributes.position.count; idx += g.index!.count; }
  const pos = new Float32Array(v * 3), nor = new Float32Array(v * 3), uv = new Float32Array(v * 2), ind = new Uint32Array(idx);
  let ov = 0, oi = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array as Float32Array, ov * 3); nor.set(g.attributes.normal.array as Float32Array, ov * 3); uv.set(g.attributes.uv.array as Float32Array, ov * 2);
    const gi = g.index!.array; for (let k = 0; k < gi.length; k++) ind[oi + k] = gi[k] + ov;
    ov += g.attributes.position.count; oi += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(ind, 1));
  out.computeBoundingSphere();
  return out;
}
