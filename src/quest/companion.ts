import * as THREE from 'three';
import type { Collider } from '../world/index';

// B2 companion: Natalie walks with you once she joins, keeps a step behind your shoulder, and thinks out
// loud (barks) about where you are and what you find. "Wait here" parks her; chatter can be muted.
export interface CompanionPrefs { follow: boolean; quiet: boolean }
const KEY = 'gametool.companion';
export function loadCompanion(): CompanionPrefs {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { follow: !!v.follow, quiet: !!v.quiet }; } catch { return { follow: false, quiet: false }; }
}
export function saveCompanion(p: CompanionPrefs) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* blocked */ } }

const WALK = 2.2, RUN = 5.2, KEEP = 2.0;
const DOOR_Z = -18.2;   // the Ruined Library's front wall (world/index.ts LIB.front)

export class Companion {
  speed = 0;
  private yaw: number;
  private line: HTMLDivElement;
  private lineTimer = 0;
  private lastBark = -1e9;
  private said = new Set<string>();

  constructor(private root: () => THREE.Object3D, private target: THREE.Object3D, private colliders: Collider[], private bounds: number, readonly prefs: CompanionPrefs) {
    this.yaw = root().rotation.y;
    this.line = document.createElement('div');
    this.line.id = 'companionLine';
    this.line.className = 'companion-line hidden';
    document.body.appendChild(this.line);
  }

  /** Ground height under her feet (main sets it: the meadow's bumps and the hills). */
  terrain: (x: number, z: number) => number = () => 0;
  get pos() { return this.root().position; }

  // Follow: aim for a point behind-left of the player; walk, or run to catch up; never stand inside a collider.
  update(dt: number, player: THREE.Vector3, playerYaw: number, frozen: boolean) {
    const r = this.root();
    if (!this.prefs.follow || frozen) { this.speed = 0; this.syncTarget(); return; }
    const goal = new THREE.Vector3(player.x + Math.sin(playerYaw) * 1.4 - Math.cos(playerYaw) * 0.9, 0, player.z + Math.cos(playerYaw) * 1.4 + Math.sin(playerYaw) * 0.9);
    // The library has one way in: on the other side of its front wall from the player, head for the door first.
    const inside = (z: number) => z < DOOR_Z;
    const glade = Math.abs(player.x) < 100;   // the dungeon (far east) has no library wall
    if (glade && inside(player.z) !== inside(r.position.z)) goal.set(0, 0, inside(r.position.z) ? DOOR_Z - 1.2 : DOOR_Z + 1.2);
    if (glade && Math.abs(goal.z - DOOR_Z) < 1.5 && inside(player.z) !== inside(r.position.z) && Math.abs(r.position.x) < 1.2 && Math.hypot(goal.x - r.position.x, goal.z - r.position.z) < 0.6) goal.set(0, 0, inside(player.z) ? DOOR_Z - 1.2 : DOOR_Z + 1.2);
    const dx = goal.x - r.position.x, dz = goal.z - r.position.z, d = Math.hypot(dx, dz);
    const far = Math.hypot(player.x - r.position.x, player.z - r.position.z);
    if (far > 30) { r.position.set(goal.x, this.terrain(goal.x, goal.z), goal.z); this.speed = 0; this.syncTarget(); return; }   // left behind (teleport, respawn): catch up
    const want = d < 0.25 ? 0 : d > KEEP * 2 ? RUN : Math.min(WALK, d * 1.6);
    this.speed += (want - this.speed) * (1 - Math.exp(-8 * dt));
    if (d > 0.05 && this.speed > 0.05) {
      const step = Math.min(d, this.speed * dt);
      r.position.x += (dx / d) * step; r.position.z += (dz / d) * step;
      const face = Math.atan2(dx, dz);
      this.yaw += Math.atan2(Math.sin(face - this.yaw), Math.cos(face - this.yaw)) * (1 - Math.exp(-10 * dt));
    } else {
      // Standing: turn to face the player.
      const face = Math.atan2(player.x - r.position.x, player.z - r.position.z);
      this.yaw += Math.atan2(Math.sin(face - this.yaw), Math.cos(face - this.yaw)) * (1 - Math.exp(-4 * dt));
    }
    this.pushOut(r.position);
    r.position.y = this.terrain(r.position.x, r.position.z);
    r.rotation.y = this.yaw;
    this.syncTarget();
  }

  private pushOut(p: THREE.Vector3) {
    const R = 0.3;
    for (const c of this.colliders) {
      if (c.kind === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + R;
        if (d < m && d > 1e-4) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; }
      } else if (c.kind === 'box') {
        if (p.x > c.minX - R && p.x < c.maxX + R && p.z > c.minZ - R && p.z < c.maxZ + R) {
          const ex = [c.minX - R - p.x, c.maxX + R - p.x], ez = [c.minZ - R - p.z, c.maxZ + R - p.z];
          const bx = Math.abs(ex[0]) < Math.abs(ex[1]) ? ex[0] : ex[1], bz = Math.abs(ez[0]) < Math.abs(ez[1]) ? ez[0] : ez[1];
          if (Math.abs(bx) < Math.abs(bz)) p.x += bx; else p.z += bz;
        }
      }
    }
    const b = this.bounds - 1;
    p.x = Math.max(-b, Math.min(b, p.x)); p.z = Math.max(-b, Math.min(b, p.z));
  }
  private syncTarget() { const p = this.root().position; this.target.position.set(p.x, 0.9, p.z); }

  // A line under the screen centre: "Natalie: …". `key` lines are said once; ambient ones respect a cooldown.
  say(text: string, opts: { key?: string; force?: boolean; ms?: number } = {}) {
    if (this.prefs.quiet && !opts.force) return false;
    if (opts.key) { if (this.said.has(opts.key)) return false; this.said.add(opts.key); }
    const now = performance.now();
    if (!opts.force && !opts.key && now - this.lastBark < 25000) return false;
    this.lastBark = now;
    this.line.textContent = `Natalie: “${text}”`;
    this.line.classList.remove('hidden');
    clearTimeout(this.lineTimer);
    this.lineTimer = window.setTimeout(() => this.line.classList.add('hidden'), opts.ms ?? Math.max(3500, text.length * 70));
    return true;
  }
  get lastLine() { return this.line.classList.contains('hidden') ? '' : this.line.textContent ?? ''; }
}
