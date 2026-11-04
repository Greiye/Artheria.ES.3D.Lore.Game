import * as THREE from 'three';
import { buildFigure } from '../world/figure';
import { FigureAnim, type AnimInput, type Pose } from '../anim/procedural';
import { cleanLook, type NetLook } from './look';
import { Bubble } from './emotes';

/** Held things, cloned from the player's own (shared geometry): main.ts supplies them. */
export interface Props { sword: THREE.Object3D; torch: THREE.Object3D; book: THREE.Object3D }

// The other players in the room (multiplayer PR 2): each is a rigged figure like a townsperson, placed from the
// 12-a-second state its owner sends and smoothed in between. The rig, culling and drawing are main.ts's usual
// puppet loop (ids 'net:<peer>'); this file owns where they are and what they're doing.

export const SEND_HZ = 12;
const POSES: Pose[] = ['stance', 'punch', 'hang', 'plank', 'pushup', 'read', 'sit', 'smith', 'mirror', 'write', 'kneel', 'fiddle', 'drum', 'pipe', 'wake', 'wakeroll', 'sitground'];
const AWAY_AFTER = 5;   // seconds with no state: they're at a menu, or their phone slept; hide them
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** One frame of what you're doing, packed small: [x, y, z, yaw, scaleY, speed, flags, pose, swing, combo, lookYaw, lookPitch, lean]. */
export type Wire = number[];
export function packState(body: THREE.Object3D, i: AnimInput, torch = false): Wire {
  const f = (i.airborne ? 1 : 0) | (i.aiming ? 2 : 0) | (i.sword ? 4 : 0) | (i.talking ? 8 : 0) | (torch ? 16 : 0);
  const r = (n: number, k = 100) => Math.round(n * k) / k;
  return [r(body.position.x), r(body.position.y), r(body.position.z), r(body.rotation.y, 1000), r(body.scale.y), r(i.speed), f,
    i.pose ? POSES.indexOf(i.pose) : -1, i.swing == null ? -1 : r(i.swing), i.combo ?? 0, r(i.look?.yaw ?? 0), r(i.look?.pitch ?? 0), r(i.lean ?? 0)];
}

export class Remote {
  readonly root = new THREE.Group();
  fig: FigureAnim | null = null;
  figure: THREE.Object3D | null = null;
  input: AnimInput = { speed: 0 };
  private target = new THREE.Vector3();
  private yaw = 0;
  private seen = false;
  private quiet = 0;
  private tag: THREE.Sprite;
  private tagY = 2.1;
  readonly bubble = new Bubble();
  torch = false;
  private props: Props | null = null;
  lookRaw: unknown = undefined;
  constructor(readonly id: string, public name: string, private scene: THREE.Scene) {
    this.root.name = 'net:' + id;
    this.root.visible = false;
    this.tag = nameTag(name);
    this.root.add(this.tag);
    this.root.add(this.bubble.sprite);
    scene.add(this.root);
  }
  get away() { return !this.seen || this.quiet > AWAY_AFTER; }

  setLook(raw: unknown): boolean {
    this.lookRaw = raw;
    const nl: NetLook | null = cleanLook(raw);
    if (!nl) return false;
    if (this.figure) this.root.remove(this.figure);
    const fig = buildFigure(nl.look, nl.height);
    fig.rotation.y = Math.PI;   // as the player's own body: figures face +Z, the body faces its yaw
    this.root.add(fig);
    this.figure = fig;
    this.fig = fig.userData.rig ? new FigureAnim(fig.userData.rig) : null;
    this.tagY = this.tag.position.y = nl.height + 0.35;
    this.bubble.sprite.position.y = nl.height + 0.8;
    if (this.props) this.hold(this.props);
    return true;
  }
  /** Put the held things in this figure's hands (again after a new look rebuilds it). */
  hold(p: Props) {
    this.props = p;
    const bones = (this.figure?.userData.rig as { bones: Record<string, THREE.Bone> } | undefined)?.bones;
    if (!bones) return;
    bones.foreN.add(p.sword); p.sword.position.set(-0.03, -0.3, 0.05); p.sword.rotation.set(Math.PI / 2, 0, 0);
    bones.foreP.add(p.torch); p.torch.position.set(0.03, -0.3, 0.06); p.torch.rotation.set(0.35, 0, 0);
    bones.spine.add(p.book); p.book.position.set(0, 0.22, 0.3); p.book.rotation.set(-0.75, 0, 0); p.book.scale.setScalar(1.4);
  }
  setName(name: string) {
    this.name = name;
    this.root.remove(this.tag); disposeTag(this.tag);
    this.tag = nameTag(name); this.tag.position.y = this.tagY;
    this.root.add(this.tag);
  }

  apply(raw: unknown) {
    if (!Array.isArray(raw) || raw.length < 13) return;
    const w = raw as unknown[];
    if (![w[0], w[1], w[2], w[3]].every((v) => typeof v === 'number' && Number.isFinite(v))) return;
    const x = num(w[0]), y = num(w[1]), z = num(w[2]);
    if (Math.abs(x) > 1e4 || Math.abs(y) > 1e4 || Math.abs(z) > 1e4) return;
    this.target.set(x, y, z);
    this.yaw = num(w[3]);
    const f = num(w[6]) | 0, pose = num(w[7], -1) | 0, swing = num(w[8], -1);
    this.input = {
      speed: Math.min(20, Math.max(0, num(w[5]))), airborne: !!(f & 1), aiming: !!(f & 2), sword: !!(f & 4), talking: !!(f & 8),
      pose: POSES[pose] ?? null, swing: swing < 0 ? null : Math.min(1, swing), combo: Math.min(3, Math.max(0, num(w[9]) | 0)),
      look: { yaw: Math.max(-1.7, Math.min(1.7, num(w[10]))), pitch: Math.max(-1, Math.min(1, num(w[11]))) }, lean: Math.max(-1, Math.min(1, num(w[12]))),
    };
    this.torch = !!(f & 16);
    this.root.scale.y = Math.min(1.2, Math.max(0.4, num(w[4], 1)));
    if (!this.seen) { this.root.position.copy(this.target); this.root.rotation.y = this.yaw; }   // first sight: no slide in from the origin
    this.seen = true; this.quiet = 0;
  }

  update(dt: number) {
    this.quiet += dt;
    this.bubble.update(dt);
    if (this.props) {
      const i = this.input;
      this.props.sword.visible = !!i.sword && !i.pose;
      this.props.torch.visible = this.torch && !i.pose;
      this.props.book.visible = i.pose === 'read';
    }
    const show = !this.away && !!this.figure;
    if (this.root.visible !== show) this.root.visible = show;
    if (!show) return;
    // Smooth toward the last state: fast enough to keep up at a run, slow enough to hide the 12 Hz steps.
    const k = 1 - Math.exp(-14 * dt);
    const p = this.root.position;
    if (p.distanceToSquared(this.target) > 100) p.copy(this.target);   // a jump of 10 m+ (a door, a respawn): snap
    else p.lerp(this.target, k);
    this.root.rotation.y += wrap(this.yaw - this.root.rotation.y) * k;
  }

  remove() { this.scene.remove(this.root); disposeTag(this.tag); }   // (figure parts may share cached geometry: left to GC)
}

function nameTag(name: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '600 30px Georgia, serif';
  const w = Math.min(248, g.measureText(name).width + 28);
  g.fillStyle = 'rgba(30, 22, 14, 0.62)';
  g.beginPath(); g.roundRect?.((256 - w) / 2, 10, w, 44, 14); g.fill();
  g.fillStyle = '#F6EBD2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 128, 33, 236);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.2, 0.3, 1);
  s.position.y = 2.1;
  s.name = 'nameTag';
  s.renderOrder = 5;
  return s;
}
function disposeTag(s: THREE.Sprite) { s.material.map?.dispose(); s.material.dispose(); }
