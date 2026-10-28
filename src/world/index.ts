import * as THREE from 'three';
import { pixelTexture, rng, type TexName } from '../tex/pixel';
import { Batch } from './batch';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildSky, type TimeOfDay } from './sky';
import { tufts, leafMaterial, wind, type Tuft } from './foliage';
import { buildFigure, buildCoach } from './figure';
import { heightAt, shapeGround, setFlatMask, buildMountains } from './terrain';
import { groundMaterial, outcrop } from './land';
import QUEST from '../../content/quest/missing-party.json';
import { buildTown, townClear, type Town } from './town';

// Rebuild R2 (docs/vision.md, docs/rebuild-plan.md): the start glade in the new look.
// Vintage Story environment (pixel-textured, lit, dense undergrowth) + Mega Man Legends figures
// (unlit, painted light) + golden-hour haze and light shafts. Layout, ids and the World contract are
// unchanged from the legacy build (D7, F1.2–F1.4, F2.2–F2.3, D13), so gameplay and tests carry over.

// `top` (v0.04): the collider is a solid that height you can stand on, step onto, vault or climb.
// Without it a collider is a wall as tall as anything the player can reach.
export interface CircleCollider { kind: 'circle'; x: number; z: number; r: number; top?: number }
export interface BoxCollider { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number; top?: number }
export type Collider = CircleCollider | BoxCollider;

export interface World {
  scene: THREE.Scene;
  colliders: Collider[];
  bookTarget: THREE.Object3D;   // F3.1 raycast target (forgiving hitbox around the book)
  bookCenter: THREE.Vector3;
  spawn: { pos: THREE.Vector3; yaw: number };
  bounds: number;               // half-size of the walkable square (F1.3)
  readonly sunElevationDeg: number;      // F2.2: < 15° for the sunset
  readonly time: TimeOfDay;              // v0.04: day / sunset / night
  setTime(t: TimeOfDay): void;
  libraryDoor: THREE.Mesh;      // F2.3: 3.4 m wooden door, locked until F3.4
  natalieTarget: THREE.Object3D; // F3: E on Natalie opens her dialogue
  town: Town;                    // v0.04: the storybook town (src/world/town.ts)
  heightAt(x: number, z: number): number;   // v0.04 hills: ground height
  stations: { mirror: THREE.Object3D; anvil: THREE.Object3D; banner: THREE.Object3D; campfire: THREE.Object3D; bedroll: THREE.Object3D };   // Phase B forges + C sketchbook: E opens them
  campfireFlame: THREE.Mesh;                                  // B8: flickers in main.ts
  bannerCloth: THREE.Mesh;                                    // B10: its map is the stamped sketch
  lecternPages: [THREE.Mesh, THREE.Mesh];                     // B3: margin notes are drawn onto these
  doorOpen: boolean;
  openDoor(): void;             // F3.4 `unlock:library_door`
  standees: Record<string, THREE.Object3D>;  // placeholder characters; .glb model slots replace them
  solids: THREE.Object3D[];     // F4.2: what a bolt can stick in (the ground is handled separately)
  update(t: number, camera: THREE.Camera): void;
  setShadows(on: boolean): void;   // F1.1
  setFogDistance(far: number): void; // F1.1
  setFoliage(density: number): void;  // R3 perf: 0..1 share of undergrowth tufts drawn (preset-driven)
}

const HALF = 50; // F1.2: ~100 x 100 m start area
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildWorld(): World {
  const scene = new THREE.Scene();
  const colliders: Collider[] = [];
  const R = rng(20261016);
  const SUN_ELEV = 13, SUN_AZ = 38;
  const sky = buildSky(scene, SUN_ELEV, SUN_AZ);
  sky.setTime('sunset');   // v0.04: every visit starts at a dark sunset
  buildMountains(scene);

  // One lit material per pixel texture (Lambert: cheap on phones, takes shadows).
  const mats = new Map<TexName, THREE.MeshLambertMaterial>();
  const tex = (n: TexName) => mats.get(n) ?? (mats.set(n, new THREE.MeshLambertMaterial({ map: pixelTexture(n) })), mats.get(n)!);
  const rune = new THREE.MeshBasicMaterial({ color: new THREE.Color('#3FE0E8').multiplyScalar(1.4) });   // A4 rune glow, blooms
  const B = new Batch();
  const solids: THREE.Object3D[] = [];
  const shadowCasters: THREE.Object3D[] = [];

  // ---------- ground ----------
  const groundGeo = new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60, 80, 80).rotateX(-Math.PI / 2);
  const gUV = groundGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < gUV.count; i++) gUV.setXY(i, gUV.getX(i) * (HALF * 2 + 60), gUV.getY(i) * (HALF * 2 + 60));   // 1 tile per metre
  // Shaped once the keep-out zones are known (below): v0.04 hills at the edge, style pass 2 bumps in the meadow.
  const ground = new THREE.Mesh(groundGeo, groundMaterial());
  ground.name = 'ground';
  scene.add(ground);
  // Bare-earth patches: alpha-blended dirt decals around the dais and along the walk.
  const dirtMat = new THREE.MeshLambertMaterial({ map: pixelTexture('dirt'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  dirtMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec2 dc = vMapUv2 - 0.5; diffuseColor.a *= smoothstep(0.5, 0.3, length(dc));`).replace('void main() {', 'varying vec2 vMapUv2;\nvoid main() {');
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute vec2 edge;\nvarying vec2 vMapUv2;\nvoid main() {\n  vMapUv2 = edge;').replace('#include <uv_vertex>', '#include <uv_vertex>');
  };
  // Dirt patches, merged into one mesh (one draw call): `edge` keeps 0..1 across each patch for the soft rim,
  // `uv` is scaled by the patch size so the dirt texture keeps the same pixel size on every patch.
  const patches = ([[0, 0.5, 4.2], [0, 6, 2.2], [0, -10, 2.6], [0, -15.5, 3.4], [-4.2, -2.2, 2.2]] as const).map(([x, z, r]) => {
    const g = new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2).translate(x, 0.006, z);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    g.setAttribute('edge', uv.clone());
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 2, uv.getY(i) * r * 2);
    return g;
  });
  const decals = new THREE.Mesh(mergeGeometries(patches), dirtMat);
  decals.name = 'dirt-patches'; decals.raycast = () => {};
  scene.add(decals);

  // ---------- paved path spawn -> lectern -> library ----------
  const pave = (z0: number, z1: number, gap: number) => {
    for (let z = z0; z1 > z0 ? z <= z1 : z >= z1; z += z1 > z0 ? 0.7 : -0.7) {
      for (const x of [-0.36, 0.36]) {
        if (R() < gap) continue;
        B.box(tex('paving'), V(x + (R() - 0.5) * 0.06, 0.025, z), 0.64, 0.05, 0.64, (R() - 0.5) * 0.12);
      }
    }
  };
  pave(1.6, 9, 0.14);

  // ---------- rune dais, pillars, lectern, book ----------
  B.add(tex('mossStone'), new THREE.CylinderGeometry(2.2, 2.35, 0.1, 10), V(0, 0.05, 0));
  B.add(tex('stone'), new THREE.CylinderGeometry(1.6, 1.6, 0.04, 10), V(0, 0.11, 0));
  const glowBits: THREE.Mesh[] = [];
  [[0, -2.6], [2.6, 0], [-2.6, 0]].forEach(([x, z]) => {
    B.box(tex('mossStone'), V(x, 0.55, z), 0.5, 1.1, 0.5, Math.PI / 8);
    B.box(tex('stone'), V(x, 1.14, z), 0.62, 0.08, 0.62, Math.PI / 8);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), rune);
    cap.position.set(x, 1.3, z); cap.rotation.y = Math.PI / 4;
    scene.add(cap); glowBits.push(cap);
    colliders.push({ kind: 'circle', x, z, r: 0.38 });
  });
  // Lectern: chunky carved wood.
  B.box(tex('wood'), V(0, 0.06, 0), 0.62, 0.12, 0.52);
  B.box(tex('wood'), V(0, 0.55, 0), 0.22, 0.9, 0.22);
  B.add(tex('planks'), new THREE.BoxGeometry(0.74, 0.07, 0.54), V(0, 1.05, 0), undefined, 0, -0.35);
  colliders.push({ kind: 'circle', x: 0, z: 0, r: 0.45 });
  // The lore book: open pages + red cover, tilted with the lectern top.
  const book = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.03, 0.44), tex('cover'));
  const pageL = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.04, 0.39), tex('parchment')); pageL.position.set(-0.155, 0.03, 0); pageL.rotation.z = 0.06;
  const pageR = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.04, 0.39), tex('parchment')); pageR.position.set(0.155, 0.03, 0); pageR.rotation.z = -0.06;
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.46), rune); ribbon.position.set(0, 0.055, 0.02);
  book.add(cover, pageL, pageR, ribbon);
  book.position.set(0, 1.12, 0.02);
  book.rotation.x = -0.35;
  scene.add(book);
  shadowCasters.push(cover, pageL, pageR);
  // Floating rune ring above the book so it reads from spawn (F1.2).
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 4, 12).rotateX(Math.PI / 2), rune);
  ring.position.set(0, 1.62, 0);
  scene.add(ring);
  const bookTarget = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  bookTarget.position.set(0, 1.12, 0);
  scene.add(bookTarget);

  // ---------- F2.3 / D13: the Ruined Library ----------
  // Giant scorched stone hall beyond the lectern, front toward spawn, 3.4 m door (2x player). Roof burned away.
  const LIB = { x: 0, front: -18, w: 26, d: 24, h: 8.5 };
  const DOOR = { w: 1.8, h: 3.4 };
  const back = LIB.front - LIB.d, midZ = LIB.front - LIB.d / 2, T = 0.8;
  const wall = (x: number, y: number, z: number, w: number, h: number, d: number, t: TexName = 'bricks') => B.box(tex(t), V(x, y, z), w, h, d);
  const side = (LIB.w - DOOR.w) / 2;
  wall(-(DOOR.w / 2 + side / 2), LIB.h / 2, LIB.front, side, LIB.h, T);
  wall(DOOR.w / 2 + side / 2, LIB.h / 2, LIB.front, side, LIB.h, T);
  wall(0, DOOR.h + (LIB.h - DOOR.h) / 2, LIB.front, DOOR.w, LIB.h - DOOR.h, T);
  wall(-LIB.w / 2, LIB.h / 2, midZ, T, LIB.h, LIB.d);
  wall(LIB.w / 2, LIB.h / 2, midZ, T, LIB.h, LIB.d);
  wall(0, LIB.h / 2, back, LIB.w, LIB.h, T);
  // Buttresses (mossy at the foot), plinth and cornice in lighter stone: built grand, then burned.
  for (const x of [-LIB.w / 2, -LIB.w / 4, LIB.w / 4, LIB.w / 2]) {
    wall(x, LIB.h * 0.4, LIB.front + 0.6, 1.2, LIB.h * 0.8, 1.2, 'stone');
    wall(x, 0.5, LIB.front + 0.6, 1.5, 1.0, 1.5, 'mossStone');
  }
  wall(0, 0.3, LIB.front + 0.5, LIB.w + 0.4, 0.6, 0.3, 'mossStone');
  wall(0, LIB.h - 0.2, LIB.front + 0.1, LIB.w + 0.6, 0.4, T + 0.3, 'stone');
  // Door frame and broken crenellations.
  wall(-DOOR.w / 2 - 0.25, DOOR.h / 2 + 0.1, LIB.front + 0.45, 0.4, DOOR.h + 0.2, 0.3, 'stone');
  wall(DOOR.w / 2 + 0.25, DOOR.h / 2 + 0.1, LIB.front + 0.45, 0.4, DOOR.h + 0.2, 0.3, 'stone');
  wall(0, DOOR.h + 0.3, LIB.front + 0.45, DOOR.w + 0.9, 0.4, 0.3, 'stone');
  for (let x = -LIB.w / 2 + 0.8; x < LIB.w / 2; x += 1.9) {
    if (R() < 0.3) continue;
    const mh = 0.6 + R() * 0.7;
    wall(x, LIB.h + mh / 2, LIB.front, 0.9, mh, T, R() < 0.5 ? 'bricks' : 'stone');
  }
  // Ivy curtains on the front face: alpha leaf slabs, thickest near the corners.
  const ivy = leafMaterial('leaves');
  const ivyB = new Batch();
  for (let i = 0; i < 16; i++) {
    const x = (R() < 0.5 ? -1 : 1) * (3 + R() * (LIB.w / 2 - 3.5)), h = 1.5 + R() * 4.5;
    ivyB.box(ivy, V(x, LIB.h - h / 2 - R() * 1.5, LIB.front + 0.46 + R() * 0.05), 0.8 + R() * 1.6, h, 0.08);
  }
  ivyB.flush(scene, 'ivy').forEach((m) => { m.raycast = () => {}; shadowCasters.push(m); });
  // Fallen blocks at the base (orc fire, D13).
  for (let i = 0; i < 9; i++) {
    const x = (R() * 2 - 1) * (LIB.w / 2 - 1), z = LIB.front + 1.2 + R() * 2.5;
    if (Math.abs(x) < 3.2) continue;
    const s = 0.4 + R() * 0.6;
    B.add(tex(R() < 0.5 ? 'bricks' : 'stone'), new THREE.BoxGeometry(1, 1, 1), V(x, s * 0.35, z), V(s * 1.3, s * 0.8, s), R() * 6, (R() - 0.5) * 0.3, (R() - 0.5) * 0.3);
    colliders.push({ kind: 'circle', x, z, r: s * 1.1 });
  }
  const box = (minX: number, maxX: number, minZ: number, maxZ: number) => colliders.push({ kind: 'box', minX, maxX, minZ, maxZ });
  box(-LIB.w / 2 - T / 2, -DOOR.w / 2, LIB.front - T / 2, LIB.front + 1.2);
  box(DOOR.w / 2, LIB.w / 2 + T / 2, LIB.front - T / 2, LIB.front + 1.2);
  box(-LIB.w / 2 - T / 2, -LIB.w / 2 + T / 2, back - T / 2, LIB.front);
  box(LIB.w / 2 - T / 2, LIB.w / 2 + T / 2, back - T / 2, LIB.front);
  box(-LIB.w / 2, LIB.w / 2, back - T / 2, back + T / 2);
  const doorCollider: Collider = { kind: 'box', minX: -DOOR.w / 2, maxX: DOOR.w / 2, minZ: LIB.front - T / 2, maxZ: LIB.front + 1.2 };
  colliders.push(doorCollider);
  // The door: its own unit-box mesh scaled to 1.8 x 3.4 m (the door texture is drawn for that shape).
  const libraryDoor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), tex('door'));
  libraryDoor.name = 'library_door';
  libraryDoor.scale.set(DOOR.w, DOOR.h, 0.2);
  libraryDoor.position.set(DOOR.w / 2, DOOR.h / 2, 0);
  const hinge = new THREE.Group();
  hinge.position.set(-DOOR.w / 2, 0, LIB.front + 0.35);
  hinge.add(libraryDoor);
  scene.add(hinge);
  shadowCasters.push(libraryDoor);
  solids.push(libraryDoor);
  // A warm lantern either side of the door (bloom).
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFC878').multiplyScalar(1.7) });
  for (const x of [-1.6, 1.6]) {
    B.box(tex('wood'), V(x, 2.7, LIB.front + 0.55), 0.08, 0.5, 0.3);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), lamp);
    l.position.set(x, 2.45, LIB.front + 0.72); scene.add(l); glowBits.push(l);
  }
  pave(-2.9, LIB.front + 0.8, 0.22);

  // Keep-out zone for scattered props: dais + path + spawn + library and its forecourt.
  const clear = (x: number, z: number, pad: number) => Math.hypot(x, z) < 4.5 + pad || (Math.abs(x) < 2 + pad && z > LIB.front && z < 12 + pad)
    || (Math.abs(x) < LIB.w / 2 + 2 + pad && z < LIB.front + 4 + pad && z > back - 2 - pad)
    // Phases B–E: the camp, the gallery hall, the quest's forest tracks and its two outdoor leads.
    || (x > -11 - pad && x < -3 + pad && z > -7 - pad && z < 5 + pad) || (x > 9.5 - pad && x < 20.5 + pad && z > 2 - pad && z < 10 + pad)
    || Math.hypot(x - 9.5, z + 10) < 3.5 + pad || Math.hypot(x - 16, z + 14) < 2 + pad || Math.hypot(x + 16, z + 4) < 2 + pad
    || (x > -19 - pad && x < -9 + pad && z > 9 - pad && z < 19 + pad)   // Phase F dojo
    || (x > 19 - pad && x < 29 + pad && z > -28 - pad && z < -17 + pad)   // v0.04 rock climb
    || townClear(x, z, pad);   // v0.04 town
  // Style pass 2: the meadow gets gentle bumps, except where something stands on flat ground.
  const flatSpots: [number, number, number][] = [
    ...QUEST.clues.map((c) => [c.at[0], c.at[2], 2.5] as [number, number, number]),
    ...Object.values(QUEST.leads).map((l) => [l.at[0], l.at[2], 3] as [number, number, number]),
    [3.8, 3.2, 1.5], [-6, -5, 4.5], [5.5, -6, 4.5], [-8, 2, 4.5], [8, 1, 4.5],   // the hero standee; the ruined walls (flat landings for vaults)
  ];
  setFlatMask((x, z) => clear(x, z, 0.5) || flatSpots.some(([fx, fz, r]) => Math.hypot(x - fx, z - fz) < r));
  shapeGround(groundGeo);

  // ---------- trees: birch + oak, trunks batched, canopies as alpha-cut leaf blocks ----------
  const canopyDark = leafMaterial('leaves', true), canopyLight = leafMaterial('leavesLight', true);
  const leafB = new Batch();
  const trees: [number, number][] = [];
  const tree = (x: number, z: number) => {
    const birch = R() < 0.45, h = birch ? 4.5 + R() * 3 : 3.2 + R() * 2, r = birch ? 0.16 : 0.28 + R() * 0.1, gy = heightAt(x, z);
    B.add(tex(birch ? 'birch' : 'bark'), new THREE.CylinderGeometry(r * 0.8, r, h, 6), V(x, gy + h / 2, z), undefined, R() * 6);
    if (!birch) {   // root flare + a low branch stub
      B.add(tex('bark'), new THREE.CylinderGeometry(r, r * 1.6, 0.5, 6), V(x, gy + 0.25, z), undefined, R() * 6);
    }
    // Canopy: overlapping leaf blocks around the crown, a few hanging lower; birches are narrow and tall.
    const blocks = birch ? 5 : 8, cr = birch ? 1.1 : 1.9;
    for (let i = 0; i < blocks; i++) {
      const s = (birch ? 0.9 : 1.1) + R() * (birch ? 0.6 : 0.9);
      const a = R() * Math.PI * 2, d = R() * cr * 0.8, y = h - (birch ? 1.6 : 0.6) + R() * cr * (birch ? 2.0 : 1.1);
      // S3: rounded low-poly leaf clumps (storybook canopies) instead of Vintage Story leaf cubes.
      leafB.add(R() < 0.5 ? canopyDark : canopyLight, new THREE.IcosahedronGeometry(0.66, 1),
        V(x + Math.cos(a) * d, gy + y, z + Math.sin(a) * d), V(s, s * (birch ? 1.1 : 0.8), s), R() * 1.5);
    }
    if (!birch) for (let i = 0; i < 2; i++) {   // stubby branches out to the crown
      const a = R() * Math.PI * 2;
      B.add(tex('bark'), new THREE.BoxGeometry(0.14, 0.14, 1.2), V(x + Math.cos(a) * 0.5, gy + h - 0.8 - i * 0.5, z + Math.sin(a) * 0.5), undefined, -a + Math.PI / 2, 0.5);
    }
    colliders.push({ kind: 'circle', x, z, r: r + 0.12 });
  };
  for (let i = 0; i < 400 && trees.length < 95; i++) {
    const x = (R() * 2 - 1) * (HALF - 2), z = (R() * 2 - 1) * (HALF - 2);
    if (clear(x, z, 3) || trees.some(([a, b]) => Math.hypot(a - x, b - z) < 3.6)) continue;
    trees.push([x, z]);
    tree(x, z);
  }
  // A ring of tall trees past the boundary so the horizon is forest, not a hard edge (fog swallows it).
  for (let a = 0; a < Math.PI * 2; a += 0.09) {
    const r = HALF + 4 + R() * 12, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 7 + R() * 5, gy = heightAt(x, z) - 0.3;
    B.add(tex(R() < 0.4 ? 'birch' : 'bark'), new THREE.CylinderGeometry(0.3, 0.4, h, 5), V(x, gy + h / 2, z));
    leafB.add(canopyDark, new THREE.IcosahedronGeometry(0.62, 0), V(x, gy + h, z), V(4 + R() * 2, 3.5 + R() * 2, 4 + R() * 2), R());
  }
  // Bushes: low leaf blocks, walk-through (soft foliage, see assumptions).
  for (let i = 0; i < 110; i++) {
    const x = (R() * 2 - 1) * (HALF - 1), z = (R() * 2 - 1) * (HALF - 1);
    if (clear(x, z, 1)) continue;
    const s = 0.6 + R() * 0.7;
    leafB.add(R() < 0.5 ? canopyLight : canopyDark, new THREE.IcosahedronGeometry(0.62, 0), V(x, heightAt(x, z) + s * 0.4, z), V(s * 1.3, s * 0.85, s * 1.2), R() * 3);
  }
  leafB.flush(scene, 'canopy').forEach((m) => { m.raycast = () => {}; shadowCasters.push(m); });

  // ---------- rocks + ruined walls ----------
  const rock = (x: number, z: number, s: number, t: TexName) => {
    B.add(tex(t), new THREE.DodecahedronGeometry(1, 0), V(x, heightAt(x, z) + s * 0.4, z), V(s * (1 + R() * 0.4), s * 0.8, s), R() * 6);
    colliders.push({ kind: 'circle', x, z, r: s * 1.05 });
  };
  for (let i = 0; i < 70; i++) {
    const x = (R() * 2 - 1) * (HALF - 1), z = (R() * 2 - 1) * (HALF - 1);
    if (clear(x, z, 1.5)) continue;
    rock(x, z, 0.35 + R() * R() * 1.6, R() < 0.55 ? 'mossStone' : 'stone');
  }
  // Style pass 2: a few rock outcrops with moss on top, out in the open meadow.
  const OR = rng(5150);
  for (let i = 0, made = 0; i < 60 && made < 7; i++) {
    const x = (OR() * 2 - 1) * (HALF - 8), z = (OR() * 2 - 1) * (HALF - 8);
    if (clear(x, z, 4) || trees.some(([a, b]) => Math.hypot(a - x, b - z) < 4)) continue;
    outcrop(B, tex, colliders, x, z, heightAt(x, z), OR);
    trees.push([x, z]);
    made++;
  }
  // Two rocks flanking the path near spawn so collision is easy to test (F1.3 Done-when).
  rock(-2.4, 6.5, 0.8, 'mossStone'); rock(2.6, 8.5, 0.95, 'stone');
  colliders.splice(-2, 2, { kind: 'circle', x: -2.4, z: 6.5, r: 0.88 }, { kind: 'circle', x: 2.6, z: 8.5, r: 1.05 });
  const walls: [number, number, number, number][] = [[-6, -5, 4, 0.5], [5.5, -6, 3, 0.5], [-8, 2, 0.5, 3.5], [8, 1, 0.5, 4]];
  walls.forEach(([x, z, w, d]) => {
    B.box(tex('bricks'), V(x, 0.45, z), w, 0.9, d);
    B.box(tex('mossStone'), V(x, 0.96, z), w + 0.15, 0.12, d + 0.15);
    colliders.push({ kind: 'box', minX: x - w / 2 - 0.05, maxX: x + w / 2 + 0.05, minZ: z - d / 2 - 0.05, maxZ: z + d / 2 + 0.05, top: 1.02 });   // v0.04: vaultable
  });

  // v0.04: a fall of rocks to climb (Mirror's Edge style: jump, vault and mantle up), with a lookout on top.
  const ROCKS = { x: 24, z: -22 }, RR = rng(4404);   // own random stream: the glade's layout stays as it was
  const slabs: [number, number, number, number, number][] = [   // x, z (from ROCKS), w, d, top
    [0, 3.2, 2.4, 1.8, 0.7], [0.6, 1.4, 2.2, 2.0, 1.4], [0.2, -0.6, 2.6, 2.0, 2.1], [-1.8, -1.6, 2.0, 2.2, 2.8], [-0.4, -3.3, 3.0, 2.6, 3.5],
    [2.6, -2.8, 1.6, 1.6, 1.2], [-3.4, 0.6, 1.8, 1.8, 1.0],
  ];
  for (const [dx, dz, w, d, top] of slabs) {
    const x = ROCKS.x + dx, z = ROCKS.z + dz, ry = (dx * 7 + dz * 3) % 0.5 - 0.25;
    B.box(tex(top > 2 ? 'stone' : 'mossStone'), V(x, top / 2 - 0.02, z), w, top, d, ry * 0.3);
    B.box(tex('mossStone'), V(x - 0.05, top + 0.04, z + 0.05), w * 0.86, 0.1, d * 0.86, ry * 0.3);
    colliders.push({ kind: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top });
    // Broken chunks leaning on it (dressing, a little lower than the top so they never change the footing).
    for (const [cx, cz, k] of [[-0.5, 0.5, 0.55], [0.5, -0.5, 0.45]] as const) {
      const h = top * k + 0.2;
      B.box(tex(RR() < 0.5 ? 'stone' : 'mossStone'), V(x + cx * w, h / 2 - 0.05, z + cz * d), w * 0.42, h, d * 0.42, 0.5 + RR());
    }
  }

  const town = buildTown(scene, B, tex, colliders);   // v0.04
  const statics = B.flush(scene, 'static');
  statics.forEach((m) => { solids.push(m); shadowCasters.push(m); });

  // ---------- undergrowth (instanced, wind-swayed) ----------
  const scatter = (n: number, minR: number, maxR: number, pad: number, near = 0.6): Tuft[] => {
    const out: Tuft[] = [];
    for (let i = 0; i < n * 3 && out.length < n; i++) {
      // Biased toward the player's area: dense near the glade, sparser far out (fog hides the rest).
      const a = R() * Math.PI * 2, r = minR + Math.pow(R(), near) * (maxR - minR);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) > HALF + 8 || Math.abs(z) > HALF + 8) continue;
      if (clear(x, z, pad) && !(Math.hypot(x, z) > 2.5 && Math.hypot(x, z) < 4.2 && R() < 0.5)) continue;
      out.push({ x, z, s: 0.7 + R() * 0.6, ry: R() * Math.PI, y: heightAt(x, z) });
    }
    return out;
  };
  // Tufts are scattered in random order, so drawing the first N keeps an even spread at any density.
  const undergrowth = [
    tufts(scene, 'grassBlades', scatter(2000, 1.5, 30, -0.6, 0.8), [0.6, 0.5]),
    tufts(scene, 'flowers', scatter(320, 3, 30, 0.2), [0.5, 0.45]),
    tufts(scene, 'fern', scatter(300, 4, 40, 0.6), [1.1, 0.8], 0.05),
  ];
  const fullCounts = undergrowth.map((m) => m.count);

  // ---------- characters: Mega Man Legends-style placeholders (model slots) ----------
  const standees: Record<string, THREE.Object3D> = {};
  const place = (id: string, obj: THREE.Object3D, x: number, z: number, ry: number, r: number) => {
    obj.position.set(x, 0, z); obj.rotation.y = ry; obj.name = 'standee:' + id;
    scene.add(obj);
    colliders.push({ kind: 'circle', x, z, r });
    standees[id] = obj;
  };
  place('stagecoach', buildCoach(3.4), -5.0, -2.6, 0.5, 1.5);
  place('hero', buildFigure({ art: 'hero', skin: '#F0C8A0', hair: '#6B3E22', primary: '#3E6FA8', secondary: '#7FA8D0', boots: '#2E4A6E', accent: '#F2C94C', hairStyle: 'spiky' }, 1.8), 3.8, 3.2, -0.6, 0.35);
  // v0.05 D13: Natalie Bourbon, the warner, left of the library door (§3 step 4).
  const NAT = { x: -2.8, z: LIB.front + 1.8 };
  place('natalie', buildFigure({ art: 'natalie', skin: '#EBC2A0', hair: '#3A2418', primary: '#7A3A5A', secondary: '#C9A36B', boots: '#4A2E22', accent: '#2B2A24', eyes: '#5A3A7A', hairStyle: 'long', skirt: true }, 1.75), NAT.x, NAT.z, 0.35, 0.35);
  // Phase D (B12): Magister Greer, Aralon's wizard-trader (half the time a rooster), by the coach road (Mike's pick for the Curio Pedlar).
  place('pedlar', buildFigure({ art: 'pedlar', skin: '#F2EEE6', hair: '#F2EEE6', primary: '#4A3A7A', secondary: '#5A4A8A', boots: '#3A2E22', accent: '#C8423A', hairStyle: 'hood', skirt: true, species: 'owlkin', eyeStyle: 'round', feature: '#E0A020', marks: '#C8423A', build: 1.1 }, 1.6), -7.8, -5.4, 0.9, 0.4);
  const natalieTarget = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  natalieTarget.name = 'natalie';
  natalieTarget.position.set(NAT.x, 0.9, NAT.z);
  scene.add(natalieTarget);

  // ---------- Phase B: the travellers' camp by the coach: a standing mirror (B4) and an anvil (B5) ----------
  // Batched like the rest of the world: 3 materials + the glass = 4 draw calls for the whole camp.
  const campB = new Batch();
  const iron = new THREE.MeshLambertMaterial({ color: '#4A4C50' });
  // Anvil on a tree stump.
  const AX = -7.6, AZ = 1.2;
  campB.add(tex('bark'), new THREE.CylinderGeometry(0.42, 0.48, 0.55, 8), V(AX, 0.27, AZ));
  campB.box(iron, V(AX, 0.63, AZ), 0.34, 0.16, 0.24);
  campB.box(iron, V(AX, 0.78, AZ), 0.62, 0.14, 0.3, 0.2);
  campB.box(iron, V(AX + 0.36 * Math.cos(0.2), 0.8, AZ - 0.36 * Math.sin(0.2)), 0.22, 0.1, 0.16, 0.2);   // horn
  campB.box(tex('wood'), V(AX - 0.1, 0.88, AZ + 0.08), 0.05, 0.05, 0.3, 1.1);                          // hammer handle
  campB.box(iron, V(AX - 0.02, 0.89, AZ - 0.05), 0.1, 0.08, 0.08, 1.1);
  colliders.push({ kind: 'circle', x: AX, z: AZ, r: 0.5 });
  // Standing mirror: wooden frame, a pale glass that catches the sky.
  const MX = -8.4, MZ = -0.6, MR = 1.1;
  campB.box(tex('wood'), V(MX, 1.0, MZ), 0.9, 1.8, 0.08, MR);
  for (const s of [-1, 1]) campB.box(tex('wood'), V(MX + Math.cos(MR) * s * 0.36, 0.05, MZ - Math.sin(MR) * s * 0.36), 0.08, 0.1, 0.5, MR);
  // B10 banner pole: the cloth (a sketch, painted in the sketchbook) hangs from the crossbar and sways.
  const BX = -9.2, BZ = 1.0, BR = Math.atan2(-BX, -BZ);
  campB.box(tex('wood'), V(BX, 1.3, BZ), 0.09, 2.6, 0.09, BR);
  campB.box(tex('wood'), V(BX, 2.45, BZ), 1.1, 0.07, 0.07, BR);
  campB.add(tex('mossStone'), new THREE.CylinderGeometry(0.22, 0.28, 0.16, 7), V(BX, 0.08, BZ));
  colliders.push({ kind: 'circle', x: BX, z: BZ, r: 0.3 });
  const bannerCloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2, 6, 8), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));
  bannerCloth.name = 'bannerCloth';
  bannerCloth.position.set(BX + Math.sin(BR) * 0.06, 1.8, BZ + Math.cos(BR) * 0.06); bannerCloth.rotation.y = BR;
  bannerCloth.castShadow = true;
  scene.add(bannerCloth);
  // B8 campfire: a ring of stones, crossed logs, and log seats; the flame is its own flickering mesh.
  const FX = -5.4, FZ = 3.2;
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; campB.add(tex('stone'), new THREE.DodecahedronGeometry(0.13, 0), V(FX + Math.cos(a) * 0.55, 0.08, FZ + Math.sin(a) * 0.55), new THREE.Vector3(1, 0.7, 1), a); }
  for (const a of [0.3, 1.35, 2.4]) campB.add(tex('bark'), new THREE.CylinderGeometry(0.06, 0.07, 0.75, 6), V(FX, 0.12, FZ), undefined, a, Math.PI / 2 - 0.25);
  for (const [dx, dz, ry] of [[1.5, 0.3, 1.4], [-0.6, 1.5, 0.2], [-1.3, -0.9, 2.3]] as const) campB.add(tex('bark'), new THREE.CylinderGeometry(0.2, 0.2, 1.2, 7), V(FX + dx, 0.2, FZ + dz), undefined, ry, Math.PI / 2);
  colliders.push({ kind: 'circle', x: FX, z: FZ, r: 0.65 });
  // v0.04: a bedroll by the fire. Sleeping on it moves the time of day on.
  const BRX = FX + 1.1, BRZ = FZ - 1.7;
  campB.box(tex('cover'), V(BRX, 0.05, BRZ), 0.8, 0.08, 1.8, 0.35);
  campB.box(tex('wood'), V(BRX + 0.05, 0.06, BRZ - 0.1), 0.86, 0.04, 1.7, 0.35);
  campB.add(tex('cover'), new THREE.CylinderGeometry(0.16, 0.16, 0.8, 8), V(BRX + Math.sin(0.35) * 0.82, 0.16, BRZ + Math.cos(0.35) * 0.82), undefined, 0.35, Math.PI / 2, 0);
  const flame = new THREE.Mesh(mergeGeometries([
    new THREE.ConeGeometry(0.22, 0.6, 5).translate(0, 0.3, 0), new THREE.ConeGeometry(0.14, 0.42, 5).translate(0.09, 0.21, 0.05), new THREE.ConeGeometry(0.12, 0.36, 5).translate(-0.08, 0.18, -0.06),
  ].map((g, i) => { const n = g.toNonIndexed(); const c = new THREE.Color(['#F2783A', '#FFD25A', '#FFB347'][i]); n.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3)); n.deleteAttribute('uv'); return n; })), new THREE.MeshBasicMaterial({ vertexColors: true }));
  flame.position.set(FX, 0.12, FZ); flame.name = 'campfire-flame'; flame.raycast = () => {};
  scene.add(flame);
  campB.flush(scene, 'camp').forEach((m) => { m.castShadow = true; shadowCasters.push(m); });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 1.6), new THREE.MeshBasicMaterial({ color: '#BFD8E0' }));
  glass.name = 'camp';
  glass.position.set(MX + Math.sin(MR) * 0.045, 1.0, MZ + Math.cos(MR) * 0.045); glass.rotation.y = MR; scene.add(glass);
  colliders.push({ kind: 'circle', x: MX, z: MZ, r: 0.45 });
  const hitbox = (name: string, x: number, y: number, z: number, w: number, h: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshBasicMaterial({ visible: false }));
    m.name = name; m.position.set(x, y, z); scene.add(m); return m;
  };
  const stations = { mirror: hitbox('mirror', MX, 1.0, MZ, 1.0, 2.0), anvil: hitbox('anvil', AX, 0.6, AZ, 1.0, 1.2), banner: hitbox('banner', BX, 1.4, BZ, 1.0, 2.8), campfire: hitbox('campfire', FX, 0.4, FZ, 1.4, 0.8), bedroll: hitbox('bedroll', BRX, 0.3, BRZ, 1.2, 0.6) };

  let doorOpen = false, doorAngle = 0;
  return {
    stations,
    town,
    heightAt,
    bannerCloth,
    campfireFlame: flame,
    lecternPages: [pageL, pageR],
    scene,
    colliders,
    bookTarget,
    bookCenter: new THREE.Vector3(0, 1.12, 0),
    spawn: { pos: new THREE.Vector3(0, 0, 8.5), yaw: 0 },  // yaw 0 looks toward -Z: the lectern
    bounds: HALF,
    get sunElevationDeg() { return sky.elevationDeg; },
    get time() { return sky.time; },
    setTime(t: TimeOfDay) { sky.setTime(t); },
    libraryDoor,
    natalieTarget,
    standees,
    solids,
    get doorOpen() { return doorOpen; },
    openDoor() {
      if (doorOpen) return;
      doorOpen = true;
      colliders.splice(colliders.indexOf(doorCollider), 1);
    },
    update(t: number, camera: THREE.Camera) {
      const targetAngle = doorOpen ? THREE.MathUtils.degToRad(100) : 0;
      if (doorAngle !== targetAngle) { doorAngle = Math.min(targetAngle, doorAngle + 0.03); hinge.rotation.y = doorAngle; }
      ring.rotation.y = t * 0.8;
      ring.position.y = 1.62 + Math.sin(t * 1.6) * 0.05;
      wind.value = t;
      sky.update(t, camera);
    },
    setShadows(on: boolean) {
      sky.sun.castShadow = on;
      ground.receiveShadow = on;
      shadowCasters.forEach((o) => { o.castShadow = on; o.receiveShadow = on; });
    },
    setFoliage(density: number) {
      undergrowth.forEach((m, i) => { m.count = Math.round(fullCounts[i] * THREE.MathUtils.clamp(density, 0, 1)); });
    },
    setFogDistance(far: number) {
      // Style pass 1: the haze starts later, so the painted colour reads.
      if (scene.fog instanceof THREE.Fog) { scene.fog.near = far * 0.45; scene.fog.far = far; }
    },
  };
}
