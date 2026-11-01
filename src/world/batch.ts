import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Static batching for the world: every prop is baked into world space, given box-projected UVs
// in metres (1 texture tile = 1 m, so every surface shares one texel density, docs/vision.md),
// then merged into one mesh per material. A glade of hundreds of props stays a handful of draw calls.

// Box-projected UVs from world-space positions: each face samples the plane it mostly faces.
function worldUV(geo: THREE.BufferGeometry, scale = 1): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  // Per-face normal (not per-vertex) so a face never splits across two projections.
  for (let i = 0; i < p.count; i += 3) {
    const nx = Math.abs(n.getX(i) + n.getX(i + 1) + n.getX(i + 2));
    const ny = Math.abs(n.getY(i) + n.getY(i + 1) + n.getY(i + 2));
    const nz = Math.abs(n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2));
    for (let k = i; k < i + 3; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      let u: number, v: number;
      if (ny >= nx && ny >= nz) { u = x; v = z; }
      else if (nx >= nz) { u = z; v = y; }
      else { u = x; v = y; }
      uv[k * 2] = u * scale; uv[k * 2 + 1] = v * scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Style pass 1: baked ambient occlusion and edge light, stored as vertex colours (free at runtime).
// A piece standing on the ground darkens toward its foot, so walls, trunks and rocks sit in the grass instead of
// floating; the upward faces at a piece's top get a touch lighter (the MML top-edge highlight).
const AO_HEIGHT = 0.9, AO_DARK = 0.64, TOP_LIGHT = 1.08;
function bakeAO(g: THREE.BufferGeometry) {
  const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const grounded = minY < 0.5 && maxY - minY > 0.15;   // flat pieces (paving, lanes) lie on the ground: no AO
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    let k = 1;
    if (grounded) { const t = Math.min(1, Math.max(0, (y - minY) / AO_HEIGHT)); k = AO_DARK + (1 - AO_DARK) * Math.sqrt(t); }
    if (maxY - y < 0.02 && n.getY(i) > 0.7 && maxY - minY > 0.15) k *= TOP_LIGHT;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
// Batched meshes carry vertex colours; materials shared with unbatched meshes (which have none) stay untouched,
// so each batched material gets one vertex-coloured twin.
const twins = new WeakMap<THREE.Material, THREE.Material>();
function withVertexColors(mat: THREE.Material): THREE.Material {
  if ((mat as THREE.MeshLambertMaterial).vertexColors) return mat;
  let t = twins.get(mat);
  if (!t) {
    t = mat.clone();   // clone() drops shader hooks (fire glow, wind), so carry them over
    t.onBeforeCompile = mat.onBeforeCompile;
    t.customProgramCacheKey = mat.customProgramCacheKey;
    (t as THREE.MeshLambertMaterial).vertexColors = true; t.name = mat.name; twins.set(mat, t);
  }
  return t;
}

export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  // Add a geometry, transformed (position, Y rotation [+ X/Z tilt], non-uniform scale) into world space.
  add(mat: THREE.Material, geo: THREE.BufferGeometry, pos: THREE.Vector3, scale = new THREE.Vector3(1, 1, 1), ry = 0, rx = 0, rz = 0, uvScale = 1) {
    this.q.setFromEuler(this.e.set(rx, ry, rz, 'YXZ'));
    this.m.compose(pos, this.q, scale);
    const g = worldUV(geo.clone().applyMatrix4(this.m), uvScale);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    bakeAO(g);
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }

  box(mat: THREE.Material, pos: THREE.Vector3, w: number, h: number, d: number, ry = 0) {
    this.add(mat, new THREE.BoxGeometry(w, h, d), pos, undefined, ry);
  }

  flush(scene: THREE.Object3D, name: string): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.parts.forEach((list, mat) => {
      const merged = mergeGeometries(list, false);
      if (!merged) return;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, withVertexColors(mat));
      mesh.name = name;
      scene.add(mesh);
      out.push(mesh);
    });
    this.parts.clear();
    return out;
  }
}
