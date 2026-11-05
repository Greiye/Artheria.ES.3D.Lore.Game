import { mulberry32 } from '../dungeon/gen';

// Skyrunner (Mike 2026-11-05): the seeded land under a sky run. A square of rolling hills (value noise, a few
// octaves), water in the low ground, rock spires to dodge, scattered trees, a rim of mountains at the edge, the
// launch perch (A) and the beacon tower (B) 1.6 to 2 km apart, and a few wind rings along the way. Same seed, same map.
export const SIZE = 3000;            // metres across
export const RES = 120;              // height grid cells per side
export const WATER = 6;              // water level, metres
export const CEILING = 400;
export const CRUISE = 40;            // m/s at half throttle

export interface Spire { x: number; z: number; r: number; h: number; base: number }   // h = height of the top, base = foot (both absolute)
export interface Ring { x: number; y: number; z: number; yaw: number }
export interface SkyMap {
  seed: number;
  h: Float32Array;                   // (RES + 1)^2 heights
  start: { x: number; z: number; y: number; yaw: number };
  goal: { x: number; z: number; y: number };
  rings: Ring[];
  spires: Spire[];
  trees: { x: number; z: number; y: number; s: number }[];
  dist: number;                      // straight-line A to B, metres
}

const N = RES + 1, CELL = SIZE / RES, HALF = SIZE / 2;
const smooth = (t: number) => t * t * (3 - 2 * t);
const sstep = (a: number, b: number, x: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** Value noise on a lattice of `cells` per side, wrapped, from a seeded table. */
function lattice(R: () => number, cells: number) {
  const t = new Float32Array((cells + 1) * (cells + 1)).map(() => R());
  return (u: number, v: number) => {
    const x = u * cells, y = v * cells, i = Math.min(cells - 1, Math.floor(x)), j = Math.min(cells - 1, Math.floor(y));
    const fx = smooth(x - i), fy = smooth(y - j), at = (a: number, b: number) => t[b * (cells + 1) + a];
    return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
  };
}

/** Ground height at (x, z) from the map's grid (bilinear). Off the map: the rim height. */
export function groundAt(m: SkyMap, x: number, z: number): number {
  const fx = Math.min(RES - 0.001, Math.max(0, (x + HALF) / CELL)), fz = Math.min(RES - 0.001, Math.max(0, (z + HALF) / CELL));
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, at = (a: number, b: number) => m.h[b * N + a];
  return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - tz) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * tz;
}

/** Land or water, whichever is higher: what a plane hits. */
export const surfaceAt = (m: SkyMap, x: number, z: number) => Math.max(WATER, groundAt(m, x, z));

export function generateSky(seed: number): SkyMap {
  const R = mulberry32(seed ^ 0x5CA1AB1E);
  const o1 = lattice(R, 6), o2 = lattice(R, 14), o3 = lattice(R, 34);
  // The route: A and B either side of the centre, on a random heading.
  const yaw = R() * Math.PI * 2, dist = 1600 + R() * 400;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const ax = -dx * dist / 2, az = -dz * dist / 2, bx = dx * dist / 2, bz = dz * dist / 2;
  const h = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / RES, v = j / RES, x = u * SIZE - HALF, z = v * SIZE - HALF;
    let y = o1(u, v) * 95 + o2(u, v) * 38 + o3(u, v) * 10 - 42;   // about -40 to 100 m
    y = Math.max(-8, y);
    // A rim of mountains so the edge of the map reads as an edge.
    const edge = Math.max(Math.abs(x), Math.abs(z));
    y += sstep(HALF - 260, HALF, edge) * 260;
    // Flat ground round the perch and the beacon.
    for (const [px, pz] of [[ax, az], [bx, bz]]) {
      const d = Math.hypot(x - px, z - pz), k = sstep(160, 60, d);
      y = y * (1 - k) + 30 * k;
    }
    h[j * N + i] = y;
  }
  const m: SkyMap = { seed, h, start: { x: ax, z: az, y: 0, yaw }, goal: { x: bx, z: bz, y: 0 }, rings: [], spires: [], trees: [], dist };
  m.start.y = groundAt(m, ax, az); m.goal.y = groundAt(m, bx, bz);
  // Wind rings: 4 along the line, pushed off it a little, 40 to 80 m above the ground.
  for (let k = 0; k < 4; k++) {
    const f = 0.2 + k * 0.2 + (R() - 0.5) * 0.06, off = (R() - 0.5) * 240;
    const x = ax + (bx - ax) * f + dz * off, z = az + (bz - az) * f - dx * off;
    m.rings.push({ x, z, y: surfaceAt(m, x, z) + 40 + R() * 40, yaw });
  }
  // Rock spires, kept off the perch, the beacon and the rings.
  for (let tries = 0; m.spires.length < 18 && tries < 400; tries++) {
    const x = (R() - 0.5) * (SIZE - 700), z = (R() - 0.5) * (SIZE - 700);
    if (Math.hypot(x - ax, z - az) < 250 || Math.hypot(x - bx, z - bz) < 250 || m.rings.some((r) => Math.hypot(x - r.x, z - r.z) < 80)) continue;
    const base = groundAt(m, x, z);
    m.spires.push({ x, z, r: 8 + R() * 10, h: Math.max(base, WATER) + 70 + R() * 110, base: Math.min(base, WATER) - 4 });
  }
  // Trees on dry, not-too-high ground.
  for (let tries = 0; m.trees.length < 1400 && tries < 6000; tries++) {
    const x = (R() - 0.5) * (SIZE - 300), z = (R() - 0.5) * (SIZE - 300), y = groundAt(m, x, z);
    if (y < WATER + 2 || y > 95 || Math.hypot(x - ax, z - az) < 70 || Math.hypot(x - bx, z - bz) < 70) continue;
    m.trees.push({ x, z, y, s: 0.7 + R() * 0.8 });
  }
  return m;
}
