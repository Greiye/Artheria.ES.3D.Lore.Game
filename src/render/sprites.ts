import * as THREE from 'three';
import { headSheet, SHEET } from './headArt';
import type { FigureLook } from '../world/figure';

// Pixel-art billboards, shown facing the camera with a 1 px ink outline and snapped to 8 directions (45°).
//
// - Heads (S2h, as in Tree of Savior): every head is flat 2D pixel art, drawn per look by src/render/headArt.ts
//   as an 8-frame sheet. There is no 3D head at all; the billboard picks the frame for the side it's seen from.
// - Hybrid (default): the body is an unlit 3D mesh with baked shading, under the 2D head.
// - Sprites (S2b, Graphics > Characters): the body is a billboard too, drawn live from the rig into a small
//   render target at a sprite frame rate (as in Ragnarok Online), under the same 2D head.
// The 3D parts a billboard replaces live on SPRITE_LAYER, which the main camera doesn't render.

export const SPRITE_LAYER = 3;
const BODY_PX = 52;           // pixels per metre: a 1.75 m figure is ~90 px tall
const FPS = 12;               // sprite animation rate
const DIRS = 8;
const ELEV = 0.26;            // radians: the sprite artist's viewing angle, a little above eye level
const HEAD_LIFT = 0.18;       // metres the head billboard sits toward the camera, clear of the shoulders
const INK = new THREE.Color('#2A2026');

interface Board {
  rt: THREE.WebGLRenderTarget | null;   // null: a drawn sheet (heads)
  mesh: THREE.Mesh;
  anchor: THREE.Object3D;     // its world position is the frame's reference point
  w: number; h: number; cy: number;   // frame size and centre height above the anchor, metres (unscaled)
  t: number; dir: number;
}

const vert = /* glsl */`
uniform vec4 frame;   // xy scale, zw offset: which frame of a sheet
varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = uv * frame.xy + frame.zw;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const frag = /* glsl */`
uniform sampler2D map;
uniform vec2 texel;
uniform vec3 ink;
varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) {
    float n = texture2D(map, vUv + vec2(texel.x, 0.0)).a + texture2D(map, vUv - vec2(texel.x, 0.0)).a
            + texture2D(map, vUv + vec2(0.0, texel.y)).a + texture2D(map, vUv - vec2(0.0, texel.y)).a;
    if (n < 0.5) discard;
    c = vec4(ink, 1.0);
  }
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const noRaycast = () => {};
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 20);
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
const toCam = new THREE.Vector3();
const clear = new THREE.Color();
const bodies = new Map<THREE.Object3D, Board>();
const heads = new Map<THREE.Object3D, Board>();

function shown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function makeBoard(root: THREE.Object3D, anchor: THREE.Object3D, w: number, h: number, cy: number, src: number | THREE.Texture, lift: number, name: string): Board {
  const rt = typeof src === 'number' ? new THREE.WebGLRenderTarget(Math.ceil(w * src), Math.ceil(h * src), {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true,
  }) : null;
  const map = rt ? rt.texture : src as THREE.Texture;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      map: { value: null }, texel: { value: new THREE.Vector2() }, ink: { value: INK.clone() }, frame: { value: new THREE.Vector4(1, 1, 0, 0) },
    }]),
    vertexShader: vert, fragmentShader: frag, fog: true,
  });
  mat.uniforms.map.value = map;
  const img = map.image as { width: number; height: number };
  mat.uniforms.texel.value.set(1 / img.width, 1 / img.height);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, cy, 0), mat);
  mesh.name = name;
  mesh.raycast = noRaycast;
  mesh.frustumCulled = false;
  // Set straight in world space just before it draws: facing the camera, leaning back toward a high one
  // (as RO does) so the overview doesn't squash it.
  mesh.onBeforeRender = (_r, _s, camera) => {
    anchor.matrixWorld.decompose(tmpV, tmpQ, tmpS);
    const dx = camera.position.x - tmpV.x, dz = camera.position.z - tmpV.z;
    const pitch = Math.atan2(camera.position.y - tmpV.y - 0.8, Math.hypot(dx, dz));
    if (lift) tmpV.addScaledVector(toCam.subVectors(camera.position, tmpV).normalize(), lift * tmpS.x);
    tmpQ.setFromEuler(tmpE.set(-Math.max(0, pitch), Math.atan2(dx, dz), 0));
    tmpS.set(tmpS.x, tmpS.x, tmpS.x);
    mesh.matrixWorld.compose(tmpV, tmpQ, tmpS);
    mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    mesh.normalMatrix.getNormalMatrix(mesh.modelViewMatrix);
  };
  root.add(mesh);
  return { rt, mesh, anchor, w, h, cy, t: Infinity, dir: -1 };
}

function bodyBoard(root: THREE.Object3D): Board {
  let b = bodies.get(root);
  if (!b) {
    const height = (root.userData.height as number) ?? 1.75;
    const h = height * 1.3;   // room for raised arms, hats, tails
    b = makeBoard(root, root, height * 0.95, h, h / 2 - height * 0.08, BODY_PX, 0, 'sprite');
    bodies.set(root, b);
  }
  return b;
}

// The 2D head: one frame of the look's sheet. Head units scale by the figure's head size.
function headBoard(root: THREE.Object3D): Board | null {
  let b = heads.get(root);
  const hd = root.userData.head as { anchor: THREE.Object3D; size: number } | undefined;
  const look = root.userData.look as FigureLook | undefined;
  if (!b && hd && look) {
    const s = hd.size;
    b = makeBoard(root, hd.anchor, SHEET.w * s, SHEET.h * s, (SHEET.top - SHEET.h / 2) * s, headSheet(look), HEAD_LIFT, 'head-sprite');
    (b.mesh.material as THREE.ShaderMaterial).uniforms.frame.value.set(1 / DIRS, 1, 0, 0);
    heads.set(root, b);
  }
  return b ?? null;
}

let spriteMode = false;
/** true = pixel-sprite bodies, false = hybrid 3D bodies (default); heads are 2D either way. */
export function setSpriteCharacters(on: boolean) { spriteMode = on; }

// Hybrid: the body on the main camera. Sprites: the body on the sprite layer. Bodies are unlit (light
// painted into the vertex colours), so the sprite pass needs no lights.
function applyMode(root: THREE.Object3D) {
  root.userData.spriteMode = spriteMode;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.name === 'sprite' || m.name === 'head-sprite' || m.name === 'blob-shadow') return;
    m.layers.set(spriteMode ? SPRITE_LAYER : 0);
  });
  const b = bodies.get(root);
  if (b) b.mesh.visible = spriteMode;
}

/** Mark a figure root for the billboard pass (buildFigure calls this). */
export function spriteFigure(root: THREE.Object3D) { root.userData.sprite = true; }

// The direction (0..7, 0 = seen from the front, 2 = its left side) `b.anchor` is seen from.
function direction(b: Board, camera: THREE.Camera): number {
  b.anchor.matrixWorld.decompose(tmpV, tmpQ, tmpS);
  tmpE.setFromQuaternion(tmpQ, 'YXZ');
  const seen = Math.atan2(camera.position.x - tmpV.x, camera.position.z - tmpV.z);
  const step = (Math.PI * 2) / DIRS;
  return ((Math.round((seen - tmpE.y) / step) % DIRS) + DIRS) % DIRS;
}

// Snap the view to one of 8 directions around `b.anchor` and aim the sprite camera; false = frame still current.
function aim(b: Board, camera: THREE.Camera, dt: number, scaleFrom: THREE.Object3D): boolean {
  const dir = direction(b, camera);
  b.t += dt;
  if (b.t < 1 / FPS && dir === b.dir) return false;
  b.t = 0; b.dir = dir;
  const facing = tmpE.y;   // direction() left the anchor's pose in tmpV / tmpE
  const pos = tmpV.clone();
  scaleFrom.matrixWorld.decompose(toCam, tmpQ, tmpS);
  const a = facing + dir * ((Math.PI * 2) / DIRS), k = tmpS.x, cy = pos.y + b.cy * k;
  cam.left = -b.w / 2 * k; cam.right = b.w / 2 * k; cam.top = b.h / 2 * k; cam.bottom = -b.h / 2 * k;
  cam.updateProjectionMatrix();
  const d = 6;
  cam.position.set(pos.x + Math.sin(a) * Math.cos(ELEV) * d, cy + Math.sin(ELEV) * d, pos.z + Math.cos(a) * Math.cos(ELEV) * d);
  cam.lookAt(pos.x, cy, pos.z);
  cam.updateMatrixWorld();
  return true;
}

/** Redraw the billboards that are on screen. Call once a frame, before the main render. */
export function updateSprites(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, dt: number) {
  const roots: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.userData.sprite) roots.push(o); });
  if (!roots.length) return;
  for (const root of roots) if (root.userData.spriteMode !== spriteMode) applyMode(root);
  const prevTarget = renderer.getRenderTarget(), prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(clear);
  renderer.setClearColor(0x000000, 0);
  for (const root of roots) {
    if (!shown(root)) continue;
    root.updateWorldMatrix(true, true);   // this frame's pose; cheaper than updating the whole scene
    const h = headBoard(root);
    if (h) {
      h.mesh.visible = true;
      const dir = direction(h, camera);
      if (dir !== h.dir) { h.dir = dir; (h.mesh.material as THREE.ShaderMaterial).uniforms.frame.value.z = dir / DIRS; }
    }
    if (!spriteMode) continue;
    const b = bodyBoard(root);
    b.mesh.visible = true;
    if (!aim(b, camera, dt, root)) continue;
    cam.layers.set(SPRITE_LAYER);
    renderer.setRenderTarget(b.rt);
    renderer.clear();
    renderer.render(root, cam);
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(clear, prevAlpha);
}
