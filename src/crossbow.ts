// F4 crossbow (roadmap 0.05). 1 equips, 2 hands; RMB aims down sights (FOV −15°); LMB fires.
// Bolts fly at 60 m/s with gravity and stick for 30 s (F4.2). R = active reload (F4.3, Gears of War):
// a 2 s bar; R again inside the 15% zone = 0.5 s reload + 2× damage on the next shot; outside it = 3 s jam.
// Shots use bolts from the inventory; E on a stuck bolt picks it back up (F4.4).
// PLACEHOLDER: box crossbow + box bolts (A6) until a .glb exists.
import * as THREE from 'three';
import type { Inventory } from './inventory';
import type { Player } from './player';
import { buildCrossbowModel, loadWeapon, type WeaponCosmetic } from './forge/weapon';

export const BOLT_SPEED = 60;         // m/s (F4.2)
export const STICK_SECONDS = 30;      // F4.2
export const RELOAD_SECONDS = 2;      // F4.3 normal reload
export const FAST_RELOAD_SECONDS = 0.5;
export const JAM_SECONDS = 3;
// F4.3 the 15% "perfect" window, as a fraction of the 2 s bar: 0.3–0.6 s in, so a perfect press finishes the
// reload at 0.5 s (or at once, if pressed after 0.5 s). See docs/assumptions.md.
export const ZONE = { start: 0.15, end: 0.30 };
const GRAVITY = 9.8;
const BOLT_GEO = new THREE.BoxGeometry(0.02, 0.02, 0.4);
const BOLT_MAT = new THREE.MeshLambertMaterial({ color: 0xD9D8CC });
const ADS_FOV_DROP = 15;              // F4.1

export interface Bolt { mesh: THREE.Mesh; origin: THREE.Vector3; vel: THREE.Vector3; stuck: boolean; age: number; damage: number; hitbox: THREE.Mesh }
export type ReloadState = { active: false } | { active: true; t: number; mode: 'normal' | 'fast' | 'jam'; total: number };

export class Crossbow {
  equipped = false;
  loaded = false;
  ads = false;
  bonusNextShot = false;
  reload: ReloadState = { active: false };
  lastReloadOutcome: 'normal' | 'fast' | 'jam' | null = null;
  readonly bolts: Bolt[] = [];
  readonly viewmodel = new THREE.Group();
  private loadedBolt!: THREE.Mesh;
  private fovOffset = 0;
  private ray = new THREE.Raycaster();
  onFire: () => void = () => undefined;
  onReloadClick: () => void = () => undefined;
  onChange: () => void = () => undefined;

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, private player: Player,
    private inventory: Inventory, private solids: THREE.Object3D[], private baseFov: () => number) {
    // Rebuild R4: pixel-textured like the world (docs/vision.md), lit by the same sun.
    // Phase B (B5): the parts and materials come from the player's weapon forge cosmetic.
    this.loadedBolt = this.applyCosmetic(loadWeapon());
    this.viewmodel.visible = false;
    camera.add(this.viewmodel);
    this.placeViewmodel(0);
  }

  // B5: rebuild the held crossbow from a cosmetic (looks only; stats never change).
  applyCosmetic(c: WeaponCosmetic): THREE.Mesh {
    this.viewmodel.clear();
    const model = buildCrossbowModel(c);
    this.viewmodel.add(...model.children);
    this.loadedBolt = this.viewmodel.getObjectByName('loadedBolt') as THREE.Mesh;
    return this.loadedBolt;
  }

  get bolts_left() { return this.inventory.count('bolt'); }
  get reloading() { return this.reload.active; }

  equip() {
    if (this.inventory.count('crossbow') < 1) return false;
    this.equipped = true;
    this.onChange();
    return true;
  }
  unequip() { this.equipped = false; this.ads = false; this.onChange(); }

  setADS(on: boolean) { this.ads = on && this.equipped; }

  // F4.1 / F4.2 / F4.4: one loaded bolt leaves the muzzle; it was already taken from the inventory when loaded.
  fire(): boolean {
    if (!this.equipped || !this.loaded || this.reload.active) return false;
    this.loaded = false;
    const dir = new THREE.Vector3();
    this.player.lookDir(dir);   // R3: aim follows the player's view even while the camera rig is blending
    const start = this.player.eyePos.clone().addScaledVector(dir, 0.45);
    const mesh = new THREE.Mesh(BOLT_GEO, BOLT_MAT);
    mesh.position.copy(start);
    mesh.lookAt(start.clone().add(dir));
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
    mesh.add(hitbox);
    this.scene.add(mesh);
    this.bolts.push({ mesh, origin: start.clone(), vel: dir.multiplyScalar(BOLT_SPEED), stuck: false, age: 0, damage: this.bonusNextShot ? 2 : 1, hitbox });
    this.bonusNextShot = false;
    this.onFire();
    this.onChange();
    return true;
  }

  // F4.3: first R starts the bar; a second R during it decides fast (in zone) or jam (outside).
  pressReload() {
    if (!this.equipped) return;
    if (!this.reload.active) {
      if (this.loaded || this.inventory.count('bolt') < 1) return;
      this.reload = { active: true, t: 0, mode: 'normal', total: RELOAD_SECONDS };
      this.onReloadClick();
    } else if (this.reload.mode === 'normal') {
      const f = this.reload.t / RELOAD_SECONDS;
      if (f >= ZONE.start && f <= ZONE.end) this.reload = { ...this.reload, mode: 'fast', total: Math.max(this.reload.t, FAST_RELOAD_SECONDS) };
      else this.reload = { ...this.reload, mode: 'jam', total: JAM_SECONDS };
    }
    this.onChange();
  }

  private finishReload() {
    if (!this.reload.active) return;
    const mode = this.reload.mode;
    this.reload = { active: false };
    if (!this.inventory.take('bolt', 1)) return;
    this.loaded = true;
    this.lastReloadOutcome = mode;
    if (mode === 'fast') this.bonusNextShot = true;
    this.onReloadClick();
    this.onChange();
  }

  // F4.4: the stuck bolt under the crosshair within reach, if any.
  boltAt(origin: THREE.Vector3, dir: THREE.Vector3, reach: number): Bolt | null {
    this.ray.set(origin, dir); this.ray.far = reach;
    const stuck = this.bolts.filter((b) => b.stuck);
    const hit = this.ray.intersectObjects(stuck.map((b) => b.hitbox), false)[0];
    return hit ? stuck.find((b) => b.hitbox === hit.object) ?? null : null;
  }
  pickUp(b: Bolt) {
    this.removeBolt(b);
    this.inventory.give('bolt', 1);
    this.onChange();
  }
  private removeBolt(b: Bolt) {
    this.scene.remove(b.mesh);   // geometry and material are shared by every bolt
    this.bolts.splice(this.bolts.indexOf(b), 1);
  }

  update(dt: number) {
    // F4.3 reload timer.
    if (this.reload.active) {
      this.reload.t += dt;
      if (this.reload.t >= this.reload.total) this.finishReload();
    }
    // F4.2 projectiles: integrate, then sweep the segment against solids and the ground.
    for (const b of [...this.bolts]) {
      b.age += dt;
      if (b.stuck) { if (b.age > STICK_SECONDS) this.removeBolt(b); continue; }
      const from = b.mesh.position.clone();
      b.vel.y -= GRAVITY * dt;
      const step = b.vel.clone().multiplyScalar(dt);
      const len = step.length();
      this.ray.set(from, step.clone().normalize()); this.ray.far = len + 0.2;
      const hit = this.ray.intersectObjects(this.solids, false)[0];
      if (hit) { b.mesh.position.copy(hit.point).addScaledVector(step.normalize(), -0.12); b.stuck = true; b.age = 0; continue; }
      const to = from.add(step);
      if (to.y <= 0.02) { to.y = 0.02; b.mesh.position.copy(to); b.stuck = true; b.age = 0; continue; }
      if (b.age > 6) { this.removeBolt(b); continue; }   // flew off the map
      b.mesh.position.copy(to);
      b.mesh.lookAt(to.clone().add(b.vel));
    }
    // F4.1 ADS: lerp the FOV down 15°; viewmodel visible only in first person with the crossbow in hand.
    const target = this.ads ? ADS_FOV_DROP : 0;
    this.fovOffset += (target - this.fovOffset) * Math.min(1, dt * 12);
    const fov = this.baseFov() - this.fovOffset;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.viewmodel.visible = this.equipped && !this.player.thirdPerson;
    this.loadedBolt.visible = this.loaded;
    this.placeViewmodel(this.fovOffset / ADS_FOV_DROP);
  }

  private placeViewmodel(k: number) {
    this.viewmodel.position.set(THREE.MathUtils.lerp(0.22, 0, k), THREE.MathUtils.lerp(-0.2, -0.09, k), THREE.MathUtils.lerp(-0.45, -0.36, k));
  }
}
