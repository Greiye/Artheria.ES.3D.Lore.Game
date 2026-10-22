import * as THREE from 'three';
import { controls, type Action } from './controls';
import type { Collider } from './world';
import type { Settings } from './settings';
import { buildFigure } from './world/figure';

// M1 — first-person player. Covers D2, F2.1 (movement half), F1.3.
// Pointer lock is used when the browser grants it; otherwise hold the left mouse button to look
// (sandboxed previews and some embeds deny pointer lock — the game must still be playable).
export class Player {
  readonly pos = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  private vy = 0;
  private grounded = true;
  sneaking = false;
  private eye: number = controls.eyeHeight;
  readonly held = new Set<Action>();
  // Analog move input from a thumbstick / touch joystick: x = right, y = forward, each -1..1.
  // Skyrim-style: a small deflection walks, a full one runs.
  readonly analog = { x: 0, y: 0 };
  readonly analogLook = { x: 0, y: 0 };   // rad/s, from the right stick
  // D2 / F2.4: F toggles third person. A6 body = Legends-style figure, shown only in 3rd person.
  thirdPerson = false;
  readonly body = new THREE.Group();
  readonly eyePos = new THREE.Vector3();   // F3.1 reach is measured from the eyes, not the 3rd-person camera

  constructor(private camera: THREE.PerspectiveCamera, private settings: Settings, private colliders: Collider[], private bounds: number) {
    // PLACEHOLDER: Mega Man Legends-style figure until player.glb exists (H9, docs/vision.md).
    // children[0] is the model slot; children[1] marks "forward" and is hidden once a model shows its own front.
    const figure = buildFigure({ skin: '#F0C8A0', hair: '#5A3420', primary: '#4F7A3A', secondary: '#C9B48A', boots: '#5A3A22', accent: '#7A5236', hairStyle: 'spiky' }, controls.eyeHeight + 0.1);
    figure.rotation.y = Math.PI;   // figures face +Z; the player faces -Z at yaw 0
    const facing = new THREE.Object3D();
    facing.name = 'facing';
    facing.position.set(0, controls.eyeHeight - 0.15, -controls.playerRadius - 0.05);
    this.body.add(figure, facing);
    this.body.visible = false;
  }

  togglePOV() { this.thirdPerson = !this.thirdPerson; this.syncCamera(); }

  spawn(p: THREE.Vector3, yaw: number) {
    this.pos.copy(p); this.yaw = yaw; this.pitch = 0; this.vy = 0; this.grounded = true; this.sneaking = false;
    this.eye = controls.eyeHeight;
    this.syncCamera();
  }

  // F2.1 Mouse: look, pitch clamped ±89°, invert Y + sensitivity from settings (F2.3).
  look(dx: number, dy: number) {
    const k = controls.mouseBase * this.settings.sensitivity;
    const lim = THREE.MathUtils.degToRad(controls.pitchLimitDeg);
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k * (this.settings.invertY ? -1 : 1), -lim, lim);
  }

  jump() {
    if (!this.grounded || this.sneaking) return;
    this.vy = Math.sqrt(2 * controls.gravity * controls.jumpHeight); // F2.1 Space: ~1 m apex
    this.grounded = false;
  }

  toggleSneak() { this.sneaking = !this.sneaking; }

  // Speed rules (F2 table): run by default; Shift = walk; Caps Lock flips the default; Alt = sprint.
  speed(): number {
    const s = controls.speeds;
    if (this.sneaking) return s.sneak;
    if (this.held.has('sprint')) return s.sprint;
    const running = this.settings.alwaysRun !== this.held.has('walk');
    return running ? s.run : s.walk;
  }

  update(dt: number) {
    if (this.analogLook.x || this.analogLook.y) {
      const lim = THREE.MathUtils.degToRad(controls.pitchLimitDeg);
      this.yaw -= this.analogLook.x * dt;
      this.pitch = THREE.MathUtils.clamp(this.pitch - this.analogLook.y * dt * (this.settings.invertY ? -1 : 1), -lim, lim);
    }
    let f = (this.held.has('forward') ? 1 : 0) - (this.held.has('back') ? 1 : 0);
    let r = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    let scale = 1;
    const mag = Math.min(1, Math.hypot(this.analog.x, this.analog.y));
    if (!f && !r && mag > 0) {
      f = this.analog.y; r = this.analog.x;
      // Partial stick = walk pace, full stick = current pace (run / sprint).
      scale = mag < controls.analogRunThreshold ? Math.min(1, controls.speeds.walk / this.speed()) * (mag / controls.analogRunThreshold) : 1;
    }
    if (f || r) {
      const len = Math.hypot(f, r), sp = this.speed() * dt * scale;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // yaw 0 faces -Z; right is +X.
      const dx = (r * cos - f * sin) / len * sp;
      const dz = (-r * sin - f * cos) / len * sp;
      // Sub-step so a sprint frame can't tunnel through a thin collider.
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
      for (let i = 0; i < steps; i++) { this.pos.x += dx / steps; this.pos.z += dz / steps; this.resolve(); }
    }
    // Vertical: gravity + flat ground at y = 0 (F1.3 ground collision).
    if (!this.grounded) {
      this.vy -= controls.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.grounded = true; }
    }
    // D2 / F2 C: eye height eases between 1.7 m and 1.1 m.
    const target = this.sneaking ? controls.sneakEyeHeight : controls.eyeHeight;
    this.eye += (target - this.eye) * Math.min(1, dt * 12);
    this.syncCamera();
  }

  // F1.3: push the player circle out of every collider, then clamp to the invisible boundary.
  private resolve() {
    const pr = controls.playerRadius;
    for (const c of this.colliders) {
      if (c.kind === 'circle') {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + pr;
        if (d < min) {
          const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
          this.pos.x = c.x + nx * min; this.pos.z = c.z + nz * min;
        }
      } else {
        const cx = THREE.MathUtils.clamp(this.pos.x, c.minX, c.maxX), cz = THREE.MathUtils.clamp(this.pos.z, c.minZ, c.maxZ);
        const dx = this.pos.x - cx, dz = this.pos.z - cz, d = Math.hypot(dx, dz);
        if (d < pr) {
          if (d > 1e-6) { this.pos.x = cx + dx / d * pr; this.pos.z = cz + dz / d * pr; }
          else {
            // Centre inside the box: exit through the nearest face.
            const opts = [[c.minX - pr - this.pos.x, 0], [c.maxX + pr - this.pos.x, 0], [0, c.minZ - pr - this.pos.z], [0, c.maxZ + pr - this.pos.z]];
            opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
            this.pos.x += opts[0][0]; this.pos.z += opts[0][1];
          }
        }
      }
    }
    const lim = this.bounds - pr;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
  }

  private syncCamera() {
    this.eyePos.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.body.visible = this.thirdPerson;
    this.body.position.set(this.pos.x, this.pos.y - (controls.eyeHeight - this.eye) * 0.5, this.pos.z);
    this.body.scale.y = this.eye / controls.eyeHeight;
    this.body.rotation.y = this.yaw;
    if (!this.thirdPerson) { this.camera.position.copy(this.eyePos); return; }
    // D2 default: 3 m back, 0.5 m right of the eyes, pulled in so it never ends up inside a collider.
    const back = new THREE.Vector3(0, 0, 1).applyEuler(this.camera.rotation).multiplyScalar(controls.thirdPerson.back);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).multiplyScalar(controls.thirdPerson.right);
    const offset = back.add(right);
    const p = new THREE.Vector3();
    let free = 0;
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      p.copy(this.eyePos).addScaledVector(offset, t);
      if (p.y < 0.2 || this.blocked(p.x, p.z, controls.thirdPerson.wallPad)) break;
      free = t;
    }
    this.camera.position.copy(this.eyePos).addScaledVector(offset, free);
  }

  // F2.4 camera wall collision: is this XZ point inside (or within `pad` of) a collider or past the edge?
  private blocked(x: number, z: number, pad: number): boolean {
    if (Math.abs(x) > this.bounds - pad || Math.abs(z) > this.bounds - pad) return true;
    for (const c of this.colliders) {
      if (c.kind === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; }
      else if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  }
}
