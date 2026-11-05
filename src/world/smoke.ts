import * as THREE from 'three';
import { rng } from '../tex/pixel';

// UX pass (Mike 2026-10-31): chimney smoke. Lived-in houses show themselves from across the green instead of a
// floating marker. Decor 7 (Mike 2026-11-05, "not billboards"): every puff is a real low-poly 3D cloud (a faceted
// ball, flat shaded) instead of a camera-facing sprite. One instanced mesh for every chimney: each puff rises,
// drifts with the wind, swells, then shrinks away and starts again at its chimney. One draw call, no transparency
// sorting, about 20 triangles a puff.
const PER = 7, LIFE = 6;   // puffs per chimney, seconds each puff lives

export interface Smoke { mesh: THREE.InstancedMesh; update(t: number): void }

export function buildSmoke(scene: THREE.Scene, chimneys: THREE.Vector3[]): Smoke {
  const n = chimneys.length * PER, R = rng(5150), phase = Array.from({ length: n }, () => R()), spin = Array.from({ length: n }, () => R() * Math.PI * 2);
  const mat = new THREE.MeshLambertMaterial({ color: '#E4E0D8', flatShading: true, transparent: true, opacity: 0.88, depthWrite: false });
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat, n);
  mesh.name = 'chimney-smoke'; mesh.frustumCulled = false; mesh.raycast = () => {};
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Puffs darken a touch as they rise (grey-white at the pot, paler as they thin out), per instance.
  for (let i = 0; i < n; i++) mesh.setColorAt(i, new THREE.Color().setHSL(0.09, 0.06, 0.78 + R() * 0.12));
  scene.add(mesh);
  const d = new THREE.Object3D();
  return {
    mesh,
    update(t: number) {
      for (let i = 0; i < n; i++) {
        const c = chimneys[Math.floor(i / PER)], k = ((t / LIFE + i / PER + phase[i] * 0.3) % 1);
        // Rises about 5 m, leans downwind (east-north-east), wobbles a little; swells, then shrinks away at the top.
        d.position.set(c.x + k * k * 2.6 + Math.sin(t * 0.7 + i) * 0.15 * k, c.y + k * 5, c.z - k * k * 1.2 + Math.cos(t * 0.6 + i) * 0.15 * k);
        const sz = (0.3 + k * 0.95) * Math.min(1, k * 8) * Math.min(1, (1 - k) * 3.5);
        d.scale.set(sz, sz * 0.85, sz);
        d.rotation.set(spin[i] + t * 0.3, spin[i] * 1.7 + t * 0.2, 0);
        d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
