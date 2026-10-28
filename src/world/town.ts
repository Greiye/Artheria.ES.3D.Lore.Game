import * as THREE from 'three';
import { pixelTexture, type TexName } from '../tex/pixel';
import { Batch } from './batch';
import { buildFigure } from './figure';
import type { Collider } from './index';

// v0.04: a small storybook town south of the glade, down the path from the spawn point. One building per
// tool: the smithy (weapon forge), tailor (character mirror), scriptorium (sketchbook), cartographer
// (living map), the general store (the shopkeeper) and an inn (sleep). The library, dojo and gallery
// already have their own places. Buildings are shells: walking up to a door and pressing E opens the tool.
export type TownId = 'smithy' | 'tailor' | 'scriptorium' | 'cartographer' | 'shop' | 'inn';
export const TOWN_NAMES: Record<TownId, string> = {
  smithy: 'Smithy', tailor: 'Tailor', scriptorium: 'Scriptorium', cartographer: 'Cartographer', shop: 'General Store', inn: 'Inn',
};
const ICONS: Record<TownId, string> = { smithy: '⚒', tailor: '✂', scriptorium: '✒', cartographer: '⌖', shop: '⚖', inn: '☾' };
// Street along x at z = 30. North row faces south (+z), south row faces north (−z). Path from spawn at x = 0.
export const STREET = { z: 30, minX: -12, maxX: 22, half: 2.6 };
// One plaster and three roof colours: each tint is its own merged mesh (draw call), so keep them few.
const PLASTER = '#EFE2C6';
const W = 7, D = 6, WALL = 3.0, PLINTH = 0.4, RISE = 2.1;
const LOTS: { id: TownId; x: number; z: number; ry: number; wall: string; roof: string }[] = [
  { id: 'smithy', x: -6, z: 23.5, ry: 0, wall: PLASTER, roof: '#5A4A44' },
  { id: 'tailor', x: 6, z: 23.5, ry: 0, wall: PLASTER, roof: '#3E5A7A' },
  { id: 'scriptorium', x: 16, z: 23.5, ry: 0, wall: PLASTER, roof: '#7A3A3A' },
  { id: 'cartographer', x: -6, z: 36.5, ry: Math.PI, wall: PLASTER, roof: '#3E5A7A' },
  { id: 'shop', x: 6, z: 36.5, ry: Math.PI, wall: PLASTER, roof: '#7A3A3A' },
  { id: 'inn', x: 16, z: 36.5, ry: Math.PI, wall: PLASTER, roof: '#5A4A44' },
];
/** Keep-out for scattered props (trees, rocks, bushes, undergrowth). */
export const townClear = (x: number, z: number, pad: number) =>
  (x > STREET.minX - 3 - pad && x < STREET.maxX + 3 + pad && z > 19.5 - pad && z < 40.5 + pad) || (Math.abs(x) < 2 + pad && z > 11 && z < 28);

function signTexture(id: TownId): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4A3222'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#C9A36B'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 56);
  g.fillStyle = '#F2E2B8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 26px Georgia, serif';
  g.fillText(`${ICONS[id]}  ${TOWN_NAMES[id]}`, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export interface Town {
  doors: Record<TownId, THREE.Object3D>;
  shopkeeper: THREE.Object3D;
  shopkeeperHit: THREE.Object3D;
}

export function buildTown(scene: THREE.Scene, B: Batch, tex: (n: TexName) => THREE.Material, colliders: Collider[]): Town {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const tinted = new Map<string, THREE.MeshLambertMaterial>();
  const tint = (t: TexName, color: string) => tinted.get(t + color) ?? (tinted.set(t + color, new THREE.MeshLambertMaterial({ map: pixelTexture(t), color })), tinted.get(t + color)!);
  const glow = new THREE.MeshBasicMaterial({ color: '#F2C27A' });
  const doors = {} as Record<TownId, THREE.Object3D>;

  // Street paving and the dirt lane up from the glade.
  B.box(tex('paving'), V((STREET.minX + STREET.maxX) / 2, 0.02, STREET.z), STREET.maxX - STREET.minX, 0.04, STREET.half * 2);
  B.box(tex('dirt'), V(0, 0.012, 19.5), 2.2, 0.02, 15);

  for (const L of LOTS) {
    const c = Math.cos(L.ry), s = Math.sin(L.ry);
    const at = (lx: number, y: number, lz: number) => V(L.x + lx * c + lz * s, y, L.z - lx * s + lz * c);
    const plaster = tint('stone', L.wall), roof = tint('planks', L.roof), wood = tex('wood');
    B.add(tex('stone'), new THREE.BoxGeometry(W + 0.3, PLINTH, D + 0.3), at(0, PLINTH / 2, 0), undefined, L.ry);
    B.add(plaster, new THREE.BoxGeometry(W, WALL, D), at(0, PLINTH + WALL / 2, 0), undefined, L.ry);
    // Gable ends: a triangle of plaster on the front and back walls.
    const gable = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, RISE)]);
    // The ridge runs front to back, so the gables face the street.
    for (const z of [D / 2 - 0.1, -D / 2 - 0.1]) B.add(plaster, new THREE.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false }), at(0, PLINTH + WALL, z), undefined, L.ry);
    const half = W / 2 + 0.45, slope = Math.hypot(half, RISE), tilt = Math.atan2(RISE, half);
    for (const side of [-1, 1]) {
      B.add(roof, new THREE.BoxGeometry(slope + 0.1, 0.2, D + 0.8), at(side * half / 2, PLINTH + WALL + RISE / 2 + 0.1, 0), undefined, L.ry, 0, -side * tilt);
    }
    B.add(wood, new THREE.BoxGeometry(0.24, 0.24, D + 0.9), at(0, PLINTH + WALL + RISE + 0.12, 0), undefined, L.ry);   // ridge beam
    // Timber frame: corner posts, a mid rail and a top rail on the street side.
    for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) B.add(wood, new THREE.BoxGeometry(0.24, WALL, 0.24), at(x, PLINTH + WALL / 2, z), undefined, L.ry);
    for (const y of [PLINTH + 1.55, PLINTH + WALL - 0.1]) B.add(wood, new THREE.BoxGeometry(W, 0.18, 0.12), at(0, y, D / 2 + 0.04), undefined, L.ry);
    for (const x of [-W / 4, W / 4]) B.add(wood, new THREE.BoxGeometry(0.16, WALL, 0.12), at(x, PLINTH + WALL / 2, D / 2 + 0.04), undefined, L.ry);
    // Door, step and two lit windows.
    B.add(tex('door'), new THREE.BoxGeometry(1.2, 2.2, 0.1), at(0, PLINTH + 1.1, D / 2 + 0.05), undefined, L.ry);
    B.add(tex('stone'), new THREE.BoxGeometry(1.8, 0.2, 0.7), at(0, 0.1, D / 2 + 0.45), undefined, L.ry);
    for (const x of [-W * 0.36, W * 0.36]) {
      B.add(glow, new THREE.BoxGeometry(0.9, 0.9, 0.06), at(x, PLINTH + 1.7, D / 2 + 0.03), undefined, L.ry);
      B.add(wood, new THREE.BoxGeometry(1.08, 0.12, 0.14), at(x, PLINTH + 1.2, D / 2 + 0.06), undefined, L.ry);
      B.add(wood, new THREE.BoxGeometry(0.08, 0.9, 0.1), at(x, PLINTH + 1.7, D / 2 + 0.07), undefined, L.ry);
    }
    if (L.id === 'smithy') {   // a stone chimney for the forge
      B.add(tex('bricks'), new THREE.BoxGeometry(0.9, 2.6, 0.9), at(-W / 2 + 1.2, PLINTH + WALL + 1.5, -1.2), undefined, L.ry);
      B.add(tex('stone'), new THREE.BoxGeometry(1.4, 0.3, 1.4), at(W / 2 + 0.9, 0.15, D / 2 - 0.6), undefined, L.ry);   // quench trough
    }
    if (L.id === 'shop') {   // a market counter in front, with crates
      B.add(wood, new THREE.BoxGeometry(2.4, 0.9, 0.7), at(2.4, 0.45, D / 2 + 1.6), undefined, L.ry);
      B.add(tex('planks'), new THREE.BoxGeometry(0.6, 0.6, 0.6), at(-2.6, 0.3, D / 2 + 1.0), undefined, L.ry + 0.3);
      B.add(tex('planks'), new THREE.BoxGeometry(0.5, 0.5, 0.5), at(-2.5, 0.85, D / 2 + 1.0), undefined, L.ry - 0.2);
      const cp = at(2.4, 0, D / 2 + 1.6);
      colliders.push({ kind: 'box', minX: cp.x - 1.25, maxX: cp.x + 1.25, minZ: cp.z - 0.4, maxZ: cp.z + 0.4, top: 0.9 });
    }
    // Hanging sign over the door.
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(L.id) }));
    sign.position.copy(at(0, PLINTH + 2.75, D / 2 + 0.12)); sign.rotation.y = L.ry; sign.name = 'sign:' + L.id; sign.raycast = () => {};
    scene.add(sign);
    colliders.push({ kind: 'box', minX: L.x - (W / 2 + 0.2), maxX: L.x + W / 2 + 0.2, minZ: L.z - (D / 2 + 0.2), maxZ: L.z + D / 2 + 0.2 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    door.position.copy(at(0, 1.3, D / 2 + 0.6)); door.rotation.y = L.ry; door.name = 'door:' + L.id;
    scene.add(door);
    doors[L.id] = door;
  }

  // Lamp posts along the street (glowing lanterns; no extra lights).
  for (const x of [-11, 1, 11, 21]) for (const z of [STREET.z - STREET.half - 0.3, STREET.z + STREET.half + 0.3]) {
    if ((x === 1) && z > STREET.z) continue;
    B.add(tex('wood'), new THREE.CylinderGeometry(0.07, 0.09, 2.8, 6), V(x, 1.4, z));
    B.add(glow, new THREE.BoxGeometry(0.26, 0.34, 0.26), V(x, 2.9, z));
    colliders.push({ kind: 'circle', x, z, r: 0.15 });
  }

  // The shopkeeper stands behind the counter.
  const shop = LOTS.find((l) => l.id === 'shop')!;
  const sx = shop.x - 2.4, sz = shop.z - (D / 2 + 0.65);
  const shopkeeper = buildFigure({ skin: '#D8A880', hair: '#B8B0A0', primary: '#6A4A2A', secondary: '#E8D8B0', boots: '#3A2A1E', accent: '#C9A36B', hairStyle: 'short', build: 1.2 }, 1.7);
  shopkeeper.position.set(sx, 0, sz); shopkeeper.rotation.y = Math.PI; shopkeeper.name = 'standee:shopkeeper';
  scene.add(shopkeeper);
  colliders.push({ kind: 'circle', x: sx, z: sz, r: 0.35 });
  const shopkeeperHit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  shopkeeperHit.position.set(sx, 0.9, sz - 1.6); shopkeeperHit.name = 'shopkeeper';
  scene.add(shopkeeperHit);
  return { doors, shopkeeper, shopkeeperHit };
}
