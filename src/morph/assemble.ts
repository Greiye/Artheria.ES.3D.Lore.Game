// B57 morphology, PR 3 (Mike 2026-11-06, option 1; LOD at 20 m): a character from a spec. One shared base body
// (a skinned mesh on the same skeleton as every figure, src/world/figure.ts RIG) wears the cached parts
// (src/morph/parts.ts) as rigid pieces on its bones. The morphs move the skeleton: height scales it, limb length
// stretches the arms and legs, build widens the trunk (and everything worn on it), head size scales the head; face
// shape is a morph target on the body's head. Past 20 m the small face and hair details stop being drawn.
// The rig is the one FigureAnim drives (userData.rig), so assembled people walk, sit and wave like everyone else.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BONES, RIG, HEAD, rigged, blobShadow, figureMaterial, type BoneName, type FigureRig } from '../world/figure';
import { SLOTS, type CharacterSpec, type Slot } from './spec';
import { partCache, type PartCache } from './parts';

/** Past this many metres from the eye, the details below are hidden (Mike 2026-11-06). */
export const LOD_DIST = 20;
const DETAIL: Slot[] = ['brows', 'eyes', 'nose', 'mouth', 'beard', 'accessory'];

/** What each morph does at its ends (0 and 1). */
export const RANGE = { height: [1.55, 1.95], build: [0.86, 1.18], limbLength: [0.92, 1.08], headSize: [0.9, 1.12], faceShape: [-1, 1] } as const;
const lerp = (r: readonly [number, number], t: number) => r[0] + (r[1] - r[0]) * t;

let baseGeometry: THREE.BufferGeometry | null = null;
/** The base body every assembled character shares: plain skin, low-poly, rigged per bone, with one morph target
 *  (face shape: a narrow, long face at -1, a broad, round one at +1). Authored for 1.75 m, each piece relative to its
 *  bone's pivot (the skeleton binds with identity inverses, as buildFigure's does). */
export function baseBody(): THREE.BufferGeometry {
  if (baseGeometry) return baseGeometry;
  const parts: THREE.BufferGeometry[] = [];
  const at = (bone: BoneName, g: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const p = RIG[bone][1];
    g.translate(x - p[0], y - p[1], z - p[2]);
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    parts.push(rigged(n, BONES.indexOf(bone)));
  };
  const cyl = (rt: number, rb: number, h: number, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
  at('head', new THREE.SphereGeometry(1, 10, 8).scale(HEAD.w / 2, HEAD.h / 2, HEAD.d / 2), 0, HEAD.y, 0);
  at('spine', cyl(0.05, 0.055, 0.1), 0, 1.47, 0);                         // neck
  at('spine', new THREE.BoxGeometry(0.34, 0.48, 0.2), 0, 1.2, 0);          // chest and belly
  at('hips', new THREE.BoxGeometry(0.31, 0.15, 0.19), 0, 0.9, 0);
  for (const [up, low, k] of [['armN', 'foreN', -1], ['armP', 'foreP', 1]] as const) {
    at(up, cyl(0.05, 0.045, 0.3), k * 0.205, 1.27, 0);
    at(low, cyl(0.043, 0.036, 0.27), k * 0.22, 0.99, 0);
    at(low, new THREE.BoxGeometry(0.06, 0.09, 0.035), k * 0.22, 0.81, 0);   // hand
  }
  for (const [up, low, k] of [['thighN', 'shinN', -1], ['thighP', 'shinP', 1]] as const) {
    at(up, cyl(0.07, 0.058, 0.42), k * 0.092, 0.69, 0);
    at(low, cyl(0.055, 0.042, 0.45), k * 0.095, 0.26, 0);
    at(low, new THREE.BoxGeometry(0.085, 0.06, 0.19), k * 0.097, 0.03, 0.04);   // foot
  }
  const g = mergeGeometries(parts)!;
  // Face shape: head vertices below the eyes spread out (or pull in), and the chin drops a little when narrow.
  const pos = g.attributes.position, skin = g.attributes.skinIndex, head = BONES.indexOf('head');
  const delta = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    if (skin.getX(i) !== head) continue;
    const x = pos.getX(i), y = pos.getY(i) - (HEAD.y - RIG.head[1][1]);   // head-local: the skull's centre
    const low = THREE.MathUtils.clamp(-y / (HEAD.h / 2) + 0.2, 0, 1);   // 0 at the brow, 1 at the chin
    delta[i * 3] = x * 0.22 * low;
    delta[i * 3 + 1] = low * 0.012;
  }
  g.morphAttributes.position = [new THREE.Float32BufferAttribute(delta, 3)];
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  baseGeometry = g;
  return g;
}

/** Build a character from a (validated) spec. Returns a group like buildFigure's: feet at y = 0, facing +Z, with
 *  userData.rig for FigureAnim, userData.height, and userData.spec. Shared geometry and materials stay in the cache. */
export function assemble(spec: CharacterSpec, cache: PartCache = partCache): THREE.Group {
  const m = spec.morphs;
  const height = lerp(RANGE.height, m.height), U = height / 1.75;
  const W = lerp(RANGE.build, m.build), L = lerp(RANGE.limbLength, m.limbLength), HS = lerp(RANGE.headSize, m.headSize);
  const root = new THREE.Group();
  root.name = 'assembled';
  // The skeleton at 1.75 m (pivot offsets as in buildFigure); the root bone scales it to this character's height, so
  // the shared geometry needs no copy per size. Then the morphs.
  const bones = {} as Record<BoneName, THREE.Bone>, rest = {} as Record<BoneName, THREE.Vector3>;
  for (const name of BONES) {
    const [parent, [x, y, z]] = RIG[name], b = new THREE.Bone(), pp = parent ? RIG[parent][1] : [0, 0, 0];
    b.name = name;
    b.position.set(x - pp[0], y - pp[1], z - pp[2]);
    if (parent) bones[parent].add(b);
    bones[name] = b;
  }
  bones.root.scale.setScalar(U);
  // Longer legs lift the hips so the feet stay on the ground; longer arms just reach lower.
  const legTop = RIG.thighN[1][1];
  bones.hips.position.y = RIG.hips[1][1] - legTop + legTop * L;
  for (const b of ['thighN', 'thighP', 'armN', 'armP'] as const) bones[b].scale.y = L;
  // Build widens the trunk (and what's worn on it); the head keeps its own proportions.
  bones.hips.scale.set(W, 1, W);   // the spine, arms and legs inherit it
  bones.head.scale.set(HS / W, HS, HS / W);
  for (const b of ['armN', 'armP'] as const) bones[b].scale.x = bones[b].scale.z = 1 / W ** 0.5;   // arms grow less than the trunk
  for (const name of BONES) rest[name] = bones[name].position.clone();
  // The shared base body in this character's skin.
  const body = new THREE.SkinnedMesh(baseBody(), skinMaterial(spec.skin));
  body.name = 'figure-body';
  body.morphTargetInfluences = [lerp(RANGE.faceShape, m.faceShape)];
  body.add(bones.root);
  body.bind(new THREE.Skeleton(BONES.map((n) => bones[n]), BONES.map(() => new THREE.Matrix4())), new THREE.Matrix4());
  body.frustumCulled = false;
  root.add(body);
  // The outfit (B57 PR 4, phone perf): the cached parts, merged per look into two skinned meshes on the same skeleton,
  // clothes and face details, in one shared vertex-colour material. Four draw calls a person (body, clothes, details,
  // shadow), like buildFigure's, instead of one per part; people dressed alike share the merged geometry too.
  const outfit = outfitFor(spec, cache);
  const detail: THREE.Object3D[] = [];
  for (const [g, name] of [[outfit.clothes, 'figure-clothes'], [outfit.detail, 'figure-details']] as const) {
    if (!g) continue;
    const mesh = new THREE.SkinnedMesh(g, outfitMaterial());
    mesh.name = name;
    mesh.bind(body.skeleton, new THREE.Matrix4());
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    root.add(mesh);
    if (name === 'figure-details') detail.push(mesh);
  }
  root.userData.outfitKey = outfit.key;
  const shadow = new THREE.Mesh(shadowGeometry(), shadowMaterial());
  shadow.name = 'blob-shadow'; shadow.position.y = 0.015; shadow.scale.setScalar(0.3 * U); shadow.raycast = () => {};
  root.add(shadow);
  root.userData.rig = { bones, rest, mesh: body } satisfies FigureRig;
  root.userData.height = height;
  root.userData.spec = spec;
  root.userData.detail = detail;
  root.userData.lodNear = true;
  return root;
}

// Merged outfits, by look (skin aside): built on first wear, freed when the last wearer is disposed.
interface Outfit { key: string; clothes: THREE.BufferGeometry | null; detail: THREE.BufferGeometry | null; users: number }
const outfits = new Map<string, Outfit>();
const outfitKey = (s: CharacterSpec) => SLOTS.map((k) => `${s.parts[k].id}${s.parts[k].color}`).join('|');
function outfitFor(spec: CharacterSpec, cache: PartCache): Outfit {
  const key = outfitKey(spec);
  let o = outfits.get(key);
  if (!o) {
    const clothes: THREE.BufferGeometry[] = [], detail: THREE.BufferGeometry[] = [], col = new THREE.Color();
    for (const slot of SLOTS) {
      const p = spec.parts[slot];
      col.set(p.color);   // (three converts the sRGB hex to linear)
      for (const piece of cache.pieces(slot, p.id)) {
        const g = piece.geometry.clone(), n = g.attributes.position.count, c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
        g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
        (DETAIL.includes(slot) ? detail : clothes).push(rigged(g, BONES.indexOf(piece.bone)));
      }
    }
    const merge = (gs: THREE.BufferGeometry[]) => { if (!gs.length) return null; const m = mergeGeometries(gs)!; for (const g of gs) g.dispose(); m.computeBoundingSphere(); return m; };
    o = { key, clothes: merge(clothes), detail: merge(detail), users: 0 };
    outfits.set(key, o);
  }
  o.users++;
  return o;
}
let outfitMat: THREE.MeshLambertMaterial | null = null, shadowGeo: THREE.BufferGeometry | null = null, shadowMat: THREE.Material | null = null;
// The game's character lighting (cel bands from the sun, the hour's tint, nearby lamps), as every other figure has.
function outfitMaterial() { return outfitMat ??= Object.assign(figureMaterial({ vertexColors: true, flatShading: true }), { name: 'outfit' }); }
const skinMats = new Map<string, THREE.MeshLambertMaterial>();
function skinMaterial(c: string) { let m = skinMats.get(c); if (!m) { m = figureMaterial({ color: c, flatShading: true }); m.name = 'skin:' + c; skinMats.set(c, m); } return m; }
function shadowGeometry() { return shadowGeo ??= (blobShadow(1).geometry as THREE.BufferGeometry); }
function shadowMaterial() { return shadowMat ??= (blobShadow(1).material as THREE.Material); }
/** For tests: how many merged outfits are alive. */
export const outfitCount = () => outfits.size;

/** Hide the small details past LOD_DIST from `eye` (and show them again nearer). Cheap: call it every frame. */
export function updateLod(char: THREE.Object3D, eye: THREE.Vector3): boolean {
  const near = char.getWorldPosition(tmp).distanceTo(eye) < LOD_DIST;
  if (near !== char.userData.lodNear) {
    char.userData.lodNear = near;
    for (const o of char.userData.detail as THREE.Object3D[]) o.visible = near;
  }
  return near;
}
const tmp = new THREE.Vector3();

/** Take a character out of the scene and free what is only its own (the skeleton), and its merged outfit when nobody
 *  else wears it. Shared parts stay cached. */
export function disposeCharacter(char: THREE.Object3D) {
  char.removeFromParent();
  (char.userData.rig as FigureRig | undefined)?.mesh.skeleton.dispose();
  const o = outfits.get(char.userData.outfitKey as string);
  if (o && --o.users <= 0) { o.clothes?.dispose(); o.detail?.dispose(); outfits.delete(o.key); }
  char.userData.outfitKey = null;
  char.userData.detail = [];
}
