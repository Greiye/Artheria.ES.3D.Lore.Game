import * as THREE from 'three';
import { rng } from '../tex/pixel';
import type { Collider } from './index';
import { PATHS } from './land';

// Quad detail 2 (Mike 2026-11-04, Graphics thread: quad-based detail, fences): flat painted fence panels along the
// paths. Every panel is one upright alpha-cut quad (back to back, normals up, like the tree and bush cards), its feet
// following the ground, all merged into ONE mesh: one draw call. The sheet is our own pixel art, painted at load:
// a split-rail fence, a woven wattle hurdle and a whitewashed picket fence. Thin posts block the way (small circle
// colliders); a gap every few panels lets you through.
const CW = 64, CH = 32, KINDS = ['rail', 'wattle', 'picket'] as const;
type Kind = typeof KINDS[number];
const N = KINDS.length;
const PANEL = 2.0, HIGH = 1.0;   // metres

function paintSheet(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CW * N; c.height = CH;
  const g = c.getContext('2d')!;
  KINDS.forEach((kind, k) => {
    const R = rng(4471 + k * 31), ox = k * CW;
    const px = (x: number, y: number, col: string) => { if (x < 0 || x >= CW || y < 0 || y >= CH) return; g.fillStyle = col; g.fillRect(ox + x, y, 1, 1); };
    const rect = (x: number, y: number, w: number, h: number, col: string) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, col); };
    const wood = ['#4A3420', '#6A4C2E', '#86643E', '#A07C4E'];
    const post = (x: number, top: number) => {   // a round post: dark edge, a lit stripe, a cut top
      rect(x, top, 4, CH - top, wood[1]); rect(x + 1, top, 1, CH - top, wood[3]); rect(x + 3, top, 1, CH - top, wood[0]);
      rect(x, top, 4, 1, wood[2]);
      for (let y = top + 3; y < CH; y += 4 + Math.floor(R() * 4)) px(x + 2, y, wood[0]);   // grain
    };
    if (kind === 'rail') {
      for (const ry of [9, 18]) {   // two split rails, sagging a touch, rough edges
        for (let x = 0; x < CW; x++) {
          const y = ry + Math.round(Math.sin((x / CW) * Math.PI) * 1.2);
          px(x, y, wood[2]); px(x, y + 1, wood[1]); px(x, y + 2, R() < 0.8 ? wood[0] : wood[1]);
          if (R() < 0.12) px(x, y, wood[3]);
        }
      }
      post(0, 4); post(CW - 4, 4);
    } else if (kind === 'wattle') {
      // Hazel rods woven over and under upright stakes.
      const stakes = [2, 14, 26, 38, 50, CW - 4];
      for (const x of stakes) { rect(x, 6, 2, CH - 6, wood[1]); rect(x, 6, 1, CH - 6, wood[2]); }
      for (let row = 0; row < 11; row++) {
        const y = 8 + row * 2;
        for (let x = 0; x < CW; x++) {
          const seg = Math.floor(x / 12), over = (seg + row) % 2 === 0;
          const yy = y + (over ? 0 : 1) - (x % 12 < 2 || x % 12 > 9 ? 0 : 0);
          px(x, yy, over ? (row % 3 ? '#9A7A48' : '#B08E58') : '#6E5232');
          if (R() < 0.05) px(x, yy, '#4A6A2E');   // a leaf left on the rod
        }
      }
      for (const x of stakes) rect(x, 4, 2, 2, wood[2]);
    } else {
      // Whitewashed pickets with pointed tops on two rails.
      for (const ry of [12, 22]) rect(0, ry, CW, 2, '#B8AE98');
      for (let x = 1; x < CW - 2; x += 6) {
        const top = 5 + Math.floor(R() * 2);
        rect(x, top + 2, 4, CH - top - 2, '#E8E2D2'); rect(x + 3, top + 2, 1, CH - top - 2, '#B8AE98');
        rect(x + 1, top + 1, 2, 1, '#E8E2D2'); px(x + 1, top, '#F4F0E4');
        for (let y = top + 6; y < CH; y += 5) if (R() < 0.4) px(x + 1 + Math.floor(R() * 2), y, '#9C9480');   // chips in the paint
      }
    }
  });
  return c;
}

// Which paths get a fence: path index, side (1 left of travel, -1 right), kind, how far off the path (m).
const RUNS: [number, 1 | -1, Kind, number][] = [
  [5, 1, 'rail', 1.7], [5, -1, 'rail', 1.7],   // both sides of the coach road west to the gate
  [4, 1, 'wattle', 1.6],                        // the way up to the rock climb
  [8, -1, 'picket', 1.6],                       // the lane east off the green
  [6, 1, 'rail', 1.6],                          // west of the green toward the footbridge
  [3, -1, 'wattle', 1.5],                       // toward the dojo
];

/** Fences along the paths: one merged mesh, small post colliders. `blocked` keeps them off buildings and props. */
export function buildFences(scene: THREE.Scene, heightAt: (x: number, z: number) => number, colliders: Collider[], blocked: (x: number, z: number) => boolean): THREE.Mesh {
  const R = rng(6061);
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
  const posts: [number, number][] = [];
  const quad = (x0: number, z0: number, x1: number, z1: number, k: number, flip: boolean) => {
    const y0 = heightAt(x0, z0) - 0.06, y1 = heightAt(x1, z1) - 0.06, u0 = k / N, u1 = (k + 1) / N, b = pos.length / 3;
    const [ax, az, bx, bz, ua, ub] = flip ? [x1, z1, x0, z0, u1, u0] : [x0, z0, x1, z1, u0, u1];
    const [ya, yb] = flip ? [y1, y0] : [y0, y1];
    pos.push(ax, ya, az, bx, yb, bz, bx, yb + HIGH, bz, ax, ya + HIGH, az);
    uv.push(ua, 0, ub, 0, ub, 1, ua, 1);
    for (let i = 0; i < 4; i++) nrm.push(0, 1, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  for (const [pi, side, kind, off] of RUNS) {
    const line = PATHS[pi], k = KINDS.indexOf(kind);
    // Walk the polyline, offset to one side, in panel lengths.
    const pts: [number, number][] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, z0] = line[i], [x1, z1] = line[i + 1], L = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / L * side, nz = (x1 - x0) / L * side;
      for (let d = i === 0 ? 1.5 : 0; d < L; d += PANEL) pts.push([x0 + (x1 - x0) * (d / L) + nx * off, z0 + (z1 - z0) * (d / L) + nz * off]);
    }
    let n = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      if (Math.hypot(x1 - x0, z1 - z0) > PANEL * 1.5) continue;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (blocked(x0, z0) || blocked(x1, z1) || blocked(mx, mz)) { n = 0; continue; }
      if (++n % 5 === 0 || R() < 0.08) continue;   // a gap now and then: a way through
      quad(x0, z0, x1, z1, k, false); quad(x0, z0, x1, z1, k, true);
      posts.push([x0, z0], [mx, mz], [x1, z1]);
    }
  }
  for (const [x, z] of posts) colliders.push({ kind: 'circle', x, z, r: 0.16 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const tex = new THREE.CanvasTexture(paintSheet());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 }));
  mesh.name = 'fence-cards'; mesh.raycast = () => {};
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}
