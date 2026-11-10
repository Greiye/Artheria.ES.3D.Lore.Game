import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEE_THROUGH_PARS, SEE_THROUGH_CUT, seeThroughUniforms } from './seeThrough';

// G2 (Mike 2026-11-03, graphics batch): thin ink outlines on characters and props, like the ink line on drawn
// sprites. The cheap "inverted hull": each outlined thing gets one extra mesh drawn back-faces-only, pushed out
// along smoothed normals by a fixed number of screen pixels (thinner far away), in a dark ink colour. No post pass,
// so it works on every preset. All static props share one outline mesh (one extra draw call); each character
// gets one skinned outline bound to its own skeleton.

export const outlineUniforms = {
  outlinePx: { value: 1.6 },                                  // line width in drawing-buffer pixels, up close
  outlineRes: { value: new THREE.Vector2(1280, 720) },        // drawing-buffer size (set by main.ts)
  outlineInk: { value: new THREE.Color('#231a14') },
  outlineOn: { value: 1 },
};

const VERT = /* glsl */`
uniform float outlinePx;
uniform vec2 outlineRes;
uniform float outlineOn;
varying vec3 vViewPosition;
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  vViewPosition = -mvPosition.xyz;
  vec4 cp = projectionMatrix * mvPosition;
  vec3 n = normalize(normalMatrix * objectNormal);
  vec2 d = (projectionMatrix * vec4(n, 0.0)).xy;
  d = d / max(length(d), 1e-5);
  // Constant pixel width close up, thinning with distance so far scenery doesn't turn to ink.
  float k = outlinePx * outlineOn * clamp(14.0 / max(cp.w, 0.1), 0.25, 1.0);
  cp.xy += d * k * 2.0 / outlineRes * cp.w;
  gl_Position = cp;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */`
uniform vec3 outlineInk;
varying vec3 vViewPosition;
${SEE_THROUGH_PARS}
#include <common>
#include <fog_pars_fragment>
void main() {
  ${SEE_THROUGH_CUT}
  gl_FragColor = vec4(outlineInk, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

let mat: THREE.ShaderMaterial | null = null;
function outlineMaterial(): THREE.ShaderMaterial {
  if (mat) return mat;
  mat = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...outlineUniforms, ...seeThroughUniforms },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, fog: true,
  });
  // UniformsUtils.clone copies: point the shared uniforms back at the live objects.
  Object.assign(mat.uniforms, outlineUniforms, seeThroughUniforms);
  return mat;
}

const noRaycast = () => {};
/** One smooth-normal hull geometry for `geos` (box corners would split apart with their flat normals). */
function hullGeometry(geos: THREE.BufferGeometry[], keep: string[]): THREE.BufferGeometry | null {
  const parts = geos.map((g) => {
    const c = new THREE.BufferGeometry();
    for (const k of keep) if (g.attributes[k]) c.setAttribute(k, g.attributes[k]);
    if (g.index) c.setIndex(g.index);
    return c.index ? c.toNonIndexed() : c;
  });
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (!merged) return null;
  const hull = mergeVertices(merged, 1e-4);
  hull.computeVertexNormals();
  hull.computeBoundingSphere();
  return hull;
}

/** Outline static props: every mesh given shares one hull (world-space geometry, as the batches build it). */
export function outlineStatic(meshes: THREE.Mesh[], scene: THREE.Object3D, name = 'outline-static'): THREE.Mesh | null {
  const geos = meshes.map((m) => { m.updateWorldMatrix(true, false); return m.geometry.clone().applyMatrix4(m.matrixWorld); });
  const hull = hullGeometry(geos, ['position']);
  if (!hull) return null;
  const o = new THREE.Mesh(hull, outlineMaterial());
  o.name = name; o.raycast = noRaycast; o.matrixAutoUpdate = false;
  scene.add(o);
  return o;
}

/** Outline one moving mesh: its own hull as a child, so it follows the mesh (the knight frame's limbs). */
export function outlineChild(m: THREE.Mesh): THREE.Mesh | null {
  const hull = hullGeometry([m.geometry], ['position']);
  if (!hull) return null;
  const o = new THREE.Mesh(hull, outlineMaterial());
  o.name = 'outline-child'; o.raycast = noRaycast;
  m.add(o);
  return o;
}

/** A skinned hull over several pieces on one skeleton (B57: an assembled person's body and outfit), to share. */
export function skinnedHull(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null { return hullGeometry(geos, ['position', 'skinIndex', 'skinWeight']); }

/** Outline a skinned character: a hull bound to the same skeleton, beside the body. `shared` is a prebuilt hull
 *  (skinnedHull) that several characters use; it is never disposed here. */
export function outlineSkinned(body: THREE.SkinnedMesh, shared?: THREE.BufferGeometry | null): THREE.SkinnedMesh | null {
  const hull = shared ?? hullGeometry([body.geometry], ['position', 'skinIndex', 'skinWeight']);
  if (!hull) return null;
  const o = new THREE.SkinnedMesh(hull, outlineMaterial());
  o.name = 'figure-outline'; o.raycast = noRaycast; o.frustumCulled = body.frustumCulled;
  o.position.copy(body.position); o.quaternion.copy(body.quaternion); o.scale.copy(body.scale);
  body.parent?.add(o);
  o.bind(body.skeleton, body.bindMatrix);
  return o;
}

/** Settings > Graphics > Ink outlines. Hiding the one shared material skips every outline draw. */
export function setOutlines(on: boolean) { outlineMaterial().visible = on; outlineUniforms.outlineOn.value = on ? 1 : 0; }
