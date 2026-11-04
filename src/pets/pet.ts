import * as THREE from 'three';
import type { Collider } from '../world/index';
import { storeSet } from '../store';

// Pets (Mike 2026-11-04, "Add pets. Have them be able to join the player."; plan OK'd with "Go").
// Three to befriend, each with its own food: the farm dog by the inn (bread), the barn cat by the General Store (dried
// fish), the little owl at the Ruined Library, out from dusk (jerky), and Shadow, a giant hedgehog the size of a
// dog who snuffles about by the campfire (Mike 2026-11-04: "a giant hedgehog the size of a dog named shadow"; mealworms). Fed, a pet is yours and comes with you: one
// at a time, a step behind your right shoulder (Natalie keeps the left); the owl flies there. It runs when you run,
// finds its way round walls, catches up if left far behind, and sits or perches when you stand still. Talk to a pet
// you've befriended for the pets page (name it, tell it to stay, call another).
// Saved on this device: who you've befriended, their names, who is with you and where the others wait.
export type PetId = 'dog' | 'cat' | 'owl' | 'hedgehog';
export const PET_IDS: PetId[] = ['dog', 'cat', 'owl', 'hedgehog'];
export interface PetPrefs { friends: PetId[]; withYou: PetId | null; stayAt: Partial<Record<PetId, [number, number]>>; names: Partial<Record<PetId, string>> }
const KEY = 'gametool.pets';
const isPet = (f: unknown): f is PetId => PET_IDS.includes(f as PetId);
export function loadPets(): PetPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { friends: Array.isArray(v.friends) ? v.friends.filter(isPet) : [], withYou: isPet(v.withYou) ? v.withYou : null, stayAt: v.stayAt ?? {}, names: v.names ?? {} };
  } catch { return { friends: [], withYou: null, stayAt: {}, names: {} }; }
}
export function savePets(p: PetPrefs) { storeSet(KEY, JSON.stringify(p)); }

/** Each pet: what it is called until you name it, what it eats, and how it moves. */
/** Pets that already have a name (Mike named the hedgehog); you can still rename them. */
const BORN_NAMES: Partial<Record<PetId, string>> = { hedgehog: 'Shadow' };
export const SPECIES: Record<PetId, { kind: string; food: string; foodName: string; fly: boolean; walk: number; run: number }> = {
  dog: { kind: 'dog', food: 'bread', foodName: 'bread', fly: false, walk: 2.4, run: 5.6 },
  cat: { kind: 'cat', food: 'fish', foodName: 'dried fish', fly: false, walk: 2.2, run: 5.8 },
  owl: { kind: 'owl', food: 'jerky', foodName: 'jerky', fly: true, walk: 3.2, run: 6.4 },
  hedgehog: { kind: 'hedgehog', food: 'mealworms', foodName: 'mealworms', fly: false, walk: 2.0, run: 5.0 },
};

const KEEP = 1.8;
type Parts = Record<'body' | 'head' | 'tail' | 'fl' | 'fr' | 'bl' | 'br', THREE.Object3D> & { wl?: THREE.Object3D; wr?: THREE.Object3D };
const box = (w: number, h: number, d: number, m: THREE.Material) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; return o; };
const lambert = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

/** Our own low-poly farm dog: a chunky body, head and snout, floppy ears, four legs and a tail, ~0.55 m at the back. */
function buildDog(): { root: THREE.Group; parts: Parts } {
  const fur = new THREE.MeshLambertMaterial({ color: 0xA8692E, flatShading: true });
  const pale = new THREE.MeshLambertMaterial({ color: 0xEAD3A8, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3A2414, flatShading: true });
  const root = new THREE.Group(); root.name = 'pet:dog';
  const body = new THREE.Group(); body.position.y = 0.42; root.add(body);
  const torso = box(0.32, 0.28, 0.66, fur); body.add(torso);
  const chest = box(0.26, 0.2, 0.2, pale); chest.position.set(0, -0.06, 0.26); body.add(chest);
  const head = new THREE.Group(); head.position.set(0, 0.2, 0.36); body.add(head);
  const skull = box(0.26, 0.24, 0.26, fur); head.add(skull);
  const snout = box(0.15, 0.12, 0.17, pale); snout.position.set(0, -0.05, 0.19); head.add(snout);
  const nose = box(0.07, 0.05, 0.04, dark); nose.position.set(0, -0.01, 0.28); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = box(0.07, 0.16, 0.11, dark); ear.position.set(s * 0.15, 0.02, -0.02); ear.rotation.z = s * 0.25; head.add(ear);
    const eye = box(0.04, 0.04, 0.02, dark); eye.position.set(s * 0.07, 0.04, 0.135); head.add(eye);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.1, -0.33); body.add(tail);
  const tailMesh = box(0.06, 0.06, 0.26, fur); tailMesh.position.z = -0.12; tail.add(tailMesh); tail.rotation.x = -0.6;
  const leg = (x: number, z: number) => {
    const g = new THREE.Group(); g.position.set(x, -0.1, z); body.add(g);
    const l = box(0.09, 0.32, 0.09, fur); l.position.y = -0.16; g.add(l);
    const paw = box(0.1, 0.05, 0.12, pale); paw.position.set(0, -0.3, 0.02); g.add(paw);
    return g;
  };
  return { root, parts: { body, head, tail, fl: leg(-0.11, 0.24), fr: leg(0.11, 0.24), bl: leg(-0.11, -0.24), br: leg(0.11, -0.24) } };
}

/** Our own low-poly barn cat: slim and low, pointed ears, a long tail held up; grey tabby with a pale chest. */
function buildCat(): { root: THREE.Group; parts: Parts } {
  const fur = lambert(0x8A8580), pale = lambert(0xEDE6DA), dark = lambert(0x3C3836), eyeM = lambert(0xC9B23A);
  const root = new THREE.Group(); root.name = 'pet:cat';
  const body = new THREE.Group(); body.position.y = 0.27; root.add(body);
  body.add(box(0.2, 0.18, 0.46, fur));
  const stripe = box(0.21, 0.04, 0.3, dark); stripe.position.set(0, 0.08, -0.02); body.add(stripe);
  const chest = box(0.16, 0.12, 0.1, pale); chest.position.set(0, -0.03, 0.2); body.add(chest);
  const head = new THREE.Group(); head.position.set(0, 0.13, 0.26); body.add(head);
  head.add(box(0.19, 0.16, 0.16, fur));
  const muzzle = box(0.1, 0.06, 0.05, pale); muzzle.position.set(0, -0.04, 0.09); head.add(muzzle);
  for (const sd of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 4), fur); ear.position.set(sd * 0.06, 0.11, -0.01); ear.rotation.y = Math.PI / 4; ear.castShadow = true; head.add(ear);
    const eye = box(0.035, 0.03, 0.02, eyeM); eye.position.set(sd * 0.05, 0.02, 0.085); head.add(eye);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.06, -0.23); body.add(tail);
  const tm = box(0.045, 0.045, 0.36, fur); tm.position.z = -0.17; tail.add(tm); tail.rotation.x = -1.0;
  const leg = (x: number, z: number) => {
    const g = new THREE.Group(); g.position.set(x, -0.06, z); body.add(g);
    const l = box(0.06, 0.21, 0.06, fur); l.position.y = -0.1; g.add(l);
    const paw = box(0.065, 0.03, 0.08, pale); paw.position.set(0, -0.2, 0.01); g.add(paw);
    return g;
  };
  return { root, parts: { body, head, tail, fl: leg(-0.07, 0.17), fr: leg(0.07, 0.17), bl: leg(-0.07, -0.17), br: leg(0.07, -0.17) } };
}

/** Our own low-poly little owl: a round brown body, big pale face disc and eyes, two wings and small feet. */
function buildOwl(): { root: THREE.Group; parts: Parts } {
  const fur = lambert(0x7A5A3A), pale = lambert(0xE8D8B8), dark = lambert(0x2A2018), eyeM = lambert(0xF2C230), beakM = lambert(0xB89A5A);
  const root = new THREE.Group(); root.name = 'pet:owl';
  const body = new THREE.Group(); body.position.y = 0.2; root.add(body);
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), fur); torso.scale.set(1, 1.25, 0.95); torso.castShadow = true; body.add(torso);
  const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), pale); belly.scale.set(1, 1.2, 0.5); belly.position.set(0, -0.03, 0.08); body.add(belly);
  const head = new THREE.Group(); head.position.set(0, 0.2, 0.01); body.add(head);
  const skull = box(0.22, 0.17, 0.18, fur); head.add(skull);
  const face = box(0.18, 0.12, 0.02, pale); face.position.set(0, -0.005, 0.09); head.add(face);
  for (const sd of [-1, 1]) {
    const eye = box(0.05, 0.05, 0.02, eyeM); eye.position.set(sd * 0.045, 0.01, 0.1); head.add(eye);
    const pupil = box(0.022, 0.022, 0.01, dark); pupil.position.set(sd * 0.045, 0.01, 0.112); head.add(pupil);
    const tuft = box(0.04, 0.06, 0.04, fur); tuft.position.set(sd * 0.09, 0.1, 0); tuft.rotation.z = -sd * 0.4; head.add(tuft);
  }
  const beak = box(0.03, 0.04, 0.03, beakM); beak.position.set(0, -0.04, 0.105); head.add(beak);
  const wing = (sd: number) => {
    const g = new THREE.Group(); g.position.set(sd * 0.14, 0.06, -0.01); body.add(g);
    const w = box(0.03, 0.2, 0.17, fur); w.position.set(sd * 0.01, -0.08, 0); g.add(w);
    return g;
  };
  const tail = new THREE.Group(); tail.position.set(0, -0.14, -0.12); body.add(tail);
  const tm = box(0.1, 0.03, 0.1, dark); tm.position.z = -0.03; tail.add(tm);
  const foot = (x: number) => { const g = new THREE.Group(); g.position.set(x, -0.17, 0.04); body.add(g); const f = box(0.05, 0.03, 0.06, beakM); f.position.y = -0.015; g.add(f); return g; };
  const none = () => { const g = new THREE.Group(); body.add(g); return g; };
  return { root, parts: { body, head, tail, fl: foot(-0.05), fr: foot(0.05), bl: none(), br: none(), wl: wing(-1), wr: wing(1) } };
}
/** Our own low-poly Shadow: a giant hedgehog the size of the dog. A round body under a coat of dark spines (low
 *  four-sided cones in rows), a pale pointed face with a black nose and beady eyes, and four short legs. */
function buildHedgehog(): { root: THREE.Group; parts: Parts } {
  const spine = lambert(0x3A3430), tip = lambert(0x8C8070), face = lambert(0xC8AE8A), dark = lambert(0x161210);
  const root = new THREE.Group(); root.name = 'pet:hedgehog';
  root.scale.setScalar(0.82);   // built roomy, shown the dog's size
  const body = new THREE.Group(); body.position.y = 0.36; root.add(body);
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), spine); core.scale.set(1, 0.78, 1.25); core.castShadow = true; body.add(core);
  const belly = box(0.4, 0.12, 0.6, face); belly.position.y = -0.2; body.add(belly);
  // Spines: rows of cones over the back, pointing out and back, pale-tipped every other row.
  const cone = new THREE.ConeGeometry(0.05, 0.2, 4);
  for (let row = 0; row < 5; row++) for (let i = 0; i < 7; i++) {
    const a = -1.1 + (i / 6) * 2.2, z = 0.22 - row * 0.12, up = 0.2 + Math.cos(a) * 0.06 - row * 0.005;
    const c = new THREE.Mesh(cone, row % 2 ? tip : spine);
    c.position.set(Math.sin(a) * 0.3, Math.cos(a) * up, z - 0.05);
    c.rotation.set(-0.9 - row * 0.12, 0, -a * 0.9);
    c.castShadow = true; body.add(c);
  }
  const head = new THREE.Group(); head.position.set(0, -0.02, 0.4); body.add(head);
  const skull = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 5), face); skull.rotation.x = Math.PI / 2; skull.position.z = 0.08; skull.castShadow = true; head.add(skull);
  const nose = box(0.06, 0.05, 0.05, dark); nose.position.set(0, 0, 0.25); head.add(nose);
  for (const sd of [-1, 1]) {
    const eye = box(0.04, 0.04, 0.03, dark); eye.position.set(sd * 0.08, 0.06, 0.06); head.add(eye);
    const ear = box(0.05, 0.05, 0.03, face); ear.position.set(sd * 0.12, 0.12, -0.02); head.add(ear);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0, -0.42); body.add(tail);
  const leg = (x: number, z: number) => {
    const g = new THREE.Group(); g.position.set(x, -0.18, z); body.add(g);
    const l = box(0.1, 0.18, 0.1, face); l.position.y = -0.08; g.add(l);
    const paw = box(0.11, 0.04, 0.13, dark); paw.position.set(0, -0.17, 0.02); g.add(paw);
    return g;
  };
  return { root, parts: { body, head, tail, fl: leg(-0.17, 0.22), fr: leg(0.17, 0.22), bl: leg(-0.17, -0.22), br: leg(0.17, -0.22) } };
}
const BUILD: Record<PetId, () => { root: THREE.Group; parts: Parts }> = { dog: buildDog, cat: buildCat, owl: buildOwl, hedgehog: buildHedgehog };

export class Pet {
  readonly root: THREE.Group;
  /** Invisible box that follows the dog, for looking at / pressing E (main.ts interactables). */
  readonly hit: THREE.Mesh;
  speed = 0;
  sitting = false;
  private parts: Parts;
  private fly = 0;   // the owl: 0 perched, 1 flying at shoulder height
  /** Only out at dusk and by night until befriended (the owl); main sets it. */
  shown: () => boolean = () => true;
  private yaw = 0;
  private t = 0;
  private still = 0;
  private sniff = 0;
  private detour = 0;
  private detourT = 0;
  terrain: (x: number, z: number) => number = () => 0;

  constructor(readonly id: PetId, scene: THREE.Scene, home: THREE.Vector3, homeYaw: number, private colliders: Collider[], private bounds: () => number, readonly prefs: PetPrefs) {
    const d = BUILD[id]();
    this.root = d.root; this.parts = d.parts;
    const at = prefs.stayAt[id];
    this.root.position.set(at ? at[0] : home.x, 0, at ? at[1] : home.z);
    this.yaw = homeYaw; this.root.rotation.y = homeYaw;
    scene.add(this.root);
    const hs = id === 'dog' || id === 'hedgehog' ? 1 : 0.75;
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(0.9 * hs, 0.9 * hs, 1.1 * hs), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.name = 'pet-hit:' + id;
    scene.add(this.hit);
  }

  get friend() { return this.prefs.friends.includes(this.id); }
  get following() { return this.prefs.withYou === this.id; }
  get sp() { return SPECIES[this.id]; }
  /** Its name, once you've given it one; otherwise "the dog". */
  get name() { return this.prefs.names[this.id] || BORN_NAMES[this.id] || ''; }
  get label() { return this.name || 'the ' + this.sp.kind; }
  rename(n: string) { const t = n.trim().slice(0, 24); if (t) this.prefs.names[this.id] = t; else delete this.prefs.names[this.id]; savePets(this.prefs); }
  get pos() { return this.root.position; }

  /** Fed: it's yours, and it comes with you. */
  befriend() {
    if (!this.friend) this.prefs.friends.push(this.id);
    this.follow(true);
  }
  follow(on: boolean) {
    this.prefs.withYou = on ? this.id : this.prefs.withYou === this.id ? null : this.prefs.withYou;
    if (on) delete this.prefs.stayAt[this.id]; else this.prefs.stayAt[this.id] = [+this.pos.x.toFixed(2), +this.pos.z.toFixed(2)];
    savePets(this.prefs);
  }
  /** Put it beside the player (a door into the dungeon and back). */
  placeNear(p: THREE.Vector3, dx = -1.2, dz = 1.0) { this.root.position.set(p.x + dx, p.y, p.z + dz); }

  update(dt: number, player: THREE.Vector3, playerYaw: number, frozen: boolean) {
    this.t += dt;
    const r = this.root;
    let moving = false;
    if (this.following && !frozen) {
      // A step behind the player's right shoulder.
      const goal = new THREE.Vector3(player.x - Math.sin(playerYaw) * 1.3 + Math.cos(playerYaw) * 0.9, 0, player.z - Math.cos(playerYaw) * 1.3 - Math.sin(playerYaw) * 0.9);
      const dx = goal.x - r.position.x, dz = goal.z - r.position.z, d = Math.hypot(dx, dz);
      const far = Math.hypot(player.x - r.position.x, player.z - r.position.z);
      if (far > 30) { r.position.set(goal.x, 0, goal.z); this.speed = 0; }   // left behind (teleport, respawn)
      else {
        const want = d < 0.3 ? 0 : d > KEEP * 2 ? this.sp.run : Math.min(this.sp.walk, d * 1.8);
        this.speed += (want - this.speed) * (1 - Math.exp(-8 * dt));
        if (d > 0.05 && this.speed > 0.05) {
          // Head for the goal, or round whatever blocked the last step (a wall, a cart): angle off to one side for a
          // moment and try the other side if that doesn't help either.
          const step = Math.min(d, this.speed * dt), head = Math.atan2(dx, dz) + this.detour;
          const was = r.position.clone();
          r.position.x += Math.sin(head) * step; r.position.z += Math.cos(head) * step;
          this.pushOut(r.position);
          const gained = Math.hypot(goal.x - was.x, goal.z - was.z) - Math.hypot(goal.x - r.position.x, goal.z - r.position.z);
          this.detourT -= dt;
          if (gained < step * 0.25 && this.detourT <= 0) { this.detour = this.detour > 0 ? -1.2 : this.detour < 0 ? 0 : 1.2; this.detourT = 0.6; }
          else if (this.detourT <= -0.6) this.detour = 0;
          this.turnTo(head, 10, dt);
          moving = this.speed > 0.2;
        } else this.turnTo(Math.atan2(player.x - r.position.x, player.z - r.position.z), 4, dt);
      }
      this.pushOut(r.position);
    } else {
      this.speed *= Math.exp(-8 * dt);
      // Waiting: turn to watch the player when they come near.
      const near = Math.hypot(player.x - r.position.x, player.z - r.position.z) < 6;
      if (near) this.turnTo(Math.atan2(player.x - r.position.x, player.z - r.position.z), 3, dt);
    }
    this.still = moving ? 0 : this.still + dt;
    this.sitting = this.still > 1.5;
    // The owl flies at shoulder height while it's with you and you're on the move, and lands when you stop.
    if (this.sp.fly) this.fly += ((this.following && !this.sitting ? 1 : 0) - this.fly) * (1 - Math.exp(-3 * dt));
    r.position.y = this.terrain(r.position.x, r.position.z) + this.fly * (1.5 + Math.sin(this.t * 2.2) * 0.08);
    r.rotation.y = this.yaw;
    r.visible = this.friend || this.shown();
    this.animate(dt, moving);
    this.hit.position.set(r.position.x, r.position.y + 0.45 * (this.id === 'dog' || this.id === 'hedgehog' ? 1 : 0.6), r.position.z);
    this.hit.rotation.y = this.yaw;
  }

  private turnTo(face: number, k: number, dt: number) { this.yaw += Math.atan2(Math.sin(face - this.yaw), Math.cos(face - this.yaw)) * (1 - Math.exp(-k * dt)); }

  private animate(dt: number, moving: boolean) {
    const P = this.parts, t = this.t;
    if (this.sp.fly) {
      // Wings beat in flight and fold when perched; the head turns about, as owls' do.
      const flap = this.fly > 0.3 ? Math.sin(t * 16) * 0.9 * this.fly : 0;
      if (P.wl && P.wr) { P.wl.rotation.z = -flap - 0.1; P.wr.rotation.z = flap + 0.1; }
      P.body.rotation.x = this.fly * 0.25;
      P.head.rotation.y = this.fly > 0.3 ? 0 : Math.sin(t * 0.7) > 0.6 ? 1.1 : Math.sin(t * 0.7) < -0.7 ? -1.1 : 0;
      return;
    }
    const gait = moving ? Math.min(1, this.speed / this.sp.run + 0.35) : 0;
    const sw = Math.sin(t * (6 + this.speed * 2.4)) * 0.7 * gait;
    // Sitting folds the back legs and tips the body up; standing straightens it again.
    const sit = this.sitting ? 1 : 0;
    const k = 1 - Math.exp(-6 * dt);
    P.body.rotation.x += (-0.42 * sit - P.body.rotation.x) * k;
    const base = this.id === 'cat' ? 0.27 : this.id === 'hedgehog' ? 0.36 : 0.42;
    P.body.position.y += ((base - base * 0.24 * sit + Math.abs(sw) * 0.03) - P.body.position.y) * k;
    P.fl.rotation.x = sw + 0.42 * sit; P.br.rotation.x = sw * 0.9 - 1.1 * sit;
    P.fr.rotation.x = -sw + 0.42 * sit; P.bl.rotation.x = -sw * 0.9 - 1.1 * sit;
    // Tail: wags when it's with you, slower when it's waiting.
    // (the cat's sways slowly, held high)
    P.tail.rotation.y = this.id === 'cat' ? Math.sin(t * 1.6) * 0.5 : Math.sin(t * (this.following ? 14 : 5)) * (this.following ? 0.6 : 0.3);
    // Nosing about now and then while standing; looks up while sitting.
    if (!moving && !this.sitting) { this.sniff += dt; } else this.sniff = 0;
    const nose = !moving && !this.sitting && Math.sin(this.sniff * 1.3) > 0.3 ? -0.45 + Math.sin(t * 9) * 0.05 : this.sitting ? 0.25 : 0;
    P.head.rotation.x += (-nose - P.head.rotation.x) * k;
  }

  private pushOut(p: THREE.Vector3) {
    const R = 0.3;
    for (const c of this.colliders) {
      if (c.kind === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + R;
        if (d < m && d > 1e-4) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; }
      } else if (c.kind === 'box') {
        if (p.x > c.minX - R && p.x < c.maxX + R && p.z > c.minZ - R && p.z < c.maxZ + R) {
          const ex = [c.minX - R - p.x, c.maxX + R - p.x], ez = [c.minZ - R - p.z, c.maxZ + R - p.z];
          const bx = Math.abs(ex[0]) < Math.abs(ex[1]) ? ex[0] : ex[1], bz = Math.abs(ez[0]) < Math.abs(ez[1]) ? ez[0] : ez[1];
          if (Math.abs(bx) < Math.abs(bz)) p.x += bx; else p.z += bz;
        }
      }
    }
    const b = this.bounds() - 1;
    p.x = Math.max(-b, Math.min(b, p.x)); p.z = Math.max(-b, Math.min(b, p.z));
  }
}
