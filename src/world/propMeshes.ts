import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rng } from '../tex/pixel';

// Barrels, kegs and crates (Mike 2026-11-05, Graphics thread: "Don't billboard the crates and barrels"): real
// low-poly 3D, a lathed barrel with a bulge and capped ends, and crates as boxes with rounded corners. They wear one
// small painted sheet (our own pixel art, painted at load): barrel staves with iron hoops, a lid of end grain, a
// crate face of planks with an X brace. Every barrel and keg is merged into one mesh and every crate into another:
// two draw calls for the lot, about 40 triangles a barrel and 108 a crate.
export type PropKind = 'barrel' | 'keg' | 'crate' | 'crates';
export interface Prop { kind: PropKind; x: number; z: number; y?: number; s?: number; flip?: boolean }

const CELL = 32, CELLS = 3;   // sheet cells: 0 staves (wraps round the barrel), 1 lid, 2 crate face
const WOOD = ['#3A2614', '#5A3C20', '#7A5430', '#98703E', '#B48A52'];
const IRON = ['#26262A', '#3E3E44', '#5A5A62'];

function paintSheet(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CELL * CELLS; c.height = CELL;
  const g = c.getContext('2d')!, R = rng(5803);
  const px = (cell: number, x: number, y: number, col: string) => { g.fillStyle = col; g.fillRect(cell * CELL + x, y, 1, 1); };
  // Staves: eight boards round the barrel (4 px each), a dark seam between, grain flecks, two iron hoops.
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const seam = x % 4 === 0, k = (Math.floor(x / 4) % 2) ? 2 : 3;
    px(0, x, y, seam ? WOOD[1] : R() < 0.1 ? WOOD[k - 1] : R() < 0.06 ? WOOD[k + 1] : WOOD[k]);
  }
  for (const hy of [6, 24]) for (let x = 0; x < CELL; x++) { px(0, x, hy, IRON[2]); px(0, x, hy + 1, IRON[1]); px(0, x, hy + 2, IRON[0]); if (x % 8 === 3) px(0, x, hy + 1, IRON[2]); }
  // Lid: end grain rings inside an iron rim, a bung.
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const d = Math.hypot(x - 15.5, y - 15.5);
    px(1, x, y, d > 14 ? IRON[1] : d > 12.5 ? WOOD[1] : Math.floor(d) % 4 === 0 ? WOOD[2] : R() < 0.08 ? WOOD[2] : WOOD[3]);
  }
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) px(1, 20 + x, 13 + y, WOOD[0]);
  // Crate face: four planks with seams, a frame, an X brace, nails at the corners.
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) px(2, x, y, y % 8 === 0 ? WOOD[1] : R() < 0.08 ? WOOD[2] : (y >> 3) % 2 ? WOOD[3] : WOOD[2]);
  for (let i = 0; i < CELL; i++) {
    for (const [x, y] of [[i, 0], [i, 1], [i, CELL - 2], [i, CELL - 1], [0, i], [1, i], [CELL - 2, i], [CELL - 1, i]]) px(2, x, y, (x < 2 || y < 2) ? WOOD[4] : WOOD[1]);
    if (i > 2 && i < CELL - 3) { px(2, i, i, WOOD[4]); px(2, i + 1, i, WOOD[3]); px(2, i, CELL - 1 - i, WOOD[4]); px(2, i + 1, CELL - 1 - i, WOOD[3]); }
  }
  for (const [x, y] of [[3, 3], [CELL - 4, 3], [3, CELL - 4], [CELL - 4, CELL - 4]]) px(2, x, y, IRON[0]);
  return c;
}

/** Squeeze a geometry's 0..1 UVs into one cell of the sheet. */
function toCell(g: THREE.BufferGeometry, cell: number): THREE.BufferGeometry {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / CELLS);
  return g;
}

/** A barrel 1 m tall by default: lathed staves bulging at the middle, a lid on each end. 8 sides (low poly). */
function barrelGeometry(h: number, r: number): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4; prof.push(new THREE.Vector2(r * (0.86 + Math.sin(t * Math.PI) * 0.14), t * h)); }
  const side = toCell(new THREE.LatheGeometry(prof, 8), 0);
  const lid = (y: number, up: boolean) => {
    const g = toCell(new THREE.CircleGeometry(r * 0.86, 8).rotateX(up ? -Math.PI / 2 : Math.PI / 2), 1);
    return g.translate(0, y, 0);
  };
  const parts = [side, lid(h - 0.03, true), lid(0.005, false)].map((g) => { const n = g.index ? g.toNonIndexed() : g; return n; });
  return mergeGeometries(parts)!;
}

/** Darken toward the foot so props sit on the ground (as the batched statics do). */
function groundAO(g: THREE.BufferGeometry, baseY: number) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getY(i) - baseY) / 0.7)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0.68 + 0.32 * Math.sqrt(t); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** All the barrels and crates: two merged meshes (barrels + kegs, crates). Returns them for shadows and outlines. */
export function propMeshes(scene: THREE.Scene, items: Prop[]): THREE.Mesh[] {
  const tex = new THREE.CanvasTexture(paintSheet());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const R = rng(9091), barrels: THREE.BufferGeometry[] = [], crates: THREE.BufferGeometry[] = [];
  const crate = (sz: number) => toCell(new RoundedBoxGeometry(sz, sz, sz, 1, sz * 0.07), 2);
  const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry: number, list: THREE.BufferGeometry[]) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.rotateY(ry).translate(x, y, z);
    groundAO(n, y);
    list.push(n);
  };
  for (const it of items) {
    const s = it.s ?? 1, y = it.y ?? 0, ry = R() * Math.PI * 2;
    if (it.kind === 'barrel') place(barrelGeometry(0.95 * s, 0.38 * s), it.x, y, it.z, ry, barrels);
    else if (it.kind === 'keg') place(barrelGeometry(0.6 * s, 0.27 * s), it.x, y, it.z, ry, barrels);
    else if (it.kind === 'crate') { const sz = 0.7 * s; place(crate(sz).translate(0, sz / 2, 0), it.x, y, it.z, ry, crates); }
    else {   // a stack: two crates side by side and a smaller one on top, turned a little
      const sz = 0.55 * s, c = Math.cos(ry), sn = Math.sin(ry);
      for (const dx of [-0.3, 0.3]) place(crate(sz).translate(0, sz / 2, 0), it.x + dx * c * s, y, it.z - dx * sn * s, ry + (R() - 0.5) * 0.3, crates);
      place(crate(sz * 0.85).translate(0, sz * 0.85 / 2, 0), it.x, y + sz, it.z, ry + 0.4 + (R() - 0.5) * 0.3, crates);
    }
  }
  const out: THREE.Mesh[] = [];
  for (const [name, list] of [['prop-barrels', barrels], ['prop-crates', crates]] as const) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(list), new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }));
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    out.push(mesh);
  }
  return out;
}
