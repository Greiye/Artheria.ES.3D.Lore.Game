import * as THREE from 'three';

// One flight step for everything that is shot or thrown (crossbow bolts, thrown and slung rocks, the magic missile).
// Each weapon used to carry its own copy of this: gravity, then a swept ray against the solids and the foes, then the
// ground. They share it now, and all fly in fixed slices of time, so an arc is the same at 20 frames a second as at 120.
// What happens on a hit (stick, bounce, wink out) stays with the weapon.

export const GRAVITY = 9.8;
/** Longest slice of time a projectile is moved in one go, s. */
export const FLIGHT_STEP = 1 / 120;

/** A foe in the way: how far along the step it is, and what hitting it does (false: turned aside). */
export type FoeHit = { dist: number; hit: (damage: number, dir: THREE.Vector3) => boolean };
/** Who is in the way of a step from `from` along `dir` (normalised) within `len` metres. */
export type FoeQuery = (from: THREE.Vector3, dir: THREE.Vector3, len: number) => FoeHit | null;

export interface FlightWorld {
  solids: THREE.Object3D[];
  /** Ground height at (x, z), bumps and hills included. */
  terrain: (x: number, z: number) => number;
  foes: FoeQuery | null;
}
export interface FlightOpts {
  /** Multiplier on GRAVITY (0: flies straight). */
  gravity: number;
  /** Extra reach of the sweep beyond the step, m (thin things would otherwise slip between two steps). */
  reach: number;
  /** How far above the ground counts as landed, m. */
  ground: number;
}
export type FlightResult =
  | { kind: 'fly' }
  | { kind: 'foe'; foe: FoeHit; dir: THREE.Vector3; from: THREE.Vector3 }
  | { kind: 'solid'; point: THREE.Vector3; dir: THREE.Vector3 }
  | { kind: 'ground' };

const ray = new THREE.Raycaster(), step = new THREE.Vector3(), from = new THREE.Vector3(), dir = new THREE.Vector3();

/**
 * Move `pos` by one slice `h` of flight at `vel` (gravity is applied to `vel` first). On 'fly' and 'ground' `pos` has
 * moved (on 'ground' it rests at the ground height); on 'foe' and 'solid' it is left where the step began, and the
 * result says where and along what direction the hit was. The vectors in a result are reused by the next call.
 */
export function flightStep(pos: THREE.Vector3, vel: THREE.Vector3, h: number, world: FlightWorld, o: FlightOpts): FlightResult {
  vel.y -= GRAVITY * o.gravity * h;
  step.copy(vel).multiplyScalar(h);
  const len = step.length();
  if (len < 1e-9) return { kind: 'fly' };
  from.copy(pos); dir.copy(step).divideScalar(len);
  ray.set(from, dir); ray.far = len + o.reach;
  const hit = ray.intersectObjects(world.solids, false)[0];
  const foe = world.foes?.(from, dir, len + o.reach) ?? null;
  if (foe && (!hit || foe.dist < hit.distance)) return { kind: 'foe', foe, dir, from };
  if (hit) return { kind: 'solid', point: hit.point, dir };
  pos.add(step);
  const gy = world.terrain(pos.x, pos.z);
  if (pos.y <= gy + o.ground) { pos.y = gy + o.ground; return { kind: 'ground' }; }
  return { kind: 'fly' };
}

/** Calls `each(h)` for `dt` cut into equal slices no longer than FLIGHT_STEP; stops early when it returns false. */
export function flightSlices(dt: number, each: (h: number) => boolean | void): void {
  const n = Math.max(1, Math.ceil(dt / FLIGHT_STEP - 1e-9)), h = dt / n;
  for (let i = 0; i < n; i++) if (each(h) === false) return;
}
