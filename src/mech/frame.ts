import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { painted } from '../world/figure';
import { outlineChild } from '../render/outline';

// Mike 2026-11-05 ("Robots? Can you add pilotable mechs?", then "Make the mech pilotable for right now"): a knight
// frame, a 10 ft elvish titan of the kind the Caerne found (the Telandor Savior, Tales Part I), here a lesser one,
// rusted, kneeling in a treeline. A mana gem in its chest wakes it. Chunky low-poly bronze gone green, with rune
// seams that glow when it's awake. No skeleton: each limb is its own group, posed by hand below (kneel, stand, walk,
// strike, guard, slam). The pilot stands inside the chest, so the player's own figure is hidden while piloting.

export const FRAME_HEIGHT = 3.2;   // m: the canon 10 ft
const BRONZE = '#5E7A62', BRONZE_D = '#3E5444', RUST = '#8A5A34', IRON = '#3A3A40', GOLD = '#B89A48';
const RUNE_ON = new THREE.Color('#7FF0FF'), RUNE_OFF = new THREE.Color('#2A4448');

type Part = 'hips' | 'torso' | 'head' | 'armL' | 'foreL' | 'armR' | 'foreR' | 'thighL' | 'shinL' | 'thighR' | 'shinR';
// Pivots (m, parent-relative) for a frame facing +Z, feet at y 0.
const PIVOT: Record<Part, [Part | null, number, number, number]> = {
  hips: [null, 0, 1.55, 0], torso: ['hips', 0, 0.1, 0], head: ['torso', 0, 1.15, 0.05],
  armR: ['torso', -0.82, 0.92, 0], foreR: ['armR', 0, -0.62, 0], armL: ['torso', 0.82, 0.92, 0], foreL: ['armL', 0, -0.62, 0],
  thighR: ['hips', -0.36, -0.05, 0], shinR: ['thighR', 0, -0.72, 0], thighL: ['hips', 0.36, -0.05, 0], shinL: ['thighL', 0, -0.72, 0],
};
const PARTS = Object.keys(PIVOT) as Part[];

export type Strike = 'swing' | 'slam' | 'pulse';

export class KnightFrame {
  readonly root = new THREE.Group();
  /** An invisible box round it, for the "Climb in" prompt. */
  readonly hit: THREE.Mesh;
  private readonly p = {} as Record<Part, THREE.Group>;
  private readonly rune: THREE.MeshBasicMaterial;
  awake = false;
  piloted = false;
  /** 0 kneeling (asleep) .. 1 standing. */
  private up = 0;
  private phase = 0;
  private act: { kind: Strike; t: number; dur: number; hitAt: number; done: boolean } | null = null;
  private guardT = 0;
  guarding = false;
  private pulseCd = 0;
  private slamCd = 0;
  /** A strike lands: what, where from, and facing (unit, flat). */
  onStrike: ((kind: Strike, at: THREE.Vector3, fwd: THREE.Vector3) => void) | null = null;
  /** A foot comes down while walking. */
  onStep: (() => void) | null = null;
  private lastFoot = 0;

  constructor() {
    this.root.name = 'knight-frame';
    this.rune = new THREE.MeshBasicMaterial({ color: RUNE_OFF.clone() });
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const geos = {} as Record<Part, [THREE.BufferGeometry, string][]>;
    const glow = {} as Record<Part, THREE.BufferGeometry[]>;
    for (const n of PARTS) { geos[n] = []; glow[n] = []; }
    const box = (n: Part, w: number, h: number, d: number, x: number, y: number, z: number, c: string, rx = 0, rz = 0) => {
      const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); geos[n].push([g, c]);
    };
    const cyl = (n: Part, r1: number, r2: number, h: number, x: number, y: number, z: number, c: string, sides = 6) => {
      const g = new THREE.CylinderGeometry(r1, r2, h, sides); g.translate(x, y, z); geos[n].push([g, c]);
    };
    const lit = (n: Part, w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); glow[n].push(g); };

    // Hips: a plated skirt (tassets) over a dark core.
    box('hips', 0.9, 0.35, 0.6, 0, -0.05, 0, IRON);
    box('hips', 1.0, 0.18, 0.66, 0, 0.12, 0, BRONZE_D);
    for (const s of [-1, 1]) box('hips', 0.42, 0.42, 0.1, s * 0.26, -0.22, 0.34, BRONZE, -0.12);
    box('hips', 0.9, 0.42, 0.1, 0, -0.22, -0.34, BRONZE, 0.12);
    // Torso: a barrel chest (the cockpit), a gorget, the gem heart and rune seams.
    box('torso', 1.25, 0.95, 0.9, 0, 0.55, 0, BRONZE);
    box('torso', 1.0, 0.3, 0.75, 0, 0.0, 0, BRONZE_D);
    box('torso', 1.35, 0.22, 0.95, 0, 1.0, 0, BRONZE_D);   // collar ridge
    box('torso', 0.5, 0.5, 0.06, 0, 0.6, 0.47, GOLD);       // the gem's setting
    box('torso', 0.25, 0.8, 0.05, -0.38, 0.55, -0.47, RUST);
    box('torso', 0.7, 0.55, 0.3, 0, 0.6, -0.55, IRON);      // back plate (the hatch)
    lit('torso', 0.24, 0.24, 0.08, 0, 0.6, 0.5);             // gem heart
    lit('torso', 0.04, 0.5, 0.04, -0.5, 0.55, 0.46); lit('torso', 0.04, 0.5, 0.04, 0.5, 0.55, 0.46);
    lit('torso', 0.9, 0.04, 0.04, 0, 0.12, 0.4);
    // Head: a great helm with a visor slit and a crest.
    box('head', 0.46, 0.48, 0.5, 0, 0.22, 0, BRONZE);
    box('head', 0.5, 0.1, 0.54, 0, 0.47, 0, BRONZE_D);
    box('head', 0.08, 0.22, 0.42, 0, 0.6, -0.02, GOLD);
    lit('head', 0.36, 0.05, 0.04, 0, 0.27, 0.26);
    for (const [s, arm, fore] of [[-1, 'armR', 'foreR'], [1, 'armL', 'foreL']] as const) {
      // Pauldron, upper arm, elbow, forearm, a big gauntlet.
      box(arm, 0.6, 0.32, 0.7, s * 0.08, 0.12, 0, BRONZE, 0, s * -0.25);
      box(arm, 0.5, 0.12, 0.62, s * 0.12, -0.06, 0, BRONZE_D, 0, s * -0.25);
      cyl(arm, 0.17, 0.15, 0.6, 0, -0.32, 0, IRON);
      cyl(fore, 0.16, 0.16, 0.16, 0, 0, 0, RUST, 6);
      box(fore, 0.34, 0.55, 0.36, 0, -0.32, 0, BRONZE);
      box(fore, 0.4, 0.3, 0.42, 0, -0.72, 0.02, BRONZE_D);   // fist
      lit(fore, 0.04, 0.4, 0.04, s * 0.18, -0.3, 0.12);
    }
    // The left forearm carries a kite shield (its pilot's guard).
    box('foreL', 0.1, 1.1, 0.75, 0.3, -0.42, 0.05, BRONZE_D);
    box('foreL', 0.12, 0.85, 0.08, 0.31, -0.42, 0.05, GOLD);
    box('foreL', 0.12, 0.08, 0.55, 0.31, -0.3, 0.05, GOLD);
    for (const [s, thigh, shin] of [[-1, 'thighR', 'shinR'], [1, 'thighL', 'shinL']] as const) {
      box(thigh, 0.38, 0.72, 0.44, 0, -0.36, 0, BRONZE);
      box(thigh, 0.3, 0.5, 0.06, 0, -0.32, 0.23, RUST);
      lit(thigh, 0.04, 0.4, 0.04, s * 0.2, -0.34, 0.12);
      cyl(shin, 0.17, 0.17, 0.2, 0, 0, 0, IRON, 6);
      box(shin, 0.4, 0.2, 0.3, 0, 0.02, 0.15, BRONZE_D);         // knee cop
      box(shin, 0.34, 0.68, 0.4, 0, -0.38, 0, BRONZE);
      box(shin, 0.46, 0.16, 0.7, 0, -0.75, 0.1, IRON);          // sabaton
      box(shin, 0.38, 0.06, 0.22, 0, -0.66, 0.36, BRONZE_D);
    }

    for (const n of PARTS) {
      const [parent, x, y, z] = PIVOT[n], g = new THREE.Group();
      g.name = 'frame-' + n; g.position.set(x, y, z);
      (parent ? this.p[parent] : this.root).add(g);
      this.p[n] = g;
      const merged = mergeGeometries(geos[n].map(([geo, c]) => painted(geo, c, -1, 1.2)));
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true; m.name = 'frame-mesh'; m.userData.solid = true;   // never cut away by see-through (src/render/seeThrough.ts)
      g.add(m);
      outlineChild(m);
      if (glow[n].length) { const r = new THREE.Mesh(mergeGeometries(glow[n]), this.rune); r.name = 'frame-rune'; g.add(r); }
    }
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3, 1.8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 1.5; this.hit.name = 'frame-hit';
    this.root.add(this.hit);
    this.root.userData.tris = PARTS.reduce((t, n) => t + ((this.p[n].children[0] as THREE.Mesh).geometry.attributes.position.count / 3), 0);
    this.pose(0);
  }

  get busy() { return this.act !== null; }
  get standing() { return this.up > 0.98; }
  /** Seconds until the rune pulse is ready again. */
  get pulseWait() { return this.pulseCd; }

  wake(instant = false) { this.awake = true; if (instant) this.up = 1; }

  swing() { if (this.standing && !this.act) this.act = { kind: 'swing', t: 0, dur: 0.6, hitAt: 0.32, done: false }; }
  slam(): boolean { if (!this.standing || this.act || this.slamCd > 0) return false; this.act = { kind: 'slam', t: 0, dur: 1.0, hitAt: 0.55, done: false }; this.slamCd = 2; return true; }
  pulse(): boolean { if (!this.standing || this.act || this.pulseCd > 0) return false; this.act = { kind: 'pulse', t: 0, dur: 0.7, hitAt: 0.3, done: false }; this.pulseCd = 6; return true; }

  /** `speed`: how fast it's walking (m/s), for the gait. */
  update(dt: number, speed: number) {
    const want = this.awake ? 1 : 0;
    this.up += Math.sign(want - this.up) * Math.min(Math.abs(want - this.up), dt / 1.6);
    this.pulseCd = Math.max(0, this.pulseCd - dt); this.slamCd = Math.max(0, this.slamCd - dt);
    this.guardT += ((this.guarding && !this.act ? 1 : 0) - this.guardT) * Math.min(1, dt * 10);
    if (speed > 0.2 && this.standing) this.phase += dt * speed * 1.5; else this.phase += (Math.round(this.phase / Math.PI) * Math.PI - this.phase) * Math.min(1, dt * 6);
    const foot = Math.floor(this.phase / Math.PI);
    if (foot !== this.lastFoot) { this.lastFoot = foot; if (speed > 0.2) this.onStep?.(); }
    if (this.act) {
      const a = this.act;
      a.t += dt;
      if (!a.done && a.t >= a.hitAt) {
        a.done = true;
        const fwd = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
        const at = this.root.position.clone().addScaledVector(fwd, a.kind === 'swing' ? 1.4 : 0.8);
        this.onStrike?.(a.kind, at, fwd);
      }
      if (a.t >= a.dur) this.act = null;
    }
    const target = this.awake ? (this.act?.kind === 'pulse' ? RUNE_ON.clone().multiplyScalar(1.6) : RUNE_ON) : RUNE_OFF;
    this.rune.color.lerp(target, Math.min(1, dt * 3));
    this.pose(speed);
  }

  private pose(speed: number) {
    const P = this.p, u = this.up, k = 1 - u;   // k: how kneeling
    const S = Math.sin(this.phase), C = Math.cos(this.phase), g = this.standing ? Math.min(1, speed / 3) : 0;
    for (const n of PARTS) P[n].rotation.set(0, 0, 0);
    // Kneel (asleep): right knee down, left foot planted, head bowed, arms hanging, the torso slumped forward.
    P.hips.position.y = PIVOT.hips[2] - k * 0.72 + g * Math.abs(C) * 0.06;
    P.thighR.rotation.x = k * 0.25 - S * 0.55 * g;
    P.shinR.rotation.x = k * 1.55 + Math.max(0, -C) * 0.5 * g;
    P.thighL.rotation.x = -k * 1.35 + S * 0.55 * g;
    P.shinL.rotation.x = k * 1.35 + Math.max(0, C) * 0.5 * g;
    P.torso.rotation.x = k * 0.4 + g * 0.08;
    P.torso.rotation.y = S * 0.08 * g;
    P.head.rotation.x = k * 0.45;
    P.armR.rotation.x = k * 0.25 + S * 0.35 * g; P.armR.rotation.z = -0.12;
    P.armL.rotation.x = k * 0.25 - S * 0.35 * g; P.armL.rotation.z = 0.12;
    P.foreR.rotation.x = -0.25 - k * 0.3; P.foreL.rotation.x = -0.25 - k * 0.3;
    // Guard: the shield arm comes up across the front.
    if (this.guardT > 0.01) {
      const t = this.guardT;
      P.armL.rotation.x += -1.25 * t; P.armL.rotation.z += -0.45 * t; P.foreL.rotation.x += -0.6 * t; P.torso.rotation.x += 0.08 * t;
    }
    const a = this.act;
    if (!a) return;
    const t = a.t / a.dur, ease = (x: number) => x * x * (3 - 2 * x);
    if (a.kind === 'swing') {   // right hook: wind back, then punch through
      const wind = t < 0.45 ? ease(t / 0.45) : 1 - ease(Math.min(1, (t - 0.45) / 0.25)), hit = t < 0.45 ? 0 : t < 0.75 ? ease((t - 0.45) / 0.3) : 1 - ease((t - 0.75) / 0.25);
      P.armR.rotation.x += 0.7 * wind - 1.7 * hit; P.foreR.rotation.x += -1.1 * wind + 0.9 * hit;
      P.torso.rotation.y += 0.45 * wind - 0.4 * hit;
    } else if (a.kind === 'slam') {   // both fists up over the head, then down into the ground
      const raise = t < 0.45 ? ease(t / 0.45) : 1 - ease(Math.min(1, (t - 0.45) / 0.12)), down = t < 0.45 ? 0 : t < 0.8 ? 1 : 1 - ease((t - 0.8) / 0.2);
      for (const [arm, fore] of [[P.armR, P.foreR], [P.armL, P.foreL]]) { arm.rotation.x += -2.8 * raise - 1.2 * down; fore.rotation.x += -0.6 * raise; }
      P.torso.rotation.x += -0.2 * raise + 0.5 * down;
      P.hips.position.y -= 0.35 * down;
      P.thighR.rotation.x += -0.5 * down; P.shinR.rotation.x += 0.9 * down; P.thighL.rotation.x += -0.5 * down; P.shinL.rotation.x += 0.9 * down;
    } else {   // rune pulse: arms flung wide, chest thrust out
      const w = Math.sin(Math.min(1, t) * Math.PI);
      P.armR.rotation.z += -1.1 * w; P.armL.rotation.z += 1.1 * w; P.torso.rotation.x += -0.25 * w; P.head.rotation.x += -0.3 * w;
    }
  }
}
