import * as THREE from 'three';
import { rng } from '../tex/pixel';

// v0.04: hills and distant mountains. The play area stays flat (every placed prop sits at y = 0); the land
// starts to roll up 42 m out from the centre into hills at the edge of the walkable square and beyond it,
// and a ring of low-poly mountains stands far out past the fog (drawn without fog, so they always show).
const sstep = (a: number, b: number, v: number) => { const t = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const HILLS_FROM = 42;

// Style pass 2: gentle bumps across the open meadow, up to ~0.45 m. Everything built at y = 0 (the dais, paths,
// the camp, the town, the library, walls) stays on flat ground: a mask, 1 m per cell, is 0 wherever a keep-out
// test says so and blurred so the land eases up from it. Trees, rocks and bushes sit on heightAt().
const MASK_HALF = 44, MASK_N = MASK_HALF * 2 + 1;
let mask: Float32Array | null = null;
/** Build the flat mask from a keep-out test (true = keep this spot flat). Call before shaping the ground. */
export function setFlatMask(keepFlat: (x: number, z: number) => boolean) {
  let m = new Float32Array(MASK_N * MASK_N);
  for (let j = 0; j < MASK_N; j++) for (let i = 0; i < MASK_N; i++) m[j * MASK_N + i] = keepFlat(i - MASK_HALF, j - MASK_HALF) ? 0 : 1;
  // Erode once (a flat apron round every keep-out), then blur twice for a soft rise.
  const pass = (src: Float32Array, f: (vals: number[]) => number) => {
    const out = new Float32Array(src.length);
    for (let j = 0; j < MASK_N; j++) for (let i = 0; i < MASK_N; i++) {
      const vals: number[] = [];
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const ii = Math.min(MASK_N - 1, Math.max(0, i + di)), jj = Math.min(MASK_N - 1, Math.max(0, j + dj));
        vals.push(src[jj * MASK_N + ii]);
      }
      out[j * MASK_N + i] = f(vals);
    }
    return out;
  };
  m = pass(m, (v) => Math.min(...v));
  const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  m = pass(pass(m, avg), avg);
  mask = m;
}
function maskAt(x: number, z: number): number {
  if (!mask) return 0;
  const fx = x + MASK_HALF, fz = z + MASK_HALF;
  if (fx < 0 || fz < 0 || fx >= MASK_N - 1 || fz >= MASK_N - 1) return 0;
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, at = (a: number, b: number) => mask![b * MASK_N + a];
  return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - tz) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * tz;
}
const bump = (x: number, z: number) => 0.24 + 0.16 * Math.sin(x * 0.23 + 0.7) * Math.cos(z * 0.19 - 1.1) + 0.08 * Math.sin(x * 0.51 - z * 0.43);

/** Ground height at (x, z), in metres. 0 on everything built flat; gentle bumps in the meadow; hills at the edge. */
export function heightAt(x: number, z: number): number {
  const m = Math.max(Math.abs(x), Math.abs(z));
  const meadow = bump(x, z) * maskAt(x, z) * (1 - sstep(HILLS_FROM - 4, HILLS_FROM, m));
  if (m <= HILLS_FROM) return meadow;
  const roll = 0.65 + 0.35 * Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11 - 0.4) + 0.15 * Math.sin(x * 0.31 + z * 0.27);
  return sstep(HILLS_FROM, 62, m) * 9 * roll;
}

/** Lift a flat, subdivided ground plane (already rotated to XZ) onto the hills. */
export function shapeGround(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  p.needsUpdate = true;
  geo.computeVertexNormals();
}

/** A ring of craggy, snow-capped mountains on the horizon. One merged mesh per material (2 draw calls). */
export function buildMountains(scene: THREE.Scene): THREE.Mesh[] {
  const R = rng(7707);
  const rock: THREE.BufferGeometry[] = [], snow: THREE.BufferGeometry[] = [];
  const peak = (h: number, r: number, x: number, z: number, seg: number) => {
    const g = new THREE.ConeGeometry(r, h, seg, 3).toNonIndexed();
    const p = g.attributes.position as THREE.BufferAttribute;
    // Push the side vertices about so each peak is crooked; the tip and base ring stay put.
    const jit = new Map<string, [number, number]>();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > h / 2 - 0.01 || y < -h / 2 + 0.01) continue;
      const k = `${p.getX(i).toFixed(2)},${y.toFixed(2)},${p.getZ(i).toFixed(2)}`;
      if (!jit.has(k)) jit.set(k, [(R() - 0.5) * r * 0.35, (R() - 0.5) * h * 0.12]);
      const [d, dy] = jit.get(k)!;
      p.setXYZ(i, p.getX(i) + d, y + dy, p.getZ(i) - d * 0.6);
    }
    g.translate(x, h / 2 - 4, z);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
  };
  for (let a = 0; a < Math.PI * 2; a += 0.21 + R() * 0.12) {
    const d = 112 + R() * 30, h = 26 + R() * 34, r = 20 + R() * 16;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, seg = 5 + Math.floor(R() * 3);
    rock.push(peak(h, r, x, z, seg));
    if (h > 40) {   // the tall ones keep snow on their tops
      const sh = h * 0.3, sr = r * 0.3;
      const s = new THREE.ConeGeometry(sr * 1.18, sh, seg, 1).toNonIndexed();
      s.translate(x, h - 4 - sh / 2 + 0.3, z); s.deleteAttribute('uv'); s.computeVertexNormals();
      snow.push(s);
    }
  }
  const mk = (geos: THREE.BufferGeometry[], color: string, name: string) => {
    const g = mergeAll(geos);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, fog: false, flatShading: true }));
    m.name = name; m.raycast = () => {};
    scene.add(m);
    return m;
  };
  return [mk(rock, '#6E7F94', 'mountains'), mk(snow, '#EEF2F6', 'mountain-snow')];
}

function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nrm.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}
