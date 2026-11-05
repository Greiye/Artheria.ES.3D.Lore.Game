// Mike 2026-11-05: the weapon forge shows the weapon in the middle of the screen (the space the panel leaves), large,
// on a soft dark backdrop, instead of floating over the anvil in front of the hero. Drag it (mouse or finger), the
// right stick or the arrow keys turn it. It's its own little scene, drawn over the world after the frame.
import * as THREE from 'three';

function backdropTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(46,40,30,0.92)'); grad.addColorStop(0.6, 'rgba(24,22,18,0.8)'); grad.addColorStop(1, 'rgba(10,10,10,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ForgePreview {
  active = false;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  /** Turned by drags; holds the fitted model. */
  readonly turntable = new THREE.Group();
  private holder = new THREE.Group();
  private size = new THREE.Vector2();

  constructor() {
    this.camera.position.set(0, 0, 4.2);
    this.scene.add(new THREE.AmbientLight('#FFF4E0', 1.4));
    const key = new THREE.DirectionalLight('#FFE8C8', 2.2); key.position.set(2, 3, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight('#9FC8FF', 0.9); rim.position.set(-3, 1, -2); this.scene.add(rim);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: backdropTexture(), transparent: true, depthWrite: false }));
    back.position.z = -1.6; back.renderOrder = -1;
    this.scene.add(back, this.turntable);
    this.turntable.add(this.holder);
  }

  /** Show `model`, fitted to about 1.9 units across and centred. A sword lies on its side; a crossbow shows its flank. */
  set(model: THREE.Object3D, kind: 'crossbow' | 'sword') {
    this.holder.clear();
    const wrap = new THREE.Group(); wrap.add(model);
    if (kind === 'sword') wrap.rotation.z = -Math.PI / 2;   // blade to the right
    else wrap.rotation.y = Math.PI / 2;                     // muzzle to the left, side on
    wrap.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(wrap), c = box.getCenter(new THREE.Vector3()), dim = box.getSize(new THREE.Vector3());
    const k = 1.9 / Math.max(dim.x, dim.y, dim.z, 1e-3);
    wrap.position.sub(c.multiplyScalar(k)); wrap.scale.multiplyScalar(k);
    this.holder.add(wrap);
  }
  reset() { this.turntable.rotation.set(0.25, -0.5, 0); }
  turn(yaw: number, pitch: number) {
    this.turntable.rotation.y += yaw;
    this.turntable.rotation.x = THREE.MathUtils.clamp(this.turntable.rotation.x + pitch, -1.2, 1.2);
  }

  /** Draw over the frame into `rect` (CSS pixels): the part of the screen the panel leaves free. */
  render(renderer: THREE.WebGLRenderer, rect: { x: number; y: number; w: number; h: number }) {
    if (!this.active || rect.w < 40 || rect.h < 40) return;
    renderer.getSize(this.size);
    const H = this.size.y, auto = renderer.autoClear;
    this.camera.aspect = rect.w / rect.h;
    this.camera.fov = rect.w < rect.h ? 44 : 30;   // a tall space (phone held upright): pull back a little
    this.camera.updateProjectionMatrix();
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setViewport(rect.x, H - rect.y - rect.h, rect.w, rect.h);
    renderer.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h);
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, this.size.x, this.size.y);
    renderer.autoClear = auto;
  }
}
