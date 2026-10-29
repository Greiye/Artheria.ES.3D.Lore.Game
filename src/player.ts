import * as THREE from 'three';
import { controls, type Action } from './controls';
import type { Collider } from './world';
import type { Settings } from './settings';
import { buildFigure, GOTHIC_LOOK, type FigureLook } from './world/figure';

const STEP = 0.35;          // m: rises up to this are walked up
const VAULT_MAX = 1.6;      // m: jump at a ledge up to this high (above the feet) to vault or climb it
const MANTLE_REACH = 1.2;   // m: in mid-air, a ledge this far above the feet is caught and climbed

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
  thirdPerson = true;   // rebuild R3: third-person follow is the default view (docs/vision.md)
  readonly body = new THREE.Group();
  readonly eyePos = new THREE.Vector3();   // F3.1 reach is measured from the eyes, not the 3rd-person camera
  // Phase A: in third person the body turns toward where it moves (Legends / modern 3rd-person feel);
  // it faces the view instead when `faceView` is set (first person, crossbow in hand).
  bodyYaw = 0;
  faceView = false;
  hSpeed = 0;                // horizontal speed, m/s, for the animator
  private landedFlag = false;
  get airborne() { return !this.grounded; }
  // v0.04 (Mirror's Edge): a vault over / climb onto a ledge, eased along an arc. null when not vaulting.
  private vault: { from: THREE.Vector3; to: THREE.Vector3; peak: number; t: number; dur: number } | null = null;
  vaults = 0;                // count, for the HUD / haptics / tests
  get vaulting() { return this.vault !== null; }
  /** Ground height of the land itself at (x, z); hills set this (v0.04). */
  terrain: (x: number, z: number) => number = () => 0;
  // True once after touching down (read by the animator for the landing squash).
  consumeLanded(): boolean { const l = this.landedFlag; this.landedFlag = false; return l; }

  constructor(private settings: Settings, private colliders: Collider[], public bounds: number) {
    // PLACEHOLDER: Mega Man Legends-style figure until player.glb exists (H9, docs/vision.md).
    // children[0] is the model slot; children[1] marks "forward" and is hidden once a model shows its own front.
    const figure = buildFigure(GOTHIC_LOOK, controls.eyeHeight + 0.1);
    figure.rotation.y = Math.PI;   // figures face +Z; the player faces -Z at yaw 0
    const facing = new THREE.Object3D();
    facing.name = 'facing';
    facing.position.set(0, controls.eyeHeight - 0.15, -controls.playerRadius - 0.05);
    this.body.add(figure, facing);
    this.body.visible = false;
  }

  // B4 character forge: swap in a figure built from the forged look. Returns the new figure.
  setLook(look: FigureLook, height: number): THREE.Object3D {
    const old = this.body.children[0];
    const figure = buildFigure(look, height);
    figure.rotation.y = Math.PI;
    figure.visible = old.visible;   // stays hidden when a player.glb has replaced it
    figure.userData.replacedBy = old.userData.replacedBy;
    this.body.remove(old);
    this.body.children.unshift(figure); figure.parent = this.body;
    return figure;
  }

  // Where the player is looking (yaw/pitch), independent of where the camera rig currently is.
  lookDir(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  togglePOV() { this.thirdPerson = !this.thirdPerson; if (this.thirdPerson) this.pitch = 0; }

  spawn(p: THREE.Vector3, yaw: number) {
    this.pos.copy(p); this.yaw = yaw; this.bodyYaw = yaw; this.hSpeed = 0; this.pitch = 0; this.vy = 0; this.grounded = true; this.sneaking = false;
    this.eye = controls.eyeHeight;
    this.syncBody();
  }

  // Storybook restyle S1: in the follow view, vertical look input zooms the camera instead of pitching.
  zoomBy: ((d: number) => void) | null = null;

  // F2.1 Mouse: look, pitch clamped ±89°, invert Y + sensitivity from settings (F2.3).
  look(dx: number, dy: number) {
    const k = controls.mouseBase * this.settings.sensitivity;
    const lim = THREE.MathUtils.degToRad(controls.pitchLimitDeg);
    this.yaw -= dx * k;
    if (this.thirdPerson && this.zoomBy) { this.zoomBy(dy * k * 0.5); return; }
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k * (this.settings.invertY ? -1 : 1), -lim, lim);
  }

  jump() {
    if (!this.grounded || this.sneaking || this.vault) return;
    if (this.tryVault(VAULT_MAX)) return;
    this.vy = Math.sqrt(2 * controls.gravity * controls.jumpHeight); // F2.1 Space: ~1 m apex
    this.grounded = false;
  }

  toggleSneak() { this.sneaking = !this.sneaking; }

  // Speed rules (F2 table): run by default; Shift = walk; Caps Lock flips the default; Alt = sprint.
  /** Slows (a snare, a diseased goblin's bite) scale every speed; 1 = none. */
  speedMul = 1;
  speed(): number {
    const s = controls.speeds;
    if (this.sneaking) return s.sneak * this.speedMul;
    if (this.held.has('sprint')) return s.sprint * this.speedMul;
    const running = this.settings.alwaysRun !== this.held.has('walk');
    return (running ? s.run : s.walk) * this.speedMul;
  }

  update(dt: number) {
    if (this.analogLook.x || this.analogLook.y) {
      const lim = THREE.MathUtils.degToRad(controls.pitchLimitDeg);
      this.yaw -= this.analogLook.x * dt;
      if (this.thirdPerson && this.zoomBy) this.zoomBy(this.analogLook.y * dt * 0.35);
      else this.pitch = THREE.MathUtils.clamp(this.pitch - this.analogLook.y * dt * (this.settings.invertY ? -1 : 1), -lim, lim);
    }
    if (this.vault) {   // the vault owns the body until it lands
      const x0 = this.pos.x, z0 = this.pos.z;
      this.stepVault(dt);
      this.hSpeed = Math.hypot(this.pos.x - x0, this.pos.z - z0) / dt;
      this.syncBody();
      return;
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
      const x0 = this.pos.x, z0 = this.pos.z;
      for (let i = 0; i < steps; i++) { this.pos.x += dx / steps; this.pos.z += dz / steps; this.resolve(); }
      const moved = Math.hypot(this.pos.x - x0, this.pos.z - z0);
      this.hSpeed = moved / dt;
      if (!this.faceView && moved > 1e-4) this.turnBody(Math.atan2(-dx, -dz), dt);
    } else this.hSpeed = 0;
    if (this.faceView) this.turnBody(this.yaw, dt);
    // Vertical (F1.3, v0.04): gravity onto the highest ground under the player: the land, or the top of a
    // rock / low wall within a step of the feet. Small rises are stepped up, small drops followed.
    const g = this.groundAt(this.pos.x, this.pos.z);
    if (this.grounded) {
      if (g > this.pos.y - 0.25) this.pos.y = g;
      else { this.grounded = false; this.vy = 0; }
    } else {
      this.vy -= controls.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= g) { this.pos.y = g; this.vy = 0; this.grounded = true; this.landedFlag = true; }
      // Mantle: pushing into a ledge within reach in mid-air pulls the player up onto it.
      else if (this.hSpeed > 0.5 && this.vy < 2) this.tryVault(MANTLE_REACH);
    }
    // D2 / F2 C: eye height eases between 1.7 m and 1.1 m.
    const target = this.sneaking ? controls.sneakEyeHeight : controls.eyeHeight;
    this.eye += (target - this.eye) * Math.min(1, dt * 12);
    this.syncBody();
  }

  private inside(c: Collider, x: number, z: number, pad: number) {
    return c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + pad
      : x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad;
  }
  /** The ground the feet would rest on at (x, z): the land, or a top within a step of the feet. */
  groundAt(x: number, z: number): number {
    let g = this.terrain(x, z);
    for (const c of this.colliders) if (c.top !== undefined && c.top > g && c.top <= this.pos.y + STEP && this.inside(c, x, z, controls.playerRadius * 0.5)) g = c.top;
    return g;
  }
  // Vault / mantle: a ledge just ahead whose top is above a step and within `reach` of the feet. A thin
  // obstacle (a low wall) is vaulted clean over; a deep one is climbed onto.
  private tryVault(reach: number): boolean {
    const fx = -Math.sin(this.bodyYaw), fz = -Math.cos(this.bodyYaw), pr = controls.playerRadius;
    const ax = this.pos.x + fx * (pr + 0.35), az = this.pos.z + fz * (pr + 0.35);
    let best: Collider | null = null;
    for (const c of this.colliders) {
      if (c.top === undefined || c.top <= this.pos.y + STEP || c.top > this.pos.y + reach || !this.inside(c, ax, az, 0.05)) continue;
      if (!best || c.top! > best.top!) best = c;
    }
    if (!best) return false;
    const top = best.top!;
    // How deep is it along the run? Walk forward until we're past it.
    let depth = 0.4;
    while (depth < 2.5 && this.inside(best, this.pos.x + fx * (pr + depth), this.pos.z + fz * (pr + depth), 0)) depth += 0.1;
    const over = depth < 1.1 && this.groundAt(this.pos.x + fx * (pr * 2 + depth + 0.2), this.pos.z + fz * (pr * 2 + depth + 0.2)) < top - STEP;
    const dist = over ? pr * 2 + depth + 0.25 : pr + 0.55;
    const to = new THREE.Vector3(this.pos.x + fx * dist, top, this.pos.z + fz * dist);
    if (over) to.y = this.terrain(to.x, to.z);
    this.vault = { from: this.pos.clone(), to, peak: top + 0.3, t: 0, dur: over ? 0.45 : 0.4 + (top - this.pos.y) * 0.12 };
    this.vy = 0; this.grounded = false; this.vaults++;
    return true;
  }
  private stepVault(dt: number) {
    const v = this.vault!;
    v.t = Math.min(1, v.t + dt / v.dur);
    const k = v.t * v.t * (3 - 2 * v.t), up = Math.min(1, v.t / 0.55);
    this.pos.x = v.from.x + (v.to.x - v.from.x) * k;
    this.pos.z = v.from.z + (v.to.z - v.from.z) * k;
    // Up to the peak first (hands on the ledge), then over and down onto the far side or the top.
    this.pos.y = v.t < 0.55 ? v.from.y + (v.peak - v.from.y) * Math.sin(up * Math.PI / 2) : v.peak + (v.to.y - v.peak) * ((v.t - 0.55) / 0.45) ** 2;
    if (v.t >= 1) { this.pos.y = v.to.y; this.vault = null; this.grounded = true; this.landedFlag = true; this.vy = 0; }
  }

  private turnBody(target: number, dt: number) {
    const d = Math.atan2(Math.sin(target - this.bodyYaw), Math.cos(target - this.bodyYaw));
    this.bodyYaw += d * (1 - Math.exp(-14 * dt));
  }

  // F1.3: push the player circle out of every collider, then clamp to the invisible boundary.
  private resolve() {
    const pr = controls.playerRadius;
    if (this.vault) return;   // the vault's path is already clear of what it goes over
    for (const c of this.colliders) {
      if (c.top !== undefined && this.pos.y >= c.top - STEP) continue;   // standing on it, or stepping up
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

  // Eyes + body follow the simulation; the camera itself is placed by CameraRig (src/camera/rig.ts).
  syncNow() { this.syncBody(); }
  private syncBody() {
    this.eyePos.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.body.position.set(this.pos.x, this.pos.y - (controls.eyeHeight - this.eye) * 0.5, this.pos.z);
    this.body.scale.y = this.eye / controls.eyeHeight;
    this.body.rotation.y = this.bodyYaw;
  }
}
