import * as THREE from 'three';
import { Batch } from './batch';
import { pixelTexture } from '../tex/pixel';
import { GALLERY } from '../campfire/gallery';

// v0.06 W2: interior ceilings for the Ruined Library and the gallery hall, so looking up from inside (in any of the
// three cameras) meets timber, never sky. Each ceiling is a single downward-facing plank plane plus a few beams: from
// above the plane is back-face culled, so the overview still looks down into the halls and the outside is unchanged.
// The ceilings cast no shadow, so the halls stay lit as before.
export interface Roofed { minX: number; maxX: number; minZ: number; maxZ: number; y: number }
export const ROOFED: Record<'library' | 'gallery', Roofed> = {
  library: { minX: -13, maxX: 13, minZ: -42, maxZ: -18, y: 8.35 },   // world/index.ts LIB: walls 8.5 m
  gallery: { minX: GALLERY.minX, maxX: GALLERY.maxX, minZ: GALLERY.minZ, maxZ: GALLERY.maxZ, y: 3.22 },   // under the lintel
};

/** The hall whose ceiling is over (x, z), if any. */
export function roofOver(x: number, z: number, pad = 0): Roofed | null {
  for (const r of Object.values(ROOFED)) if (x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad) return r;
  return null;
}

export function buildCeilings(scene: THREE.Scene): THREE.Mesh[] {
  const B = new Batch();
  // Faces that only look down get almost no sky or sun light, so each carries a little of its own (bounce light
  // off the floor) through an emissive copy of its texture; otherwise the ceiling reads as a black hole.
  const lit = (name: 'planks' | 'wood', color: number, bounce: number) => new THREE.MeshLambertMaterial({ map: pixelTexture(name), color, emissiveMap: pixelTexture(name), emissive: new THREE.Color(color).multiplyScalar(bounce) });
  const planks = lit('planks', 0xB89A7A, 0.42), beam = lit('wood', 0x8A7058, 0.36);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const plane = (r: Roofed) => B.add(planks, new THREE.PlaneGeometry(r.maxX - r.minX, r.maxZ - r.minZ).rotateX(Math.PI / 2), V((r.minX + r.maxX) / 2, r.y, (r.minZ + r.maxZ) / 2));
  const L = ROOFED.library, G = ROOFED.gallery;
  plane(L);
  for (let x = L.minX + 2.6; x < L.maxX - 1; x += 3.2) B.box(beam, V(x, L.y - 0.24, (L.minZ + L.maxZ) / 2), 0.4, 0.46, L.maxZ - L.minZ - 0.6);
  plane(G);
  for (let z = G.minZ + 1.75; z < G.maxZ - 1; z += 1.75) B.box(beam, V((G.minX + G.maxX) / 2 + 0.4, G.y - 0.1, z), G.maxX - G.minX - 0.8, 0.2, 0.22);
  // A frieze closes the gap between the gallery's 3 m walls and its ceiling.
  B.box(beam, V(G.maxX - 0.2, 3.11, (G.minZ + G.maxZ) / 2), 0.4, 0.22, G.maxZ - G.minZ);
  for (const z of [G.minZ + 0.3, G.maxZ - 0.3]) B.box(beam, V((G.minX + G.maxX) / 2 + 0.2, 3.11, z), G.maxX - G.minX - 0.4, 0.22, 0.6);
  const meshes = B.flush(scene, 'ceiling');
  meshes.forEach((m) => { m.castShadow = false; m.receiveShadow = false; m.raycast = () => {}; });
  return meshes;
}
