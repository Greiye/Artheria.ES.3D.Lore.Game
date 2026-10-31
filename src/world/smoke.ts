import * as THREE from 'three';
import { rng } from '../tex/pixel';

// UX pass (Mike 2026-10-31): chimney smoke. Lived-in houses show themselves from across the green instead of a
// floating marker. One Points cloud for every chimney: each puff rises, drifts with the wind, grows and fades,
// then starts again at its chimney. One draw call.
const PER = 7, LIFE = 6;   // puffs per chimney, seconds each puff lives

function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, r = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  r.addColorStop(0, 'rgba(235,230,220,.9)'); r.addColorStop(0.6, 'rgba(210,205,198,.45)'); r.addColorStop(1, 'rgba(200,196,190,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Smoke { points: THREE.Points; update(t: number): void }

export function buildSmoke(scene: THREE.Scene, chimneys: THREE.Vector3[]): Smoke {
  const n = chimneys.length * PER, pos = new Float32Array(n * 3), R = rng(5150), phase = Array.from({ length: n }, () => R());
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: puffTexture(), size: 1.6, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.name = 'chimney-smoke'; points.frustumCulled = false; points.raycast = () => {};
  scene.add(points);
  return {
    points,
    update(t: number) {
      for (let i = 0; i < n; i++) {
        const c = chimneys[Math.floor(i / PER)], k = ((t / LIFE + i / PER + phase[i] * 0.3) % 1);
        // Rises about 5 m, leans downwind (east-north-east), wobbles a little.
        pos[i * 3] = c.x + k * k * 2.6 + Math.sin(t * 0.7 + i) * 0.15 * k;
        pos[i * 3 + 1] = c.y + k * 5;
        pos[i * 3 + 2] = c.z - k * k * 1.2 + Math.cos(t * 0.6 + i) * 0.15 * k;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
