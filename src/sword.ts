// v0.08 (Mike 2026-11-01): "Add sword for player to swing and damage goblins". The smith's practice sword, taken
// from the stand in front of the smithy. 3 equips it (or the Q / D-pad right weapon cycle: hands → sword →
// crossbow). LMB / RT / the touch Swing button swings: a short arc in front of you that hurts and knocks back
// every goblin in it. Swings chain into a three-hit combo; the third is a heavy cut that can't be turned by a
// pot lid. In the follow view the swing turns you toward the nearest goblin within reach (light aim assist).
// `sharpness` is the hook for B17 gear care (1 = keen; lower = dull, less damage).
import * as THREE from 'three';
import type { Inventory } from './inventory';
import type { Player } from './player';

// Mike 2026-11-05: the same hand weapon in four kinds. swing: seconds per swing; strike: when in it the blow lands;
// reach: metres from your feet (plus the goblin's own radius); arc: half-angle of the cut; damage: per blow of the
// three-blow combo, before armour and sharpness; heavy: which blows go through a pot lid; thrust: a straight jab.
export type MeleeKind = 'sword' | 'dagger' | 'mace' | 'spear';
export const MELEE: Record<MeleeKind, { swing: number; strike: number; reach: number; arc: number; damage: number[]; heavy: boolean[]; thrust: boolean; knock: number }> = {
  sword: { swing: 0.42, strike: 0.15, reach: 1.75, arc: 1.05, damage: [2, 2, 3], heavy: [false, false, true], thrust: false, knock: 1 },
  dagger: { swing: 0.22, strike: 0.08, reach: 1.3, arc: 0.8, damage: [1, 1, 2], heavy: [false, false, false], thrust: false, knock: 0.6 },
  mace: { swing: 0.62, strike: 0.26, reach: 1.6, arc: 0.9, damage: [3, 3, 4], heavy: [true, true, true], thrust: false, knock: 1.6 },
  spear: { swing: 0.5, strike: 0.2, reach: 2.6, arc: 0.35, damage: [2, 2, 3], heavy: [false, false, true], thrust: true, knock: 1.2 },
};
const COMBO_WINDOW = 0.55;   // seconds after a swing ends for the next to chain
const ASSIST = 1.75;                // follow view: turn toward a goblin up to ~100° off your facing

interface Slash { from: THREE.Vector3; fwd: THREE.Vector3; reach: number; arc: number; damage: number; heavy: boolean }

/** A low-poly hand weapon, grip at the origin, along +Y. */
function buildMelee(kind: MeleeKind): THREE.Group {
  if (kind === 'sword') return buildSwordModel();
  const g = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: '#C4C8CE' }), iron = new THREE.MeshLambertMaterial({ color: '#6E7276' });
  const wood = new THREE.MeshLambertMaterial({ color: '#6A4A2E' }), grip = new THREE.MeshLambertMaterial({ color: '#4A3222' });
  steel.userData.steel = true; iron.userData.steel = true;
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, y: number) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; o.raycast = () => {}; g.add(o); return o; };
  if (kind === 'dagger') {
    part(new THREE.BoxGeometry(0.04, 0.26, 0.012), steel, 0.2);
    const tip = part(new THREE.ConeGeometry(0.028, 0.07, 4), steel, 0.365); tip.scale.z = 0.4; tip.rotation.y = Math.PI / 4;
    part(new THREE.BoxGeometry(0.12, 0.025, 0.035), iron, 0.06);
    part(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 6), grip, -0.01);
  } else if (kind === 'mace') {
    part(new THREE.CylinderGeometry(0.02, 0.024, 0.62, 6), wood, 0.22);
    part(new THREE.IcosahedronGeometry(0.085, 0), iron, 0.56);
    for (let i = 0; i < 6; i++) { const f = part(new THREE.BoxGeometry(0.02, 0.12, 0.05), iron, 0.56); f.rotation.y = (i / 6) * Math.PI * 2; f.translateZ(0.075); }
  } else {
    part(new THREE.CylinderGeometry(0.017, 0.02, 1.7, 6), wood, 0.45);
    const head = part(new THREE.ConeGeometry(0.04, 0.22, 4), steel, 1.41); head.scale.z = 0.4;
    part(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6), iron, 1.29);
  }
  return g;
}
/** A low-poly arming sword, grip at the origin, blade along +Y (about 0.95 m long). */
function buildSwordModel(): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: '#C4C8CE' }), edge = new THREE.MeshLambertMaterial({ color: '#E8ECF0' });
  const grip = new THREE.MeshLambertMaterial({ color: '#4A3222' }), brass = new THREE.MeshLambertMaterial({ color: '#B08A3E' });
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, name?: string) => {
    const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; o.raycast = () => {}; if (name) o.name = name; g.add(o); return o;
  };
  part(new THREE.BoxGeometry(0.055, 0.68, 0.014), steel, 0.46, 'blade');
  part(new THREE.BoxGeometry(0.012, 0.68, 0.018), edge, 0.46, 'edge');   // the fuller's bright line
  steel.userData.steel = true; edge.userData.edge = true;
  const tip = part(new THREE.ConeGeometry(0.039, 0.12, 4), steel, 0.86); tip.scale.z = 0.36; tip.rotation.y = Math.PI / 4;
  part(new THREE.BoxGeometry(0.24, 0.035, 0.05), brass, 0.105);      // cross-guard
  part(new THREE.CylinderGeometry(0.019, 0.022, 0.17, 6), grip, 0.0);
  part(new THREE.SphereGeometry(0.03, 6, 4), brass, -0.1);            // pommel
  return g;
}

const ease = (x: number) => x * x * (3 - 2 * x);

export class Sword {
  equipped = false;
  /** Mike 2026-11-05: sword, dagger, mace or spear (the same hand-weapon slot). */
  kind: MeleeKind = 'sword';
  private get st() { return MELEE[this.kind]; }
  /** Which hand holds it: 1 right, -1 left (Mike 2026-11-05: any item in either hand; two swords at once). */
  side: 1 | -1 = 1;
  /** Seconds into the current swing; -1 when not swinging. */
  t = -1;
  /** 1, 2 or 3: which cut of the combo is (or was last) swinging. */
  combo = 0;
  /** B17 hook: 1 = keen. Damage scales with it (at least 1). */
  sharpness = 1;
  swings = 0;
  hits = 0;
  readonly held = new THREE.Group();
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
    this.held.add(buildSwordModel());
    this.held.visible = false;
    this.viewmodel.name = 'sword-viewmodel';
    const vm = buildSwordModel(); vm.scale.setScalar(0.62); this.viewmodel.add(vm);
    this.viewmodel.visible = false;
    camera.add(this.viewmodel);
    this.attach();
  }

  /** In the figure's hand on its side (again after the forge swaps the figure, or the sword changes hands). */
  attach() {
    const rig = this.player.body.children[0]?.userData.rig as { bones: Record<string, THREE.Bone> } | undefined;
    const bone = this.side > 0 ? rig?.bones.foreN : rig?.bones.foreP;
    if (!bone) return;
    bone.add(this.held);
    this.held.position.set(-0.03 * this.side, -0.3, 0.05);
    this.held.rotation.set(Math.PI / 2, 0, 0);   // forearm hanging: the blade points forward
  }
  /** B17: dull and rusty steel shows on the blade (held and first-person): greyer when dull, brown when rusty. */
  setCondition(sharp: number, rust: number) {
    const base = new THREE.Color('#C4C8CE'), dull = new THREE.Color('#7E8084'), rusty = new THREE.Color('#8A4E2A');
    const c = base.clone().lerp(dull, (1 - sharp) * 0.8).lerp(rusty, rust * 0.75);
    for (const root of [this.held, this.viewmodel]) root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (m?.userData?.steel) m.color.copy(c);
      if (m?.userData?.edge) o.visible = sharp > 0.55;
    });
    this.condition = { sharp, rust };
  }
  condition = { sharp: 1, rust: 0 };
  get owned() { return this.inventory.count('sword') > 0; }
  get swinging() { return this.t >= 0; }
  /** 0..1 through the swing, or null (for the animator). */
  get progress(): number | null { return this.t >= 0 ? Math.min(1, this.t / this.st.swing) : null; }

  equip() { if (!this.has) return false; this.equipped = true; this.onChange(); return true; }
  /** Change what kind of weapon this is (rebuilds the models; the blade's wear shows on the new one). */
  setKind(kind: MeleeKind) {
    if (kind === this.kind) return;
    this.kind = kind; this.t = -1; this.combo = 0; this.queued = false;
    this.held.clear(); this.held.add(buildMelee(kind));
    this.viewmodel.clear(); const vm = buildMelee(kind); vm.scale.setScalar(kind === 'spear' ? 0.5 : 0.62); this.viewmodel.add(vm);
    this.setCondition(this.condition.sharp, this.condition.rust);
  }
  /** You have one of this kind. */
  get has() { return this.inventory.count(this.kind) > 0; }
  setSide(side: 1 | -1) { if (side === this.side) return; this.side = side; this.attach(); }
  unequip() { this.equipped = false; this.t = -1; this.queued = false; this.combo = 0; this.onChange(); }

  /** Start a swing. Pressing again late in a swing queues the next cut of the combo. */
  swing(): boolean {
    if (!this.equipped) return false;
    if (this.t >= 0) { if (this.t > this.st.swing * 0.45) this.queued = true; return false; }
    this.combo = this.chainT > 0 ? (this.combo % 3) + 1 : 1;
    this.t = 0; this.struck = false; this.swings++;
    this.onSwing(this.st.heavy[this.combo - 1]);
    return true;
  }

  update(dt: number) {
    if (this.t >= 0) {
      this.t += dt;
      if (!this.struck && this.t >= this.st.strike) { this.struck = true; this.strike(); }
      if (this.t >= this.st.swing) {
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
    const P = this.player, st = this.st, heavy = st.heavy[this.combo - 1];
    // Facing: the view in first person; the body in the follow view, turned toward the nearest goblin in reach.
    let yaw = P.thirdPerson ? P.bodyYaw : P.yaw;
    if (P.thirdPerson) {
      let best = Infinity;
      for (const f of this.foes()) {
        const dx = f.x - P.pos.x, dz = f.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d > st.reach + 0.6 || d < 1e-3) continue;
        const a = Math.atan2(-dx, -dz), off = Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)));
        if (off < ASSIST && d < best) { best = d; P.bodyYaw = a; }
      }
      yaw = P.bodyYaw;
    }
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const damage = Math.max(1, Math.round(st.damage[this.combo - 1] * this.sharpness));
    const n = this.slash?.({ from: P.pos.clone(), fwd, reach: st.reach, arc: st.arc, damage, heavy }) ?? 0;
    if (n) { this.hits += n; this.onHit(n, heavy); }
  }

  // First person: the sword rests up and right; a cut sweeps it right-to-left (the third cut comes down overhead).
  private placeViewmodel() {
    const k = this.progress;
    const rest = { x: 0.3, y: -0.28, z: -0.5, rx: -0.35, rz: -0.25 };
    rest.x *= this.side; rest.rz *= this.side;
    if (k === null) { const v = this.viewmodel; v.position.set(rest.x, rest.y, rest.z); v.rotation.set(rest.rx, 0, rest.rz); return; }
    if (this.st.thrust) {   // the spear jabs straight out and back
      const out = Math.sin(Math.PI * Math.min(1, k * 1.15)), v = this.viewmodel;
      v.position.set(rest.x * 0.4, -0.22, rest.z - out * 0.45); v.rotation.set(-Math.PI / 2 + 0.05, 0, 0);
      return;
    }
    const heavy = this.combo === 3, flip = (this.combo === 2 ? -1 : 1) * this.side;
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
