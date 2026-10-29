import * as THREE from 'three';
import { rng, type TexName } from '../tex/pixel';
import type { Batch } from './batch';
import type { Collider } from './index';
import { TOWN_PALETTE as P } from './palette';

// References review (Willowbrook layout): a river down the west side of the town, crossed by a stone bridge on the
// coach road and a plank footbridge on the path to the windmill, and a windmill on the far bank. The ground stays
// flat, so the water is a slate-blue strip just above it with a muddy, stony edge; its ripples scroll (one shared
// texture, also used by the fountain).
const W = 3.4;   // water width
export const riverX = (z: number) => -31.5 + 1.6 * Math.sin(z * 0.09 + 0.5) + 0.6 * Math.sin(z * 0.21);
const Z0 = -48, Z1 = 48;
/** Where the paths cross: the coach road (stone) and the windmill path (planks). */
export const BRIDGES = [{ z: -4, half: 1.5, stone: true }, { z: 26.6, half: 1.0, stone: false }];
export const WINDMILL = { x: -38, z: 19, r: 2.2 };
/** Keep-out for scattered props: the water, its banks and the windmill's yard. */
export const riverClear = (x: number, z: number, pad: number) =>
  Math.abs(x - riverX(z)) < W / 2 + 1.2 + pad || Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < WINDMILL.r + 1.5 + pad;

let water: THREE.CanvasTexture | null = null;
/** Painted ripples on slate blue, wrapped so they can scroll. */
export function waterTexture(): THREE.CanvasTexture {
  if (water) return water;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, R = rng(4141);
  g.fillStyle = '#6A8AA6'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 40; i++) {
    const x = R() * 64, y = R() * 64, w = 4 + R() * 12;
    g.globalAlpha = 0.25 + R() * 0.3; g.fillStyle = R() < 0.6 ? '#8FB0C8' : P.slate;
    g.fillRect(x, y, w, 1 + Math.round(R())); g.fillRect(x - 64, y, w, 1);
  }
  water = new THREE.CanvasTexture(c);
  water.wrapS = water.wrapT = THREE.RepeatWrapping; water.colorSpace = THREE.SRGBColorSpace;
  water.magFilter = THREE.NearestFilter;
  return water;
}
export const waterMaterial = () => new THREE.MeshLambertMaterial({ map: waterTexture() });

export interface River { update(t: number): void; sails: THREE.Object3D }

export function buildRiver(scene: THREE.Scene, B: Batch, tex: (n: TexName) => THREE.Material, colliders: Collider[]): River {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const R = rng(7070);
  // The water and its muddy margin: two strips following the meander.
  const strip = (half: number, y: number, vScale: number) => {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let z = Z0, i = 0; z <= Z1; z += 1, i++) {
      const x = riverX(z);
      pos.push(x - half, y, z, x + half, y, z); uv.push(0, z / vScale, 1, z / vScale);
      if (i) idx.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const mud = new THREE.Mesh(strip(W / 2 + 0.7, 0.02, 4), tex('dirt'));
  const tx = waterTexture();
  const wet = new THREE.Mesh(strip(W / 2, 0.05, 4), new THREE.MeshLambertMaterial({ map: tx }));
  mud.name = 'river-bank'; wet.name = 'river'; mud.receiveShadow = wet.receiveShadow = true;
  scene.add(mud, wet);
  // Stones and reeds along both banks (skipping the bridges).
  const reed = new THREE.MeshLambertMaterial({ color: P.moss });
  for (let z = Z0 + 1; z < Z1; z += 1.3) {
    if (BRIDGES.some((b) => Math.abs(z - b.z) < b.half + 1.2)) continue;
    for (const s of [-1, 1]) {
      const x = riverX(z) + s * (W / 2 + 0.15 + R() * 0.4), k = 0.25 + R() * 0.35;
      if (R() < 0.7) B.add(tex(R() < 0.5 ? 'stone' : 'mossStone'), new THREE.DodecahedronGeometry(k, 0), V(x, k * 0.3, z + R() * 0.6), V(1, 0.6, 1), R() * 6);
      if (R() < 0.35) for (let i = 0; i < 4; i++) B.add(reed, new THREE.BoxGeometry(0.04, 0.6 + R() * 0.5, 0.04), V(x + (R() - 0.5) * 0.5, 0.35, z + (R() - 0.5) * 0.5), undefined, 0, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4);
    }
  }
  // The water blocks the way, 2 m at a time, except under a bridge.
  for (let z = Z0; z < Z1; z += 2) {
    const xs = [riverX(z), riverX(z + 1), riverX(z + 2)], lo = Math.min(...xs) - W / 2 + 0.3, hi = Math.max(...xs) + W / 2 - 0.3;
    const b = BRIDGES.find((b) => z + 2 > b.z - b.half && z < b.z + b.half);
    if (!b) { colliders.push({ kind: 'box', minX: lo, maxX: hi, minZ: z, maxZ: z + 2 }); continue; }
    if (z < b.z - b.half) colliders.push({ kind: 'box', minX: lo, maxX: hi, minZ: z, maxZ: b.z - b.half });
    if (z + 2 > b.z + b.half) colliders.push({ kind: 'box', minX: lo, maxX: hi, minZ: b.z + b.half, maxZ: z + 2 });
  }
  // Bridges: a deck you step up onto, low walls (stone) or rails (planks) along both sides.
  for (const b of BRIDGES) {
    const x = riverX(b.z), len = W + 2.4, top = b.stone ? 0.28 : 0.2, mat = tex(b.stone ? 'stone' : 'planks');
    B.box(mat, V(x, top / 2, b.z), len, top, b.half * 2 + 0.2);
    colliders.push({ kind: 'box', minX: x - len / 2, maxX: x + len / 2, minZ: b.z - b.half, maxZ: b.z + b.half, top });
    for (const s of [-1, 1]) {
      const z = b.z + s * (b.half + 0.05);
      if (b.stone) B.box(tex('stone'), V(x, top + 0.3, z), len, 0.6, 0.3);
      else {
        for (const px of [-len / 2 + 0.2, 0, len / 2 - 0.2]) B.box(tex('wood'), V(x + px, top + 0.45, z), 0.12, 0.9, 0.12);
        B.box(tex('wood'), V(x, top + 0.85, z), len, 0.1, 0.1);
      }
      colliders.push({ kind: 'box', minX: x - len / 2, maxX: x + len / 2, minZ: z - 0.15, maxZ: z + 0.15 });
    }
  }

  // The windmill: a tapered tan tower, a brown cap, four lattice sails turning toward the town.
  const M = WINDMILL, wall = new THREE.MeshLambertMaterial({ map: (tex('plaster') as THREE.MeshLambertMaterial).map, color: P.tan });
  const capMat = new THREE.MeshLambertMaterial({ map: (tex('roofTiles') as THREE.MeshLambertMaterial).map, color: P.brown });
  B.add(tex('stone'), new THREE.CylinderGeometry(2.25, 2.35, 0.6, 8), V(M.x, 0.3, M.z));
  B.add(wall, new THREE.CylinderGeometry(1.5, 2.1, 7, 8), V(M.x, 4.1, M.z));
  B.add(capMat, new THREE.ConeGeometry(1.95, 2.2, 8), V(M.x, 8.7, M.z));
  B.add(tex('door'), new THREE.BoxGeometry(1.0, 1.9, 0.1), V(M.x + 2.0, 1.55, M.z), undefined, Math.PI / 2, 0, 0.05);
  for (const y of [3.4, 5.6]) B.add(tex('wood'), new THREE.BoxGeometry(0.6, 0.7, 0.08), V(M.x + 1.78 - (y - 3.4) * 0.08, y, M.z + 0.1), undefined, Math.PI / 2, 0, 0.07);
  colliders.push({ kind: 'circle', x: M.x, z: M.z, r: M.r });
  const sails = new THREE.Group();
  sails.position.set(M.x + 1.95, 7.2, M.z); sails.name = 'windmill-sails';
  const sw = new THREE.MeshLambertMaterial({ map: (tex('wood') as THREE.MeshLambertMaterial).map }), cloth = new THREE.MeshLambertMaterial({ color: P.cream, side: THREE.DoubleSide });
  const parts: [THREE.BufferGeometry, THREE.Material][] = [[new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8).rotateZ(Math.PI / 2), sw]];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, m = new THREE.Matrix4().makeRotationX(a);
    parts.push([new THREE.BoxGeometry(0.14, 5.4, 0.14).translate(0, 2.7, 0).applyMatrix4(m), sw]);
    parts.push([new THREE.PlaneGeometry(1.1, 4.2).rotateY(Math.PI / 2).translate(0.05, 3.1, 0.65).applyMatrix4(m), cloth]);
  }
  for (const [g, mat] of parts) { const mesh = new THREE.Mesh(g, mat); mesh.raycast = () => {}; sails.add(mesh); }
  scene.add(sails);

  return {
    sails,
    update(t: number) { tx.offset.y = -t * 0.18; sails.rotation.x = t * 0.35; },
  };
}
