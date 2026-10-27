import * as THREE from 'three';
import { figureMats } from '../world/figure';

// Pixel-art billboards drawn live from the 3D figures. Each billboard has its own small render target: the
// part is drawn into it from one of 8 directions around it (snapped to 45° from where the camera sees it),
// at a low pixel density and a sprite frame rate, then shown facing the camera with a 1 px ink outline.
// Rigs, poses, the forge and species all keep working, because the source is the live rig.
//
// - Hybrid (default, S2d, as in Tree of Savior): the body is a 3D toon-lit mesh; only the head is a
//   pixel-art billboard. The body is drawn into the head's frame as a depth-only mask first, so hair
//   that hangs behind the body is hidden from the front and shows from the back.
// - Sprites (S2b, Graphics > Characters): the whole figure is one billboard, as in Ragnarok Online.
// The 3D parts the billboards replace live on SPRITE_LAYER, which the main camera doesn't render.

export const SPRITE_LAYER = 3;
const MASK_LAYER = 4;          // hybrid bodies, for the depth-only pass behind each head
const BODY_PX = 52;           // pixels per metre: a 1.75 m figure is ~90 px tall
const HEAD_PX = 84;           // the head gets more pixels, like ToS's detailed heads
const FPS = 12;               // sprite animation rate
const DIRS = 8;
const ELEV = 0.26;            // radians: the sprite artist's viewing angle, a little above eye level
const HEAD_LIFT = 0.18;       // metres the head billboard sits toward the camera, clear of the shoulders
const INK = new THREE.Color('#2A2026');

interface Board {
  rt: THREE.WebGLRenderTarget;
  mesh: THREE.Mesh;
  anchor: THREE.Object3D;     // its world position is the frame's reference point
  w: number; h: number; cy: number;   // frame size and centre height above the anchor, metres (unscaled)
  t: number; dir: number;
}

const vert = /* glsl */`
varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = uv;
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
const mask = new THREE.MeshBasicMaterial({ colorWrite: false });
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
const toCam = new THREE.Vector3();
const clear = new THREE.Color();
const bodies = new Map<THREE.Object3D, Board>();
const heads = new Map<THREE.Object3D, Board>();

function shown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function makeBoard(root: THREE.Object3D, anchor: THREE.Object3D, w: number, h: number, cy: number, px: number, lift: number, name: string): Board {
  const rt = new THREE.WebGLRenderTarget(Math.ceil(w * px), Math.ceil(h * px), {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true,
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      map: { value: null }, texel: { value: new THREE.Vector2() }, ink: { value: INK.clone() },
    }]),
    vertexShader: vert, fragmentShader: frag, fog: true,
  });
  mat.uniforms.map.value = rt.texture;
  mat.uniforms.texel.value.set(1 / rt.width, 1 / rt.height);
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

function headBoard(root: THREE.Object3D): Board | null {
  let b = heads.get(root);
  const hd = root.userData.head as { anchor: THREE.Object3D; w: number; h: number; cy: number } | undefined;
  if (!b && hd) {
    b = makeBoard(root, hd.anchor, hd.w, hd.h, hd.cy, HEAD_PX, HEAD_LIFT, 'head-sprite');
    heads.set(root, b);
  }
  return b ?? null;
}

let spriteMode = false;
/** true = whole-figure pixel sprites, false = hybrid 3D bodies with pixel-art heads (default). */
export function setSpriteCharacters(on: boolean) { spriteMode = on; }

// Hybrid: the body on the main camera (toon-lit), the head on the sprite layer. Sprites: all on the sprite
// layer, flat (light painted into the vertex colours; the sprite pass has no lights).
function applyMode(root: THREE.Object3D) {
  root.userData.spriteMode = spriteMode;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.name === 'sprite' || m.name === 'head-sprite' || m.name === 'blob-shadow') return;
    if (m.name === 'figure-body') {
      m.layers.set(spriteMode ? SPRITE_LAYER : 0);
      if (!spriteMode) m.layers.enable(MASK_LAYER);
      m.material = spriteMode ? figureMats.flat : figureMats.toon;
    }
    else if (m.name === 'figure-head' || m.name === 'face' || m.parent?.name === 'head-group') m.layers.set(SPRITE_LAYER);
    else m.layers.set(spriteMode ? SPRITE_LAYER : 0);
  });
  const b = bodies.get(root), h = heads.get(root);
  if (b) b.mesh.visible = spriteMode;
  if (h) h.mesh.visible = !spriteMode;
}

/** Mark a figure root for the billboard pass (buildFigure calls this). */
export function spriteFigure(root: THREE.Object3D) { root.userData.sprite = true; }

// Snap the view to one of 8 directions around `b.anchor` and aim the sprite camera; false = frame still current.
function aim(b: Board, camera: THREE.Camera, dt: number, scaleFrom: THREE.Object3D): boolean {
  b.anchor.matrixWorld.decompose(tmpV, tmpQ, tmpS);
  tmpE.setFromQuaternion(tmpQ, 'YXZ');
  const facing = tmpE.y;
  const seen = Math.atan2(camera.position.x - tmpV.x, camera.position.z - tmpV.z);
  const step = (Math.PI * 2) / DIRS;
  const dir = ((Math.round((seen - facing) / step) % DIRS) + DIRS) % DIRS;
  b.t += dt;
  if (b.t < 1 / FPS && dir === b.dir) return false;
  b.t = 0; b.dir = dir;
  scaleFrom.matrixWorld.decompose(toCam, tmpQ, tmpS);
  const a = facing + dir * step, k = tmpS.x, cy = tmpV.y + b.cy * k;
  cam.left = -b.w / 2 * k; cam.right = b.w / 2 * k; cam.top = b.h / 2 * k; cam.bottom = -b.h / 2 * k;
  cam.updateProjectionMatrix();
  const d = 6;
  cam.position.set(tmpV.x + Math.sin(a) * Math.cos(ELEV) * d, cy + Math.sin(ELEV) * d, tmpV.z + Math.cos(a) * Math.cos(ELEV) * d);
  cam.lookAt(tmpV.x, cy, tmpV.z);
  cam.updateMatrixWorld();
  return true;
}

/** Redraw the billboards that are on screen. Call once a frame, before the main render. */
export function updateSprites(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, dt: number) {
  const roots: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.userData.sprite) roots.push(o); });
  if (!roots.length) return;
  for (const root of roots) if (root.userData.spriteMode !== spriteMode) applyMode(root);
  scene.updateMatrixWorld();
  const prevTarget = renderer.getRenderTarget(), prevAlpha = renderer.getClearAlpha(), prevAuto = renderer.autoClear;
  renderer.getClearColor(clear);
  renderer.setClearColor(0x000000, 0);
  for (const root of roots) {
    if (!shown(root)) continue;
    if (spriteMode) {
      const b = bodyBoard(root);
      b.mesh.visible = true;
      if (!aim(b, camera, dt, root)) continue;
      cam.layers.set(SPRITE_LAYER);
      renderer.setRenderTarget(b.rt);
      renderer.clear();
      renderer.render(root, cam);
      continue;
    }
    const b = headBoard(root);
    const rig = root.userData.rig as { mesh: THREE.SkinnedMesh } | undefined;
    const group = (root.userData.head as { group: THREE.Object3D } | undefined)?.group;
    if (!b || !rig || !group) continue;
    b.mesh.visible = true;
    if (!aim(b, camera, dt, root)) continue;
    renderer.setRenderTarget(b.rt);
    renderer.clear();
    // Depth-only body first (its mask layer), so the head's hair hides behind it where it should.
    const was = rig.mesh.material;
    rig.mesh.material = mask;
    b.mesh.visible = false;
    cam.layers.set(MASK_LAYER);
    renderer.autoClear = false;
    renderer.render(rig.mesh, cam);
    rig.mesh.material = was;
    cam.layers.set(SPRITE_LAYER);
    renderer.render(group, cam);
    renderer.autoClear = prevAuto;
    b.mesh.visible = true;
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(clear, prevAlpha);
  renderer.autoClear = prevAuto;
}
