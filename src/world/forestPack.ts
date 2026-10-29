import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../tex/pixel';
import { availableModels, loadModel } from '../models';

// References review: "Low Poly Forest Tree Pack" by 99.Miles (CC BY 4.0; credited in Extras > Inspirations and
// public/models/CREDITS.md), from public/models/forest-trees.glb. Its trees and rocks dress the hills past the
// meadow. Each piece is baked to its own origin, then every placed copy is merged per material, so the whole
// forest costs a handful of draw calls. No file (or a file:// page) → the hills keep their own trees.
interface Piece { parts: [THREE.BufferGeometry, THREE.Material][]; height: number; rock: boolean }

/** The pack's pieces, each centred on x/z with its foot at y 0. Trunks and their branches are one piece. */
function pieces(root: THREE.Object3D): Piece[] {
  root.updateMatrixWorld(true);
  const groups = new Map<string, [THREE.BufferGeometry, THREE.Material][]>(), lit = new Map<string, THREE.MeshLambertMaterial>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) {   // copied out of the file's interleaved buffers
      const a = m.geometry.attributes[k];
      if (!a) continue;
      const out = new Float32Array(a.count * a.itemSize), get = [a.getX, a.getY, a.getZ, a.getW];
      for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) out[i * a.itemSize + j] = get[j].call(a, i);
      g.setAttribute(k, new THREE.BufferAttribute(out, a.itemSize));
    }
    g.setIndex(m.geometry.index ? m.geometry.index.clone() : null);
    g.applyMatrix4(m.matrixWorld);
    // "Tree_Trunk_01.002" and "Tree_Branches_01.002" belong to the same tree.
    const key = (m.parent?.name || m.name).replace(/^Tree_(Trunk|Branches)_/, 'Tree_');
    // Lit like the world's own trees (not unlit like characters), so they take the time of day. Leaf cards are
    // cut out instead of blended, so they sort and cast like solid geometry.
    const src = m.material as THREE.MeshBasicMaterial;
    const id = (src.map?.uuid ?? '') + src.color.getHexString();   // the loader gives every mesh its own copy
    let mat = lit.get(id);
    if (!mat) lit.set(id, mat = new THREE.MeshLambertMaterial({ map: src.map, color: src.color, alphaTest: src.map && src.transparent ? 0.5 : 0, side: src.side }));
    (groups.get(key) ?? groups.set(key, []).get(key)!).push([g, mat]);
  });
  return [...groups.entries()].map(([key, parts]) => {
    const box = new THREE.Box3();
    for (const [g] of parts) { g.computeBoundingBox(); box.union(g.boundingBox!); }
    const c = box.getCenter(new THREE.Vector3());
    for (const [g] of parts) g.translate(-c.x, -box.min.y, -c.z);
    return { parts, height: box.max.y - box.min.y, rock: key.startsWith('Rocks') };
  }).filter((p) => p.height > 0.01);
}

export interface ForestPack { mesh: THREE.Group; trees: number; rocks: number }

/**
 * Scatter the pack over the hills: `count` trees and a third as many rocks in the band `from`–`to` metres out
 * (the square distance the hills use), skipping wherever `keepOut` says.
 */
export async function plantForestPack(scene: THREE.Scene, heightAt: (x: number, z: number) => number,
  keepOut: (x: number, z: number) => boolean, count = 70, from = 45, to = 64): Promise<ForestPack | null> {
  if (!availableModels.has('forest-trees')) return null;
  const root = await loadModel('forest-trees');
  if (!root) return null;
  const all = pieces(root), trees = all.filter((p) => !p.rock && p.height > 3), rocks = all.filter((p) => p.rock);
  if (!trees.length) return null;
  const R = rng(9907), byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const put = (p: Piece, x: number, z: number, h: number) => {
    const k = h / p.height, m = new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) - 0.05, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * Math.PI * 2), new THREE.Vector3(k, k, k));
    for (const [g, mat] of p.parts) (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push(g.clone().applyMatrix4(m));
  };
  let nt = 0, nr = 0;
  for (let i = 0; i < count * 6 && nt < count; i++) {
    const x = (R() * 2 - 1) * to, z = (R() * 2 - 1) * to, d = Math.max(Math.abs(x), Math.abs(z));
    if (d < from || keepOut(x, z)) continue;
    put(trees[Math.floor(R() * trees.length)], x, z, 6 + R() * 5); nt++;
    if (rocks.length && R() < 0.35) { put(rocks[Math.floor(R() * rocks.length)], x + (R() - 0.5) * 6, z + (R() - 0.5) * 6, 0.6 + R() * 0.9); nr++; }
  }
  const mesh = new THREE.Group();
  mesh.name = 'forest-pack';
  byMat.forEach((geos, mat) => {
    const merged = mergeGeometries(geos, false);
    if (!merged) return;
    const part = new THREE.Mesh(merged, mat);
    part.name = 'forest-pack'; part.raycast = () => {};
    mesh.add(part);
  });
  scene.add(mesh);
  return { mesh, trees: nt, rocks: nr };
}
