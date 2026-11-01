import * as THREE from 'three';
import { FigureAnim } from '../anim/procedural';
import type { FigureRig } from '../world/figure';
import type { Variant } from '../traits/roll';
import { buildGoblin, goblinStats, damageRoll, RARITY_COLOUR, type GoblinStats } from '../traits/goblin';

// Real-time goblins (docs/trait-roll-tables.md §5, Mike: both combat modes). Each rolled goblin gets a small state
// machine picked by its behaviour row: rushers charge, skirmishers hit and back off, cowards flee and call the others,
// thieves grab bolts and run, ambushers wait crouched, archers keep their distance, trappers set snares, pack leaders
// shout (+1 damage nearby while they live), mimics dodge while you aim. Bolts hurt them; their loot uses the economy.
export const MAX_FOES = 6;
const HURT = new THREE.Color('#FF3020');
const SIGHT = 13, ALERT_RADIUS = 10, SEP = 0.55;

export interface FoeWorld {
  /** Can a goblin stand at (x, z)? */
  walkable(x: number, z: number): boolean;
  /** The player's feet, and whether they're aiming the crossbow. */
  player: THREE.Vector3;
  aiming(): boolean;
  /** A goblin hurt the player. `slow` is seconds of slow, if any. */
  hurt(dmg: number, by: Foe, slow: number): void;
  /** A thief grabs what it can; returns how many bolts it took. */
  steal(by: Foe): number;
  /** A goblin fell: pay out its loot. */
  loot(by: Foe, crowns: number, bolts: number): void;
  say(text: string): void;
}

type State = 'idle' | 'hidden' | 'chase' | 'back' | 'flee' | 'dead';
export interface Foe {
  v: Variant; st: GoblinStats; root: THREE.Group; anim: FigureAnim;
  hp: number; state: State; t: number; cd: number; windup: number; alerted: boolean;
  stolen: number; caught: number; traps: number; called: boolean; dodge: number; deadT: number; tag: THREE.Sprite; speedNow: number;
  /** v0.08 sword: seconds left of the red hit flash, and the goblin's own body materials to tint. */
  hurtT: number; mats: { m: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial; base: THREE.Color }[];
}
interface Shot { mesh: THREE.Mesh; vel: THREE.Vector3; dmg: number; by: Foe; bomb: boolean; fuse: number; landed: boolean }
interface Snare { mesh: THREE.Mesh; die: string; by: Foe }

const SHOT_GEO = new THREE.SphereGeometry(0.05, 5, 4), SHOT_MAT = new THREE.MeshBasicMaterial({ color: 0x8A8478 });
const ARROW_GEO = new THREE.BoxGeometry(0.02, 0.02, 0.45), ARROW_MAT = new THREE.MeshBasicMaterial({ color: 0xC8B898 });
const BOMB_GEO = new THREE.SphereGeometry(0.11, 7, 5), BOMB_MAT = new THREE.MeshBasicMaterial({ color: 0x2E2A26 });
const SNARE_GEO = new THREE.TorusGeometry(0.32, 0.03, 4, 10).rotateX(Math.PI / 2), SNARE_MAT = new THREE.MeshBasicMaterial({ color: 0x5A4A36 });
const BLAST_MAT = new THREE.MeshBasicMaterial({ color: 0xFFB040, transparent: true, opacity: 0.7, depthWrite: false });

function nameTag(f: Foe): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 384; c.height = 64;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(1.5, 0.25, 1); s.renderOrder = 5; s.name = 'foe-tag';
  s.raycast = () => {};
  return s;
}
function drawTag(f: Foe) {
  const mat = f.tag.material as THREE.SpriteMaterial, tex = mat.map as THREE.CanvasTexture, c = tex.image as HTMLCanvasElement, g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.font = 'bold 28px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = c.width / 2, fit = Math.min(1, (c.width - 12) / g.measureText(f.v.display).width);
  g.save(); g.translate(X, 22); g.scale(fit, 1);
  g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(f.v.display, 0, 0);
  g.fillStyle = RARITY_COLOUR[f.v.rarity]; g.fillText(f.v.display, 0, 0);
  g.restore();
  const w = 120, x0 = X - w / 2, k = Math.max(0, f.hp) / f.st.hp;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x0 - 2, 44, w + 4, 10);
  g.fillStyle = '#C0503A'; g.fillRect(x0, 46, w * k, 6);
  tex.needsUpdate = true;
}

export class Goblins {
  readonly group = new THREE.Group();
  readonly list: Foe[] = [];
  private shots: Shot[] = [];
  private snares: Snare[] = [];
  private blasts: { mesh: THREE.Mesh; t: number }[] = [];
  private tmp = new THREE.Vector3();
  /** Seconds the player has been moving; the mimic copies a dodge. */
  constructor(scene: THREE.Scene, private w: FoeWorld) { this.group.name = 'goblins'; scene.add(this.group); }

  get alive() { return this.list.filter((f) => f.state !== 'dead'); }

  spawn(v: Variant, at: THREE.Vector3, yaw = 0, force = false): Foe | null {
    if (this.alive.length >= MAX_FOES && !force) return null;
    const root = buildGoblin(v), st = goblinStats(v);
    root.position.copy(at); root.rotation.y = yaw; root.name = 'goblin:' + v.display;
    const f: Foe = { v, st, root, anim: new FigureAnim(root.userData.rig as FigureRig), hp: st.hp, state: st.behaviour === 'ambusher' ? 'hidden' : 'idle', t: 0, cd: 1, windup: 0,
      alerted: false, stolen: 0, caught: 0, traps: st.trap ? 2 : 0, called: false, dodge: 0, deadT: 0, tag: null!, speedNow: 0, hurtT: 0, mats: [] };
    // Its own copy of the body materials, so one goblin can flash red without the others.
    const rig = root.userData.rig as FigureRig | undefined;
    if (rig?.mesh) {
      const own = (m: THREE.Material) => { const c = m.clone() as THREE.MeshLambertMaterial; if ('color' in c && c.color) f.mats.push({ m: c, base: c.color.clone() }); return c; };
      rig.mesh.material = Array.isArray(rig.mesh.material) ? rig.mesh.material.map(own) : own(rig.mesh.material);
    }
    f.tag = nameTag(f); drawTag(f);
    f.tag.position.y = st.height * 1.18 + 0.15; root.add(f.tag);
    root.userData.foe = f;
    this.group.add(root);
    this.list.push(f);
    return f;
  }
  clear() {
    for (const f of this.list) this.group.remove(f.root);
    for (const s of this.shots) this.group.remove(s.mesh);
    for (const s of this.snares) this.group.remove(s.mesh);
    for (const b of this.blasts) this.group.remove(b.mesh);
    this.list.length = 0; this.shots = []; this.snares = []; this.blasts = [];
  }

  /** The nearest goblin a segment passes through (bolts): distance along it, or null. */
  hitTest(from: THREE.Vector3, dir: THREE.Vector3, len: number): { foe: Foe; dist: number } | null {
    let best: { foe: Foe; dist: number } | null = null;
    for (const f of this.list) {
      if (f.state === 'dead') continue;
      const p = f.root.position, r = 0.28 * f.st.width * (f.st.height / 0.95), top = f.st.height * 1.15;
      // Closest approach of the segment to the goblin's vertical axis, in the ground plane.
      const ox = from.x - p.x, oz = from.z - p.z, dl = Math.hypot(dir.x, dir.z);
      const t = dl < 1e-6 ? 0 : THREE.MathUtils.clamp(-(ox * dir.x + oz * dir.z) / (dl * dl), 0, len);
      const cx = ox + dir.x * t, cz = oz + dir.z * t, y = from.y + dir.y * t - p.y;
      if (Math.hypot(cx, cz) < r && y > 0 && y < top && (!best || t < best.dist)) best = { foe: f, dist: t };
    }
    return best;
  }

  /** A bolt hit `f` travelling along `dir`. Returns true if it went in (a pot-lid can turn it). */
  shoot(f: Foe, dmg: number, dir: THREE.Vector3): boolean {
    if (f.state === 'dead') return false;
    const fwd = this.tmp.set(Math.sin(f.root.rotation.y), 0, Math.cos(f.root.rotation.y));
    if (f.st.block && fwd.dot(dir) < -0.5 && Math.random() < 0.5) { this.w.say(`${f.v.display} turns the bolt with a pot lid.`); this.alert(f); return false; }
    f.hp -= Math.max(1, dmg * 3 - f.st.armour);
    f.caught++;
    drawTag(f);
    this.alert(f);
    if (f.st.behaviour === 'mimic') f.dodge = 0.8;   // shot at: it ducks aside
    if (f.hp <= 0) this.kill(f);
    return true;
  }

  /** v0.08 sword: a cut from `from` facing `fwd` (unit, flat). Every goblin inside the arc is hurt, staggered and
   *  knocked back. A pot lid can turn a light cut it faces; the heavy third cut goes through. Returns those hit. */
  slash(from: THREE.Vector3, fwd: THREE.Vector3, reach: number, arc: number, dmg: number, heavy: boolean): Foe[] {
    const out: Foe[] = [], cosArc = Math.cos(arc), dir = new THREE.Vector3();
    for (const f of this.list) {
      if (f.state === 'dead') continue;
      const p = f.root.position, dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz);
      const r = 0.28 * f.st.width * (f.st.height / 0.95);
      if (d - r > reach || (d > 0.3 && (dx * fwd.x + dz * fwd.z) / d < cosArc)) continue;
      if (d > 1e-4) dir.set(dx / d, 0, dz / d); else dir.copy(fwd);
      const facing = this.tmp.set(Math.sin(f.root.rotation.y), 0, Math.cos(f.root.rotation.y));
      if (f.st.block && !heavy && facing.dot(dir) < -0.5 && Math.random() < 0.35) { this.w.say(`${f.v.display} catches the blade on a pot lid.`); this.alert(f); f.hurtT = 0.05; continue; }
      f.hp -= Math.max(1, dmg - f.st.armour);
      f.hurtT = 0.18;
      drawTag(f);
      this.alert(f);
      f.windup = 0; f.cd = Math.max(f.cd, heavy ? 0.9 : 0.55);   // staggered: no hitting back straight away
      this.step(f, dir.x, dir.z, heavy ? 0.9 : 0.4, 1);         // knocked back (walls stop it)
      if (f.hp <= 0) this.kill(f);
      out.push(f);
    }
    return out;
  }

  private kill(f: Foe) {
    f.state = 'dead'; f.deadT = 0; f.tag.visible = false;
    this.w.loot(f, f.st.crowns, f.st.bolts + f.stolen + f.caught);
    if (f.st.leader) this.w.say(`${f.v.display} falls, and the others lose their nerve.`);
  }

  private alert(f: Foe) {
    if (f.alerted) return;
    f.alerted = true; if (f.state === 'hidden' || f.state === 'idle') f.state = 'chase';
    if (f.st.leader) {
      this.w.say(`${f.v.display} shrieks, and the goblins nearby grow bolder.`);
      for (const o of this.alive) if (o !== f && o.root.position.distanceTo(f.root.position) < ALERT_RADIUS) this.alert(o);
    }
  }

  private los(a: THREE.Vector3, b: THREE.Vector3) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.5);
    for (let i = 1; i < n; i++) { const k = i / n; if (!this.w.walkable(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k)) return false; }
    return true;
  }

  // Move toward a direction (sliding along walls). Returns the distance moved.
  private step(f: Foe, dx: number, dz: number, speed: number, dt: number) {
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) return 0;
    const p = f.root.position, s = speed * dt;
    const nx = p.x + (dx / l) * s, nz = p.z + (dz / l) * s;
    if (this.w.walkable(nx, nz)) p.set(nx, 0, nz);
    else if (this.w.walkable(nx, p.z)) p.x = nx;
    else if (this.w.walkable(p.x, nz)) p.z = nz;
    else return 0;
    return s;
  }

  private leaderBonus(f: Foe) {
    return this.alive.some((o) => o !== f && o.st.leader && o.root.position.distanceTo(f.root.position) < ALERT_RADIUS) ? 1 : 0;
  }

  /** Standing still (the dev bestiary): breathe, tags always on. */
  idle(dt: number) { for (const f of this.list) { f.anim.update(dt, { speed: 0 }); f.tag.visible = true; } }

  update(dt: number) {
    const P = this.w.player;
    for (const f of this.list) {
      if (f.mats.length && (f.hurtT > 0 || f.mats[0].m.color.r !== f.mats[0].base.r)) {
        f.hurtT = Math.max(0, f.hurtT - dt);
        const k = Math.min(1, f.hurtT / 0.12);
        for (const { m, base } of f.mats) m.color.copy(base).lerp(HURT, k * 0.7);
      }
      if (f.state === 'dead') {
        f.deadT += dt;
        f.root.rotation.x = Math.max(-Math.PI / 2, -f.deadT * 5);   // topples backwards
        if (f.deadT > 4) { f.root.visible = false; }
        continue;
      }
      const p = f.root.position, dx = P.x - p.x, dz = P.z - p.z, d = Math.hypot(dx, dz);
      const sees = d < SIGHT && this.los(p, P);
      f.cd = Math.max(0, f.cd - dt); f.t += dt; f.dodge = Math.max(0, f.dodge - dt);
      if (!f.alerted) {
        if (f.state === 'hidden' ? d < 4 : sees && d < SIGHT - 2) this.alert(f);
      }
      let mx = 0, mz = 0, sp = f.st.speed, pose: 'kneel' | 'punch' | null = f.state === 'hidden' ? 'kneel' : null, aim = false;
      const ranged = f.st.range > 0, b = f.st.behaviour;
      if (f.alerted) {
        // Cowards break at half health and call the others; thieves run once they have something.
        if (b === 'coward' && f.hp <= f.st.hp / 2 && f.state !== 'flee') {
          f.state = 'flee';
          if (!f.called) { f.called = true; this.w.say(`${f.v.display} squeals for help!`); for (const o of this.alive) if (o.root.position.distanceTo(p) < 12) this.alert(o); }
        }
        if (f.state === 'flee') { mx = -dx; mz = -dz; sp *= 1.1; }
        else if (b === 'mimic' && (this.w.aiming() || f.dodge > 0)) { mx = -dz; mz = dx; if (Math.sin(f.t * 1.3) < 0) { mx = -mx; mz = -mz; } }   // strafes while you aim
        else if (b === 'trapper' && f.traps > 0 && d < 9 && sees) {
          // Lays a snare on the way to you, then backs off to lure you over it.
          const at = new THREE.Vector3(p.x + dx * 0.45, 0, p.z + dz * 0.45);
          if (this.w.walkable(at.x, at.z)) this.lay(f, at);
          f.traps--; f.state = 'back'; f.t = 0;
        } else if (f.state === 'back') {
          mx = -dx; mz = -dz;
          if (f.t > (b === 'trapper' ? 1.6 : 1.2) || d > 6) { f.state = 'chase'; f.t = 0; }
          else if (b === 'skirmisher') { mx = -dx * 0.4 - dz; mz = -dz * 0.4 + dx; }   // circles while backing off
        } else {
          f.state = 'chase';
          const want = ranged ? (b === 'archer' ? 10 : f.st.range * 0.7) : f.st.reach * 0.8;
          if (b === 'thief' && d < 1.1 && f.stolen === 0) {
            f.stolen = this.w.steal(f);
            this.w.say(f.stolen ? `${f.v.display} snatches ${f.stolen} bolt${f.stolen > 1 ? 's' : ''} and runs!` : `${f.v.display} pats your pockets, finds nothing, and runs.`);
            f.state = 'flee';
          } else if (b === 'archer' && d < 8) { mx = -dx; mz = -dz; }
          else if ((d > want || !sees) && d > 0.75) { mx = dx; mz = dz; }   // never right on top of you
          if (ranged) aim = sees && d < f.st.range;
          // Attacks.
          if (f.windup > 0) {
            f.windup -= dt; pose = 'punch'; mx = mz = 0;
            if (f.windup <= 0 && d < f.st.reach + 0.6) {
              this.w.hurt(damageRoll(f.st.damage) + this.leaderBonus(f), f, f.st.slowOnHit);
              if (b === 'skirmisher') { f.state = 'back'; f.t = 0; }
            }
          } else if (f.cd <= 0 && sees) {
            if (ranged && d < f.st.range && b !== 'thief') { this.fire(f, d); f.cd = f.st.cooldown; }
            else if (!ranged && d < f.st.reach + 0.3) { f.windup = 0.35; f.cd = f.st.cooldown; }
          }
        }
      }
      // Keep apart from each other.
      for (const o of this.list) {
        if (o === f || o.state === 'dead') continue;
        const ox = p.x - o.root.position.x, oz = p.z - o.root.position.z, od = Math.hypot(ox, oz);
        if (od < SEP && od > 1e-4) { mx += (ox / od) * 2; mz += (oz / od) * 2; }
      }
      const moved = this.step(f, mx, mz, sp, dt);
      f.speedNow = moved / Math.max(dt, 1e-4);
      // Face where it's going, or the player while fighting.
      const face = f.alerted && f.state !== 'flee' && (moved < 1e-3 || f.windup > 0 || aim) ? Math.atan2(dx, dz) : moved > 1e-3 ? Math.atan2(mx, mz) : f.root.rotation.y;
      let dy = face - f.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      f.root.rotation.y += dy * Math.min(1, dt * 10);
      f.anim.update(dt, { speed: f.speedNow, pose, aiming: aim });
      f.tag.visible = f.state !== 'hidden' && d < 11;
    }
    this.updateShots(dt);
    // Snares: step in one and it bites and holds you a moment.
    for (const s of [...this.snares]) {
      if (Math.hypot(P.x - s.mesh.position.x, P.z - s.mesh.position.z) < 0.45) {
        this.w.hurt(damageRoll(s.die), s.by, 2); this.w.say('A snare snaps shut on your ankle!');
        this.group.remove(s.mesh); this.snares.splice(this.snares.indexOf(s), 1);
      }
    }
    for (const b of [...this.blasts]) { b.t += dt; b.mesh.scale.setScalar(1 + b.t * 4); (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - b.t / 0.35); if (b.t > 0.35) { this.group.remove(b.mesh); this.blasts.splice(this.blasts.indexOf(b), 1); } }
  }

  private lay(f: Foe, at: THREE.Vector3) {
    const m = new THREE.Mesh(SNARE_GEO, SNARE_MAT); m.position.copy(at).setY(0.03); m.name = 'snare'; m.raycast = () => {};
    this.group.add(m); this.snares.push({ mesh: m, die: f.st.trap ?? '1d6', by: f });
  }

  private fire(f: Foe, d: number) {
    const p = f.root.position, P = this.w.player, bomb = f.st.weapon === 'bomb';
    const from = new THREE.Vector3(p.x, f.st.height * 0.75, p.z);
    const to = new THREE.Vector3(P.x, bomb ? 0 : 1.2, P.z);
    let vel: THREE.Vector3;
    if (bomb) {
      // Lobbed: lands at your feet after ~0.8 s.
      const T = 0.8; vel = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y) / T + 0.5 * 9.8 * T, (to.z - from.z) / T);
    } else {
      const err = 0.05 + Math.max(0, -f.st.aim);   // an eyepatch costs aim
      vel = to.sub(from).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 2 * err).multiplyScalar(f.st.shot);
    }
    const mesh = new THREE.Mesh(bomb ? BOMB_GEO : f.st.weapon === 'bow' ? ARROW_GEO : SHOT_GEO, bomb ? BOMB_MAT : f.st.weapon === 'bow' ? ARROW_MAT : SHOT_MAT);
    mesh.position.copy(from); mesh.raycast = () => {}; mesh.name = bomb ? 'bomb' : 'shot';
    this.group.add(mesh);
    this.shots.push({ mesh, vel, dmg: damageRoll(f.st.damage) + this.leaderBonus(f), by: f, bomb, fuse: f.st.fuse || 2, landed: false });
    void d;
  }

  private updateShots(dt: number) {
    const P = this.w.player;
    for (const s of [...this.shots]) {
      const m = s.mesh, gone = () => { this.group.remove(m); this.shots.splice(this.shots.indexOf(s), 1); };
      s.fuse -= dt;
      if (s.bomb) {
        if (!s.landed) {
          s.vel.y -= 9.8 * dt; m.position.addScaledVector(s.vel, dt);
          if (m.position.y <= 0.11 || !this.w.walkable(m.position.x, m.position.z)) { m.position.y = 0.11; s.landed = true; s.vel.set(0, 0, 0); }
        }
        if (s.fuse <= 0) {
          const r = s.by.st.blast || 2;
          if (Math.hypot(P.x - m.position.x, P.z - m.position.z) < r) this.w.hurt(s.dmg, s.by, 0);
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), BLAST_MAT.clone()); b.position.copy(m.position); b.raycast = () => {};
          this.group.add(b); this.blasts.push({ mesh: b, t: 0 });
          gone();
        }
        continue;
      }
      m.position.addScaledVector(s.vel, dt);
      m.lookAt(this.tmp.copy(m.position).add(s.vel));
      if (Math.hypot(P.x - m.position.x, P.z - m.position.z) < 0.4 && m.position.y > 0 && m.position.y < 1.8) { this.w.hurt(s.dmg, s.by, 0); gone(); continue; }
      if (!this.w.walkable(m.position.x, m.position.z) || s.fuse < -2) gone();
    }
  }
}
