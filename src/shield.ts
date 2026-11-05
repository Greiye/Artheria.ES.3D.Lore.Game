// Mike 2026-11-05: shields to equip, in either hand (or both). Hold that hand's button to block: a shield turns
// every blow from the front, a sword held up after a cut turns half. Two shields block a wider arc. The smith sells
// two: a wooden buckler (light, a narrow arc) and a round iron-rimmed shield (a wide arc). Blocking slows you.
import * as THREE from 'three';
import type { Player } from './player';

export type ShieldKind = 'buckler' | 'shield';
/** Half-angle of the arc each one covers in front of you (radians). */
export const BLOCK_ARC: Record<ShieldKind | 'sword', number> = { buckler: THREE.MathUtils.degToRad(45), shield: THREE.MathUtils.degToRad(60), sword: THREE.MathUtils.degToRad(40) };
/** How much of a blocked blow gets through. */
export const BLOCK_LEAK: Record<ShieldKind | 'sword', number> = { buckler: 0, shield: 0, sword: 0.5 };

export function buildShield(kind: ShieldKind): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: kind === 'buckler' ? '#8A5A34' : '#6E4A2C' });
  const iron = new THREE.MeshLambertMaterial({ color: '#8E9296' });
  const paint = new THREE.MeshLambertMaterial({ color: '#A8342E' });
  const r = kind === 'buckler' ? 0.17 : 0.3;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, kind === 'buckler' ? 10 : 14), wood);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  if (kind === 'shield') {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 4, 14), iron); g.add(rim);
    const band = new THREE.Mesh(new THREE.BoxGeometry(r * 2 * 0.95, 0.07, 0.035), paint); band.position.z = 0.003; g.add(band);
  }
  const boss = new THREE.Mesh(new THREE.SphereGeometry(kind === 'buckler' ? 0.06 : 0.075, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), iron);
  boss.rotation.x = Math.PI / 2; boss.position.z = 0.015;
  g.add(boss);
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.raycast = () => {}; } });
  return g;
}

export class Shield {
  equipped = false;
  kind: ShieldKind = 'shield';
  /** Which hand holds it: 1 right, -1 left. */
  side: 1 | -1 = -1;
  /** Held up (its hand's button is down). */
  blocking = false;
  /** Seconds since it last turned a blow (for the jolt). */
  private jolt = 0;
  readonly held = new THREE.Group();
  readonly viewmodel = new THREE.Group();
  private raise = 0;

  constructor(camera: THREE.Camera, private player: Player) {
    this.held.name = 'held-shield'; this.viewmodel.name = 'shield-viewmodel';
    this.held.visible = this.viewmodel.visible = false;
    camera.add(this.viewmodel);
    this.setKind('shield');
  }

  setKind(kind: ShieldKind) {
    this.kind = kind;
    this.held.clear(); this.viewmodel.clear();
    this.held.add(buildShield(kind));
    const v = buildShield(kind); v.scale.setScalar(0.8); this.viewmodel.add(v);
    this.attach();
  }
  setSide(side: 1 | -1) { if (side === this.side) return; this.side = side; this.attach(); }
  /** On the forearm, its face out to the side (again after the forge swaps the figure). */
  attach() {
    const rig = this.player.body.children[0]?.userData.rig as { bones: Record<string, THREE.Bone> } | undefined;
    const bone = this.side > 0 ? rig?.bones.foreN : rig?.bones.foreP;
    if (!bone) return;
    bone.add(this.held);
    this.held.position.set(-0.07 * this.side, -0.16, 0.02);
    this.held.rotation.set(0, -Math.PI / 2 * this.side, 0);
  }
  /** It turned a blow: a jolt in the view. */
  struck() { this.jolt = 0.18; }

  update(dt: number, firstPerson: boolean, pose: boolean) {
    this.raise += ((this.blocking ? 1 : 0) - this.raise) * Math.min(1, dt * 14);
    this.jolt = Math.max(0, this.jolt - dt);
    this.held.visible = this.equipped && !pose;
    this.viewmodel.visible = this.equipped && firstPerson && !pose;
    if (!this.viewmodel.visible) return;
    // First person: low at the side; raised, it comes up to the middle of the view.
    const k = this.raise, s = this.side, j = Math.sin(this.jolt * 40) * this.jolt * 0.25;
    this.viewmodel.position.set(THREE.MathUtils.lerp(0.42 * s, 0.16 * s, k), THREE.MathUtils.lerp(-0.42, -0.2, k) + j, THREE.MathUtils.lerp(-0.5, -0.42, k));
    this.viewmodel.rotation.set(0, THREE.MathUtils.lerp(-0.9 * s, -0.25 * s, k), 0);
  }
}
