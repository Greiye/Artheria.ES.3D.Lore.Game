import * as THREE from 'three';
import { Painter } from './decor';
import type { Collider } from './index';

// Mike 2026-11-06 (Graphics thread, library item 5: "Trap doors are now stairs down."): the way into the descent is
// a stone stairwell cut into the library floor, where the trapdoor was. The flagstones leave a gap for it
// (src/library.ts) and the ground mesh under the hall is sunk well below (world/index.ts), so you look straight down
// the steps into the dark. A low worn kerb runs round three sides; you go down from the side facing the door.
export const STAIRS = { x: 6.5, top: -32, len: 5.0, w: 1.9, depth: 2.6, steps: 12 };
/** The opening in the floor: x ±w/2, z from top (entry) to top - len. */
export const STAIR_HOLE = { minX: STAIRS.x - STAIRS.w / 2, maxX: STAIRS.x + STAIRS.w / 2, minZ: STAIRS.top - STAIRS.len, maxZ: STAIRS.top };

/** Sink the ground mesh round the stairwell (the floor covers it everywhere else). */
export function sinkGround(geo: THREE.BufferGeometry, pad = 2.6) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (x > STAIR_HOLE.minX - pad && x < STAIR_HOLE.maxX + pad && z > STAIR_HOLE.minZ - pad && z < STAIR_HOLE.maxZ + pad) p.setY(i, -STAIRS.depth - 3);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
}

export function buildStairwell(scene: THREE.Scene, colliders: Collider[]): { mesh: THREE.Mesh; dark: THREE.Mesh } {
  const P = new Painter(9090), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const { x, top, len, w, depth, steps } = STAIRS, zc = top - len / 2;
  const STONE = ['#8A837B', '#817A72', '#948C83'], DARK = ['#5E5853', '#565049'];
  // The well's walls, inside faces only, darkening as they go down.
  const wallFace = (cx: number, cz: number, ry: number, width: number) => {
    for (let k = 0; k < 4; k++) P.add(new THREE.PlaneGeometry(width, depth / 4), k < 1 ? STONE[k % 3] : DARK[k % 2], V(cx, -depth / 8 - (k * depth) / 4, cz), ry);
  };
  wallFace(x - w / 2, zc, Math.PI / 2, len); wallFace(x + w / 2, zc, -Math.PI / 2, len);
  wallFace(x, top - len, 0, w);
  wallFace(x, top, Math.PI, w);
  // The steps: worn stone treads, each a box, going down from the entry edge.
  const run = len / steps, rise = depth / steps;
  for (let i = 0; i < steps; i++) {
    const y = -(i + 1) * rise, z = top - (i + 0.5) * run;
    const tread = i < 6 ? STONE[i % 3] : DARK[i % 2], riser = i < 6 ? '#4E4843' : '#2E2A27';
    P.add(new THREE.BoxGeometry(w - 0.04, rise, run + 0.02), (c) => (c.z > run / 2 - 0.02 && c.y < rise / 2 - 0.02 ? riser : tread), V(x, y + rise / 2, z));
    P.add(new THREE.BoxGeometry(w - 0.06, 0.025, 0.06), i < 8 ? '#B4ACA0' : '#7A736B', V(x, y + rise + 0.012, z + run / 2 - 0.02));   // the worn nosing catches the light
    if (i % 3 === 1) P.add(new THREE.BoxGeometry(0.2 + (i % 2) * 0.15, 0.05, 0.12), '#5E5954', V(x - 0.4 + (i % 4) * 0.25, y + rise + 0.02, z), i);   // a chip of fallen stone
  }
  // The kerb: low, worn blocks on three sides (left, right, far end), and a post at each corner.
  const kerb = (cx: number, cz: number, lx: number, lz: number) => P.add(new THREE.BoxGeometry(lx, 0.28, lz), STONE[(Math.round(cx * 7 + cz * 3) % 3 + 3) % 3], V(cx, 0.14, cz));
  for (let k = 0; k < 4; k++) { const z0 = top - (k + 0.5) * (len / 4); kerb(x - w / 2 - 0.15, z0, 0.3, len / 4 - 0.03); kerb(x + w / 2 + 0.15, z0, 0.3, len / 4 - 0.03); }
  kerb(x, top - len - 0.15, w + 0.6, 0.3);
  for (const [px, pz] of [[x - w / 2 - 0.15, top - len - 0.15], [x + w / 2 + 0.15, top - len - 0.15], [x - w / 2 - 0.15, top + 0.05], [x + w / 2 + 0.15, top + 0.05]]) P.add(new THREE.BoxGeometry(0.34, 0.75, 0.34), '#6A645F', V(px, 0.375, pz));
  for (const [px, pz] of [[x - w / 2 - 0.15, top - len - 0.15], [x + w / 2 + 0.15, top - len - 0.15], [x - w / 2 - 0.15, top + 0.05], [x + w / 2 + 0.15, top + 0.05]]) P.add(new THREE.DodecahedronGeometry(0.16, 0), '#827B73', V(px, 0.84, pz));
  const mesh = P.mesh(scene, 'library-stairwell')!;
  (mesh.material as THREE.MeshLambertMaterial).emissive = new THREE.Color(0x2a241e);   // a little light from the torch below
  mesh.castShadow = false; mesh.receiveShadow = false;   // lit by the sky through the broken roof, not shadowed by the floor it's cut into
  // At the bottom, darkness: an unlit black floor and a black arch where the steps turn under the hall.
  const dark = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.05, 1.2), new THREE.MeshBasicMaterial({ color: 0x050403 }));
  dark.position.set(x, -depth - 0.02, top - len - 0.2); dark.name = 'stairwell-dark'; dark.raycast = () => {};
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 1.6), new THREE.MeshBasicMaterial({ color: 0x050403 }));
  arch.position.set(x, -depth + 0.8, top - len + 0.01); arch.raycast = () => {};
  dark.add(arch); arch.position.sub(dark.position);
  // A torch in a bracket on the far wall, halfway down: the one warm thing in the well.
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), new THREE.MeshBasicMaterial({ color: 0xFFB050 }));
  flame.position.set(x, -depth * 0.45 + 0.18, top - len + 0.14); flame.raycast = () => {};
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.32, 5), new THREE.MeshLambertMaterial({ color: 0x3A2A1C }));
  stick.position.set(x, -depth * 0.45, top - len + 0.12); stick.rotation.x = 0.3;
  dark.add(flame, stick); flame.position.sub(dark.position); stick.position.sub(dark.position);
  scene.add(dark);
  // You can't fall in: the kerb and the open hole are solid (the hole only stops you; the stairs are walked by the
  // descent's own cinematic).
  colliders.push({ kind: 'box', minX: STAIR_HOLE.minX - 0.3, maxX: STAIR_HOLE.maxX + 0.3, minZ: STAIR_HOLE.minZ - 0.3, maxZ: STAIR_HOLE.maxZ + 0.2 });
  return { mesh, dark };
}
