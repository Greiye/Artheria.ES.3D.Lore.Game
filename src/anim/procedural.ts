import * as THREE from 'three';
import type { BoneName, FigureRig } from '../world/figure';

// Phase A (B1): procedural "auto" animation. Rigged figures (src/world/figure.ts) get walk/run cycles,
// idle breathing, talk gestures, aiming, a jump tuck, landing squash and a head look-at, blended by
// smoothed state weights so every change eases. Unrigged .glb models get a whole-body version
// (bob, lean, breathing) through `BodyAnim`. A .glb clip, when present, takes over (src/models.ts).
export interface AnimInput {
  speed: number;          // horizontal m/s
  talking?: boolean;
  aiming?: boolean;
  airborne?: boolean;
  landed?: boolean;       // true for the one frame the figure touches down
  look?: { yaw: number; pitch: number } | null;   // head target relative to the body, radians
  pose?: Pose | null;     // Phase F (B14): a dojo drill takes over the whole body; v0.04: 'read' while a book is open
  sword?: boolean;        // v0.08: a sword in the right hand (guard)
  swing?: number | null;  // v0.08: 0..1 through a sword cut
  combo?: number;         // v0.08: 1 forehand, 2 backhand, 3 heavy overhead
}
// v0.06 S1 station poses: sit (campfire), smith (anvil), mirror (tailor), write (desk / scriptorium), kneel (bedroll).
// v0.06 T4: the cinema band plays: fiddle, drum and pipe.
export type Pose = 'stance' | 'punch' | 'hang' | 'plank' | 'read' | 'sit' | 'smith' | 'mirror' | 'write' | 'kneel' | 'fiddle' | 'drum' | 'pipe';

const WALK = 2.5, RUN = 5;
// Restyle S2f (Tree of Savior): poses are stepped at a sprite frame rate, not interpolated every frame, for
// the flipbook feel of 8-direction sprite cycles. Movement through the world stays smooth.
const ANIM_FPS = 12;
const smooth = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class FigureAnim {
  private phase = 0;
  private t = Math.random() * 10;   // de-sync idle breathing between figures
  private w = { walk: 0, run: 0, talk: 0, aim: 0, air: 0, squash: 0, pose: 0, sword: 0 };
  private pose: Pose = 'stance';
  private poseT = 0;
  private head = { yaw: 0, pitch: 0 };
  private B: Record<BoneName, THREE.Bone>;
  private rest: Record<BoneName, THREE.Vector3>;

  private acc = 0;
  private landed = false;

  constructor(rig: FigureRig) { this.B = rig.bones; this.rest = rig.rest; }

  update(dt: number, i: AnimInput) {
    if (dt <= 0) return;
    this.acc += dt;
    this.landed ||= !!i.landed;   // a one-frame event must survive the skipped frames
    if (this.acc < 1 / ANIM_FPS) return;
    const step = this.acc;
    this.acc = 0;
    this.pose_(step, this.landed ? { ...i, landed: true } : i);
    this.landed = false;
  }

  private pose_(dt: number, i: AnimInput) {
    this.t += dt;
    const w = this.w, B = this.B, t = this.t;
    w.walk = smooth(w.walk, THREE.MathUtils.clamp(i.speed / WALK, 0, 1), 10, dt);
    w.run = smooth(w.run, THREE.MathUtils.clamp((i.speed - WALK) / (RUN - WALK), 0, 1), 8, dt);
    w.talk = smooth(w.talk, i.talking ? 1 : 0, 6, dt);
    w.aim = smooth(w.aim, i.aiming ? 1 : 0, 12, dt);
    w.air = smooth(w.air, i.airborne ? 1 : 0, 14, dt);
    if (i.landed) w.squash = 1;
    w.squash = smooth(w.squash, 0, 9, dt);
    // Stride: ~1.3 m per full cycle walking, ~2.2 m running.
    const stride = THREE.MathUtils.lerp(1.3, 2.2, w.run);
    if (i.speed > 0.05) this.phase += (i.speed / stride) * Math.PI * 2 * dt;
    else this.phase = smooth(this.phase, Math.round(this.phase / Math.PI) * Math.PI, 6, dt);   // settle feet together
    const s = Math.sin(this.phase), c = Math.cos(this.phase), loco = w.walk;
    const legAmp = 0.45 * loco + 0.35 * w.run, kneeAmp = 0.5 * loco + 0.6 * w.run;
    const ground = 1 - w.air;

    // Legs: thighs swing (negative x = forward), knees bend on the back swing.
    B.thighN.rotation.x = (-s * legAmp) * ground - 0.55 * w.air;
    B.thighP.rotation.x = (s * legAmp) * ground - 0.35 * w.air;
    B.shinN.rotation.x = Math.max(0, c) * kneeAmp * ground + 0.95 * w.air;
    B.shinP.rotation.x = Math.max(0, -c) * kneeAmp * ground + 0.7 * w.air;

    // Hips: bob twice per cycle, sway sideways, dip on landing. Spine leans into speed and twists.
    const breathe = Math.sin(t * 2.2);
    B.hips.position.y = this.rest.hips.y - Math.abs(s) * (0.03 * loco + 0.05 * w.run) * ground + Math.abs(c) * 0.02 * w.run - 0.12 * w.squash;
    B.hips.position.x = this.rest.hips.x + s * 0.015 * loco;
    B.hips.rotation.y = s * 0.12 * loco;
    B.spine.rotation.x = 0.06 * loco + 0.18 * w.run + breathe * 0.015 * (1 - loco) + 0.12 * w.squash - 0.1 * w.air;
    B.spine.rotation.y = -s * 0.16 * loco + Math.sin(t * 0.7) * 0.03 * (1 - loco);
    B.spine.rotation.z = Math.sin(t * 0.45) * 0.02 * (1 - loco);   // idle weight shift
    B.root.scale.y = 1 - 0.08 * w.squash;

    // Arms: counter-swing to the legs, elbows bend more when running; idle hang with breath.
    const armAmp = 0.5 * loco + 0.35 * w.run;
    let aN = s * armAmp, aP = -s * armAmp, fN = -0.15 - 0.85 * w.run, fP = fN, zN = -0.06 - breathe * 0.02, zP = 0.06 + breathe * 0.02;
    // Talk: the P hand gestures, the N hand rests on the hip.
    const g = Math.sin(t * 3.1), g2 = Math.sin(t * 1.7);
    aP = THREE.MathUtils.lerp(aP, -0.55 + g * 0.25, w.talk); fP = THREE.MathUtils.lerp(fP, -0.9 + g2 * 0.3, w.talk);
    zP = THREE.MathUtils.lerp(zP, 0.25 + g2 * 0.1, w.talk);
    zN = THREE.MathUtils.lerp(zN, -0.35, w.talk * 0.6); fN = THREE.MathUtils.lerp(fN, -0.6, w.talk * 0.6);
    // Aim: both arms up and forward, holding a crossbow at the chest.
    aN = THREE.MathUtils.lerp(aN, -1.25, w.aim); aP = THREE.MathUtils.lerp(aP, -1.45, w.aim);
    fN = THREE.MathUtils.lerp(fN, -0.5, w.aim); fP = THREE.MathUtils.lerp(fP, -0.15, w.aim);
    zN = THREE.MathUtils.lerp(zN, 0.35, w.aim); zP = THREE.MathUtils.lerp(zP, -0.15, w.aim);
    // v0.08 sword: a guard with the blade forward; a cut winds up and sweeps across the body (the third overhead).
    w.sword = smooth(w.sword, i.sword ? 1 : 0, 12, dt);
    if (w.sword > 0.01) {
      aN = THREE.MathUtils.lerp(aN, -0.5 + s * 0.15 * loco, w.sword); fN = THREE.MathUtils.lerp(fN, -0.95, w.sword); zN = THREE.MathUtils.lerp(zN, 0.05, w.sword);
    }
    if (i.swing != null) {
      const k = i.swing, heavy = i.combo === 3, flip = i.combo === 2 ? -1 : 1, L = THREE.MathUtils.lerp;
      const e = (x: number) => x * x * (3 - 2 * x);
      const a = e(Math.min(1, k / 0.3)), b = e(THREE.MathUtils.clamp((k - 0.3) / 0.25, 0, 1)), c = e(THREE.MathUtils.clamp((k - 0.55) / 0.45, 0, 1));
      const W = heavy ? { a: -2.8, z: 0.1, f: -0.7, sy: 0, sx: -0.15 } : { a: -1.7, z: flip > 0 ? -1.0 : 0.7, f: -1.2, sy: 0.45 * flip, sx: 0 };
      const C = heavy ? { a: -0.45, z: 0.1, f: -0.1, sy: 0, sx: 0.3 } : { a: -1.25, z: flip > 0 ? 0.75 : -0.9, f: -0.15, sy: -0.55 * flip, sx: 0.1 };
      const R = { a: aN, z: zN, f: fN, sy: 0, sx: 0 };
      const at = (key: keyof typeof R) => L(L(L(R[key], W[key], a), C[key], b), R[key], c);
      aN = at('a'); zN = at('z'); fN = at('f');
      B.spine.rotation.y += at('sy'); B.spine.rotation.x += at('sx');
      aP = L(aP, -0.4, 1 - c); zP = L(zP, 0.45, 1 - c);   // the free arm swings out for balance
    }
    // Airborne: arms rise for balance.
    B.armN.rotation.set(aN - 0.4 * w.air, 0, zN - 0.5 * w.air);
    B.armP.rotation.set(aP - 0.4 * w.air, 0, zP + 0.5 * w.air);
    B.foreN.rotation.x = fN; B.foreP.rotation.x = fP;

    // Head: look-at target (clamped), a nod while talking, a small idle drift.
    const ly = THREE.MathUtils.clamp(i.look?.yaw ?? 0, -1.1, 1.1), lp = THREE.MathUtils.clamp(i.look?.pitch ?? 0, -0.5, 0.5);
    this.head.yaw = smooth(this.head.yaw, ly + Math.sin(t * 0.3) * 0.08 * (1 - loco), 5, dt);
    this.head.pitch = smooth(this.head.pitch, lp, 5, dt);
    B.head.rotation.set(this.head.pitch - Math.sin(t * 5.2) * 0.07 * w.talk - B.spine.rotation.x * 0.6, this.head.yaw - B.spine.rotation.y, 0, 'YXZ');

    // B14 drills: blend the whole body toward a demonstrated exercise.
    if (i.pose) { if (i.pose !== this.pose) this.poseT = 0; this.pose = i.pose; }
    w.pose = smooth(w.pose, i.pose ? 1 : 0, 5, dt);
    this.poseT += dt;
    const k = w.pose;
    B.root.rotation.set(0, 0, 0); B.root.position.set(0, 0, 0);
    if (k < 0.002) return;
    const H = this.rest.hips.y / 0.93, pt = this.poseT;   // figure height unit (hips at 0.93 of 1.75 m, src/world/figure.ts RIG)
    const L = THREE.MathUtils.lerp;
    const set = (b: BoneName, x: number, y = 0, z = 0) => { const r = B[b].rotation; r.set(L(r.x, x, k), L(r.y, y, k), L(r.z, z, k)); };
    if (this.pose === 'stance' || this.pose === 'punch') {
      set('thighN', -0.95, 0, -0.5); set('thighP', -0.95, 0, 0.5); set('shinN', 1.05); set('shinP', 1.05);
      B.hips.position.y = L(B.hips.position.y, this.rest.hips.y - 0.24 * H, k);
      set('spine', 0.05); set('head', -0.05);
      if (this.pose === 'stance') { set('armN', 0.35, 0, -0.15); set('armP', 0.35, 0, 0.15); set('foreN', -1.8); set('foreP', -1.8); }
      else {
        const side = Math.sin(pt * 7) > 0, e = Math.min(1, Math.abs(Math.sin(pt * 7)) * 1.6);
        set('armN', side ? L(0.3, -1.5, e) : 0.3, 0, -0.1); set('foreN', side ? L(-1.9, -0.05, e) : -1.9);
        set('armP', side ? 0.3 : L(0.3, -1.5, e), 0, 0.1); set('foreP', side ? -1.9 : L(-1.9, -0.05, e));
        set('spine', 0.05, side ? -0.25 * e : 0.25 * e);
      }
    } else if (this.pose === 'hang') {
      // Upside down from the bar by the knees; curl up toward the knees and back down.
      B.root.rotation.z = Math.PI * k; B.root.position.y = (2.3 + 0.49 * H) * k;   // knees hooked over the bar (2.3 m)
      const c = 0.5 - 0.5 * Math.cos(pt * 2.2);
      set('thighN', 0); set('thighP', 0); set('shinN', 1.7); set('shinP', 1.7);
      set('spine', -1.25 * c); set('head', -0.4 * c);
      set('armN', -0.6 - 1.6 * c, 0, -0.1); set('armP', -0.6 - 1.6 * c, 0, 0.1); set('foreN', -0.4 * c); set('foreP', -0.4 * c);
    } else if (this.pose === 'read') {
      // v0.04: reading. Head down over a book held at the chest; every few seconds one hand turns a page.
      const turn = Math.max(0, Math.sin(pt * 1.8)) ** 8;
      set('spine', 0.1); set('head', 0.38 + Math.sin(t * 0.7) * 0.03);
      set('armN', -0.42, 0, 0.32); set('foreN', -1.25, 0.2);
      set('armP', -0.42 - 0.25 * turn, 0, -0.32 + 0.3 * turn); set('foreP', -1.25 + 0.35 * turn, -0.2 - 0.6 * turn);
    } else if (this.pose === 'sit') {
      // On a log seat (about 0.4 m): thighs level, shins down, forearms on the knees, a slow sway to the music.
      set('thighN', -1.45, 0, -0.12); set('thighP', -1.45, 0, 0.12); set('shinN', 1.5); set('shinP', 1.5);
      B.hips.position.y = L(B.hips.position.y, this.rest.hips.y - 0.39 * H, k);
      set('spine', 0.16, Math.sin(pt * 1.4) * 0.05); set('head', 0.08 + Math.sin(pt * 1.4 + 0.6) * 0.04);
      set('armN', -0.7, 0, -0.1); set('armP', -0.7, 0, 0.1); set('foreN', -0.75); set('foreP', -0.75);
    } else if (this.pose === 'kneel') {
      // On the bedroll: knees down, sitting back on the heels, head bowed.
      set('thighN', -0.2, 0, -0.08); set('thighP', -0.2, 0, 0.08); set('shinN', 1.75); set('shinP', 1.75);
      B.hips.position.y = L(B.hips.position.y, this.rest.hips.y - 0.5 * H, k);
      set('spine', 0.22); set('head', 0.35);
      set('armN', -0.45, 0, -0.05); set('armP', -0.45, 0, 0.05); set('foreN', -0.5); set('foreP', -0.5);
    } else if (this.pose === 'smith') {
      // At the anvil: feet apart, leaning in; one hand holds the work, the other brings the hammer down.
      const blow = 0.5 - 0.5 * Math.cos(pt * 5.2), hit = blow ** 3;
      set('thighN', -0.15, 0, -0.18); set('thighP', -0.15, 0, 0.18); set('shinN', 0.2); set('shinP', 0.2);
      B.hips.position.y = L(B.hips.position.y, this.rest.hips.y - 0.04 * H, k);
      set('spine', 0.28 + 0.06 * hit); set('head', 0.25);
      set('armN', -0.7, 0, 0.15); set('foreN', -0.9);
      set('armP', -0.5 - 1.8 * blow, 0, -0.1); set('foreP', -0.4 - 0.5 * blow);
    } else if (this.pose === 'mirror') {
      // Posing for the glass: hand on the hip, the other at the chin, turning the head to see each side.
      set('spine', -0.04, Math.sin(pt * 0.8) * 0.12); set('head', 0.05, Math.sin(pt * 0.8 + 0.4) * 0.3);
      set('armN', -0.35, 0, 0.35); set('foreN', -2.1, 0.3);
      set('armP', 0.15, 0, 0.55); set('foreP', -1.6);
    } else if (this.pose === 'write') {
      // At the desk with a quill: leaning over the page, the writing hand scratching small strokes.
      const scratch = Math.sin(pt * 9) * 0.07 + Math.sin(pt * 2.3) * 0.05;
      set('spine', 0.38); set('head', 0.42);
      set('armN', -0.55, 0, 0.12); set('foreN', -1.15);
      set('armP', -0.75 + scratch, 0, -0.18); set('foreP', -0.95 + scratch * 1.5, -0.2);
    } else if (this.pose === 'fiddle') {
      // Fiddle under the chin (N hand on the neck), the bow arm sawing across; swaying with the tune.
      const bow = Math.sin(pt * 4.2);
      set('spine', 0.04, Math.sin(pt * 1.3) * 0.08, Math.sin(pt * 1.3) * 0.05); set('head', 0.2, 0.25, 0.25);
      set('armN', -1.2, 0.3, 0.55); set('foreN', -0.9, 0.4);
      set('armP', -0.75 + bow * 0.15, 0, -0.6 + bow * 0.25); set('foreP', -1.2 - bow * 0.35);
    } else if (this.pose === 'drum') {
      // A hand drum at the hip: both hands beat in turn, the head nods on the beat.
      const a = Math.max(0, Math.sin(pt * 6)), b = Math.max(0, -Math.sin(pt * 6));
      set('spine', 0.12); set('head', 0.15 + (a + b) * 0.08);
      set('armN', -0.45 - a * 0.5, 0, 0.15); set('foreN', -1.0 - a * 0.4);
      set('armP', -0.45 - b * 0.5, 0, -0.15); set('foreP', -1.0 - b * 0.4);
    } else if (this.pose === 'pipe') {
      // A pipe at the lips, both hands on it, fingers fluttering; a gentle bob.
      const f = Math.sin(pt * 8) * 0.06;
      B.hips.position.y = L(B.hips.position.y, this.rest.hips.y - Math.abs(Math.sin(pt * 2.1)) * 0.02 * H, k);
      set('spine', -0.05); set('head', -0.05 + Math.sin(pt * 2.1) * 0.05);
      set('armN', -1.1 + f, 0, 0.3); set('foreN', -1.5);
      set('armP', -1.0 - f, 0, -0.3); set('foreP', -1.7);
    } else if (this.pose === 'plank') {
      B.root.rotation.x = (Math.PI / 2 - 0.12) * k; B.root.position.y = 0.2 * H * k;
      set('thighN', 0); set('thighP', 0); set('shinN', 0); set('shinP', 0); set('spine', Math.sin(t * 2) * 0.015);
      set('armN', -1.45, 0, -0.1); set('armP', -1.45, 0, 0.1); set('foreN', -1.5); set('foreP', -1.5); set('head', -0.5);
    }
  }
}

// Unrigged .glb (no bones, or bones without clips for this state): move the whole model.
export class BodyAnim {
  private phase = 0;
  private t = Math.random() * 10;
  private walk = 0;
  private talk = 0;
  private base: { y: number; sy: number } | null = null;

  constructor(private obj: THREE.Object3D) {}

  update(dt: number, i: AnimInput) {
    if (dt <= 0) return;
    if (!this.base) this.base = { y: this.obj.position.y, sy: this.obj.scale.y };
    this.t += dt;
    this.walk = smooth(this.walk, THREE.MathUtils.clamp(i.speed / WALK, 0, 1.6), 10, dt);
    this.talk = smooth(this.talk, i.talking ? 1 : 0, 6, dt);
    if (i.speed > 0.05) this.phase += (i.speed / 1.4) * Math.PI * 2 * dt;
    const s = Math.sin(this.phase);
    this.obj.position.y = this.base.y + Math.abs(s) * 0.05 * this.walk;
    this.obj.rotation.x = 0.06 * this.walk + Math.sin(this.t * 5) * 0.03 * this.talk;
    this.obj.rotation.z = s * 0.05 * this.walk;
    this.obj.scale.y = this.base.sy * (1 + Math.sin(this.t * 2.2) * 0.012 * (1 - Math.min(1, this.walk)));
  }
}
