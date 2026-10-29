import * as THREE from 'three';
import { pixelTexture, rng, type TexName } from '../tex/pixel';
import type { Batch } from './batch';
import type { Collider } from './index';

// Style pass 2 (docs style plan item 5): worn footpaths painted into the ground, and mossy rock outcrops.
// The paths are one small mask texture over the play area, so the ground stays one mesh and one draw call:
// its shader blends the dirt texture in wherever the mask says a path runs.
const SPAN = 120, PX = 512;   // the mask covers x, z in −60…60 at ~0.23 m a pixel
// Polylines (x, z) between the places people walk: spawn to the town lane, the camp, the gallery hall, the dojo,
// the rock climb, and the coach road out to the west gate.
const PATHS: [number, number][][] = [
  [[0, 8.5], [0.3, 12], [-0.2, 16], [0, 20], [0, 24.5]],
  [[-2.6, 1.2], [-4.2, 1.8], [-5.4, 1.6]],
  [[2.6, 3.4], [6, 4.6], [9.6, 5.4]],
  [[-2.2, 9], [-6, 11.2], [-9.6, 12.6], [-11.5, 13.2]],
  [[3.2, -11], [8, -14.5], [14, -17.5], [19.5, -19.5]],
  [[-9, -3.6], [-14, -4.2], [-22, -3.8], [-30, -4.2], [-38, -4], [-44, -4]],
  [[-19.5, 26.5], [-30, 27], [-40, 25]],   // off the green's west side, over the footbridge
  [[-34, 26.4], [-35.6, 22], [-35.6, 19.3]],   // to the windmill door
  [[27.5, 26.5], [36, 24], [44, 25]],
];
const W = 1.9;   // path width, metres

function pathMask(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = PX;
  const g = c.getContext('2d')!;
  const R = rng(9191), k = PX / SPAN, at = (x: number, z: number): [number, number] => [(x + SPAN / 2) * k, (z + SPAN / 2) * k];
  g.fillStyle = '#000'; g.fillRect(0, 0, PX, PX);
  g.lineCap = g.lineJoin = 'round';
  for (const line of PATHS) {
    // Wobble the line a little (worn paths are never ruler-straight), then stroke wide-and-faint to narrow-and-solid
    // so the edge fades into the grass.
    const pts: [number, number][] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, z0] = line[i], [x1, z1] = line[i + 1], n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.5));
      for (let s = 0; s < n; s++) { const t = s / n; pts.push(at(x0 + (x1 - x0) * t + (R() - 0.5) * 0.35, z0 + (z1 - z0) * t + (R() - 0.5) * 0.35)); }
    }
    pts.push(at(...line[line.length - 1]));
    for (const [w, a] of [[1.7, 0.18], [1.35, 0.3], [1.0, 0.55], [0.7, 0.9]]) {
      g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = W * w * k;
      g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.stroke();
    }
    // Grass creeping back in down the middle (the two wheel ruts of a cart track read as one worn strip here).
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = W * 0.18 * k;
    g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

/** The ground's material: painted grass, with dirt blended in along the paths (one draw call). */
export function groundMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ map: pixelTexture('grass') });
  const mask = pathMask(), dirt = pixelTexture('dirt');
  m.onBeforeCompile = (sh) => {
    sh.uniforms.pathMask = { value: mask }; sh.uniforms.dirtMap = { value: dirt };
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec2 vGroundXZ;\nvoid main() {\n  vGroundXZ = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform sampler2D pathMask;\nuniform sampler2D dirtMap;\nvarying vec2 vGroundXZ;\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float pm = texture2D(pathMask, (vGroundXZ + ${(SPAN / 2).toFixed(1)}) / ${SPAN.toFixed(1)}).r;
        vec4 dirt = texture2D(dirtMap, vMapUv * 0.8);
        // A ragged edge: the dirt's own brightness decides which side of the fade a texel falls.
        float k = smoothstep(0.25, 0.7, pm + (dirt.r - 0.5) * 0.35);
        diffuseColor.rgb = mix(diffuseColor.rgb, dirt.rgb * vec3(1.02, 0.97, 0.9), k);
      }`);
  };
  m.customProgramCacheKey = () => 'ground-paths';
  return m;
}

/** A small outcrop: three or four rocks leaning together, the big one with a mossy cap. Batched (no new draw calls). */
export function outcrop(B: Batch, tex: (n: TexName) => THREE.Material, colliders: Collider[], x: number, z: number, gy: number, R: () => number) {
  const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
  const big = 1.0 + R() * 0.7, n = 3 + Math.floor(R() * 2);
  B.add(tex('stone'), new THREE.DodecahedronGeometry(1, 0), V(x, gy + big * 0.55, z), V(big * 1.25, big * 0.95, big), R() * 6);
  B.add(tex('mossStone'), new THREE.DodecahedronGeometry(1, 0), V(x, gy + big * 1.18, z), V(big * 0.95, big * 0.32, big * 0.8), R() * 6);   // moss cap
  colliders.push({ kind: 'circle', x, z, r: big * 1.15 });
  for (let i = 1; i < n; i++) {
    const a = R() * Math.PI * 2, d = big * (1.1 + R() * 0.5), s = big * (0.35 + R() * 0.3);
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    B.add(tex(R() < 0.5 ? 'stone' : 'mossStone'), new THREE.DodecahedronGeometry(1, 0), V(px, gy + s * 0.45, pz), V(s * 1.2, s * 0.9, s), R() * 6, 0, (R() - 0.5) * 0.5);
    colliders.push({ kind: 'circle', x: px, z: pz, r: s * 1.05 });
  }
}
