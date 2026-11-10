import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Draw-call diet for props and creatures built from many little meshes (Mike 2026-11-09, the e2e draw-call budget).
// Plain flat-coloured Lambert pieces become one mesh with the colour in the vertices; textured or see-through pieces
// are merged per material. Nothing changes on screen: same faces, same colours, same shadows.

const flat = new Map<string, THREE.MeshLambertMaterial>();
/** The shared vertex-coloured Lambert for merged flat pieces (one per shading / side combination). */
function flatMaterial(flatShading: boolean, side: THREE.Side): THREE.MeshLambertMaterial {
  const k = `${flatShading}|${side}`;
  let m = flat.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading, side }); m.name = 'merged-flat'; flat.set(k, m); }
  return m;
}

/** A plain coloured Lambert (no texture, no glow, not see-through) can ride on vertex colours. */
function isFlat(m: THREE.Material): m is THREE.MeshLambertMaterial {
  const l = m as THREE.MeshLambertMaterial;
  return !!l.isMeshLambertMaterial && !l.map && !l.emissiveMap && !l.alphaMap && !l.transparent && l.opacity === 1 && l.visible && !l.vertexColors
    && l.emissive.getHex() === 0 && !l.userData.keep && l.alphaTest === 0 && l.depthWrite && l.depthTest;
}
const mergeable = (o: THREE.Object3D): o is THREE.Mesh => {
  const m = o as THREE.Mesh;
  if (!m.isMesh || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return false;
  if (Array.isArray(m.material) || !m.visible || !m.material.visible || m.userData.keep || m.children.length) return false;
  return !m.geometry.morphAttributes.position && m.renderOrder === 0;
};

type Bucket = { material: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean; layers: number };

function bake(mesh: THREE.Mesh, toParent: THREE.Matrix4, colour: THREE.Color | null): THREE.BufferGeometry {
  const src = mesh.geometry, g = new THREE.BufferGeometry();
  const ni = src.index ? src.toNonIndexed() : src;
  g.setAttribute('position', ni.attributes.position.clone());
  if (ni.attributes.normal) g.setAttribute('normal', ni.attributes.normal.clone()); else g.computeVertexNormals();
  const n = g.attributes.position.count;
  g.setAttribute('uv', ni.attributes.uv ? ni.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (colour) {
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = colour.r; c[i * 3 + 1] = colour.g; c[i * 3 + 2] = colour.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  g.applyMatrix4(toParent);
  if (toParent.determinant() < 0) {   // a mirrored piece: flip the winding back
    const p = g.attributes.position.array as Float32Array, nn = g.attributes.normal.array as Float32Array, uv = g.attributes.uv.array as Float32Array, col = g.attributes.color?.array as Float32Array | undefined;
    const swap = (a: Float32Array, size: number, i: number) => { for (let k = 0; k < size; k++) { const t = a[(i + 1) * size + k]; a[(i + 1) * size + k] = a[(i + 2) * size + k]; a[(i + 2) * size + k] = t; } };
    for (let i = 0; i < n; i += 3) { swap(p, 3, i); swap(nn, 3, i); swap(uv, 2, i); if (col) swap(col, 3, i); }
  }
  if (ni !== src) ni.dispose();
  return g;
}

/**
 * Merge the meshes under `root` into as few as possible. `deep` (default) flattens the whole subtree into `root`:
 * use it for a prop whose pieces never move on their own. With `deep: false` only root's direct mesh children are
 * merged and child groups are left alone: use it on each moving part of a creature (a head, a leg).
 * Skips skinned, instanced, invisible, multi-material and `userData.keep` meshes. Returns how many meshes went away.
 */
export function mergeMeshes(root: THREE.Object3D, opts: { deep?: boolean; name?: string } = {}): number {
  const deep = opts.deep ?? true;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), rel = new THREE.Matrix4();
  const picked: THREE.Mesh[] = [];
  if (deep) root.traverse((o) => { if (o !== root && mergeable(o)) picked.push(o); });
  else for (const o of root.children) if (mergeable(o)) picked.push(o);
  if (picked.length < 2) return 0;
  const buckets = new Map<string, Bucket>();
  for (const m of picked) {
    const mat = m.material as THREE.Material, f = isFlat(mat);
    const material = f ? flatMaterial(mat.flatShading, mat.side) : mat;
    const key = `${material.uuid}|${m.castShadow}|${m.receiveShadow}|${m.layers.mask}`;
    let b = buckets.get(key);
    if (!b) { b = { material, geos: [], cast: m.castShadow, receive: m.receiveShadow, layers: m.layers.mask }; buckets.set(key, b); }
    rel.multiplyMatrices(inv, m.matrixWorld);
    b.geos.push(bake(m, rel, f ? (mat as THREE.MeshLambertMaterial).color : null));
  }
  let gone = 0;
  const made: THREE.Mesh[] = [];
  for (const b of buckets.values()) {
    const g = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos);
    if (!g) continue;
    if (b.geos.length > 1) for (const x of b.geos) x.dispose();
    g.computeBoundingSphere(); g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, b.material);
    mesh.name = opts.name ?? (root.name ? `${root.name}-merged` : 'merged');
    mesh.castShadow = b.cast; mesh.receiveShadow = b.receive; mesh.layers.mask = b.layers;
    made.push(mesh);
  }
  for (const m of picked) { m.removeFromParent(); gone++; }
  for (const m of made) { root.add(m); gone--; }
  // Empty groups left behind by a deep merge only cost a matrix update each: drop them.
  if (deep) { const empty: THREE.Object3D[] = []; root.traverse((o) => { if (o !== root && (o as THREE.Group).isGroup && o.children.length === 0 && !o.name) empty.push(o); }); for (const o of empty) o.removeFromParent(); }
  return gone;
}
