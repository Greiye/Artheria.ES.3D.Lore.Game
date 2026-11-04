import type { Collider } from './world/index';

// B41 / B42 (Mike 2026-11-04 "All 3 yes"): auto-lean at walls and low cover, shared by the player and NPCs.
// Aiming with a wall edge just ahead, the body leans out past the edge (left or right, toward the open side);
// crouched behind low cover (a top under chest height) and aiming, you rise to peek over it. Moving, or not
// aiming, eases back in. Pure geometry over the same 2D colliders the feet use, so it costs a few dozen point
// tests a frame and nothing on the GPU.
export const LEAN = {
  reach: 1.3,     // m ahead that counts as "at the wall"
  side: 0.5,      // m the eyes move sideways at full lean
  roll: 0.2,      // rad the view tilts at full lean
  spine: 0.32,    // rad the upper body tilts at full lean (figures)
  tau: 0.14,      // s, ease in / out
  moving: 0.5,    // m/s: faster than this and you're crossing ground, not leaning
  clear: 0.25,    // m the eyes need above a top to see (and shoot) over it
};
export interface LeanWant { side: number; up: number }   // side -1 left … 1 right; up 0 … 1
export const NO_LEAN: LeanWant = { side: 0, up: 0 };

function inside(c: Collider, x: number, z: number, y: number) {
  if (c.top !== undefined && c.top <= y - LEAN.clear) return false;   // well below the eye: it doesn't block the view
  return c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r : x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;
}
function blockedAt(cs: Collider[], x: number, z: number, y: number) { for (const c of cs) if (inside(c, x, z, y)) return true; return false; }
/** Is the view from (x, z) at height y blocked within `reach` along (fx, fz)? */
function rayBlocked(cs: Collider[], x: number, z: number, fx: number, fz: number, y: number, reach = LEAN.reach) {
  for (let t = 0.15; t <= reach + 1e-6; t += 0.15) if (blockedAt(cs, x + fx * t, z + fz * t, y)) return true;
  return false;
}

/**
 * Where to lean. `y` is the ground under the feet; `eye` the eye height now (crouched or standing); `stand` the
 * standing eye height. Facing (yaw) looks along (-sin yaw, -cos yaw), like the player and the figures.
 */
export function leanTarget(cs: Collider[], x: number, z: number, y: number, yaw: number,
  o: { aiming: boolean; crouched: boolean; speed: number; eye: number; stand: number }): LeanWant {
  if (!o.aiming || o.speed > LEAN.moving) return NO_LEAN;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;   // forward, right
  const eyeY = y + o.eye;
  if (!rayBlocked(cs, x, z, fx, fz, eyeY)) return NO_LEAN;
  // Crouched behind low cover: rise and peek over it (only if standing clears it).
  if (o.crouched && !rayBlocked(cs, x, z, fx, fz, y + o.stand) && !blockedAt(cs, x, z, y + o.stand)) return { side: 0, up: 1 };
  // A wall edge: lean toward the side whose view ahead is open, and where the head would fit.
  for (const s of [1, -1]) {
    const lx = x + rx * LEAN.side * s, lz = z + rz * LEAN.side * s;
    if (!blockedAt(cs, lx, lz, eyeY) && !rayBlocked(cs, lx, lz, fx, fz, eyeY, LEAN.reach + 0.6)) return { side: s, up: 0 };
  }
  return NO_LEAN;
}

/** Eases a lean toward its target; one per character. */
export class Lean {
  side = 0;
  up = 0;
  update(dt: number, want: LeanWant) {
    const k = 1 - Math.exp(-dt / LEAN.tau);
    this.side += (want.side - this.side) * k;
    this.up += (want.up - this.up) * k;
    if (Math.abs(this.side) < 1e-3 && want.side === 0) this.side = 0;
    if (this.up < 1e-3 && want.up === 0) this.up = 0;
  }
}
