import * as THREE from 'three';

// Phase A polish: little pixel dust puffs kicked up by footsteps and landings (third person only).
// One pooled InstancedMesh of camera-facing quads, so it costs a single draw call.
const N = 32, LIFE = 0.7;

function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const g = c.getContext('2d')!;
  // An 8 px blocky blob: matches the pixel look instead of a soft gradient.
  const rows = ['..xxxx..', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..'];
  g.fillStyle = '#E8D9B0';
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'x') g.fillRect(x, y, 1, 1); }));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Dust {
  readonly mesh: THREE.InstancedMesh;
  private age = new Float32Array(N).fill(LIFE);
  private pos: THREE.Vector3[] = Array.from({ length: N }, () => new THREE.Vector3());
  private vel: THREE.Vector3[] = Array.from({ length: N }, () => new THREE.Vector3());
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private col = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0.75 });
    // The per-instance colour carries each puff's fade (red channel = alpha); the puffs stay one colour.
    mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.a *= vColor.r;'); };
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, N);
    this.mesh.name = 'dust';
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, this.col.setRGB(1, 1, 1));
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  // A puff at a foot (or several at once for a landing).
  burst(at: THREE.Vector3, n = 1, spread = 0.25) {
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % N;
      this.age[i] = 0;
      const a = Math.random() * Math.PI * 2;
      this.pos[i].set(at.x + Math.cos(a) * spread * Math.random(), 0.06, at.z + Math.sin(a) * spread * Math.random());
      this.vel[i].set(Math.cos(a) * 0.5, 0.35 + Math.random() * 0.3, Math.sin(a) * 0.5);
    }
  }

  update(dt: number, camera: THREE.Camera) {
    camera.getWorldQuaternion(this.q);
    let live = 0;
    for (let i = 0; i < N; i++) {
      if (this.age[i] >= LIFE) continue;
      this.age[i] += dt;
      const k = Math.min(1, this.age[i] / LIFE);
      this.pos[i].addScaledVector(this.vel[i], dt);
      this.vel[i].multiplyScalar(Math.exp(-3 * dt));
      const size = 0.12 + k * 0.28;
      this.s.set(size, size, size);
      this.m.compose(this.pos[i], this.q, this.s);
      this.mesh.setMatrixAt(live, this.m);
      this.mesh.setColorAt(live, this.col.setScalar(1 - k));
      live++;
    }
    this.mesh.count = live;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
