import * as THREE from 'three';
import { buildFigure } from './figure';
import { GREEN, TOWN_LOTS, FOUNTAIN, CINEMA_SPOT, type TownId } from './town';
import type { Pose } from '../anim/procedural';
import { rollTownsfolk } from '../traits/townsfolk';
import { seedOf } from '../traits/roll';
import { specFromRoll } from '../morph/spec';
import { assemble, updateLod } from '../morph/assemble';

/** B57 PR 4: townsfolk are assembled from specs (src/morph); `?oldfolk` keeps the hand-built figures to compare. */
const OLD_FOLK = typeof location !== 'undefined' && new URLSearchParams(location.search).has('oldfolk');

// v0.06 T1: placeholder townsfolk (role names only, never in the lore: placeholder-names.md). Walkers go from door
// to door round a loop on the green that clears the well, the lamp posts and the lots; two pupils spar and one
// drills outside the dojo; customers trade at the General Store's counter; pairs chat on the green.
// v0.06 T4: a small band (fiddle, drum, pipe) stands by the Projectionist's screen and plays while a reel with
// sound plays. None of them block the player or take input; the interactive NPCs are untouched.
type FolkRole = 'walker' | 'sparring' | 'drill' | 'customer' | 'chat' | 'band';
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
const loopAt = (a: number, out = new THREE.Vector3()) => out.set(GREEN.x + LOOP.rx * Math.sin(a), 0, GREEN.z - LOOP.rz * Math.cos(a));
const loopAngle = (x: number, z: number) => Math.atan2((x - GREEN.x) / LOOP.rx, -(z - GREEN.z) / LOOP.rz);
const lot = (id: TownId) => TOWN_LOTS.find((l) => l.id === id)!;
/** A point in a lot's frame: lx along its front, lz out toward the green from its centre. */
const lotAt = (id: TownId, lx: number, lz: number) => { const L = lot(id), c = Math.cos(L.ry), s = Math.sin(L.ry); return new THREE.Vector3(L.x + lx * c + lz * s, 0, L.z - lx * s + lz * c); };
/** Just in front of a lot's door step, on the green side. */
export const doorStep = (id: TownId) => lotAt(id, 0, lot(id).d / 2 + 1.5);


interface Brain { route: THREE.Vector3[]; i: number; wait: number; at: TownId | null; talkT: number; face: number | null; turn: number; speed: number; linger: number; idlePose: Pose | null }

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
    // Trait rolls: a new crowd every time the game loads (height, build, skin, hair, clothes, pace, habit).
    const run = (Math.random() * 2 ** 31) | 0;
    const add = (name: string, role: FolkRole, pos: THREE.Vector3, yaw: number) => {
      const seed = seedOf(run, n), r = rollTownsfolk(seed);
      const root = OLD_FOLK ? buildFigure(r.look, r.height) : assemble(specFromRoll(seed, r.look, r.height));
      root.position.copy(pos); root.rotation.y = yaw; root.name = 'folk:' + name;
      const f: Folk = { id: 'folk:' + n++, name, role, root, speed: 0, talking: false, pose: null, active: true };
      root.userData.folk = f;
      this.group.add(root);
      this.folk.push(f);
      this.brains.set(f, { route: [], i: 0, wait: 1 + (n % 4), at: null, talkT: (n % 3) * 1.1, face: null, turn: yaw, speed: r.speed, linger: r.wait, idlePose: r.idlePose });
      root.userData.traits = r.v;
      root.userData.look ??= r.look;   // the rolled look, for anything that reads it (assembled folk have no face sheet)
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
  /** For tests: clearance from the fountain and the lots at (x, z). */
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
        if (f.root.visible && f.root.userData.outfitKey) updateLod(f.root, camera.position);   // B57: face details past 20 m
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
      f.pose = b.idlePose;   // a habit: some read at every door
      if (b.face !== null) f.root.rotation.y = turnToward(f.root.rotation.y, b.face, dt * 4);
      if ((b.wait -= dt) > 0) return;
      // Pick another door and plan: out to the loop, round it the short way, in to the door.
      const others = TOWN_LOTS.filter((l) => l.id !== b.at), next = others[Math.floor(Math.random() * others.length)].id;
      b.route = route(p, doorStep(next));
      b.i = 0; b.at = next; b.wait = Math.max(0.5, 3 + Math.random() * 4 + b.linger);
      f.pose = null;
      const L = lot(next); b.face = L.ry + Math.PI;   // at the door, face it (lots face the green)
    }
    const goal = b.route[b.i], dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz), step = b.speed * dt;
    f.speed = b.speed;
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
  // Walk the whole path in half-metre steps and nudge any step that would graze a building in toward the
  // middle of the green, so the path bends round corners (walkers used to clip the Tailor's front corner).
  const pts = [from.clone(), ...out, to.clone()], dense: THREE.Vector3[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], k = Math.max(1, Math.ceil(a.distanceTo(b) / 0.35));
    for (let j = 1; j <= k; j++) dense.push(a.clone().lerp(b, j / k));
  }
  dense.pop();   // the door step itself stays where it is
  // The door step stays put unless something round stands on it (the grindstone, say): then step off it.
  const end = to.clone();
  for (let k = 0, o = nearestRound(end.x, end.z); k < 20 && o && !o.building; k++, o = nearestRound(end.x, end.z)) {
    const d = Math.hypot(o.dx, o.dz) || 1; end.x += o.dx / d * 0.15; end.z += o.dz / d * 0.15;
  }
  // Where the walker stands and the door step are kept as they are; the first and last steps are checked too.
  const path = [from.clone(), ...dense, end];
  clearPath(path, true);
  path.shift();
  return path;

}
/** Standing things put on the green after the town was laid out (the kill statue, a table): walkers go round them.
 *  The game hands over its collider list; only the round, standing-height ones count. */
type Round = { kind: string; x?: number; z?: number; r?: number; top?: number };
let rounds: Round[] = [];
export function setPathObstacles(colliders: Round[]) { rounds = colliders; }
const PATH_GAP = 0.3;
// A building's walls are circles over its lot footprint (town.ts footprint()); they bulge a little past the lot.
// Points near those step out of the lot (pushFromLots), the same way the lot itself pushes, so the two never fight.
const inBuilding = new WeakMap<Round, boolean>();
const isBuilding = (k: Round) => { let b = inBuilding.get(k); if (b === undefined) { b = clearance(k.x!, k.z!).lots < -0.2; inBuilding.set(k, b); } return b; };
function nearestRound(x: number, z: number): { dx: number; dz: number; d: number; building: boolean; k: Round } | null {
  let best: Round | null = null, bd = PATH_GAP;
  for (const k of rounds) {
    if (k.kind !== 'circle' || (k.top !== undefined && k.top < 0.35)) continue;
    const d = Math.hypot(x - k.x!, z - k.z!) - k.r!;
    if (d < bd) { best = k; bd = d; }
  }
  return best && { dx: x - best.x!, dz: z - best.z!, d: bd, building: isBuilding(best), k: best };
}
/** Nudge path points clear of the buildings, the well and anything round standing on the green (in place). */
export function clearPath(pts: THREE.Vector3[], keepEnds = false) {
  // Walls and the well: step each point straight off them. Points on a round thing (a lamp post, the kill statue)
  // are dropped instead: pushed off its centre, the points of a path straight through it would scatter to both
  // sides and the walker would zigzag across it. The gap is bridged below, round one side.
  const e = keepEnds ? 1 : 0;
  for (let i = e; i < pts.length - e; i++) settle(pts[i]);
  for (let i = pts.length - 1 - e; i >= e; i--) { const o = nearestRound(pts[i].x, pts[i].z); if (pts.length > 1 && o && !o.building) pts.splice(i, 1); }
  for (let pass = 0; pass < 30; pass++) {
    let added = false;
    for (let i = pts.length - 1; i > 0; i--) {
      const a = pts[i - 1], b = pts[i], m = detour(a, b);
      if (m) { pts.splice(i, 0, m); added = true; }
    }
    if (!added) break;
  }
}
const ROUND_CLEAR = PATH_GAP + 0.08;
// Round things close enough together that no one fits between them are walked round as one: the circle round them all.
let groups = new WeakMap<Round, Round>(), groupsFor = -1;
function group(k: Round): Round {
  if (groupsFor !== rounds.length) { groups = new WeakMap(); groupsFor = rounds.length; }
  const known = groups.get(k);
  if (known) return known;
  const free = rounds.filter((o) => o.kind === 'circle' && !(o.top !== undefined && o.top < 0.35) && !isBuilding(o));
  const members = [k];
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    for (const o of free) if (!members.includes(o) && Math.hypot(o.x! - m.x!, o.z! - m.z!) < o.r! + m.r! + 2 * PATH_GAP) members.push(o);
  }
  let x = 0, z = 0;
  for (const m of members) { x += m.x! / members.length; z += m.z! / members.length; }
  const g: Round = { kind: 'circle', x, z, r: Math.max(...members.map((m) => Math.hypot(m.x! - x, m.z! - z) + m.r!)) };
  for (const m of members) groups.set(m, g);
  return g;
}
/** If the straight step a to b touches something, a point to go through instead (null when it is clear). */
function detour(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 | null {
  const len = a.distanceTo(b);
  if (len < 0.08) return null;
  let cut: Round | null = null, wall = false;
  // Points sit 0.6 m off the walls; a step between them may come to 0.3 m (room for a detour by a lamp post at a door).
  for (let t = 0.05; t < 0.97; t += 0.05) {
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, o = nearestRound(x, z), c = clearance(x, z);
    if (o && !o.building) { cut = o.k; break; }
    if (c.lots < 0.3 || c.well < 0.4 || o) wall = true;
  }
  if (cut) {
    // Round it (or the whole group it stands in: two benches end to end) on the side the step already passes, the
    // nearest point of the step to its centre; if a wall is there, the other side.
    cut = group(cut);
    const dx = b.x - a.x, dz = b.z - a.z, t = THREE.MathUtils.clamp(((cut.x! - a.x) * dx + (cut.z! - a.z) * dz) / (len * len), 0, 1);
    let ux = a.x + dx * t - cut.x!, uz = a.z + dz * t - cut.z!, n = Math.hypot(ux, uz);
    if (n < 1e-3) { ux = -dz; uz = dx; n = len; }
    ux /= n; uz /= n;
    const at = (s: number) => new THREE.Vector3(cut!.x! + ux * s * (cut!.r! + ROUND_CLEAR), 0, cut!.z! + uz * s * (cut!.r! + ROUND_CLEAR));
    // Off a cluster (two benches side by side), keep stepping out from whichever one it still touches.
    const off = (m: THREE.Vector3) => { for (let k = 0, o = nearestRound(m.x, m.z); k < 40 && o && !o.building; k++, o = nearestRound(m.x, m.z)) { const d = Math.hypot(o.dx, o.dz) || 1; m.x += o.dx / d * 0.1; m.z += o.dz / d * 0.1; } return m; };
    const m = off(at(1)), c = clearance(m.x, m.z);
    if (c.lots < 0.3 || c.well < 0.4) { const o = off(at(-1)), co = clearance(o.x, o.z); if (co.lots >= c.lots && co.well >= 0.4) return o; }
    return m;
  }
  if (!wall) return null;
  const m = a.clone().lerp(b, 0.5); settle(m);
  return m.distanceTo(a) < 0.05 || m.distanceTo(b) < 0.05 ? null : m;
}
/** Step a point straight off a wall or the well (out of a lot, away from the well's centre). */
function settle(p: THREE.Vector3) {
  for (let k = 0; k < 50; k++) {
    const c = clearance(p.x, p.z), o = nearestRound(p.x, p.z);
    if (c.well < 0.5) { const dx = p.x - FOUNTAIN.x, dz = p.z - FOUNTAIN.z, d = Math.hypot(dx, dz) || 1; p.x += dx / d * 0.1; p.z += dz / d * 0.1; }
    else if (c.lots < 0.6 || o?.building) pushFromLots(p, 0.1);
    else return;
  }
}
/** Step a point out of the nearest building's footprint, through its nearest face. */
function pushFromLots(p: THREE.Vector3, step: number) {
  let best: { L: typeof TOWN_LOTS[number]; lx: number; lz: number; m: number } | null = null;
  for (const L of TOWN_LOTS) {
    const c = Math.cos(L.ry), s = Math.sin(L.ry), lx = (p.x - L.x) * c - (p.z - L.z) * s, lz = (p.x - L.x) * s + (p.z - L.z) * c;
    const m = Math.max(Math.abs(lx) - L.w / 2, Math.abs(lz) - L.d / 2);
    if (!best || m < best.m) best = { L, lx, lz, m };
  }
  if (!best) return;
  const { L, lx, lz } = best, c = Math.cos(L.ry), s = Math.sin(L.ry);
  const ux = Math.abs(lx) - L.w / 2 > Math.abs(lz) - L.d / 2 ? Math.sign(lx) || 1 : 0, uz = ux ? 0 : Math.sign(lz) || 1;
  p.x += (ux * c + uz * s) * step; p.z += (-ux * s + uz * c) * step;
}
/** For tests: how close a point comes to the well and to each lot's footprint (negative = inside). */
export function clearance(x: number, z: number) {
  const well = Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) - FOUNTAIN.r;
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
