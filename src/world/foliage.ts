import * as THREE from 'three';
import { pixelTexture, type TexName } from '../tex/pixel';

// Rebuild R2: dense Vintage Story-style undergrowth. Each tuft is two crossed alpha-cut quads with a
// pixel texture; one InstancedMesh per kind, swaying in a shared wind uniform (vertex shader only).

export const wind = { value: 0 };
const noRaycast = () => {};

function windify(mat: THREE.Material, strength: number) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wp = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #else
        vec3 wp = position;
      #endif
      float sway = sin(uWind * 1.7 + wp.x * 0.35 + wp.z * 0.27) * 0.6 + sin(uWind * 3.1 + wp.x * 0.9) * 0.4;
      transformed.x += sway * ${strength.toFixed(3)} * position.y * position.y;
      transformed.z += sway * ${(strength * 0.6).toFixed(3)} * position.y * position.y;`,
    );
  };
  mat.customProgramCacheKey = () => 'wind' + strength;
}

const crossed = (() => {
  const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const g = new THREE.BufferGeometry();
  const merge = (k: string, n: number) => {
    const out = new Float32Array((a.attributes[k].count + b.attributes[k].count) * n);
    out.set(a.attributes[k].array as Float32Array); out.set(b.attributes[k].array as Float32Array, a.attributes[k].array.length);
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  };
  merge('position', 3); merge('uv', 2);
  // Normals point up: lit like the ground under them, so tufts never go dark on their back side.
  const nrm = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const ia = a.index!.array, idx: number[] = [...ia];
  for (const i of ia) idx.push(i + a.attributes.position.count);
  g.setIndex(idx);
  return g;
})();

export interface Tuft { x: number; z: number; s: number; ry: number }

export function tufts(scene: THREE.Scene, tex: TexName, items: Tuft[], size: [number, number], strength = 0.08): THREE.InstancedMesh {
  const mat = new THREE.MeshLambertMaterial({ map: pixelTexture(tex), alphaTest: 0.5, side: THREE.DoubleSide });
  windify(mat, strength);
  const mesh = new THREE.InstancedMesh(crossed, mat, items.length);
  const d = new THREE.Object3D();
  items.forEach((it, i) => {
    d.position.set(it.x, 0, it.z); d.rotation.set(0, it.ry, 0); d.scale.set(size[0] * it.s, size[1] * it.s, size[0] * it.s);
    d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
  });
  mesh.computeBoundingSphere();
  mesh.raycast = noRaycast;
  mesh.name = 'foliage:' + tex;
  scene.add(mesh);
  return mesh;
}

// Leaf blocks: alpha-cut cubes (Vintage Story leaves), seen from inside too, for canopies and bushes.
export function leafMaterial(tex: TexName): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ map: pixelTexture(tex), alphaTest: 0.5, side: THREE.DoubleSide });
  windify(m, 0.0015);
  return m;
}
