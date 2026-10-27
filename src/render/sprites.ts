import * as THREE from 'three';

// Restyle S2b: Tree of Savior / Ragnarok Online style characters. Every figure from buildFigure() is drawn
// into its own small render target from one of 8 directions around it (snapped to 45° from where the
// camera sees it), at a low pixel density and a sprite frame rate, then shown as a camera-facing pixel-art
// billboard with a 1 px ink outline. Rigs, poses, the forge and species all keep working: the sprite is
// redrawn from the live 3D figure, which the main camera no longer sees (it lives on SPRITE_LAYER).

export const SPRITE_LAYER = 3;
const PX_PER_M = 52;          // sprite pixels per metre (a 1.75 m figure is ~90 px tall)
const FPS = 12;               // sprite animation rate
const DIRS = 8;
const ELEV = 0.26;            // radians: the sprite artist's viewing angle, a little above eye level
const INK = new THREE.Color('#2A2026');

interface Sprite {
  rt: THREE.WebGLRenderTarget;
  board: THREE.Mesh;
  w: number; h: number;       // frame size in metres
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
cam.layers.set(SPRITE_LAYER);
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
const clear = new THREE.Color();
const sprites = new Map<THREE.Object3D, Sprite>();

function shown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function attach(root: THREE.Object3D): Sprite {
  const height = (root.userData.height as number) ?? 1.75;
  const h = height * 1.3, w = height * 0.95;   // room for raised arms, hats, tails
  const rt = new THREE.WebGLRenderTarget(Math.ceil(w * PX_PER_M), Math.ceil(h * PX_PER_M), {
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
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2 - height * 0.08, 0), mat);
  board.name = 'sprite';
  board.raycast = noRaycast;
  board.frustumCulled = false;
  // Billboard, set straight in world space just before it draws.
  board.onBeforeRender = (_r, _s, camera) => {
    root.matrixWorld.decompose(tmpV, tmpQ, tmpS);
    const dx = camera.position.x - tmpV.x, dz = camera.position.z - tmpV.z;
    // Lean back toward a high camera (as RO does), so the overview doesn't squash the sprite.
    const pitch = Math.atan2(camera.position.y - tmpV.y - 0.8, Math.hypot(dx, dz));
    tmpQ.setFromEuler(tmpE.set(-Math.max(0, pitch), Math.atan2(dx, dz), 0));
    tmpS.set(tmpS.x, tmpS.y, tmpS.x);
    board.matrixWorld.compose(tmpV, tmpQ, tmpS);
    board.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, board.matrixWorld);
    board.normalMatrix.getNormalMatrix(board.modelViewMatrix);
  };
  root.add(board);
  root.traverse((o) => {
    if (o === board || o.name === 'blob-shadow') return;
    if ((o as THREE.Mesh).isMesh) o.layers.set(SPRITE_LAYER);
  });
  const s: Sprite = { rt, board, w, h, t: Infinity, dir: -1 };
  sprites.set(root, s);
  return s;
}

/** Mark a figure root for the sprite pass (buildFigure calls this). */
export function spriteFigure(root: THREE.Object3D) { root.userData.sprite = true; }

/** Redraw the sprites that are on screen. Call once a frame, before the main render. */
export function updateSprites(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, dt: number) {
  const roots: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.userData.sprite) roots.push(o); });
  if (!roots.length) return;
  scene.updateMatrixWorld();
  const prevTarget = renderer.getRenderTarget(), prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(clear);
  renderer.setClearColor(0x000000, 0);
  for (const root of roots) {
    if (!shown(root)) continue;
    const s = sprites.get(root) ?? attach(root);
    root.matrixWorld.decompose(tmpV, tmpQ, tmpS);
    tmpE.setFromQuaternion(tmpQ, 'YXZ');
    const facing = tmpE.y;
    const seen = Math.atan2(camera.position.x - tmpV.x, camera.position.z - tmpV.z);
    const step = (Math.PI * 2) / DIRS;
    const dir = ((Math.round((seen - facing) / step) % DIRS) + DIRS) % DIRS;
    s.t += dt;
    if (s.t < 1 / FPS && dir === s.dir) continue;
    s.t = 0; s.dir = dir;
    const a = facing + dir * step, scale = tmpS.x, height = (root.userData.height as number) ?? 1.75;
    const cy = tmpV.y + (s.h / 2 - height * 0.08) * scale;
    cam.left = -s.w / 2 * scale; cam.right = s.w / 2 * scale; cam.top = s.h / 2 * scale; cam.bottom = -s.h / 2 * scale;
    cam.updateProjectionMatrix();
    const d = 6;
    cam.position.set(tmpV.x + Math.sin(a) * Math.cos(ELEV) * d, cy + Math.sin(ELEV) * d, tmpV.z + Math.cos(a) * Math.cos(ELEV) * d);
    cam.lookAt(tmpV.x, cy, tmpV.z);
    cam.updateMatrixWorld();
    renderer.setRenderTarget(s.rt);
    renderer.clear();
    renderer.render(root, cam);
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(clear, prevAlpha);
}
