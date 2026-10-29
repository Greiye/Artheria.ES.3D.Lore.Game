import * as THREE from 'three';
import { headArt, SHEET, FACE, type Frame, type HeadArt } from './headArt';
import type { FigureLook } from '../world/figure';

// Characters' drawn parts and the optional pixel-sprite bodies.
//
// - Faces (realistic figures, 2026-10-29): every figure has a low-poly 3D head with a drawn face (src/render/headArt.ts,
//   Mike's sheets where they exist) on a quad over its front. Expressions (blinking, talking) only move the quad's UVs
//   to another row of the face sheet, like Mega Man Legends' face textures.
// - Hybrid (default): the whole figure is an unlit 3D mesh with baked shading.
// - Sprites (S2b, Graphics > Characters): the body (head and face included) is a billboard, drawn live from the rig
//   into a small render target at a sprite frame rate (as in Ragnarok Online).
// The 3D parts a billboard replaces live on SPRITE_LAYER, which the main camera doesn't render.

const SPRITE_LAYER = 3;
const BODY_PX = 52;           // pixels per metre: a 1.75 m figure is ~90 px tall
const FPS = 12;               // sprite animation rate
const DIRS = 8;
const ELEV = 0.26;            // radians: the sprite artist's viewing angle, a little above eye level
const INK = new THREE.Color('#2A2026');

interface Board {
  rt: THREE.WebGLRenderTarget;
  mesh: THREE.Mesh;
  anchor: THREE.Object3D;     // its world position is the frame's reference point
  w: number; h: number; cy: number;   // frame size and centre height above the anchor, metres (unscaled)
  t: number; dir: number;
}

const vert = /* glsl */`
uniform vec4 frame;       // xy scale, zw offset: which part of the target
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

function shown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function makeBoard(root: THREE.Object3D, anchor: THREE.Object3D, w: number, h: number, cy: number, px: number, name: string): Board {
  const rt = new THREE.WebGLRenderTarget(Math.ceil(w * px), Math.ceil(h * px), {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true,
  });
  const map = rt.texture;
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
    b = makeBoard(root, root, height * 0.95, h, h / 2 - height * 0.08, BODY_PX, 'sprite');
    bodies.set(root, b);
  }
  return b;
}

const BLINK = 0.12, TALK_FPS = 8;
// Which face to show: root.userData.expression if set (any row of the face sheet), else talking / blinking / neutral.
function expression(b: FaceState, root: THREE.Object3D, dt: number): string {
  b.blink -= dt;
  if (b.blink < -BLINK) b.blink = 2 + Math.random() * 3;
  const set = root.userData.expression as string | undefined;
  if (set && b.art.faces.has(set)) return set;
  if (root.userData.talking) { b.talk += dt; return Math.floor(b.talk * TALK_FPS) % 2 ? 'talk-b' : 'talk-a'; }
  b.talk = 0;
  return b.blink < 0 ? 'blink' : 'neutral';
}

// Realistic figures (2026-10-29): a 3D head with the drawn face on a quad over its front (Mega Man Legends style).
// The quad shows the middle of the front face cell; an expression change only moves its UVs.
interface FaceState { art: HeadArt; blink: number; talk: number; f: Frame | null }
const faceStates = new WeakMap<THREE.Object3D, FaceState>();
const CROP = { u0: 0.5 - FACE.w / 2 / SHEET.w, u1: 0.5 + FACE.w / 2 / SHEET.w,
  v0: 1 - (SHEET.top + FACE.drop + FACE.h / 2) / SHEET.h, v1: 1 - (SHEET.top + FACE.drop - FACE.h / 2) / SHEET.h };
function showFace(root: THREE.Object3D, dt: number) {
  const face = root.userData.face as THREE.Mesh, m = face.material as THREE.MeshBasicMaterial;
  let st = faceStates.get(root);
  if (!st) { st = { art: headArt(root.userData.look as FigureLook), blink: 1 + Math.random() * 3, talk: 0, f: null }; faceStates.set(root, st); }
  const art = st.art, f = art.faces.get(expression(st, root, dt)) ?? art.faces.get('neutral');
  if (!art.face || !f) { m.visible = false; return; }
  if (m.map !== art.face) { m.map = art.face; m.needsUpdate = true; st.f = null; }
  m.visible = true;
  if (st.f === f) return;
  st.f = f;
  const uv = face.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const a = i % 2, b = i < 2 ? 1 : 0;   // PlaneGeometry corners: (0,1) (1,1) (0,0) (1,0)
    const cu = CROP.u0 + a * (CROP.u1 - CROP.u0), cv = CROP.v0 + b * (CROP.v1 - CROP.v0);
    uv.setXY(i, cu * f[0] + f[2], cv * f[1] + f[3]);
  }
  uv.needsUpdate = true;
}
/** The expression a realistic figure's face shows now (tests). */
export function faceExpression(root: THREE.Object3D): string | null {
  const st = faceStates.get(root), f = st?.f;
  if (!st || !f) return null;
  for (const [name, frame] of st.art.faces) if (frame === f) return name;
  return null;
}

let spriteMode = false;
/** true = pixel-sprite bodies, false = hybrid 3D bodies (default). */
export function setSpriteCharacters(on: boolean) { spriteMode = on; }

// Hybrid: the body on the main camera. Sprites: the body on the sprite layer. Bodies are unlit (light
// painted into the vertex colours), so the sprite pass needs no lights.
function applyMode(root: THREE.Object3D) {
  root.userData.spriteMode = spriteMode;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.name === 'sprite' || m.name === 'blob-shadow') return;
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
    if (root.userData.face) showFace(root, dt);
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
