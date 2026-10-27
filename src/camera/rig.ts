import * as THREE from 'three';
import { controls } from '../controls';
import type { Collider } from '../world';
import type { Player } from '../player';

// The camera rig, split out of the player (rebuild R3; storybook restyle S1, docs/vision.md).
// - follow (default): a Dark Cloud 2 / Ragnarok Online style orbit camera above and behind the player.
//   The wheel (or a vertical drag / right stick) zooms from a close over-the-back view out to a high,
//   narrow-FOV overview; dragging turns it. It eases after the player and never sits inside a wall.
// - first person (F, or aiming the crossbow): camera at the eyes.
// - shot: a framed cinematic pose for reading and dialogue, blended in and out over ~0.6 s.
export interface Shot { pos: THREE.Vector3; look: THREE.Vector3; fov: number }

const ease = (t: number) => t * t * (3 - 2 * t);
const ZOOM_KEY = 'gametool.camZoom';
// Follow camera shape at zoom 0 (close) and 1 (overview).
export const FOLLOW = { distNear: 3.6, distFar: 17, elevNear: 0.32, elevFar: 0.95, fovFar: 32, lookNear: 1.45, lookFar: 0.9 };

export class CameraRig {
  private shot: Shot | null = null;
  private lastShot: Shot | null = null;
  private blend = 0;
  private free = 1;                       // smoothed fraction of the follow offset that's clear of walls
  private wasThird = false;
  private basePos = new THREE.Vector3();
  private baseQ = new THREE.Quaternion();
  private shotQ = new THREE.Quaternion();
  private m = new THREE.Matrix4();
  private up = new THREE.Vector3(0, 1, 0);
  private smoothPos = new THREE.Vector3();
  private smoothLook = new THREE.Vector3();
  private look = new THREE.Vector3();
  private hasSmooth = false;
  // Switching follow <-> first person glides the camera between the two (the "zoom into the eyes").
  private viewT = 1;
  private viewFromPos = new THREE.Vector3();
  private viewFromQ = new THREE.Quaternion();
  zoom = 0.35;
  // Highest the camera may go at (x, z), e.g. under the dungeon ceiling. Set by main.ts.
  ceiling: (x: number, z: number) => number = () => Infinity;

  constructor(private camera: THREE.PerspectiveCamera, private player: Player, private colliders: Collider[], public bounds: number, private baseFov: () => number) {
    try { const z = Number(localStorage.getItem(ZOOM_KEY)); if (localStorage.getItem(ZOOM_KEY) !== null && z >= 0 && z <= 1) this.zoom = z; } catch { /* default */ }
  }

  zoomBy(d: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom + d, 0, 1);
    try { localStorage.setItem(ZOOM_KEY, this.zoom.toFixed(3)); } catch { /* blocked */ }
  }
  // FOV of the play view: the overview end of the zoom narrows it toward a near-isometric look.
  get playFov(): number {
    const b = this.baseFov();
    if (!this.player.thirdPerson) return b;
    return THREE.MathUtils.lerp(b, Math.min(b, FOLLOW.fovFar), THREE.MathUtils.clamp((this.zoom - 0.4) / 0.6, 0, 1));
  }

  get inShot(): boolean { return this.shot !== null; }
  get switching(): boolean { return this.viewT < 1; }

  setShot(s: Shot | null) {
    if (s) this.lastShot = s;
    this.shot = s;
  }

  // Run once per frame, after the simulation steps.
  update(dt: number) {
    const p = this.player;
    let near = false;   // follow camera pulled in so close it would sit inside the player's own head
    this.baseQ.setFromEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ'));
    if (!p.thirdPerson) {
      this.basePos.copy(p.eyePos);
      this.free = 0;
      this.hasSmooth = false;
    } else {
      const z = this.zoom, L = THREE.MathUtils.lerp;
      const dist = L(FOLLOW.distNear, FOLLOW.distFar, Math.pow(z, 1.2)), elev = L(FOLLOW.elevNear, FOLLOW.elevFar, z);
      this.look.set(p.pos.x, p.pos.y + L(FOLLOW.lookNear, FOLLOW.lookFar, z), p.pos.z);
      const offset = new THREE.Vector3(Math.sin(p.yaw) * Math.cos(elev), Math.sin(elev), Math.cos(p.yaw) * Math.cos(elev)).multiplyScalar(dist);
      // F2.4 wall collision: walk out from the look point in 5% steps and stop before a collider
      // (walls count only below 9 m, so the overview can look down over the library's roofless walls).
      const q = new THREE.Vector3();
      let target = 0;
      for (let t = 0.05; t <= 1.0001; t += 0.05) {
        q.copy(this.look).addScaledVector(offset, t);
        if (q.y < 0.2 || q.y > this.ceiling(q.x, q.z) || (q.y < 9 && this.blocked(q.x, q.z, controls.thirdPerson.wallPad))) break;
        target = t;
      }
      // Pull in at once (never clip a wall), ease back out (no popping when a tree passes).
      this.free = target < this.free || !this.wasThird ? target : Math.min(target, this.free + dt * 2.5);
      const ideal = q.copy(this.look).addScaledVector(offset, this.free);
      // Ease after the player (frame-rate independent, after SimonDev's Quick_3D_RPG camera); snap on teleports.
      const k = 1 - Math.pow(0.0005, dt);
      if (!this.hasSmooth || this.smoothLook.distanceTo(this.look) > 6) { this.smoothPos.copy(ideal); this.smoothLook.copy(this.look); this.hasSmooth = true; }
      else {
        this.smoothLook.lerp(this.look, k);
        this.smoothPos.lerp(ideal, k);
        if (target < 1) this.smoothPos.copy(ideal);   // against a wall: no lag that could clip it
      }
      this.basePos.copy(this.smoothPos);
      this.m.lookAt(this.basePos, this.smoothLook, this.up);
      this.baseQ.setFromRotationMatrix(this.m);
      near = this.basePos.distanceTo(p.eyePos) < 0.9;
    }
    if (p.thirdPerson !== this.wasThird) { this.viewFromPos.copy(this.camera.position); this.viewFromQ.copy(this.camera.quaternion); this.viewT = 0; }
    if (this.viewT < 1) {
      this.viewT = Math.min(1, this.viewT + dt / 0.45);
      const k = ease(this.viewT);
      this.basePos.lerpVectors(this.viewFromPos, this.basePos, k);
      this.baseQ.slerpQuaternions(this.viewFromQ, this.baseQ, k);
    }
    this.wasThird = p.thirdPerson;
    // The body stays visible while the camera glides into the eyes, and disappears at the end.
    p.body.visible = (p.thirdPerson && !near) || (!p.thirdPerson && this.viewT < 0.8) || this.blend > 0.01 || this.shot !== null;

    this.blend = THREE.MathUtils.clamp(this.blend + (this.shot ? dt : -dt) / 0.6, 0, 1);
    const s = this.shot ?? this.lastShot;
    if (!s || this.blend === 0) {
      this.camera.position.copy(this.basePos);
      this.camera.quaternion.copy(this.baseQ);
      const f = this.playFov;
      if (Math.abs(this.camera.fov - f) > 0.01) { this.camera.fov = f; this.camera.updateProjectionMatrix(); }
      return;
    }
    const k = ease(this.blend);
    this.m.lookAt(s.pos, s.look, this.up);
    this.shotQ.setFromRotationMatrix(this.m);
    this.camera.position.lerpVectors(this.basePos, s.pos, k);
    this.camera.quaternion.slerpQuaternions(this.baseQ, this.shotQ, k);
    const fov = THREE.MathUtils.lerp(this.playFov, s.fov, k);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  // Shot: over the player's shoulder toward a talker's face (F3 dialogue).
  twoShot(target: THREE.Vector3, headY: number): Shot {
    const p = this.player.eyePos, to = new THREE.Vector3(target.x - p.x, 0, target.z - p.z).normalize();
    const right = new THREE.Vector3().crossVectors(to, this.up);
    const pos = new THREE.Vector3(p.x, 0, p.z).addScaledVector(to, -1.8).addScaledVector(right, 1.0);
    pos.y = headY + 0.2;
    return { pos, look: new THREE.Vector3(target.x, headY - 0.05, target.z), fov: 50 };
  }

  // Shot: low three-quarter view of a lectern/book from the reader's side (F3.2 reading).
  readingShot(book: THREE.Vector3): Shot {
    const p = this.player.eyePos, from = new THREE.Vector3(p.x - book.x, 0, p.z - book.z);
    if (from.lengthSq() < 1e-4) from.set(0, 0, 1);
    from.normalize().applyAxisAngle(this.up, 0.6);
    const pos = book.clone().addScaledVector(from, 1.7);
    pos.y = book.y + 0.45;
    return { pos, look: book.clone(), fov: 45 };
  }

  private blocked(x: number, z: number, pad: number): boolean {
    if (Math.abs(x) > this.bounds - pad || Math.abs(z) > this.bounds - pad) return true;
    for (const c of this.colliders) {
      if (c.kind === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; }
      else if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  }
}
