// Mike 2026-11-05: four ways out of Aralon, one per side, each to its own map after a load screen.
//   north: Aralon Edge, a clifftop above the town (built up on a real cliff just north of it, so you look down on
//          the town itself);
//   south: the beach;
//   east:  the Ranlean gates (shut this round);
//   west:  past the coach-road gate, the Amethyst Peak gates (shut this round).
// The beach and the two gates are built far off (like the dungeon), past the camera's reach from the glade; each map
// has its own ground height, a fence of colliders round it, a waystone back to Aralon and, at the gates, a gate to
// knock at. Low-poly, flat-coloured pieces with the town's pixel textures.
import * as THREE from 'three';
import { pixelTexture, rng, type TexName } from '../tex/pixel';
import type { Collider } from './index';

export type RegionId = 'town' | 'beach' | 'ranlean' | 'edge' | 'amethyst' | 'modern';
export type Side = 'north' | 'south' | 'east' | 'west';

export interface RegionSpot { hit: THREE.Mesh; verb: string; kind: 'back' | 'gate' | 'look' | 'wagon'; line?: string }
export interface Region {
  id: Exclude<RegionId, 'town'>;
  name: string;
  /** One line under the name on the load screen. */
  line: string;
  side: Side;
  origin: THREE.Vector3;
  /** Walkable rectangle, local: [minX, maxX, minZ, maxZ]. */
  rect: [number, number, number, number];
  arrive: THREE.Vector3;   // local
  arriveYaw: number;
  /** The back edge (local): walking past it takes you home. */
  back: (x: number, z: number) => boolean;
  fogFar?: number;
  /** B56: a map reached another way (the portal) comes home to this spot instead of a side's exit; set by main. */
  home?: { at: [number, number]; yaw: number };
  /** What the arrival toast says leads back (default: the waystone). */
  backHint?: string;
  /** Indoors: the follow camera stays under this height (local). */
  ceiling?: number;
}

/** Where each side's exit sits in the town, the way in after a trip, and the yaw facing back into town. */
export const TOWN_EXITS: Record<Side, { at: [number, number]; trigger: (x: number, z: number) => boolean; inside: [number, number]; yaw: number; to: Region['id'] }> = {
  north: { at: [0, -47], trigger: (x, z) => z < -46.2 && Math.abs(x) < 3, inside: [0, -43.5], yaw: Math.PI, to: 'edge' },
  south: { at: [-6, 47], trigger: (x, z) => z > 46.2 && Math.abs(x + 6) < 3, inside: [-6, 43.5], yaw: 0, to: 'beach' },
  east: { at: [47, 25], trigger: (x, z) => x > 46.2 && Math.abs(z - 25) < 3, inside: [43.5, 25], yaw: Math.PI / 2, to: 'ranlean' },
  west: { at: [-44, -4], trigger: () => false, inside: [-39.4, -4], yaw: -Math.PI / 2, to: 'amethyst' },   // the coach-road gate asks first
};

export const REGIONS: Record<Region['id'], Region> = {
  edge: {
    id: 'edge', name: 'Aralon Edge', line: 'The cliff path north. The whole town lies below, smoke and all.', side: 'north',
    origin: new THREE.Vector3(0, 28, -100), rect: [-18, 18, -18, 5.2], arrive: new THREE.Vector3(0, 0, -14), arriveYaw: Math.PI,
    back: (_x, z) => z < -16.8, fogFar: 190,
  },
  beach: {
    id: 'beach', name: 'The Beach', line: 'South, past the dunes, to where the sea comes in.', side: 'south',
    origin: new THREE.Vector3(0, 0, 700), rect: [-24, 24, -20, 7.5], arrive: new THREE.Vector3(0, 0, -16), arriveYaw: Math.PI,
    back: (_x, z) => z < -18.8, fogFar: 120,
  },
  ranlean: {
    id: 'ranlean', name: 'The Ranlean Gates', line: 'East along the trade road, to the walls of Ranlean.', side: 'east',
    origin: new THREE.Vector3(800, 0, 0), rect: [-22, 7.5, -16, 16], arrive: new THREE.Vector3(-18, 0, 0), arriveYaw: -Math.PI / 2,
    back: (x) => x < -20.8, fogFar: 110,
  },
  amethyst: {
    id: 'amethyst', name: 'The Amethyst Peak Gates', line: 'West up the coach road, into the mountains, to the carved gate.', side: 'west',
    origin: new THREE.Vector3(-700, 0, 0), rect: [-7.5, 22, -12, 12], arrive: new THREE.Vector3(18, 0, 0), arriveYaw: Math.PI / 2,
    back: (x) => x > 20.8, fogFar: 100,
  },
  // B56 (Mike 2026-11-06): through the portal by the Cartographer's, a flat in the modern world where Mike's friends
  // are. One room; the only way back is the portal on the wall.
  modern: {
    id: 'modern', name: 'The Modern World', line: "Through the portal, to a flat in another world. Josh, Jason, Liv and Rev are home.", side: 'north',
    origin: new THREE.Vector3(0, 0, -600), rect: [-5.8, 5.8, -4.8, 4.8], arrive: new THREE.Vector3(-4.6, 0, 0), arriveYaw: -Math.PI / 2,
    back: () => false, fogFar: 60, backHint: 'The portal on the wall leads back to Aralon.', ceiling: 2.5,
  },
};

/** B54 (Mike 2026-11-06): a wagon stop in town and on each far map reached by road (local spot and yaw). The wagon
 *  runs between them; friends standing at the stop ride along. */
export const WAGON_STOPS: Partial<Record<RegionId, { at: [number, number]; yaw: number }>> = {
  town: { at: [-38, 2.6], yaw: Math.PI / 2 },
  edge: { at: [-5.5, -12.5], yaw: Math.PI / 2 },
  beach: { at: [-6, -15], yaw: Math.PI / 2 },
  ranlean: { at: [-16, -6], yaw: 0 },
  amethyst: { at: [16, -6], yaw: 0 },
};
/** A covered wagon, about 3.4 m long along its local x, wheels on the ground. */
export function buildWagon(): THREE.Group {
  const g = new THREE.Group(); g.name = 'wagon';
  const wood = lam('#7A5634', pixelTexture('wood')), dark = lam('#4A3222'), canvas = lam('#E8DCC0');
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 1.4), wood); bed.position.y = 0.85; bed.castShadow = true; g.add(bed);
  for (const z of [-0.68, 0.68]) { const side = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 0.08), wood); side.position.set(0, 1.15, z); side.castShadow = true; g.add(side); }
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 2.4, 10, 1, true, 0, Math.PI), canvas);
  cover.rotation.z = Math.PI / 2; cover.rotation.y = Math.PI / 2; cover.rotation.set(0, 0, Math.PI / 2); cover.position.y = 1.3; cover.castShadow = true;
  (cover.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide; g.add(cover);
  for (const [x, r] of [[-0.95, 0.5], [0.95, 0.42]] as const) for (const z of [-0.78, 0.78]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 12), dark); w.rotation.x = Math.PI / 2; w.position.set(x, r, z); w.castShadow = true; g.add(w);
  }
  for (const z of [-0.45, 0.45]) { const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.07), wood); shaft.position.set(2.2, 0.75, z); g.add(shaft); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 1.3), wood); seat.position.set(1.25, 1.35, 0); g.add(seat);
  return g;
}

/** B56: Mike's friends in the modern flat (local spots; looks are placeholders until they say how they want to look). */
export const MODERN_FRIENDS: { id: string; name: string; at: [number, number]; yaw: number; pose?: 'sit'; seed: number; hello: string }[] = [
  { id: 'josh', name: 'Josh', at: [2.3, 0.15], yaw: Math.PI / 2, pose: 'sit', seed: 5601, hello: "Hey, you came through! Grab a seat. We're halfway through something and nobody remembers what." },
  { id: 'jason', name: 'Jason', at: [-2.6, -3.6], yaw: -2.4, seed: 5602, hello: "Oh, hey. Kettle's on. Mike said someone from Aralon might turn up." },
  { id: 'liv', name: 'Liv', at: [0.9, 3.5], yaw: -0.4, seed: 5603, hello: "Hi! Mind the cables. Welcome to the boring world: no goblins, just rent." },
  { id: 'rev', name: 'Rev', at: [3.7, 3.3], yaw: -2.0, seed: 5604, hello: "Look who it is. The portal only hums when someone's coming. You made it." },
];

const lam = (color: string, map?: THREE.Texture) => new THREE.MeshLambertMaterial({ color, map: map ?? null });
function tiled(name: TexName, rx: number, ry: number): THREE.Texture {
  const t = pixelTexture(name).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true;
  return t;
}
function box(g: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m);
  return m;
}
function rock(g: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, s: number, R: () => number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
  m.position.set(x, y + s * 0.35, z); m.scale.set(1 + R() * 0.4, 0.6 + R() * 0.4, 1 + R() * 0.3); m.rotation.set(R(), R() * 6, R());
  m.castShadow = m.receiveShadow = true; g.add(m);
  return m;
}
/** A painted sign: a board with words on it. */
export function signBoard(text: string, w = 1.6, h = 0.5): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
  const g = c.getContext('2d')!;
  g.fillStyle = '#7A5634'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#4A3222'; g.lineWidth = 6; g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.fillStyle = '#F4E6C0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 34; g.font = `bold ${size}px Georgia, serif`;
  while (g.measureText(text).width > c.width - 24 && size > 12) { size -= 2; g.font = `bold ${size}px Georgia, serif`; }
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [lam('#5E4128'), lam('#5E4128'), lam('#5E4128'), lam('#5E4128'), new THREE.MeshLambertMaterial({ map: t }), new THREE.MeshLambertMaterial({ map: t })]);
  m.castShadow = true;
  return m;
}
/** A signpost: a post with one board, facing +z (rotate the group to turn it). */
export function signpost(text: string): THREE.Group {
  const g = new THREE.Group(), wood = lam('#6A4A2E', pixelTexture('wood'));
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.14), wood); post.position.y = 1.05; post.castShadow = true; g.add(post);
  const b = signBoard(text); b.position.set(0, 1.7, 0.1); g.add(b);
  g.name = 'signpost';
  return g;
}

const hidden = new THREE.MeshBasicMaterial({ visible: false });
function hitbox(g: THREE.Object3D, x: number, y: number, z: number, w = 1.4, h = 2, d = 1.4): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hidden); m.position.set(x, y + h / 2, z); g.add(m);
  return m;
}

export class Regions {
  current: RegionId = 'town';
  readonly groups = new Map<Region['id'], THREE.Group>();
  readonly colliders = new Map<Region['id'], Collider[]>();
  readonly spots = new Map<Region['id'], RegionSpot[]>();
  private sea: THREE.Mesh | null = null;
  constructor(private scene: THREE.Scene) {}

  get region(): Region | null { return this.current === 'town' ? null : REGIONS[this.current]; }
  /** Ground height inside the current far map (null in town). */
  floor(x: number, z: number): number | null {
    const r = this.region; if (!r) return null;
    return r.origin.y;
  }
  /** Build a map on first visit and show only it. */
  show(id: RegionId) {
    this.current = id;
    for (const [k, g] of this.groups) g.visible = k === id;
    if (id === 'town' || this.groups.has(id)) return;
    const r = REGIONS[id], g = new THREE.Group(), cols: Collider[] = [], spots: RegionSpot[] = [];
    g.name = 'region-' + id; g.position.copy(r.origin);
    this.scene.add(g);
    const R = rng(id.length * 977 + id.charCodeAt(0));
    BUILD[id].call(this, g, r, spots, R);
    const ws = WAGON_STOPS[id];   // B54
    if (ws) {
      const w = buildWagon(); w.position.set(ws.at[0], 0, ws.at[1]); w.rotation.y = ws.yaw; g.add(w);
      const solid = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1, 1.4), hidden); solid.position.y = 0.5; solid.name = 'solid'; w.add(solid);
      const post = signpost('Wagon'); post.position.set(ws.at[0] + Math.sin(ws.yaw) * 1.6, 0, ws.at[1] + Math.cos(ws.yaw) * 1.6); post.rotation.y = ws.yaw; g.add(post);
      spots.push({ hit: hitbox(g, ws.at[0] + Math.sin(ws.yaw) * 1.1, 0, ws.at[1] + Math.cos(ws.yaw) * 1.1, 2.2, 2.0, 2.2), verb: 'Ride the wagon', kind: 'wagon' });
    }
    // A fence of colliders round the walkable rectangle (world space).
    const [x0, x1, z0, z1] = r.rect, o = r.origin, t = 1;
    cols.push({ kind: 'box', minX: o.x + x0 - t, maxX: o.x + x0, minZ: o.z + z0 - t, maxZ: o.z + z1 + t });
    cols.push({ kind: 'box', minX: o.x + x1, maxX: o.x + x1 + t, minZ: o.z + z0 - t, maxZ: o.z + z1 + t });
    cols.push({ kind: 'box', minX: o.x + x0 - t, maxX: o.x + x1 + t, minZ: o.z + z0 - t, maxZ: o.z + z0 });
    cols.push({ kind: 'box', minX: o.x + x0 - t, maxX: o.x + x1 + t, minZ: o.z + z1, maxZ: o.z + z1 + t });
    // Solid props: anything named 'solid' gets a box collider from its bounds.
    g.updateMatrixWorld(true);
    g.traverse((m) => {
      if (m.name !== 'solid') return;
      const b = new THREE.Box3().setFromObject(m);
      cols.push({ kind: 'box', minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z });
    });
    this.groups.set(id, g); this.colliders.set(id, cols); this.spots.set(id, spots);
  }
  private swirl: THREE.Texture | null = null;
  /** @internal */ setSwirl(t: THREE.Texture) { this.swirl = t; }
  update(t: number) {
    if (this.swirl && this.current === 'modern') this.swirl.rotation = -t * 0.8;
    if (this.current !== 'beach' || !this.sea) return;
    const p = this.sea.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 0.35 + t * 1.3) * 0.08 + Math.cos(y * 0.5 - t * 0.9) * 0.1); }
    p.needsUpdate = true;
    this.sea.position.z = 9.5 + Math.sin(t * 0.6) * 0.5;   // the tide breathing in and out
  }
  /** @internal */ setSea(m: THREE.Mesh) { this.sea = m; }
}

/** The waystone at each far map's way in: "Head back to Aralon". */
function waystone(g: THREE.Group, spots: RegionSpot[], x: number, z: number, ry: number) {
  const s = box(g, 0.6, 1.5, 0.45, lam('#9A968C', pixelTexture('mossStone')), x, 0.75, z, ry); s.name = 'solid';
  const sign = signpost('← Aralon'); sign.position.set(x + Math.cos(ry) * 1.1, 0, z - Math.sin(ry) * 1.1); sign.rotation.y = ry; g.add(sign);
  spots.push({ hit: hitbox(g, x, 0, z, 1.6, 2, 1.6), verb: 'Head back to Aralon', kind: 'back' });
}

const BUILD: Record<Region['id'], (this: Regions, g: THREE.Group, r: Region, spots: RegionSpot[], R: () => number) => void> = {
  edge(g, r, spots, R) {
    // The clifftop: grass on a rock mass, a rail along the drop, a bench and a lone pine. The town is down to the south.
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(44, 30).rotateX(-Math.PI / 2), lam('#7FA05A', tiled('grass', 22, 15)));
    grass.position.set(0, 0, -6); grass.receiveShadow = true; g.add(grass);
    const rockMat = lam('#8C8478', tiled('stone', 6, 6));
    const mass = new THREE.Mesh(new THREE.BoxGeometry(46, 28, 32), rockMat); mass.position.set(0, -14.02, -6.5); mass.receiveShadow = true; g.add(mass);
    // A broken slope of boulders down toward the hills, so the drop reads as a cliff from below too.
    for (let i = 0; i < 18; i++) rock(g, rockMat, -22 + i * 2.6 + R() * 1.2, -8 - R() * 16, 11 + R() * 9, 2.4 + R() * 2.2, R);
    // Rail along the edge.
    const wood = lam('#6A4A2E', pixelTexture('wood'));
    for (let x = -17; x <= 17; x += 2.125) box(g, 0.14, 1.0, 0.14, wood, x, 0.5, 5.9);
    const rail = box(g, 35, 0.1, 0.1, wood, 0, 0.95, 5.9); rail.name = 'solid';
    box(g, 35, 0.08, 0.08, wood, 0, 0.55, 5.9);
    // Bench facing the view.
    box(g, 2.0, 0.08, 0.5, wood, -4, 0.48, 2.5).name = 'solid';
    box(g, 2.0, 0.5, 0.08, wood, -4, 0.8, 2.25);
    for (const dx of [-0.85, 0.85]) box(g, 0.1, 0.45, 0.45, wood, -4 + dx, 0.22, 2.5);
    spots.push({ hit: hitbox(g, -4, 0, 2.5, 2.2, 1.2, 1.2), verb: 'Sit and look over Aralon', kind: 'look', line: 'From up here the library is a dark tooth, and the fountain a coin. Someone is ringing the toll bell.' });
    // A lone pine, and rocks.
    const bark = lam('#5A3E26', pixelTexture('bark')), needles = lam('#3E6A3A', pixelTexture('leaves'));
    const trunk = box(g, 0.45, 5, 0.45, bark, 9, 2.5, -4); trunk.name = 'solid';
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(2.4 - i * 0.6, 2.6, 7), needles); c.position.set(9, 3.2 + i * 1.5, -4); c.castShadow = true; g.add(c); }
    for (let i = 0; i < 7; i++) rock(g, lam('#8C8478', pixelTexture('mossStone')), (R() < 0.5 ? -1 : 1) * (5 + R() * 11), 0, -16 + R() * 12, 0.5 + R() * 0.7, R).name = 'solid';
    const sign = signpost('Aralon Edge'); sign.position.set(2.5, 0, 4.6); g.add(sign);
    waystone(g, spots, 2.2, -15.5, 0);
  },
  beach(g, r, spots, R) {
    // Sand sloping gently to the sea; dune grass at the back; driftwood, rocks, an upturned boat, a short jetty.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 40, 30, 20).rotateX(-Math.PI / 2), lam('#F0DCA8'));
    const p = sand.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, -Math.max(0, p.getZ(i) - 10) * 0.12);   // flat sand, shelving under the water
    sand.geometry.computeVertexNormals();
    sand.position.z = -2; sand.receiveShadow = true; g.add(sand);
    // In XY so the wave pass writes z (up, once the mesh is turned flat); local -y runs out to sea (+z).
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(140, 60, 40, 16).translate(0, -30, 0), new THREE.MeshLambertMaterial({ color: '#3E8AB0', transparent: true, opacity: 0.88 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.06, 9.5);
    g.add(sea); this.setSea(sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(140, 0.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#F4F8F4', transparent: true, opacity: 0.7 }));
    foam.position.set(0, 0.09, 9.6); g.add(foam);
    const grassMat = lam('#B4C07A'), rockMat = lam('#8C8478', pixelTexture('mossStone')), drift = lam('#B8A88E', pixelTexture('wood'));
    for (let i = 0; i < 46; i++) {   // marram tufts along the dunes: a few thin blades each
      const x = -24 + R() * 48, z = -19 + R() * 6;
      for (let b = 0; b < 4; b++) {
        const h = 0.45 + R() * 0.45, blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, h, 3), grassMat);
        blade.position.set(x + (R() - 0.5) * 0.3, h / 2, z + (R() - 0.5) * 0.3); blade.rotation.set((R() - 0.5) * 0.6, 0, (R() - 0.5) * 0.6); g.add(blade);
      }
    }
    for (let i = 0; i < 6; i++) rock(g, rockMat, -22 + R() * 44, 0, -6 + R() * 13, 0.6 + R() * 1.1, R).name = 'solid';
    for (let i = 0; i < 4; i++) { const l = box(g, 2.4 + R() * 1.5, 0.28, 0.32, drift, -18 + R() * 36, 0.35, -8 + R() * 12, R() * 3); l.name = 'solid'; }
    // Upturned rowboat.
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.4, 8, 1, false, 0, Math.PI), lam('#7A5A3A', pixelTexture('planks')));
    hull.rotation.set(0, 0, Math.PI / 2); hull.position.set(-9, 0.35, -3); hull.rotation.y = 0.4; hull.castShadow = true; hull.name = 'solid'; g.add(hull);
    // A jetty out into the water.
    const planks = lam('#8A6A48', pixelTexture('planks'));
    box(g, 2.2, 0.16, 12, planks, 11, 0.62, 12);
    for (let z = 7; z <= 18; z += 2.2) for (const dx of [-1, 1]) box(g, 0.18, 1.6, 0.18, lam('#4A3626'), 11 + dx, 0, z);
    spots.push({ hit: hitbox(g, 11, 0, 7.6, 2.4, 1.6, 1.4), verb: 'Look out to sea', kind: 'look', line: 'Gulls, salt, a sail far out. Somewhere past the haze, the ships that bring the patrons\' letters.' });
    const sign = signpost('The Beach'); sign.position.set(-3, 0, -14); g.add(sign);
    waystone(g, spots, 2.2, -17.5, 0);
  },
  ranlean(g, r, spots, R) {
    // The trade road east ends at Ranlean's wall: two towers, a gatehouse, the doors shut and barred, banners up.
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 50).rotateX(-Math.PI / 2), lam('#7FA05A', tiled('grass', 30, 25)));
    grass.receiveShadow = true; g.add(grass);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(34, 4).rotateX(-Math.PI / 2), lam('#B8A88E', tiled('paving', 17, 2)));
    road.position.set(-8, 0.02, 0); road.receiveShadow = true; g.add(road);
    const wall = lam('#C8BCA4', tiled('bricks', 6, 3)), dark = lam('#7A6E5E', pixelTexture('stone'));
    for (const z of [-17, 17]) box(g, 3, 9, 26, wall, 10, 4.5, z).name = 'solid';
    box(g, 3, 11, 8, wall, 10, 5.5, -6).name = 'solid';
    box(g, 3, 11, 8, wall, 10, 5.5, 6).name = 'solid';
    box(g, 3, 4.6, 4, wall, 10, 8.7, 0);   // over the doors
    for (let z = -29; z <= 29; z += 1.6) box(g, 3.1, 0.8, 0.8, wall, 10, z > -10 && z < 10 ? 11.4 : 9.4, z);   // crenels
    for (const z of [-11, 11]) {   // towers
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 14, 8), wall); tower.position.set(10, 7, z); tower.castShadow = true; tower.name = 'solid'; g.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 4, 8), lam('#3E5A8A', pixelTexture('roofTiles'))); roof.position.set(10, 16, z); roof.castShadow = true; g.add(roof);
    }
    const door = lam('#5A3E26', pixelTexture('door'));
    box(g, 0.5, 6.4, 3.9, door, 8.6, 3.2, 0).name = 'solid';
    box(g, 0.4, 0.4, 4.4, dark, 8.3, 3, 0);   // the bar
    for (const z of [-3.6, 3.6]) {   // banners, Ranlean blue and white
      const b = box(g, 0.08, 3.4, 1.4, lam('#2E4E8E'), 8.4, 6.8, z);
      box(g, 0.1, 3.4, 0.35, lam('#F0ECE0'), 8.36, 6.8, z);
      b.castShadow = false;
    }
    const notice = signBoard('By order: the gates stay shut', 2.2, 0.7); notice.position.set(8.0, 1.6, -2.9); notice.rotation.y = -Math.PI / 2; g.add(notice);
    spots.push({ hit: hitbox(g, 7.6, 0, 0, 1.4, 3, 4.2), verb: 'Knock at the gate', kind: 'gate', line: 'Three knocks. Nothing. The notice says the gates stay shut until the roads are safe again.' });
    for (let i = 0; i < 6; i++) rock(g, lam('#8C8478', pixelTexture('mossStone')), -20 + R() * 24, 0, (R() < 0.5 ? -1 : 1) * (5 + R() * 9), 0.5 + R() * 0.8, R).name = 'solid';
    const sign = signpost('Ranlean'); sign.position.set(-12, 0, 2.8); sign.rotation.y = -Math.PI / 2; g.add(sign);
    waystone(g, spots, -19.5, 2.6, -Math.PI / 2);
  },
  amethyst(g, r, spots, R) {
    // Up in the mountains: snow on the rocks, purple crystal clusters, a gate cut into the peak's face, sealed.
    const snow = new THREE.Mesh(new THREE.PlaneGeometry(50, 40).rotateX(-Math.PI / 2), lam('#E8ECF2'));
    snow.receiveShadow = true; g.add(snow);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(30, 3.4).rotateX(-Math.PI / 2), lam('#A49A90', tiled('paving', 15, 2)));
    road.position.set(8, 0.02, 0); g.add(road);
    const rockMat = lam('#7E7686', tiled('stone', 4, 4)), snowCap = lam('#F4F6FA'), amethyst = new THREE.MeshLambertMaterial({ color: '#9A5AD0', emissive: '#3A1260' });
    // The peak's face and the walls of the pass.
    box(g, 6, 24, 30, rockMat, -11, 12, 0).name = 'solid';
    for (const z of [-13.5, 13.5]) { box(g, 40, 10 + R() * 4, 3, rockMat, 6, 5, z).name = 'solid'; box(g, 40, 0.6, 3.2, snowCap, 6, 11.8, z); }
    const peak = new THREE.Mesh(new THREE.ConeGeometry(16, 34, 6), rockMat); peak.position.set(-22, 28, 0); g.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(6.5, 10, 6), snowCap); cap.position.set(-22, 41, 0); g.add(cap);
    // The carved gate: a pointed arch of dressed stone, two great doors, crystals set either side.
    const dressed = lam('#B8B0C4', pixelTexture('bricks'));
    box(g, 1, 9, 1.6, dressed, -7.6, 4.5, -3.4); box(g, 1, 9, 1.6, dressed, -7.6, 4.5, 3.4);
    box(g, 1, 1.6, 8.4, dressed, -7.6, 9.4, 0);
    box(g, 0.5, 8.2, 5.2, lam('#4A3A5A', pixelTexture('door')), -7.8, 4.1, 0).name = 'solid';
    for (const z of [-5.2, 5.2]) for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 + R() * 0.4, 0), amethyst);
      c.position.set(-7 + R() * 1.2, 0.4 + R() * 0.8, z + (R() - 0.5) * 1.4); c.scale.y = 2 + R(); c.rotation.set(R() * 0.5, R() * 3, R() * 0.5); g.add(c);
    }
    const notice = signBoard('Sealed until the thaw', 2.2, 0.7); notice.position.set(-7.0, 1.7, 3.0); notice.rotation.y = Math.PI / 2; g.add(notice);
    spots.push({ hit: hitbox(g, -6.8, 0, 0, 1.4, 3, 5), verb: 'Knock at the gate', kind: 'gate', line: 'The stone swallows the sound. Frost in the seams: these doors have not opened since autumn.' });
    for (let i = 0; i < 8; i++) { const k = rock(g, rockMat, -2 + R() * 22, 0, (R() < 0.5 ? -1 : 1) * (4 + R() * 7), 0.5 + R() * 0.9, R); k.name = 'solid'; }
    const sign = signpost('Amethyst Peak'); sign.position.set(10, 0, -2.6); sign.rotation.y = Math.PI / 2; g.add(sign);
    waystone(g, spots, 19.5, -2.6, Math.PI / 2);
  },
  modern(g, _r, spots) {
    // A plain modern flat, 12 x 10 m: laminate floor, painted walls, a window on the city, a sofa facing the TV, a
    // kitchen run, a desk, a bookcase. Indoors, so the pieces glow a little (no lamps to light them) and nothing
    // casts a shadow from the sun through the roof.
    const glow = (c: string, map?: THREE.Texture) => new THREE.MeshLambertMaterial({ color: c, map: map ?? null, emissive: c, emissiveIntensity: map ? 0.25 : 0.4 });
    const flat = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => { const m = box(g, w, h, d, mat, x, y, z, ry); m.castShadow = false; return m; };
    const H = 2.8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10).rotateX(-Math.PI / 2), glow('#B88E62', tiled('wood', 8, 7)));
    floor.receiveShadow = true; g.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 10).rotateX(Math.PI / 2), glow('#F2EFE8')); ceil.position.y = H; g.add(ceil);
    const wall = glow('#E4DED2'), skirting = glow('#F6F4EE');
    flat(12.4, H, 0.2, wall, 0, H / 2, -5.1); flat(12.4, H, 0.2, wall, 0, H / 2, 5.1);
    flat(0.2, H, 10.4, wall, -6.1, H / 2, 0); flat(0.2, H, 10.4, wall, 6.1, H / 2, 0);
    for (const z of [-4.98, 4.98]) flat(12, 0.1, 0.04, skirting, 0, 0.05, z);
    for (const x of [-5.98, 5.98]) flat(0.04, 0.1, 10, skirting, x, 0.05, 0);
    // Ceiling lights: flat panels.
    for (const [x, z] of [[-2.8, -1.5], [2.8, -1.5], [-2.8, 2.5], [2.8, 2.5]]) flat(1.0, 0.04, 0.6, new THREE.MeshBasicMaterial({ color: '#FFF8E8' }), x, H - 0.03, z);
    // The window on the city (north wall, east half).
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), new THREE.MeshBasicMaterial({ map: skyline() })); win.position.set(2.6, 1.6, -4.99); g.add(win);
    const frame = glow('#F6F4EE');
    flat(3.8, 0.08, 0.1, frame, 2.6, 2.38, -4.95); flat(3.8, 0.12, 0.2, frame, 2.6, 0.82, -4.92);
    for (const x of [0.75, 2.6, 4.45]) flat(0.08, 1.56, 0.1, frame, x, 1.6, -4.95);
    spots.push({ hit: hitbox(g, 2.6, 0.6, -4.5, 3.6, 1.8, 0.8), verb: 'Look out of the window', kind: 'look', line: 'Streetlights, wet roads, a bus going by with nobody on it. Somewhere a car alarm. No dragons in sight.' });
    // Rug, sofa (facing the TV on the east wall), coffee table.
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6).rotateX(-Math.PI / 2), glow('#4E5E78')); rug.position.set(3.5, 0.01, 0.3); g.add(rug);
    const sofa = glow('#6A7A6A'), sofaDark = glow('#566456');
    flat(0.95, 0.45, 2.4, sofa, 2.3, 0.225, 0.3).name = 'solid';
    flat(0.25, 0.85, 2.4, sofaDark, 1.72, 0.425, 0.3);
    for (const z of [-0.95, 1.55]) flat(0.95, 0.62, 0.22, sofaDark, 2.3, 0.31, z);
    for (const z of [-0.3, 0.9]) flat(0.6, 0.12, 1.05, glow('#7C8C7A'), 2.35, 0.5, z);
    const wood = glow('#8A6440', pixelTexture('wood'));
    flat(1.0, 0.06, 0.6, wood, 3.7, 0.42, 0.3);
    for (const [dx, dz] of [[-0.42, -0.24], [0.42, -0.24], [-0.42, 0.24], [0.42, 0.24]]) flat(0.05, 0.4, 0.05, wood, 3.7 + dx, 0.2, 0.3 + dz);
    flat(0.12, 0.1, 0.08, glow('#D84A3A'), 3.5, 0.5, 0.2); flat(0.18, 0.02, 0.12, glow('#2A2A2A'), 3.9, 0.46, 0.4);   // a mug, a remote
    // TV on a low unit, showing a title screen.
    flat(0.45, 0.5, 2.0, glow('#3A3430'), 5.75, 0.25, 0.3).name = 'solid';
    flat(0.06, 0.9, 1.6, glow('#18181A'), 5.9, 1.2, 0.3);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.82), new THREE.MeshBasicMaterial({ map: tvScreen() })); screen.position.set(5.86, 1.2, 0.3); screen.rotation.y = -Math.PI / 2; g.add(screen);
    spots.push({ hit: hitbox(g, 5.6, 0.6, 0.3, 0.8, 1.4, 1.8), verb: 'Look at the TV', kind: 'look', line: "It's paused on a title screen: ARTHERIA. Someone has been playing your world." });
    // Kitchen run along the north wall, west half: fridge, counter, a kettle.
    flat(0.8, 1.9, 0.7, glow('#E8ECEE'), -5.4, 0.95, -4.55).name = 'solid';
    flat(0.02, 0.4, 0.04, glow('#9AA0A4'), -5.05, 1.2, -4.18);
    flat(3.6, 0.9, 0.65, glow('#F0ECE4'), -3.0, 0.45, -4.6).name = 'solid';
    flat(3.6, 0.05, 0.7, glow('#4A4A50'), -3.0, 0.92, -4.6);
    flat(3.6, 0.7, 0.35, glow('#F0ECE4'), -3.0, 1.85, -4.8);
    const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 10), glow('#C8CCD0')); kettle.position.set(-2.3, 1.06, -4.6); g.add(kettle);
    flat(0.5, 0.04, 0.35, glow('#B8BCC0'), -3.6, 0.95, -4.6);   // the sink
    spots.push({ hit: hitbox(g, -5.4, 0, -4.2, 0.9, 1.9, 0.8), verb: 'Open the fridge', kind: 'look', line: 'Milk, a lot of hot sauce, half a lasagne with a note on it: DO NOT. You close it again.' });
    // Desk and chair on the south wall, a laptop with lines of code on it.
    flat(1.6, 0.05, 0.7, wood, 0.0, 0.75, 4.5); for (const dx of [-0.75, 0.75]) flat(0.05, 0.73, 0.65, wood, dx, 0.37, 4.5);
    g.add(Object.assign(hitbox(g, 0, 0, 4.5, 1.6, 0.8, 0.7), { name: 'solid' }));
    flat(0.5, 0.02, 0.35, glow('#2E3034'), 0.1, 0.79, 4.45);
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.32), new THREE.MeshBasicMaterial({ map: laptopScreen() })); lid.position.set(0.1, 0.95, 4.62); lid.rotation.set(0.25, Math.PI, 0); g.add(lid);
    flat(0.5, 0.06, 0.5, glow('#2A2C30'), 0.0, 0.48, 3.85); flat(0.5, 0.5, 0.06, glow('#2A2C30'), 0.0, 0.78, 3.62);
    flat(0.06, 0.45, 0.06, glow('#5A5C60'), 0.0, 0.23, 3.85);
    spots.push({ hit: hitbox(g, 0.1, 0.7, 4.4, 1.0, 0.6, 0.6), verb: 'Look at the laptop', kind: 'look', line: 'A text editor full of something called main.ts. Four thousand lines. Somebody is building a world in here.' });
    // Bookcase, a plant, a floor lamp.
    flat(1.6, 2.0, 0.35, wood, 4.6, 1.0, 4.75).name = 'solid';
    const R = rng(5656), spines = ['#9A3B2A', '#2F4E5E', '#C49A5A', '#4E6B3A', '#6B2F4E', '#D8CFBE', '#3B3F6B'];
    for (let shelf = 0; shelf < 4; shelf++) for (let x = 3.9; x < 5.25;) { const w = 0.05 + R() * 0.05, h = 0.22 + R() * 0.12; flat(w, h, 0.22, glow(spines[Math.floor(R() * spines.length)]), x, 0.12 + shelf * 0.48 + h / 2, 4.56); x += w + 0.01; }
    spots.push({ hit: hitbox(g, 4.6, 0, 4.4, 1.6, 2, 0.7), verb: 'Look at the bookcase', kind: 'look', line: 'Paperbacks, board game boxes, a dice tray. On the top shelf, a battered red notebook that looks a lot like yours.' });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 10), glow('#C8784A')); pot.position.set(5.5, 0.2, -4.4); pot.name = 'solid'; g.add(pot);
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 5), glow('#4E8A4A')); l.position.set(5.5 + (R() - 0.5) * 0.2, 0.75, -4.4 + (R() - 0.5) * 0.2); l.rotation.set((R() - 0.5) * 0.7, 0, (R() - 0.5) * 0.7); g.add(l); }
    flat(0.05, 1.6, 0.05, glow('#2A2A2A'), 0.9, 0.8, -0.9); const shade = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.3, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#FFE8B8', side: THREE.DoubleSide })); shade.position.set(0.9, 1.65, -0.9); g.add(shade);
    // The front door (south wall, west): locked.
    flat(0.95, 2.1, 0.08, glow('#5A6A7A'), -3.6, 1.05, 4.96); flat(0.04, 0.04, 0.12, glow('#C8C0A8'), -3.25, 1.0, 4.9);
    spots.push({ hit: hitbox(g, -3.6, 0, 4.6, 1.2, 2.1, 0.6), verb: 'Try the front door', kind: 'look', line: 'Locked, with a chain on. Through the peephole: a corridor, a fire door, a green EXIT sign. Better not.' });
    // The portal home on the west wall: a stone ring with the swirl in it.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), lam('#8C8478', pixelTexture('mossStone'))); ring.position.set(-5.9, 1.15, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
    const sw = swirlTexture(); this.setSwirl(sw);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ map: sw, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    disc.position.set(-5.88, 1.15, 0); disc.rotation.y = Math.PI / 2; disc.name = 'portal-swirl'; g.add(disc);
    spots.push({ hit: hitbox(g, -5.5, 0, 0, 0.8, 2.3, 2.0), verb: 'Step back through the portal', kind: 'back' });
  },
};

/** B56: the portal's swirl, a purple spiral (rotate the texture to spin it). */
export function swirlTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!, grd = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, '#FFFFFF'); grd.addColorStop(0.25, '#C89AF0'); grd.addColorStop(0.7, '#6A2AA8'); grd.addColorStop(1, 'rgba(40,10,70,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,240,255,0.55)'; x.lineWidth = 3;
  for (let arm = 0; arm < 3; arm++) { x.beginPath(); for (let i = 0; i < 60; i++) { const a = arm * 2.094 + i * 0.12, r = i * 1.0; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.center.set(0.5, 0.5);
  return t;
}
function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): THREE.Texture {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Dusk over a city: towers with lit windows. */
function skyline(): THREE.Texture {
  return canvasTex(256, 108, (x) => {
    const grd = x.createLinearGradient(0, 0, 0, 108); grd.addColorStop(0, '#2A3A6A'); grd.addColorStop(0.6, '#C87A6A'); grd.addColorStop(1, '#F0B87A');
    x.fillStyle = grd; x.fillRect(0, 0, 256, 108);
    const R = rng(808);
    for (let i = 0, px = 0; px < 256; i++) {
      const w = 14 + R() * 22, h = 30 + R() * 60; x.fillStyle = i % 2 ? '#1E2238' : '#262A44'; x.fillRect(px, 108 - h, w, h);
      x.fillStyle = '#F8D88A'; for (let wy = 108 - h + 5; wy < 104; wy += 7) for (let wx = px + 3; wx < px + w - 3; wx += 5) if (R() < 0.35) x.fillRect(wx, wy, 2, 3);
      px += w + 1;
    }
  });
}
function tvScreen(): THREE.Texture {
  return canvasTex(256, 140, (x) => {
    const grd = x.createLinearGradient(0, 0, 0, 140); grd.addColorStop(0, '#3A5A8A'); grd.addColorStop(1, '#8AB86A'); x.fillStyle = grd; x.fillRect(0, 0, 256, 140);
    x.fillStyle = '#F4E6C0'; x.textAlign = 'center'; x.font = 'bold 34px Georgia, serif'; x.fillText('ARTHERIA', 128, 62);
    x.font = '14px Georgia, serif'; x.fillText('Press any button', 128, 100);
  });
}
function laptopScreen(): THREE.Texture {
  return canvasTex(128, 84, (x) => {
    x.fillStyle = '#1E2228'; x.fillRect(0, 0, 128, 84);
    const R = rng(77), cols = ['#C8A0F0', '#8AC8F0', '#F0C88A', '#9AD08A', '#C8CCD0'];
    for (let y = 6; y < 80; y += 6) { let px = 6 + Math.floor(R() * 3) * 6; while (px < 110 && R() < 0.8) { const w = 6 + R() * 20; x.fillStyle = cols[Math.floor(R() * cols.length)]; x.fillRect(px, y, w, 3); px += w + 4; } }
  });
}
