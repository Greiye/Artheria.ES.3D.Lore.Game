import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pixelTexture } from '../tex/pixel';
import type { Collider } from '../world/index';
import { generate, isFloor, N, CELL, mulberry32, type Layout, type Room, type Theme } from './gen';

// B15 in Three.js: the seeded dungeon under the Ruined Library, built 400 m east of the glade (past the
// camera's far plane, so the two never draw together). Painted light like the figures: tiles are unlit,
// and each one's brightness comes from nearby torches plus a little wall occlusion, stored in instance
// colours. Five draw calls: floor, walls, ceiling, torches, props.
const ORIGIN = new THREE.Vector3(400, 0, 0);
const THEME: Record<Theme, { floor: string; wall: string; torch: string; liquid: string; fog: string }> = {
  Ancient: { floor: '#C9B48A', wall: '#B8A07A', torch: '#FFB347', liquid: '#3F7FB0', fog: '#1A1510' },
  Frost: { floor: '#AFC4D6', wall: '#9FB4C8', torch: '#9FE8FF', liquid: '#BFEFFF', fog: '#0E1620' },
  Molten: { floor: '#B07A5A', wall: '#8A5A44', torch: '#FF7A2A', liquid: '#FF5A1A', fog: '#1E0D08' },
  Grim: { floor: '#8A9488', wall: '#6E786C', torch: '#8CFF7A', liquid: '#5AA05A', fog: '#0C120C' },
  Verdant: { floor: '#9AB07A', wall: '#7E9A66', torch: '#FFD27A', liquid: '#4FA0A0', fog: '#0E140C' },
};
const cellToWorld = (x: number, y: number, out = new THREE.Vector3()) => out.set(ORIGIN.x + (x - N / 2) * CELL + CELL / 2, 0, ORIGIN.z + (y - N / 2) * CELL + CELL / 2);

export interface DungeonSpot { kind: 'stairs' | 'chest' | 'shrine' | 'nest'; room: Room; hit: THREE.Mesh }

export class Dungeon {
  readonly group = new THREE.Group();
  layout: Layout | null = null;
  colliders: Collider[] = [];
  spots: DungeonSpot[] = [];
  private flames: THREE.Mesh | null = null;
  private hidden = new THREE.MeshBasicMaterial({ visible: false });
  private hits: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'dungeon';
    this.group.visible = false;
    scene.add(this.group);
    // Reused hitboxes (stairs, chest, nest, up to four shrines).
    for (let i = 0; i < 7; i++) { const h = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), this.hidden); h.visible = false; scene.add(h); this.hits.push(h); }
  }

  build(seed: number): Layout {
    const L = generate(seed), T = THEME[L.theme];
    this.layout = L;
    this.group.clear();
    this.colliders = [];
    const torchPos = L.torches.map(([x, y]) => cellToWorld(x, y));
    const light = (p: THREE.Vector3) => {
      let v = 0.2;
      for (const t of torchPos) { const d = Math.hypot(p.x - t.x, p.z - t.z); if (d < 9) v += 0.95 * (1 - d / 9) ** 2; }
      return Math.min(1.15, v);
    };
    const wallNear = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isFloor(L, x + dx, y + dy)).length;
    // Floor + liquid.
    const floors: [number, number, number][] = [], walls: [number, number][] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = L.grid[y * N + x];
      if (v) floors.push([x, y, v]);
      else if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => isFloor(L, x + dx, y + dy)))) walls.push([x, y]);
    }
    const p = new THREE.Vector3(), m = new THREE.Matrix4(), c = new THREE.Color();
    const floor = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.1, CELL), new THREE.MeshBasicMaterial({ map: pixelTexture('paving') }), floors.length);
    const tint = new THREE.Color(T.floor), liquid = new THREE.Color(T.liquid);
    floors.forEach(([x, y, v], i) => {
      cellToWorld(x, y, p); p.y = v === 2 ? -0.08 : -0.04;
      floor.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
      if (v === 2) c.copy(liquid).multiplyScalar(0.9 + light(p) * 0.3);
      else c.copy(tint).multiplyScalar(light(p) * (1 - 0.12 * wallNear(x, y)));
      floor.setColorAt(i, c);
    });
    floor.name = 'dungeon-floor';
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 3.2, CELL), new THREE.MeshBasicMaterial({ map: pixelTexture('stone') }), walls.length);
    const wt = new THREE.Color(T.wall);
    walls.forEach(([x, y], i) => {
      cellToWorld(x, y, p);
      wall.setMatrixAt(i, m.makeTranslation(p.x, 1.6, p.z));
      wall.setColorAt(i, c.copy(wt).multiplyScalar(Math.max(0.25, light(p) * 0.85)));
      this.colliders.push({ kind: 'box', minX: p.x - CELL / 2, maxX: p.x + CELL / 2, minZ: p.z - CELL / 2, maxZ: p.z + CELL / 2 });
    });
    wall.name = 'dungeon-walls';
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(N * CELL, N * CELL).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(T.fog).multiplyScalar(1.6) }));
    ceiling.position.set(ORIGIN.x, 3.2, ORIGIN.z);
    // Torches: an iron sconce and a flame, on the wall side of each corner tile.
    const tg: THREE.BufferGeometry[] = [];
    const paint = (g: THREE.BufferGeometry, hex: string) => { const n = g.toNonIndexed(); c.set(hex); n.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3)); n.deleteAttribute('uv'); n.deleteAttribute('normal'); return n; };
    const flameG: THREE.BufferGeometry[] = [];
    L.torches.forEach(([x, y]) => {
      cellToWorld(x, y, p);
      const ox = isFloor(L, x - 1, y) ? (isFloor(L, x + 1, y) ? 0 : 0.85) : -0.85, oz = isFloor(L, x, y - 1) ? (isFloor(L, x, y + 1) ? 0 : 0.85) : -0.85;
      tg.push(paint(new THREE.BoxGeometry(0.12, 0.4, 0.12).translate(p.x + ox, 1.9, p.z + oz), '#2E2A26'));
      flameG.push(paint(new THREE.ConeGeometry(0.11, 0.3, 5).translate(p.x + ox, 2.25, p.z + oz), T.torch));
    });
    // Props, by room tag.
    this.spots = [];
    const R = mulberry32(L.seed ^ 0x5eed);
    let h = 0;
    const spot = (kind: DungeonSpot['kind'], room: Room, at: THREE.Vector3) => {
      const hit = this.hits[h++];
      if (!hit) return;
      hit.position.set(at.x, 0.8, at.z); hit.visible = true; hit.name = 'dungeon:' + kind;
      this.spots.push({ kind, room, hit });
    };
    for (const r of L.rooms) {
      const ctr = cellToWorld(r.cx, r.cy);
      if (r.tag === 'entrance') {
        for (let s = 0; s < 5; s++) tg.push(paint(new THREE.BoxGeometry(1.6, 0.3 * (s + 1), 0.5).translate(ctr.x, 0.15 * (s + 1), ctr.z - 1.2 - s * 0.5), s % 2 ? '#4A443C' : '#57504A'));
        this.colliders.push({ kind: 'box', minX: ctr.x - 0.8, maxX: ctr.x + 0.8, minZ: ctr.z - 3.5, maxZ: ctr.z - 0.95 });
        spot('stairs', r, new THREE.Vector3(ctr.x, 0, ctr.z - 1.3));
      } else if (r.tag === 'treasure') {
        tg.push(paint(new THREE.BoxGeometry(0.9, 0.5, 0.6).translate(ctr.x, 0.25, ctr.z), '#7A4A26'), paint(new THREE.BoxGeometry(0.94, 0.12, 0.64).translate(ctr.x, 0.55, ctr.z), '#C9A23A'));
        this.colliders.push({ kind: 'circle', x: ctr.x, z: ctr.z, r: 0.5 });
        spot('chest', r, ctr);
      } else if (r.tag === 'shrine') {
        tg.push(paint(new THREE.BoxGeometry(0.7, 1.4, 0.35).translate(ctr.x, 0.7, ctr.z), '#8A8E90'), paint(new THREE.BoxGeometry(0.4, 0.06, 0.04).translate(ctr.x, 1.1, ctr.z + 0.19), '#3FE0E8'));
        this.colliders.push({ kind: 'circle', x: ctr.x, z: ctr.z, r: 0.45 });
        spot('shrine', r, ctr);
      } else if (r.tag === 'nest') {
        for (let k = 0; k < 14; k++) tg.push(paint(new THREE.BoxGeometry(0.28, 0.06, 0.38).rotateY(R() * 3).translate(ctr.x + (R() - 0.5) * 1.4, 0.04 + k * 0.03, ctr.z + (R() - 0.5) * 1.4), k % 3 ? '#A8322A' : '#7A2420'));
        spot('nest', r, ctr);
      }
    }
    for (let i = h; i < this.hits.length; i++) this.hits[i].visible = false;
    const torches = new THREE.Mesh(mergeGeometries(tg), new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.flames = new THREE.Mesh(mergeGeometries(flameG), new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.group.add(floor, wall, ceiling, torches, this.flames);
    this.group.traverse((o) => { o.raycast = () => {}; });
    return L;
  }

  get fog() { return this.layout ? THEME[this.layout.theme].fog : '#000'; }
  entrance(): THREE.Vector3 {
    const r = this.layout!.rooms.find((x) => x.tag === 'entrance')!;
    return cellToWorld(r.cx, r.cy).add(new THREE.Vector3(0, 0, 0.6));
  }
  // Face the longest open run from the entrance (stairs are to the north), so the first view is down a hall.
  entranceYaw(): number {
    const L = this.layout!, r = L.rooms.find((x) => x.tag === 'entrance')!;
    let best = Math.PI, len = -1;
    for (const [dx, dy, yaw] of [[0, 1, Math.PI], [1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2]] as const) {
      let n = 0;
      while (isFloor(L, r.cx + dx * (n + 1), r.cy + dy * (n + 1))) n++;
      if (n > len) { len = n; best = yaw; }
    }
    return best;
  }
  /** Floor (not rock) at world (x, z), with a little margin from the walls. */
  walkable(x: number, z: number, margin = 0.3): boolean {
    const L = this.layout;
    if (!L) return false;
    for (const [mx, mz] of [[margin, 0], [-margin, 0], [0, margin], [0, -margin]]) {
      const cx = Math.floor((x + mx - ORIGIN.x) / CELL + N / 2), cy = Math.floor((z + mz - ORIGIN.z) / CELL + N / 2);
      if (!isFloor(L, cx, cy)) return false;
    }
    return true;
  }
  /** World position of a room cell. */
  roomAt(r: Room, dx = 0, dy = 0) { return cellToWorld(r.cx + dx, r.cy + dy); }
  update(t: number) { if (this.flames && this.group.visible) this.flames.scale.y = 1 + Math.sin(t * 17) * 0.03; }
  hideSpots() { this.hits.forEach((h) => { h.visible = false; }); }
}
