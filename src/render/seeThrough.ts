import * as THREE from 'three';

// B45 (Mike 2026-11-03): "The camera pulls in to avoid buildings and objects. I want to look through them."
// With see-through on, the follow camera no longer pulls in at walls (src/camera/rig.ts). Instead, anything
// between the camera and the player is cut away in a soft, dithered circle around the player, so walls, roofs,
// trees and props in the way open up like a window and close again behind you. Buildings are merged into a few
// big meshes, so this is done in each world material's fragment shader (a test against the camera-to-player
// line) rather than by fading whole objects. The ground, sky and mountains are never cut; characters aren't
// either (their material is separate).

export const seeThroughUniforms = {
  stOn: { value: 0 },
  stTarget: { value: new THREE.Vector3() },   // the player's chest, in view space
  stRadius: { value: 1.6 },                    // m, at the player
};

export const SEE_THROUGH_PARS = /* glsl */`
uniform float stOn;
uniform vec3 stTarget;
uniform float stRadius;
`;
// A cone from the camera (radius 0.35 m) widening to stRadius at the player, cut only in front of the player.
// Bayer 4x4 dithering softens the rim so the opening doesn't show a hard edge.
export const SEE_THROUGH_CUT = /* glsl */`
if (stOn > 0.5) {
  vec3 stP = -vViewPosition;
  float stLen = length(stTarget);
  vec3 stDir = stTarget / max(stLen, 1e-3);
  float stAlong = dot(stP, stDir);
  if (stAlong > 0.2 && stAlong < stLen - 0.7) {
    float stR = mix(0.35, stRadius, clamp(stAlong / stLen, 0.0, 1.0));
    float stPerp = length(stP - stDir * stAlong);
    float stEdge = clamp((stR - stPerp) / (stR * 0.35), 0.0, 1.0);
    ivec2 stC = ivec2(mod(gl_FragCoord.xy, 4.0));
    int stI = stC.x + stC.y * 4;
    float stB = float((stI == 0 ? 0 : stI == 1 ? 8 : stI == 2 ? 2 : stI == 3 ? 10 : stI == 4 ? 12 : stI == 5 ? 4 : stI == 6 ? 14 : stI == 7 ? 6
      : stI == 8 ? 3 : stI == 9 ? 11 : stI == 10 ? 1 : stI == 11 ? 9 : stI == 12 ? 15 : stI == 13 ? 7 : stI == 14 ? 13 : 5)) / 16.0;
    if (stEdge > stB + 0.03) discard;
  }
}
`;

const SKIP_NAMES = /^(ground|sky|mountains|land|terrain|river|water|stars|sun|fog)/i;
const patched = new WeakSet<THREE.Material>();

function patchMaterial(m: THREE.Material) {
  if (patched.has(m)) return;
  patched.add(m);
  const lit = (m as THREE.MeshLambertMaterial).isMeshLambertMaterial || (m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshPhongMaterial).isMeshPhongMaterial;
  if (!lit || m.customProgramCacheKey?.() === 'figure-lit') return;
  const prevCompile = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prevCompile.call(m, sh, r);
    Object.assign(sh.uniforms, seeThroughUniforms);
    sh.fragmentShader = SEE_THROUGH_PARS + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + SEE_THROUGH_CUT);
  };
  m.customProgramCacheKey = () => prevKey.call(m) + '+st';
  m.needsUpdate = true;
}

/** Let every world mesh under `root` open up when it stands between the camera and the player. */
export function enableSeeThrough(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || SKIP_NAMES.test(mesh.name)) return;
    if (o.userData.rig || o.parent?.userData.rig) return;   // characters
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) patchMaterial(m);
  });
}

const tmp = new THREE.Vector3();
/** Per frame: aim the cut at the player's chest (`target`, world space), or switch it off. */
export function updateSeeThrough(on: boolean, camera: THREE.Camera, target: THREE.Vector3) {
  seeThroughUniforms.stOn.value = on ? 1 : 0;
  if (on) seeThroughUniforms.stTarget.value.copy(tmp.copy(target).applyMatrix4(camera.matrixWorldInverse));
}
