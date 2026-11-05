import * as THREE from 'three';
import { CEILING } from './gen';

// Skyrunner flight (arcade, not a sim). The nose is local -Z, up +Y, right +X. Stick pitch and roll; the plane
// turns where it banks; let go and it levels out. Throttle sets the speed between 25 and 55 m/s, a dive adds a
// little, a mana surge adds 40% for 2 s. No stalls. Mana bolts: straight, fast, a short heat bar, a gentle pull
// toward a target near the nose.
export const MIN_SPEED = 25, MAX_SPEED = 55;
const PITCH_RATE = 1.25, ROLL_RATE = 2.6, BANK_TURN = 1.0, LEVEL = 1.6;
export const SURGE = { mul: 1.4, time: 2, cooldown: 6 };
export const BOLT = { speed: 170, life: 1.4, refire: 0.15, heat: 0.08, cool: 0.45, jam: 1.5, hitR: 4.5 };

export interface Ctl { pitch: number; roll: number; throttle: number; fire: boolean; surge: boolean }

export class Plane {
  pos = new THREE.Vector3();
  q = new THREE.Quaternion();
  speed = 40;
  throttle = 0.5;
  hp: number;
  readonly maxHp: number;
  heat = 0;
  jammed = 0;
  surge = 0;
  surgeCd = 0;
  fireCd = 0;
  /** Seconds since this plane was last hit (for the smoke and the AI's break turn). */
  sinceHit = 99;
  alive = true;
  constructor(hp: number, readonly turnMul = 1) { this.hp = this.maxHp = hp; }

  forward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.q); }
  up(out = new THREE.Vector3()) { return out.set(0, 1, 0).applyQuaternion(this.q); }
  right(out = new THREE.Vector3()) { return out.set(1, 0, 0).applyQuaternion(this.q); }

  /** Face along a yaw (0 = -Z), level. */
  face(yaw: number) { this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw); }

  /** One step of flight. Returns true when a bolt should leave the nose this step. */
  step(c: Ctl, dt: number): boolean {
    this.sinceHit += dt;
    if (!this.alive) { this.pos.y -= 30 * dt; return false; }
    const f = this.forward(_f), r = this.right(_r);
    const bank = Math.asin(THREE.MathUtils.clamp(r.y, -1, 1));            // + = right wing up (banked left)
    const climb = Math.asin(THREE.MathUtils.clamp(f.y, -1, 1));
    let roll = c.roll * ROLL_RATE * this.turnMul, pitch = c.pitch * PITCH_RATE * this.turnMul;
    // Let go and it levels out (wings first, then the nose, gently).
    if (Math.abs(c.roll) < 0.1) roll = THREE.MathUtils.clamp(bank * LEVEL * 1.5, -ROLL_RATE, ROLL_RATE);   // banked left: roll right
    if (Math.abs(c.pitch) < 0.1) pitch = -climb * 0.6;
    // The ceiling: the nose is pushed down above it.
    if (this.pos.y > CEILING) pitch = Math.min(pitch, -(this.pos.y - CEILING) * 0.05);
    // Banked turn: the heading swings toward the low wing.
    const yawRate = Math.sin(bank) * BANK_TURN * this.turnMul;   // + about world up = turn left
    const qPitch = _q1.setFromAxisAngle(_x, pitch * dt), qRoll = _q2.setFromAxisAngle(_z, -roll * dt);
    this.q.multiply(qPitch).multiply(qRoll);
    this.q.premultiply(_q3.setFromAxisAngle(_y, yawRate * dt)).normalize();
    // Speed: throttle, a dive, the surge.
    this.throttle = THREE.MathUtils.clamp(c.throttle, 0, 1);
    if (c.surge && this.surgeCd <= 0) { this.surge = SURGE.time; this.surgeCd = SURGE.cooldown; }
    this.surge = Math.max(0, this.surge - dt); this.surgeCd = Math.max(0, this.surgeCd - dt);
    const want = THREE.MathUtils.lerp(MIN_SPEED, MAX_SPEED, this.throttle) * (this.surge > 0 ? SURGE.mul : 1) - this.forward(_f).y * 8;
    this.speed += (want - this.speed) * Math.min(1, dt * 1.2);
    this.pos.addScaledVector(this.forward(_f), this.speed * dt);
    // Guns.
    this.fireCd -= dt;
    this.jammed = Math.max(0, this.jammed - dt);
    this.heat = Math.max(0, this.heat - BOLT.cool * dt);
    if (c.fire && this.fireCd <= 0 && this.jammed <= 0) {
      this.fireCd = BOLT.refire; this.heat += BOLT.heat;
      if (this.heat >= 1) { this.heat = 1; this.jammed = BOLT.jam; }
      return true;
    }
    return false;
  }

  /** The roll the wings have now, radians (+ = banked right). */
  bank() { return -Math.asin(THREE.MathUtils.clamp(this.right(_r).y, -1, 1)); }
}
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

export interface Bolt { pos: THREE.Vector3; vel: THREE.Vector3; life: number; mine: boolean }

/** A bolt from `p`'s nose. Inside `cone` radians of a target within range it bends toward where the target will be. */
export function fireBolt(p: Plane, target: Plane | null, cone: number, spread: number, rand: () => number, mine: boolean): Bolt {
  const dir = p.forward(new THREE.Vector3());
  if (target?.alive) {
    const to = target.pos.clone().sub(p.pos), d = to.length();
    const lead = target.pos.clone().addScaledVector(target.forward(new THREE.Vector3()), target.speed * (d / (BOLT.speed + p.speed)));
    const aim = lead.sub(p.pos).normalize();
    if (d < BOLT.speed * BOLT.life && dir.angleTo(aim) < cone) dir.copy(aim);
  }
  if (spread) dir.add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(spread)).normalize();
  const pos = p.pos.clone().addScaledVector(p.forward(new THREE.Vector3()), 4);
  return { pos, vel: dir.multiplyScalar(BOLT.speed + p.speed), life: BOLT.life, mine };
}

// ---------- the hexed skyrunner: pursue, line up, fire a burst, break away, again ----------
export type FoeState = 'pursue' | 'attack' | 'break' | 'climb';
export class FoeAI {
  state: FoeState = 'pursue';
  t = 0;
  burst = 0;
  breakSide = 1;
  constructor(private rand: () => number) {}

  /** Controls for `me` chasing `you`; `ground` is the height under `me`. */
  ctl(me: Plane, you: Plane, ground: number, dt: number): Ctl {
    this.t += dt;
    const local = you.pos.clone().sub(me.pos).applyQuaternion(me.q.clone().invert());
    const dist = local.length(), off = Math.acos(THREE.MathUtils.clamp(-local.z / Math.max(1, dist), -1, 1));
    const c: Ctl = { pitch: 0, roll: 0, throttle: 0.6, fire: false, surge: false };
    // Too low: level the wings and climb, whatever else.
    if (me.pos.y - ground < 45 || this.state === 'climb') {
      if (this.state !== 'climb') { this.state = 'climb'; this.t = 0; }
      c.roll = THREE.MathUtils.clamp(-me.bank() * 2, -1, 1); c.pitch = 1;
      if (me.pos.y - ground > 90 || this.t > 3) { this.state = 'pursue'; this.t = 0; }
      return c;
    }
    if (me.sinceHit < 0.1 && this.state !== 'break') { this.state = 'break'; this.t = 0; this.breakSide = this.rand() < 0.5 ? -1 : 1; }
    if (this.state === 'break') {
      c.roll = THREE.MathUtils.clamp((this.breakSide * 1.1 - me.bank()) * 2, -1, 1); c.pitch = 0.9; c.throttle = 1;
      if (this.t > 1.6) { this.state = 'pursue'; this.t = 0; }
      return c;
    }
    // Bank so the target is "above" in the plane's frame, then pull toward it.
    const want = Math.atan2(local.x, Math.max(0.01, local.y + 0.3 * dist * (off < 0.5 ? 0 : 1)));
    c.roll = THREE.MathUtils.clamp(want * 1.6, -1, 1);
    c.pitch = Math.abs(want) < 1.3 ? THREE.MathUtils.clamp(off * 2.5, 0, 1) : 0.2;
    if (off < 0.2) { c.roll = THREE.MathUtils.clamp(local.x / Math.max(1, dist) * 6, -1, 1); c.pitch = THREE.MathUtils.clamp(local.y / Math.max(1, dist) * 6, -1, 1); }
    c.throttle = dist > 300 ? 1 : dist < 90 ? 0.25 : 0.6;
    if (this.state === 'pursue' && off < 0.09 && dist < 260) { this.state = 'attack'; this.t = 0; this.burst = 0.7; }
    if (this.state === 'attack') {
      this.burst -= dt;
      c.fire = this.burst > 0 && off < 0.12;
      if (this.burst < -0.9) { this.state = this.rand() < 0.5 ? 'break' : 'pursue'; this.t = 0; this.breakSide = this.rand() < 0.5 ? -1 : 1; }
    }
    return c;
  }
}
