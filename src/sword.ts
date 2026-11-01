// v0.08 (Mike 2026-11-01): "Add sword for player to swing and damage goblins". The smith's practice sword, taken
// from the stand in front of the smithy. 3 equips it (or the Q / D-pad right weapon cycle: hands → sword →
// crossbow). LMB / RT / the touch Swing button swings: a short arc in front of you that hurts and knocks back
// every goblin in it. Swings chain into a three-hit combo; the third is a heavy cut that can't be turned by a
// pot lid. In the follow view the swing turns you toward the nearest goblin within reach (light aim assist).
// `sharpness` is the hook for B17 gear care (1 = keen; lower = dull, less damage).
import * as THREE from 'three';
import type { Inventory } from './inventory';
import type { Player } from './player';

export const SWING = 0.42;          // seconds per swing
export const STRIKE = 0.15;         // when in the swing the blade connects
export const REACH = 1.75;          // metres from your feet to the tip, plus the goblin's own radius
export const ARC = 1.05;            // half-angle of the cut (about 60° each side)
export const COMBO_WINDOW = 0.55;   // seconds after a swing ends for the next to chain
export const DAMAGE = [2, 2, 3];    // per swing of the combo, before armour and sharpness
const ASSIST = 1.75;                // follow view: turn toward a goblin up to ~100° off your facing

export interface Slash { from: THREE.Vector3; fwd: THREE.Vector3; reach: number; arc: number; damage: number; heavy: boolean }

/** A low-poly arming sword, grip at the origin, blade along +Y (about 0.95 m long). */
export function buildSwordModel(): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: '#C4C8CE' }), edge = new THREE.MeshLambertMaterial({ color: '#E8ECF0' });
  const grip = new THREE.MeshLambertMaterial({ color: '#4A3222' }), brass = new THREE.MeshLambertMaterial({ color: '#B08A3E' });
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, name?: string) => {
    const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; o.raycast = () => {}; if (name) o.name = name; g.add(o); return o;
  };
  part(new THREE.BoxGeometry(0.055, 0.68, 0.014), steel, 0.46, 'blade');
  part(new THREE.BoxGeometry(0.012, 0.68, 0.018), edge, 0.46);        // the fuller's bright line
  const tip = part(new THREE.ConeGeometry(0.039, 0.12, 4), steel, 0.86); tip.scale.z = 0.36; tip.rotation.y = Math.PI / 4;
  part(new THREE.BoxGeometry(0.24, 0.035, 0.05), brass, 0.105);      // cross-guard
  part(new THREE.CylinderGeometry(0.019, 0.022, 0.17, 6), grip, 0.0);
  part(new THREE.SphereGeometry(0.03, 6, 4), brass, -0.1);            // pommel
  return g;
}

const ease = (x: number) => x * x * (3 - 2 * x);

export class Sword {
  equipped = false;
  /** Seconds into the current swing; -1 when not swinging. */
  t = -1;
  /** 1, 2 or 3: which cut of the combo is (or was last) swinging. */
  combo = 0;
  /** B17 hook: 1 = keen. Damage scales with it (at least 1). */
  sharpness = 1;
  swings = 0;
  hits = 0;
  readonly held = buildSwordModel();
  readonly viewmodel = new THREE.Group();
  private chainT = 0;
  private queued = false;
  private struck = false;
  /** Where goblins are, for the follow-view aim assist: their feet. */
  foes: () => THREE.Vector3[] = () => [];
  /** The cut lands: returns how many it hit. */
  slash: ((s: Slash) => number) | null = null;
  onSwing: (heavy: boolean) => void = () => undefined;
  onHit: (n: number, heavy: boolean) => void = () => undefined;
  onChange: () => void = () => undefined;

  constructor(camera: THREE.Camera, private player: Player, private inventory: Inventory) {
    this.held.name = 'held-sword';
    this.held.visible = false;
    this.viewmodel.name = 'sword-viewmodel';
    const vm = buildSwordModel(); vm.scale.setScalar(0.62); this.viewmodel.add(vm);
    this.viewmodel.visible = false;
    camera.add(this.viewmodel);
    this.attach();
  }

  /** In the figure's right hand (again after the forge swaps the figure). */
  attach() {
    const rig = this.player.body.children[0]?.userData.rig as { bones: Record<string, THREE.Bone> } | undefined;
    const bone = rig?.bones.foreN;
    if (!bone) return;
    bone.add(this.held);
    this.held.position.set(-0.03, -0.3, 0.05);
    this.held.rotation.set(Math.PI / 2, 0, 0);   // forearm hanging: the blade points forward
  }
  get owned() { return this.inventory.count('sword') > 0; }
  get swinging() { return this.t >= 0; }
  /** 0..1 through the swing, or null (for the animator). */
  get progress(): number | null { return this.t >= 0 ? Math.min(1, this.t / SWING) : null; }

  equip() { if (!this.owned) return false; this.equipped = true; this.onChange(); return true; }
  unequip() { this.equipped = false; this.t = -1; this.queued = false; this.combo = 0; this.onChange(); }

  /** Start a swing. Pressing again late in a swing queues the next cut of the combo. */
  swing(): boolean {
    if (!this.equipped) return false;
    if (this.t >= 0) { if (this.t > SWING * 0.45) this.queued = true; return false; }
    this.combo = this.chainT > 0 ? (this.combo % 3) + 1 : 1;
    this.t = 0; this.struck = false; this.swings++;
    this.onSwing(this.combo === 3);
    return true;
  }

  update(dt: number) {
    if (this.t >= 0) {
      this.t += dt;
      if (!this.struck && this.t >= STRIKE) { this.struck = true; this.strike(); }
      if (this.t >= SWING) {
        this.t = -1; this.chainT = COMBO_WINDOW;
        if (this.queued) { this.queued = false; this.swing(); }
      }
    } else this.chainT = Math.max(0, this.chainT - dt);
    if (this.chainT <= 0 && this.t < 0) this.combo = 0;
    const first = !this.player.thirdPerson;
    this.held.visible = this.equipped;
    this.viewmodel.visible = this.equipped && first;
    if (this.viewmodel.visible) this.placeViewmodel();
  }

  private strike() {
    const P = this.player, heavy = this.combo === 3;
    // Facing: the view in first person; the body in the follow view, turned toward the nearest goblin in reach.
    let yaw = P.thirdPerson ? P.bodyYaw : P.yaw;
    if (P.thirdPerson) {
      let best = Infinity;
      for (const f of this.foes()) {
        const dx = f.x - P.pos.x, dz = f.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d > REACH + 0.6 || d < 1e-3) continue;
        const a = Math.atan2(-dx, -dz), off = Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)));
        if (off < ASSIST && d < best) { best = d; P.bodyYaw = a; }
      }
      yaw = P.bodyYaw;
    }
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const damage = Math.max(1, Math.round(DAMAGE[this.combo - 1] * this.sharpness));
    const n = this.slash?.({ from: P.pos.clone(), fwd, reach: REACH, arc: ARC, damage, heavy }) ?? 0;
    if (n) { this.hits += n; this.onHit(n, heavy); }
  }

  // First person: the sword rests up and right; a cut sweeps it right-to-left (the third cut comes down overhead).
  private placeViewmodel() {
    const k = this.progress;
    const rest = { x: 0.3, y: -0.28, z: -0.5, rx: -0.35, rz: -0.25 };
    if (k === null) { const v = this.viewmodel; v.position.set(rest.x, rest.y, rest.z); v.rotation.set(rest.rx, 0, rest.rz); return; }
    const heavy = this.combo === 3, flip = this.combo === 2 ? -1 : 1;
    const wind = Math.min(1, k / 0.3), cut = THREE.MathUtils.clamp((k - 0.3) / 0.25, 0, 1), back = THREE.MathUtils.clamp((k - 0.55) / 0.45, 0, 1);
    const L = THREE.MathUtils.lerp;
    // wind-up → cut → recover, each eased
    const from = heavy ? { x: 0.1, y: 0.05, z: -0.45, rx: 0.5, rz: 0 } : { x: 0.42 * flip, y: -0.05, z: -0.42, rx: -0.2, rz: -1.2 * flip };
    const to = heavy ? { x: 0.05, y: -0.45, z: -0.55, rx: -1.5, rz: 0 } : { x: -0.38 * flip, y: -0.3, z: -0.5, rx: -0.9, rz: 1.25 * flip };
    const a = ease(wind), b = ease(cut), c = ease(back);
    const at = (key: keyof typeof rest) => L(L(L(rest[key], from[key], a), to[key], b), rest[key], c);
    this.viewmodel.position.set(at('x'), at('y'), at('z'));
    this.viewmodel.rotation.set(at('rx'), 0, at('rz'));
  }
}
