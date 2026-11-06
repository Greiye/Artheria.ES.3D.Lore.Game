import * as THREE from 'three';
// Mike 2026-11-06 (Round B, B4): a Mage learns magic missile from Magister Greer. A small bolt of pale light flies
// where you look, bends a little toward the nearest goblin ahead and lights the walls as it goes. One light is shared by
// every bolt (the newest carries it), added to the scene once the spell is learned so other heroes pay nothing for it.

export const MISSILE = {
  cd: 1.2,        // s between casts
  speed: 15,      // m/s
  range: 26,      // m before it fades
  damage: 2,
  seek: 2.2,      // rad/s it can turn toward a foe ahead
  cone: 0.45,     // rad: how far off the line of flight a foe can be to draw it
  light: { color: 0xbfd8ff, intensity: 2.6, distance: 9, decay: 1.6 },
};

type Target = { dist: number; hit: (damage: number, dir: THREE.Vector3) => boolean } | null;
interface Bolt { mesh: THREE.Object3D; vel: THREE.Vector3; travelled: number; fade: number }

const CORE_GEO = new THREE.IcosahedronGeometry(0.09, 0);
const CORE_MAT = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
const GLOW_GEO = new THREE.IcosahedronGeometry(0.24, 1);
const GLOW_MAT = new THREE.MeshBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });

export class MagicMissile {
  learned = false;
  cd = 0;
  readonly bolts: Bolt[] = [];
  readonly light = new THREE.PointLight(MISSILE.light.color, 0, MISSILE.light.distance, MISSILE.light.decay);
  /** Goblins: the nearest one a step passes through, and what a hit does. */
  targets: ((from: THREE.Vector3, dir: THREE.Vector3, len: number) => Target) | null = null;
  /** Where the living foes stand (for the gentle homing). */
  foes: () => THREE.Vector3[] = () => [];
  /** Hits so far (tests and the casebook). */
  hits = 0;
  private ray = new THREE.Raycaster();
  private lit = false;

  constructor(private scene: THREE.Scene, private solids: THREE.Object3D[], private terrain: (x: number, z: number) => number) {
    this.light.castShadow = false;
  }

  /** The spell is known: give it its light (once). */
  learn() {
    this.learned = true;
    if (!this.lit) { this.lit = true; this.scene.add(this.light); }
  }

  /** Cast from `from` along `dir` (normalised). False while cooling or unlearned. */
  cast(from: THREE.Vector3, dir: THREE.Vector3): boolean {
    if (!this.learned || this.cd > 0) return false;
    this.cd = MISSILE.cd;
    const mesh = new THREE.Group();
    const core = new THREE.Mesh(CORE_GEO, CORE_MAT), glow = new THREE.Mesh(GLOW_GEO, GLOW_MAT);
    core.raycast = glow.raycast = () => {};
    mesh.add(core, glow);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.bolts.push({ mesh, vel: dir.clone().normalize().multiplyScalar(MISSILE.speed), travelled: 0, fade: 0 });
    return true;
  }

  update(dt: number) {
    this.cd = Math.max(0, this.cd - dt);
    for (const b of [...this.bolts]) {
      if (b.fade > 0) {   // spent: a short flare as it winks out
        b.fade -= dt; b.mesh.scale.setScalar(1 + (0.25 - Math.max(0, b.fade)) * 6);
        if (b.fade <= 0) this.remove(b);
        continue;
      }
      this.home(b, dt);
      const from = b.mesh.position.clone(), step = b.vel.clone().multiplyScalar(dt), len = step.length(), dir = step.clone().normalize();
      this.ray.set(from, dir); this.ray.far = len + 0.1;
      const wall = this.ray.intersectObjects(this.solids, false)[0];
      const foe = this.targets?.(from, dir, len + 0.1) ?? null;
      if (foe && (!wall || foe.dist < wall.distance)) {
        b.mesh.position.addScaledVector(dir, foe.dist);
        if (foe.hit(MISSILE.damage, dir)) this.hits++;
        b.fade = 0.25; continue;
      }
      if (wall) { b.mesh.position.copy(wall.point).addScaledVector(dir, -0.1); b.fade = 0.25; continue; }
      b.mesh.position.add(step);
      b.travelled += len;
      const p = b.mesh.position;
      if (p.y <= this.terrain(p.x, p.z) + 0.03 || b.travelled > MISSILE.range) { b.fade = 0.25; continue; }
      b.mesh.rotation.y += dt * 9; b.mesh.rotation.x += dt * 5;
    }
    // The newest bolt carries the light; it flickers a little and dims as the bolt winks out.
    const lead = this.bolts[this.bolts.length - 1];
    if (lead) {
      this.light.position.copy(lead.mesh.position);
      const f = lead.fade > 0 ? Math.max(0, lead.fade / 0.25) * 1.6 : 1;
      this.light.intensity = MISSILE.light.intensity * f * (0.9 + Math.random() * 0.2);
    } else this.light.intensity = 0;
  }

  /** Bend gently toward the nearest foe inside the cone ahead. */
  private home(b: Bolt, dt: number) {
    const p = b.mesh.position, v = b.vel.clone().normalize();
    let best: THREE.Vector3 | null = null, bestD = Infinity;
    for (const f of this.foes()) {
      const to = new THREE.Vector3(f.x, f.y + 0.6, f.z).sub(p), d = to.length();
      if (d < 0.3 || d > MISSILE.range || to.normalize().angleTo(v) > MISSILE.cone) continue;
      if (d < bestD) { bestD = d; best = to; }
    }
    if (!best) return;
    const ang = v.angleTo(best), turn = Math.min(1, (MISSILE.seek * dt) / Math.max(ang, 1e-4));
    b.vel.copy(v.lerp(best, turn).normalize().multiplyScalar(MISSILE.speed));
  }

  private remove(b: Bolt) {
    this.scene.remove(b.mesh);
    this.bolts.splice(this.bolts.indexOf(b), 1);
  }

  clear() { for (const b of [...this.bolts]) this.remove(b); this.light.intensity = 0; }
}
