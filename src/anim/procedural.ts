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
}

const WALK = 2.5, RUN = 5;
const smooth = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class FigureAnim {
  private phase = 0;
  private t = Math.random() * 10;   // de-sync idle breathing between figures
  private w = { walk: 0, run: 0, talk: 0, aim: 0, air: 0, squash: 0 };
  private head = { yaw: 0, pitch: 0 };
  private B: Record<BoneName, THREE.Bone>;
  private rest: Record<BoneName, THREE.Vector3>;

  constructor(rig: FigureRig) { this.B = rig.bones; this.rest = rig.rest; }

  update(dt: number, i: AnimInput) {
    if (dt <= 0) return;
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
    // Airborne: arms rise for balance.
    B.armN.rotation.set(aN - 0.4 * w.air, 0, zN - 0.5 * w.air);
    B.armP.rotation.set(aP - 0.4 * w.air, 0, zP + 0.5 * w.air);
    B.foreN.rotation.x = fN; B.foreP.rotation.x = fP;

    // Head: look-at target (clamped), a nod while talking, a small idle drift.
    const ly = THREE.MathUtils.clamp(i.look?.yaw ?? 0, -1.1, 1.1), lp = THREE.MathUtils.clamp(i.look?.pitch ?? 0, -0.5, 0.5);
    this.head.yaw = smooth(this.head.yaw, ly + Math.sin(t * 0.3) * 0.08 * (1 - loco), 5, dt);
    this.head.pitch = smooth(this.head.pitch, lp, 5, dt);
    B.head.rotation.set(this.head.pitch - Math.sin(t * 5.2) * 0.07 * w.talk - B.spine.rotation.x * 0.6, this.head.yaw - B.spine.rotation.y, 0, 'YXZ');
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
