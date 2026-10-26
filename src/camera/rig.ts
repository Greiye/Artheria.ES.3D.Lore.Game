import * as THREE from 'three';
import { controls } from '../controls';
import type { Collider } from '../world';
import type { Player } from '../player';

// Rebuild R3 (docs/vision.md "Camera and perspective"): the camera rig, split out of the player.
// - follow (default): Legends-style third person, 3 m back and 0.5 m right of the eyes, never inside a wall.
// - first person (F): camera at the eyes.
// - shot: a framed cinematic pose for reading and dialogue, blended in and out over ~0.6 s.
export interface Shot { pos: THREE.Vector3; look: THREE.Vector3; fov: number }

const ease = (t: number) => t * t * (3 - 2 * t);

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

  constructor(private camera: THREE.PerspectiveCamera, private player: Player, private colliders: Collider[], public bounds: number, private baseFov: () => number) {}

  get inShot(): boolean { return this.shot !== null; }

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
    } else {
      const offset = new THREE.Vector3(0, 0, controls.thirdPerson.back).applyQuaternion(this.baseQ)
        .add(new THREE.Vector3(controls.thirdPerson.right, 0, 0).applyAxisAngle(this.up, p.yaw));
      // F2.4 wall collision: walk out from the eyes in 5% steps and stop before a collider.
      const q = new THREE.Vector3();
      let target = 0;
      for (let t = 0.05; t <= 1.0001; t += 0.05) {
        q.copy(p.eyePos).addScaledVector(offset, t);
        if (q.y < 0.2 || this.blocked(q.x, q.z, controls.thirdPerson.wallPad)) break;
        target = t;
      }
      // Pull in at once (never clip a wall), ease back out (no popping when a tree passes).
      this.free = target < this.free || !this.wasThird ? target : Math.min(target, this.free + dt * 2.5);
      this.basePos.copy(p.eyePos).addScaledVector(offset, this.free);
      near = this.free * offset.length() < 0.9;
    }
    this.wasThird = p.thirdPerson;
    p.body.visible = (p.thirdPerson && !near) || this.blend > 0.01 || this.shot !== null;

    this.blend = THREE.MathUtils.clamp(this.blend + (this.shot ? dt : -dt) / 0.6, 0, 1);
    const s = this.shot ?? this.lastShot;
    if (!s || this.blend === 0) {
      this.camera.position.copy(this.basePos);
      this.camera.quaternion.copy(this.baseQ);
      return;
    }
    const k = ease(this.blend);
    this.m.lookAt(s.pos, s.look, this.up);
    this.shotQ.setFromRotationMatrix(this.m);
    this.camera.position.lerpVectors(this.basePos, s.pos, k);
    this.camera.quaternion.slerpQuaternions(this.baseQ, this.shotQ, k);
    const fov = THREE.MathUtils.lerp(this.baseFov(), s.fov, k);
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
