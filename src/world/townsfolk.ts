import * as THREE from 'three';
import { buildFigure, type FigureLook } from './figure';
import { GREEN, TOWN_LOTS, WELL, CINEMA_SPOT, type TownId } from './town';
import type { Pose } from '../anim/procedural';

// v0.06 T1: placeholder townsfolk (role names only, never in the lore: placeholder-names.md). Walkers go from door
// to door round a loop on the green that clears the well, the lamp posts and the lots; two pupils spar and one
// drills outside the dojo; customers trade at the General Store's counter; pairs chat on the green.
// v0.06 T4: a small band (fiddle, drum, pipe) stands by the Projectionist's screen and plays while a reel with
// sound plays. None of them block the player or take input; the interactive NPCs are untouched.
export type FolkRole = 'walker' | 'sparring' | 'drill' | 'customer' | 'chat' | 'band';
export interface Folk {
  id: string;
  name: string;          // a role name ("the Lamplighter"), never a lore name
  role: FolkRole;
  root: THREE.Group;
  speed: number;         // m/s this frame (drives the walk cycle)
  talking: boolean;
  pose: Pose | null;
  active: boolean;
}

const LOOP = { rx: 15, rz: 3.6 };   // the walkers' oval: inside the lamp posts (~0.8 of the ring), outside the well
const WALK_SPEED = 1.35;
const loopAt = (a: number, out = new THREE.Vector3()) => out.set(GREEN.x + LOOP.rx * Math.sin(a), 0, GREEN.z - LOOP.rz * Math.cos(a));
const loopAngle = (x: number, z: number) => Math.atan2((x - GREEN.x) / LOOP.rx, -(z - GREEN.z) / LOOP.rz);
const lot = (id: TownId) => TOWN_LOTS.find((l) => l.id === id)!;
/** A point in a lot's frame: lx along its front, lz out toward the green from its centre. */
const lotAt = (id: TownId, lx: number, lz: number) => { const L = lot(id), c = Math.cos(L.ry), s = Math.sin(L.ry); return new THREE.Vector3(L.x + lx * c + lz * s, 0, L.z - lx * s + lz * c); };
/** Just in front of a lot's door step, on the green side. */
const doorStep = (id: TownId) => lotAt(id, 0, lot(id).d / 2 + 1.5);

const PALETTE: FigureLook[] = [
  { skin: '#E8C0A0', hair: '#5A3A22', primary: '#7A4A3A', secondary: '#E8D8B8', boots: '#3A2A1E', accent: '#C9A36B', hairStyle: 'short' },
  { skin: '#C89070', hair: '#1E1A18', primary: '#3E5A44', secondary: '#D8C8A0', boots: '#2A221C', accent: '#8A6A3A', hairStyle: 'long', skirt: true },
  { skin: '#F0D0B8', hair: '#C8A060', primary: '#5A4A7A', secondary: '#E0D0C0', boots: '#2E2A30', accent: '#B8935A', hairStyle: 'topknot' },
  { skin: '#A87050', hair: '#2A2420', primary: '#8A6A3A', secondary: '#F0E0C0', boots: '#3A2E22', accent: '#6A4A2A', hairStyle: 'cap' },
  { skin: '#E0B090', hair: '#8A4A2A', primary: '#4A6A8A', secondary: '#E8E0D0', boots: '#2A2A2E', accent: '#C9A36B', hairStyle: 'hood' },
  { skin: '#D8A880', hair: '#B8B0A0', primary: '#6A3A3A', secondary: '#D8C8A8', boots: '#3A2A1E', accent: '#A88A5A', hairStyle: 'bald', build: 1.2 },
  { skin: '#F2D6C0', hair: '#3A2A1E', primary: '#7A6A3A', secondary: '#E8D8B0', boots: '#2E241C', accent: '#5A7A4A', hairStyle: 'spiky' },
];

interface Brain { route: THREE.Vector3[]; i: number; wait: number; at: TownId | null; talkT: number; face: number | null; turn: number }

export class Townsfolk {
  readonly folk: Folk[] = [];
  readonly group = new THREE.Group();
  /** True while the cinema band is playing (a reel with sound is on, sound unmuted). */
  bandPlaying = false;
  private brains = new Map<Folk, Brain>();
  private t = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'townsfolk';
    scene.add(this.group);
    let n = 0;
    const add = (name: string, role: FolkRole, pos: THREE.Vector3, yaw: number, height = 1.62 + (n % 3) * 0.08) => {
      const root = buildFigure(PALETTE[n % PALETTE.length], height);
      root.position.copy(pos); root.rotation.y = yaw; root.name = 'folk:' + name;
      const f: Folk = { id: 'folk:' + n++, name, role, root, speed: 0, talking: false, pose: null, active: true };
      root.userData.folk = f;
      this.group.add(root);
      this.folk.push(f);
      this.brains.set(f, { route: [], i: 0, wait: 1 + (n % 4), at: null, talkT: (n % 3) * 1.1, face: null, turn: yaw });
      return f;
    };
    const face = (a: THREE.Vector3, b: THREE.Vector3) => Math.atan2(b.x - a.x, b.z - a.z);
    // Walkers, starting at different doors (the most important ones first, so Low keeps a spread).
    ([['the Lamplighter', 'inn'], ['the Carter', 'smithy'], ['the Herbalist', 'library'], ['the Water-Carrier', 'gallery']] as [string, TownId][]).forEach(([name, at]) => {
      const f = add(name, 'walker', doorStep(at), 0);
      this.brains.get(f)!.at = at;
    });
    // The dojo: two pupils sparring face to face, one drilling beside them.
    const d = lot('dojo'), dz = d.d / 2 + 2.6, s1 = lotAt('dojo', -3.1, dz), s2 = lotAt('dojo', -1.8, dz + 0.4), dr = lotAt('dojo', 2.4, dz - 0.3);
    add('the Sparring Pupil', 'sparring', s1, face(s1, s2));
    add('the Other Pupil', 'sparring', s2, face(s2, s1));
    add('the Drill Student', 'drill', dr, d.ry);
    // The General Store: customers at the counter, facing the shopkeeper (who stands at lx 2.0, just inside).
    const sh = lot('shop'), keeper = lotAt('shop', 2.0, sh.d / 2 + 0.95);
    for (const [name, lx] of [['the Customer', 1.4], ['the Haggler', 2.7]] as [string, number][]) { const p = lotAt('shop', lx, sh.d / 2 + 2.5); add(name, 'customer', p, face(p, keeper)); }
    // Pairs chatting on the green (inside the walkers' loop, clear of the well).
    for (const [cx, cz] of [[GREEN.x + 8.5, GREEN.z + 0.4], [GREEN.x - 9, GREEN.z - 0.6]]) {
      const a = new THREE.Vector3(cx - 0.6, 0, cz), b = new THREE.Vector3(cx + 0.6, 0, cz + 0.2);
      add('the Gossip', 'chat', a, face(a, b)); add('the Neighbour', 'chat', b, face(b, a));
    }
    // T4: the cinema band, beside the screen on the side away from the Projectionist, facing the green.
    const cin = CINEMA_SPOT(), cc = Math.cos(cin.ry), cs = Math.sin(cin.ry);
    const cAt = (lx: number, lz: number) => new THREE.Vector3(cin.x + lx * cc + lz * cs, 0, cin.z - lx * cs + lz * cc);
    ([['the Fiddler', 'fiddle', -2.1], ['the Drummer', 'drum', -2.9], ['the Piper', 'pipe', -3.7]] as [string, Pose, number][]).forEach(([name, kind, lx], i) => {
      const f = add(name, 'band', cAt(lx, 0.9 + (i % 2) * 0.35), cin.ry + 0.3);
      f.root.userData.instrument = kind;
      f.root.add(instrument(kind));
    });
  }

  /** Low preset: fewer townsfolk. Inactive ones are hidden and skipped. */
  setCount(perRole: 'low' | 'full') {
    const keep = new Map<FolkRole, number>([['walker', perRole === 'low' ? 2 : 4], ['sparring', 2], ['drill', perRole === 'low' ? 0 : 1], ['customer', perRole === 'low' ? 1 : 2], ['chat', perRole === 'low' ? 2 : 4], ['band', 3]]);
    const seen = new Map<FolkRole, number>();
    for (const f of this.folk) {
      const k = (seen.get(f.role) ?? 0) + 1; seen.set(f.role, k);
      f.active = k <= keep.get(f.role)!;
      f.root.visible = f.active;
    }
  }
  /** For tests: clearance from the well and the lots at (x, z). */
  clearance(x: number, z: number) { return clearance(x, z); }
  get activeCount() { return this.folk.filter((f) => f.active && f.role !== 'band').length; }

  private frustum = new THREE.Frustum();
  private pv = new THREE.Matrix4();
  private sphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  update(dt: number, camera?: THREE.Camera) {
    this.t += dt;
    // Skinned figures skip three's frustum culling, so cull them here: off-screen or far townsfolk aren't drawn.
    if (camera) { camera.updateMatrixWorld(); this.frustum.setFromProjectionMatrix(this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
    for (const f of this.folk) {
      if (!f.active) continue;
      if (camera) {
        this.sphere.center.copy(f.root.position).setY(0.9);
        f.root.visible = this.sphere.center.distanceTo(camera.position) < 70 && this.frustum.intersectsSphere(this.sphere);
      }
      const b = this.brains.get(f)!;
      if (f.role === 'walker') this.walk(f, b, dt);
      else if (f.role === 'sparring') { f.pose = Math.sin(this.t * 0.9 + (this.folk.indexOf(f) % 2) * 2) > -0.2 ? 'punch' : 'stance'; }
      else if (f.role === 'drill') f.pose = Math.sin(this.t * 0.4) > 0 ? 'punch' : 'stance';
      else if (f.role === 'customer' || f.role === 'chat') {
        // Take turns: each pair (or the counter) has one speaker at a time, swapping every few seconds.
        b.talkT += dt;
        const idx = this.folk.indexOf(f), turn = Math.floor((this.t + (f.role === 'customer' ? 0 : idx >> 1) * 1.7) / 2.6);
        f.talking = (turn + idx) % 2 === 0 && Math.sin(this.t * 0.37 + idx) > -0.6;
      } else if (f.role === 'band') {
        f.pose = this.bandPlaying ? f.root.userData.instrument as Pose : null;
      }
    }
  }

  private walk(f: Folk, b: Brain, dt: number) {
    const p = f.root.position;
    if (b.i >= b.route.length) {
      f.speed = 0;
      if (b.face !== null) f.root.rotation.y = turnToward(f.root.rotation.y, b.face, dt * 4);
      if ((b.wait -= dt) > 0) return;
      // Pick another door and plan: out to the loop, round it the short way, in to the door.
      const others = TOWN_LOTS.filter((l) => l.id !== b.at), next = others[Math.floor(Math.random() * others.length)].id;
      b.route = route(p, doorStep(next));
      b.i = 0; b.at = next; b.wait = 3 + Math.random() * 4;
      const L = lot(next); b.face = L.ry + Math.PI;   // at the door, face it (lots face the green)
    }
    const goal = b.route[b.i], dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz), step = WALK_SPEED * dt;
    f.speed = WALK_SPEED;
    f.root.rotation.y = turnToward(f.root.rotation.y, Math.atan2(dx, dz), dt * 6);
    if (d <= step) { p.set(goal.x, 0, goal.z); b.i++; }
    else { p.x += dx / d * step; p.z += dz / d * step; }
  }
}

const turnToward = (a: number, b: number, k: number) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * Math.min(1, k); };

/** From a door step to another: straight out to the loop, along it the short way round, straight in. */
export function route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const a0 = loopAngle(from.x, from.z), a1 = loopAngle(to.x, to.z);
  let da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
  const n = Math.max(1, Math.ceil(Math.abs(da) / 0.12)), out = [loopAt(a0)];
  for (let i = 1; i <= n; i++) out.push(loopAt(a0 + da * i / n));
  out.push(to.clone());
  return out;
}
/** For tests: how close a point comes to the well and to each lot's footprint (negative = inside). */
export function clearance(x: number, z: number) {
  const well = Math.hypot(x - WELL.x, z - WELL.z) - WELL.r;
  let lots = Infinity;
  for (const L of TOWN_LOTS) {
    const c = Math.cos(L.ry), s = Math.sin(L.ry), lx = (x - L.x) * c - (z - L.z) * s, lz = (x - L.x) * s + (z - L.z) * c;
    lots = Math.min(lots, Math.max(Math.abs(lx) - L.w / 2 - 0.2, Math.abs(lz) - L.d / 2 - 0.2));
  }
  return { well, lots };
}

/** A small instrument held at the chest (positions are in the figure's frame; figures face +Z). */
function instrument(kind: Pose): THREE.Object3D {
  const wood = new THREE.MeshLambertMaterial({ color: '#8A4A22' }), hide = new THREE.MeshLambertMaterial({ color: '#E8D8B0' });
  const g = new THREE.Group(); g.name = 'instrument:' + kind;
  if (kind === 'fiddle') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.3), wood); body.position.set(0.12, 1.32, 0.12); body.rotation.set(0.3, 0.6, 0.4); g.add(body);
  } else if (kind === 'drum') {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 10), wood); drum.position.set(0, 0.95, 0.25); g.add(drum);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.165, 10).rotateX(-Math.PI / 2), hide); top.position.set(0, 1.051, 0.25); g.add(top);
  } else {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.36, 6), wood); pipe.position.set(0, 1.35, 0.28); pipe.rotation.x = 1.2; g.add(pipe);
  }
  return g;
}
