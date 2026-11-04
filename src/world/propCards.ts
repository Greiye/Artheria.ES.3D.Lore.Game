import * as THREE from 'three';
import { rng } from '../tex/pixel';

// Quad detail 4 (Mike 2026-11-04, Graphics thread: quad-based detail, barrels and crates): barrels, kegs and crates
// as painted cards, our own pixel art painted at load in a three-quarter view (you see the lid). Every prop is one
// quad standing on the ground that turns to face the camera and leans back a little toward it (in the vertex shader), all of them one
// instanced mesh: one draw call, two triangles each, where the old boxes and cylinders were 12 to 40 triangles.
const CW = 32, CH = 32;
export const PROP_CARDS = ['barrel', 'keg', 'crate', 'crates'] as const;
export type PropCard = typeof PROP_CARDS[number];
const N = PROP_CARDS.length;
/** Card size in metres (width, height) per kind; the art fills the card bottom-centre. */
const SIZE: Record<PropCard, [number, number]> = { barrel: [1.0, 1.0], keg: [0.75, 0.75], crate: [0.95, 0.95], crates: [1.25, 1.25] };
export interface Prop { kind: PropCard; x: number; z: number; y?: number; s?: number; flip?: boolean }

function paintSheet(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CW * N; c.height = CH;
  const g = c.getContext('2d')!;
  let ox = 0;
  const px = (x: number, y: number, col: string) => { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= CW || y < 0 || y >= CH) return; g.fillStyle = col; g.fillRect(ox + x, y, 1, 1); };
  const WOOD = ['#3A2614', '#5A3C20', '#7A5430', '#98703E', '#B48A52'];
  const IRON = ['#26262A', '#3E3E44', '#5A5A62'];
  /** A barrel: bulging staves, lit from the left, two iron hoops, an oval lid with a ring of end grain. */
  const barrel = (R: () => number, cx: number, w: number, top: number, bot: number, tap = false) => {
    const lidH = Math.max(3, Math.round(w * 0.22));
    for (let y = top + lidH / 2; y <= bot; y++) {
      const t = (y - top) / (bot - top), half = w / 2 * (0.86 + Math.sin(t * Math.PI) * 0.14);
      for (let x = -half; x <= half; x++) {
        const u = (x + half) / (2 * half);   // 0 left .. 1 right
        const stave = Math.floor(u * 7), edge = Math.abs((u * 7) % 1 - 0.5) > 0.42;
        let k = u < 0.25 ? 3 : u < 0.6 ? 2 : u < 0.85 ? 1 : 0;
        if (stave % 2 && k > 0 && R() < 0.3) k--;
        px(cx + x, y, edge ? WOOD[Math.max(0, k - 1)] : WOOD[k]);
      }
      px(cx - half, y, WOOD[0]); px(cx + half, y, WOOD[0]);
    }
    for (const t of [0.24, 0.78]) {   // the hoops
      const y = Math.round(top + lidH / 2 + t * (bot - top - lidH / 2)), half = w / 2 * (0.86 + Math.sin(((y - top) / (bot - top)) * Math.PI) * 0.14) + 0.5;
      for (let x = -half; x <= half; x++) { const u = (x + half) / (2 * half); px(cx + x, y, IRON[u < 0.3 ? 2 : u < 0.75 ? 1 : 0]); px(cx + x, y + 1, IRON[0]); }
    }
    const rx = w / 2 * 0.86, ry = lidH / 2;   // the lid
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const d = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (d > 1.05) continue;
      px(cx + dx, top + ry + dy, d > 0.7 ? IRON[1] : d > 0.35 && R() < 0.5 ? WOOD[3] : WOOD[4]);
    }
    px(cx + rx * 0.3, top + ry, WOOD[1]);   // the bung
    for (let y = bot - 1; y <= bot; y++) for (let x = -w / 2 + 2; x <= w / 2 - 2; x++) if (R() < 0.6) px(cx + x, y, WOOD[0]);   // shadow at the foot
    if (tap) { const ty = Math.round((top + bot) / 2 + 2); for (let i = 0; i < 3; i++) px(cx - 1 + i, ty, '#C8A040'); px(cx, ty + 1, '#8A6A20'); px(cx, ty + 2, '#8A6A20'); }
  };
  /** A crate in three-quarter view: a lit top, a front of planks with a cross brace, a darker side. */
  const crate = (R: () => number, x0: number, y0: number, s: number) => {
    const d = Math.round(s * 0.35);   // depth of the top and side faces in pixels
    const front = { x: x0, y: y0 + d, w: s, h: s };
    for (let y = 0; y < front.h; y++) for (let x = 0; x < front.w; x++) {
      const plank = Math.floor(y / (front.h / 4)), seam = y % Math.round(front.h / 4) === 0;
      px(front.x + x, front.y + y, seam ? WOOD[1] : R() < 0.08 ? WOOD[2] : plank % 2 ? WOOD[3] : WOOD[2]);
    }
    for (let i = 0; i < front.w; i++) {   // the X brace and the frame
      const yy = Math.round((i / (front.w - 1)) * (front.h - 1));
      px(front.x + i, front.y + yy, WOOD[4]); px(front.x + i, front.y + front.h - 1 - yy, WOOD[4]);
      px(front.x + i, front.y, WOOD[4]); px(front.x + i, front.y + front.h - 1, WOOD[1]);
    }
    for (let y = 0; y < front.h; y++) { px(front.x, front.y + y, WOOD[4]); px(front.x + 1, front.y + y, WOOD[3]); px(front.x + front.w - 1, front.y + y, WOOD[1]); }
    for (let j = 0; j < d; j++) {   // the top (lit) and the right side (shade), slanted back to the right
      for (let x = 0; x < front.w; x++) px(front.x + x + j, front.y - 1 - j, j === d - 1 ? WOOD[3] : (x + j) % 6 === 0 ? WOOD[3] : WOOD[4]);
      for (let y = 0; y < front.h; y++) px(front.x + front.w + j, front.y + y - 1 - j, y % Math.round(front.h / 4) === 0 ? WOOD[0] : WOOD[1]);
    }
    for (const [nx, ny] of [[2, 2], [front.w - 3, 2], [2, front.h - 3], [front.w - 3, front.h - 3]]) px(front.x + nx, front.y + ny, IRON[0]);   // nails
  };
  PROP_CARDS.forEach((kind, k) => {
    const R = rng(5803 + k * 41); ox = k * CW;
    if (kind === 'barrel') barrel(R, 15.5, 22, 2, CH - 1);
    else if (kind === 'keg') barrel(R, 15.5, 22, 6, CH - 1, true);
    else if (kind === 'crate') crate(R, 4, CH - 1 - 22 - 7, 20);
    else { crate(R, 1, CH - 1 - 14 - 5, 14); crate(R, 15, CH - 1 - 14 - 5, 14); crate(R, 7, 1, 14); }
  });
  return c;
}

/** All the barrels and crates: one instanced mesh of camera-facing cards. */
export function propCards(scene: THREE.Scene, items: Prop[]): THREE.InstancedMesh {
  const tex = new THREE.CanvasTexture(paintSheet());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec2 aCard;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n  vMapUv.x = aCard.y > 0.5 ? (1.0 - vMapUv.x + aCard.x) / ${N}.0 : (vMapUv.x + aCard.x) / ${N}.0;`)
      // Turn the card about its upright axis to face the camera: the instance's place in the world, then the angle.
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vec3 propAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 propTo = cameraPosition - propAt;
  float propA = atan(propTo.x, propTo.z), propC = cos(propA), propS = sin(propA);
  // Lean back a little toward a high camera so the art isn't squashed (feet stay on the ground).
  float propT = 0.6 * atan(max(propTo.y, 0.0), length(propTo.xz));
  vec3 propL = vec3(transformed.x, transformed.y * cos(propT), -transformed.y * sin(propT));
  transformed = vec3(propL.x * propC + propL.z * propS, propL.y, -propL.x * propS + propL.z * propC);`);
  };
  mat.customProgramCacheKey = () => 'prop-cards';
  // A quad standing on its bottom edge, normals up (lit like the ground, as the other cards are).
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const cards = new Float32Array(items.length * 2);
  const d = new THREE.Object3D();
  items.forEach((it, i) => {
    const [w, h] = SIZE[it.kind], s = it.s ?? 1;
    d.position.set(it.x, it.y ?? 0, it.z); d.rotation.set(0, 0, 0); d.scale.set(w * s, h * s, w * s);
    d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    cards[i * 2] = PROP_CARDS.indexOf(it.kind); cards[i * 2 + 1] = it.flip ? 1 : 0;
  });
  geo.setAttribute('aCard', new THREE.InstancedBufferAttribute(cards, 2));
  mesh.computeBoundingSphere();
  mesh.raycast = () => {};
  mesh.frustumCulled = false;   // the cards turn in the shader; the bounding sphere is close enough but not exact
  mesh.name = 'prop-cards';
  scene.add(mesh);
  return mesh;
}
