// Mike 2026-11-05: rocks and slings, in either hand (or both). Rocks are picked up off rock piles and stack in the
// bag. With rocks in hand, the hand's button throws one in an arc: light, short, it staggers a goblin. With a sling,
// hold the button to whirl it (up to 1.2 s: the longer, the farther and harder) and let go to loose a rock. No
// reload bar: the next rock is in the pouch. A whirled shot outranges a throw and, fully wound, hits about as hard
// as a bolt. Thrown and slung rocks fly with gravity, hit goblins, and lie where they land to be picked up again.
import * as THREE from 'three';
import { flightStep, flightSlices } from './physics/projectile';
import type { Inventory } from './inventory';
import type { Player } from './player';

export type ThrowKind = 'rock' | 'sling';
const SPIN_MAX = 1.2;   // seconds to whirl a sling to full
const ROCK_FLIGHT = { gravity: 1, reach: 0.1, ground: 0.04 };
const ROCK_GEO = new THREE.IcosahedronGeometry(0.045, 0);
const ROCK_MAT = new THREE.MeshLambertMaterial({ color: '#8C8780' });
const STICK_SECONDS = 25;

export interface Rock { mesh: THREE.Mesh; vel: THREE.Vector3; landed: boolean; age: number; damage: number }
/** Living targets: the nearest one a step passes through, and what a hit does. */
export type ThrowTargets = (from: THREE.Vector3, dir: THREE.Vector3, len: number) => { dist: number; hit: (damage: number, dir: THREE.Vector3) => boolean } | null;

function heldModel(kind: ThrowKind): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'rock') {
    const r = new THREE.Mesh(ROCK_GEO, ROCK_MAT); r.scale.setScalar(1.3); g.add(r);
  } else {
    const leather = new THREE.MeshLambertMaterial({ color: '#7A5634' }), cord = new THREE.MeshLambertMaterial({ color: '#C8B48A' });
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), leather); pouch.scale.set(1, 0.6, 1); pouch.position.y = -0.32; pouch.name = 'pouch'; g.add(pouch);
    for (const x of [-0.03, 0.03]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.32, 0.008), cord); c.position.set(x, -0.16, 0); g.add(c); }
  }
  g.traverse((o) => { (o as THREE.Mesh).raycast = () => {}; });
  return g;
}

export class Thrower {
  equipped = false;
  kind: ThrowKind = 'rock';
  side: 1 | -1 = 1;
  /** Seconds the sling has been whirling (-1: not). */
  spin = -1;
  throws = 0;
  readonly held = new THREE.Group();
  readonly viewmodel = new THREE.Group();
  /** Shared by both hands: rocks in flight and lying about. */
  static readonly rocks: Rock[] = [];
  /** F1 the heavy stone: extra damage on every rock (both hands). */
  static bonus = 0;
  onThrow: (kind: ThrowKind, power: number) => void = () => undefined;
  private recoil = 0;

  constructor(private scene: THREE.Scene, camera: THREE.Camera, private player: Player, private inventory: Inventory) {
    this.held.name = 'held-thrower'; this.viewmodel.name = 'thrower-viewmodel';
    this.held.visible = this.viewmodel.visible = false;
    camera.add(this.viewmodel);
    this.build();
  }
  private build() {
    this.held.clear(); this.viewmodel.clear();
    this.held.add(heldModel(this.kind));
    const v = heldModel(this.kind); v.scale.setScalar(0.8); this.viewmodel.add(v);
    this.attach();
  }
  setKind(kind: ThrowKind) { if (kind === this.kind) return; this.kind = kind; this.spin = -1; this.build(); }
  setSide(side: 1 | -1) { if (side === this.side) return; this.side = side; this.attach(); }
  attach() {
    const rig = this.player.body.children[0]?.userData.rig as { bones: Record<string, THREE.Bone> } | undefined;
    const bone = this.side > 0 ? rig?.bones.foreN : rig?.bones.foreP;
    if (!bone) return;
    bone.add(this.held);
    this.held.position.set(-0.02 * this.side, -0.3, 0.04);
  }
  get rocksLeft() { return this.inventory.count('rock'); }
  /** 0..1, how far the sling is wound. */
  get power() { return this.spin < 0 ? 0 : Math.min(1, this.spin / SPIN_MAX); }

  /** The hand's button went down: throw a rock, or start whirling the sling. */
  press(): boolean {
    if (!this.equipped) return false;
    if (this.rocksLeft < 1) return false;
    if (this.kind === 'rock') { this.loose(0.35, 13, 0.5); return true; }
    if (this.spin < 0) this.spin = 0;
    return true;
  }
  /** The button came up: a whirling sling looses its rock. */
  release() {
    if (!this.equipped || this.kind !== 'sling' || this.spin < 0) return;
    const p = Math.max(0.15, this.power);
    this.spin = -1;
    if (this.rocksLeft < 1) return;
    this.loose(p, 14 + 22 * p, 0.45 + 0.75 * p);   // up to 36 m/s and 1.2 (a bolt's 1)
  }
  cancel() { this.spin = -1; }

  private loose(power: number, speed: number, damage: number) {
    if (!this.inventory.take('rock', 1)) return;
    const P = this.player, dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(P.pitch + 0.06, P.thirdPerson ? P.bodyYaw : P.yaw, 0, 'YXZ'));
    const start = P.eyePos.clone().addScaledVector(dir, 0.4); start.x += Math.cos(P.yaw) * 0.15 * this.side;
    const mesh = new THREE.Mesh(ROCK_GEO, ROCK_MAT); mesh.position.copy(start); mesh.castShadow = true;
    this.scene.add(mesh);
    Thrower.rocks.push({ mesh, vel: dir.multiplyScalar(speed), landed: false, age: 0, damage: damage + Thrower.bonus });
    this.throws++; this.recoil = 0.25;
    this.onThrow(this.kind, power);
  }

  /** The lying rock under the crosshair within reach, if any. */
  static rockAt(origin: THREE.Vector3, dir: THREE.Vector3, reach: number): Rock | null {
    let best: Rock | null = null, bd = Infinity;
    for (const r of Thrower.rocks) {
      if (!r.landed) continue;
      const to = r.mesh.position.clone().sub(origin), t = to.dot(dir);
      if (t < 0 || t > reach) continue;
      const off = to.addScaledVector(dir, -t).length();
      if (off < 0.35 && t < bd) { bd = t; best = r; }
    }
    return best;
  }
  static pickUp(r: Rock, inventory: Inventory) {
    r.mesh.removeFromParent();
    Thrower.rocks.splice(Thrower.rocks.indexOf(r), 1);
    inventory.give('rock', 1);
  }

  /** Flight for every rock (call once a frame, from one of the pair). */
  static fly(dt: number, solids: THREE.Object3D[], terrain: (x: number, z: number) => number, targets: ThrowTargets | null) {
    const world = { solids, terrain, foes: targets };
    for (const r of [...Thrower.rocks]) {
      r.age += dt;
      if (r.landed) { if (r.age > STICK_SECONDS) { r.mesh.removeFromParent(); Thrower.rocks.splice(Thrower.rocks.indexOf(r), 1); } continue; }
      const pos = r.mesh.position;
      flightSlices(dt, (h) => {
        const f = flightStep(pos, r.vel, h, world, ROCK_FLIGHT);
        if (f.kind === 'fly') return;
        if (f.kind === 'foe') {
          f.foe.hit(r.damage, f.dir);
          pos.copy(f.from).addScaledVector(f.dir, f.foe.dist);
          r.vel.set(-f.dir.x * 1.5, 1, -f.dir.z * 1.5);   // it bounces off
        } else if (f.kind === 'solid') {   // a wall or the ground: a slow rock settles there, a fast one bounces back weakly
          pos.copy(f.point).addScaledVector(f.dir, -0.06);
          if (r.vel.length() < 4 || f.dir.y < -0.5) { r.landed = true; r.age = 0; }
          else r.vel.set(-r.vel.x * 0.2, 0, -r.vel.z * 0.2);
        } else { r.landed = true; r.age = 0; }
        return false;   // one event a frame, as before
      });
      if (!r.landed && r.age > 6) { r.mesh.removeFromParent(); Thrower.rocks.splice(Thrower.rocks.indexOf(r), 1); }
    }
  }

  update(dt: number, firstPerson: boolean, pose: boolean) {
    if (this.spin >= 0) this.spin += dt;
    this.recoil = Math.max(0, this.recoil - dt);
    const show = this.equipped && !pose && (this.kind === 'sling' || this.rocksLeft > 0);
    this.held.visible = show;
    this.viewmodel.visible = show && firstPerson;
    // The sling whirls round its hand while winding; the pouch swings out.
    const whirl = this.spin >= 0 ? this.spin * (8 + 10 * this.power) : 0;
    this.held.rotation.set(Math.PI / 2 + (this.spin >= 0 ? Math.sin(whirl) * 0.9 : 0), 0, this.spin >= 0 ? Math.cos(whirl) * 0.9 : 0);
    if (!this.viewmodel.visible) return;
    const s = this.side, k = this.recoil / 0.25;
    this.viewmodel.position.set(0.3 * s, -0.26 + (this.spin >= 0 ? 0.12 : 0) + k * 0.06, -0.5 - k * 0.1);
    this.viewmodel.rotation.set(this.spin >= 0 ? whirl : 0.2, 0, -0.2 * s);
  }
}
