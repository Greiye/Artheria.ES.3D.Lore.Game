import * as THREE from 'three';
import type { Collider } from '../world/index';
import { storeSet } from '../store';

// Pets (Mike 2026-11-04, "Add pets. Have them be able to join the player."; plan OK'd with "Go").
// PR 1: the farm dog by the inn. Pet it, feed it a bit of bread (the General Store sells it) and it joins you:
// it trots a step behind your right shoulder (Natalie keeps the left), runs when you run, catches up if it is left
// far behind, sits when you stand still and noses about. Talk to it again to tell it to stay, or to come.
// Saved on this device: who you've befriended and who is with you.
export type PetId = 'dog';
export interface PetPrefs { friends: PetId[]; withYou: PetId | null; stayAt: Partial<Record<PetId, [number, number]>> }
const KEY = 'gametool.pets';
export function loadPets(): PetPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { friends: Array.isArray(v.friends) ? v.friends.filter((f: unknown) => f === 'dog') : [], withYou: v.withYou === 'dog' ? 'dog' : null, stayAt: v.stayAt ?? {} };
  } catch { return { friends: [], withYou: null, stayAt: {} }; }
}
export function savePets(p: PetPrefs) { storeSet(KEY, JSON.stringify(p)); }

const WALK = 2.4, RUN = 5.6, KEEP = 1.8;

/** Our own low-poly farm dog: a chunky body, head and snout, floppy ears, four legs and a tail, ~0.55 m at the back. */
function buildDog(): { root: THREE.Group; parts: Record<'body' | 'head' | 'tail' | 'fl' | 'fr' | 'bl' | 'br', THREE.Object3D> } {
  const fur = new THREE.MeshLambertMaterial({ color: 0xA8692E, flatShading: true });
  const pale = new THREE.MeshLambertMaterial({ color: 0xEAD3A8, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3A2414, flatShading: true });
  const box = (w: number, h: number, d: number, m: THREE.Material) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; return o; };
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

export class Pet {
  readonly root: THREE.Group;
  /** Invisible box that follows the dog, for looking at / pressing E (main.ts interactables). */
  readonly hit: THREE.Mesh;
  speed = 0;
  sitting = false;
  private parts: ReturnType<typeof buildDog>['parts'];
  private yaw = 0;
  private t = 0;
  private still = 0;
  private sniff = 0;
  private detour = 0;
  private detourT = 0;
  terrain: (x: number, z: number) => number = () => 0;

  constructor(readonly id: PetId, scene: THREE.Scene, home: THREE.Vector3, homeYaw: number, private colliders: Collider[], private bounds: () => number, readonly prefs: PetPrefs) {
    const d = buildDog();
    this.root = d.root; this.parts = d.parts;
    const at = prefs.stayAt[id];
    this.root.position.set(at ? at[0] : home.x, 0, at ? at[1] : home.z);
    this.yaw = homeYaw; this.root.rotation.y = homeYaw;
    scene.add(this.root);
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.1), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.name = 'pet-hit:' + id;
    scene.add(this.hit);
  }

  get friend() { return this.prefs.friends.includes(this.id); }
  get following() { return this.prefs.withYou === this.id; }
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
        const want = d < 0.3 ? 0 : d > KEEP * 2 ? RUN : Math.min(WALK, d * 1.8);
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
    r.position.y = this.terrain(r.position.x, r.position.z);
    r.rotation.y = this.yaw;
    this.still = moving ? 0 : this.still + dt;
    this.sitting = this.still > 1.5;
    this.animate(dt, moving);
    this.hit.position.set(r.position.x, r.position.y + 0.45, r.position.z);
    this.hit.rotation.y = this.yaw;
  }

  private turnTo(face: number, k: number, dt: number) { this.yaw += Math.atan2(Math.sin(face - this.yaw), Math.cos(face - this.yaw)) * (1 - Math.exp(-k * dt)); }

  private animate(dt: number, moving: boolean) {
    const P = this.parts, t = this.t;
    const gait = moving ? Math.min(1, this.speed / RUN + 0.35) : 0;
    const sw = Math.sin(t * (6 + this.speed * 2.4)) * 0.7 * gait;
    // Sitting folds the back legs and tips the body up; standing straightens it again.
    const sit = this.sitting ? 1 : 0;
    const k = 1 - Math.exp(-6 * dt);
    P.body.rotation.x += (-0.42 * sit - P.body.rotation.x) * k;
    P.body.position.y += ((0.42 - 0.1 * sit + Math.abs(sw) * 0.03) - P.body.position.y) * k;
    P.fl.rotation.x = sw + 0.42 * sit; P.br.rotation.x = sw * 0.9 - 1.1 * sit;
    P.fr.rotation.x = -sw + 0.42 * sit; P.bl.rotation.x = -sw * 0.9 - 1.1 * sit;
    // Tail: wags when it's with you, slower when it's waiting.
    P.tail.rotation.y = Math.sin(t * (this.following ? 14 : 5)) * (this.following ? 0.6 : 0.3);
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
