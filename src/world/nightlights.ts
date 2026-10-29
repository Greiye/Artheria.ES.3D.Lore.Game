import * as THREE from 'three';
import type { TimeOfDay } from './sky';

// v0.06 W3: the town and camp at night. Every lantern gets a soft additive halo (one draw call for all of them),
// the lit windows burn brighter, and a few real warm point lights (≤ 4, 2 on Low) follow the player from lantern
// to lantern so the nearest walls and paths catch the light. The count only changes with the time of day or the
// preset, so shaders recompile then (behind the sleep fade), never while walking.
const WARM = '#FFB466';

function haloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,214,150,1)'); r.addColorStop(0.25, 'rgba(255,180,100,0.55)'); r.addColorStop(1, 'rgba(255,150,70,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class NightLights {
  readonly halos: THREE.InstancedMesh;
  readonly lights: THREE.PointLight[] = [];
  private max = 4;
  private time: TimeOfDay = 'day';
  private pick = 0;
  private windowBase: THREE.Color;

  constructor(scene: THREE.Scene, readonly anchors: THREE.Vector3[], private windows: THREE.MeshBasicMaterial) {
    // Camera-facing quads, one instanced draw (point sprites can be clamped to a few pixels on some GPUs).
    this.halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({
      map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, toneMapped: false,
    }), anchors.length);
    this.halos.name = 'night-halos'; this.halos.raycast = () => {}; this.halos.frustumCulled = false;
    scene.add(this.halos);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(WARM, 0, 10, 1.7);
      l.castShadow = false; l.visible = false; l.name = 'night-light';
      scene.add(l); this.lights.push(l);
    }
    this.windowBase = windows.color.clone();
  }

  /** How many real lights may burn (preset). */
  setMax(n: number) { this.max = Math.max(0, Math.min(4, n)); this.setTime(this.time); }
  get lit() { return this.lights.filter((l) => l.visible).length; }

  setTime(t: TimeOfDay) {
    this.time = t;
    const night = t === 'night', dusk = t === 'sunset';
    (this.halos.material as THREE.MeshBasicMaterial).opacity = night ? 0.85 : dusk ? 0.4 : 0;
    this.halos.visible = night || dusk;
    this.lights.forEach((l, i) => { l.visible = night && i < this.max; });
    this.windows.color.copy(this.windowBase).multiplyScalar(night ? 1.9 : dusk ? 1.3 : 1);
    this.pick = 0;
  }

  private m = new THREE.Matrix4();
  private one = new THREE.Vector3(1, 1, 1);
  /** Turn the halos to the camera; move the real lights to the lanterns nearest (x, z) every half second. */
  update(dt: number, x: number, z: number, t: number, camera: THREE.Camera) {
    if (!this.halos.visible) return;
    this.anchors.forEach((a, i) => this.halos.setMatrixAt(i, this.m.compose(a, camera.quaternion, this.one)));
    this.halos.instanceMatrix.needsUpdate = true;
    if (this.time !== 'night') return;
    if ((this.pick -= dt) <= 0) {
      this.pick = 0.5;
      const near = this.anchors.map((a, i) => ({ i, d: (a.x - x) ** 2 + (a.z - z) ** 2 })).sort((a, b) => a.d - b.d);
      this.lights.forEach((l, k) => { const a = near[k] && this.anchors[near[k].i]; if (a) l.position.set(a.x, a.y - 0.25, a.z); });
    }
    // A slow candle flicker so it doesn't read as electric.
    this.lights.forEach((l, k) => { l.intensity = l.visible ? 7 * (0.92 + Math.sin(t * 7.3 + k * 1.9) * 0.05 + Math.sin(t * 13.1 + k) * 0.03) : 0; });
  }
}
