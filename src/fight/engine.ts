// B35 (Mike 2026-11-03) fighter mode vs Kavik, reworked 2026-11-04 (Mike: "more like Tekken", "All 6"): a 3D-fighter
// ruleset with our own moves. Four limb buttons (left hand, right hand, left foot, right foot), each changed by the
// direction held (forward, back, down). Hold back to block standing (highs and mids), down-back to block low (lows;
// highs whiff over a crouch). Mids beat a crouching block, lows beat a standing one, and a throw (both hands) beats
// any block but whiffs on a crouch; it breaks if the one caught presses a hand in time. Moves chain into strings,
// some are unsafe on block (the blocker recovers first and can punish), launchers pop the other fighter up for a
// juggle, and the edges of the mat are walls that stop a fighter knocked into them (a wall splat).
// No drawing here. Timing is in frames at a fixed 60 Hz. Positions are in metres along the line of the fight.

export type Limb = 'lp' | 'rp' | 'lk' | 'rk';
export const LIMBS: Limb[] = ['lp', 'rp', 'lk', 'rk'];
/** One fighter's controls this step: the stick (x, up, down held) and the limb buttons (presses). */
export interface Pad { x: number; up: boolean; down: boolean; lp: boolean; rp: boolean; lk: boolean; rk: boolean }
export const IDLE_PAD: Pad = { x: 0, up: false, down: false, lp: false, rp: false, lk: false, rk: false };

export type HitLevel = 'high' | 'mid' | 'low' | 'throw';
export interface Move {
  id: string; name: string;
  limb: Limb | 'throw';
  aim: 'high' | 'mid' | 'low' | 'up' | 'grab';   // how the figure throws it (animation)
  level: HitLevel;
  startup: number; active: number; recovery: number;   // frames
  dmg: number;
  block: number; hit: number;    // frame advantage for the attacker when it is blocked / when it hits
  reach: number;                  // how far past the other fighter's body it reaches (m)
  lunge?: number;                 // steps forward this far over its startup (m)
  launch?: boolean;               // pops the other fighter up for a juggle
  knock?: boolean;                // knocks down (a small pop, no juggle to speak of)
  wall?: boolean;                 // hard enough to splat on a wall
  crouch?: boolean;               // done from a crouch: ducks highs while it comes out
  air?: boolean;                  // a jumping attack
  next?: Partial<Record<Limb, string>>;   // string follow-ups: press this limb during the move
}
// Our own moves (names and frame data). Kavik uses the same list.
export const MOVES: Record<string, Move> = {
  // Hands
  jab: { id: 'jab', name: 'Snap Jab', limb: 'lp', aim: 'high', level: 'high', startup: 10, active: 2, recovery: 14, dmg: 5, block: 1, hit: 8, reach: 0.75, next: { rp: 'jab2' } },
  jab2: { id: 'jab2', name: 'Follow Cross', limb: 'rp', aim: 'high', level: 'high', startup: 11, active: 2, recovery: 18, dmg: 8, block: -3, hit: 6, reach: 0.8, next: { rk: 'jab3', lk: 'jab3low' } },
  jab3: { id: 'jab3', name: 'Turning Heel', limb: 'rk', aim: 'mid', level: 'mid', startup: 16, active: 3, recovery: 26, dmg: 14, block: -14, hit: 0, reach: 0.95, knock: true, wall: true },
  jab3low: { id: 'jab3low', name: 'Shin Rake', limb: 'lk', aim: 'low', level: 'low', startup: 18, active: 3, recovery: 22, dmg: 9, block: -12, hit: 2, reach: 0.9, crouch: true },
  straight: { id: 'straight', name: 'Long Straight', limb: 'rp', aim: 'high', level: 'high', startup: 12, active: 2, recovery: 18, dmg: 10, block: -2, hit: 6, reach: 0.9, next: { lp: 'straight2' } },
  straight2: { id: 'straight2', name: 'Elbow Turn', limb: 'lp', aim: 'mid', level: 'mid', startup: 14, active: 3, recovery: 20, dmg: 11, block: -8, hit: 5, reach: 0.7, wall: true },
  palm: { id: 'palm', name: 'Rising Palm', limb: 'rp', aim: 'up', level: 'mid', startup: 15, active: 3, recovery: 24, dmg: 12, block: -13, hit: 0, reach: 0.75, lunge: 0.25, launch: true },
  hammer: { id: 'hammer', name: 'Hammer Fist', limb: 'lp', aim: 'mid', level: 'mid', startup: 13, active: 3, recovery: 18, dmg: 9, block: -4, hit: 5, reach: 0.8, lunge: 0.2 },
  hook: { id: 'hook', name: 'Back Hook', limb: 'rp', aim: 'high', level: 'high', startup: 18, active: 3, recovery: 20, dmg: 15, block: 2, hit: 0, reach: 0.85, knock: true, wall: true },
  lowpalm: { id: 'lowpalm', name: 'Low Palm', limb: 'lp', aim: 'mid', level: 'mid', startup: 11, active: 2, recovery: 14, dmg: 5, block: -5, hit: 4, reach: 0.65, crouch: true },
  uppercut: { id: 'uppercut', name: 'Coiled Uppercut', limb: 'rp', aim: 'up', level: 'mid', startup: 14, active: 3, recovery: 30, dmg: 13, block: -16, hit: 0, reach: 0.65, crouch: true, launch: true },
  // Feet
  shin: { id: 'shin', name: 'Shin Snap', limb: 'lk', aim: 'mid', level: 'mid', startup: 13, active: 3, recovery: 18, dmg: 8, block: -6, hit: 4, reach: 0.9, next: { rk: 'shin2' } },
  shin2: { id: 'shin2', name: 'Roundhouse', limb: 'rk', aim: 'high', level: 'high', startup: 15, active: 3, recovery: 24, dmg: 13, block: -9, hit: 0, reach: 1.0, knock: true, wall: true },
  wheel: { id: 'wheel', name: 'High Wheel', limb: 'rk', aim: 'high', level: 'high', startup: 15, active: 3, recovery: 22, dmg: 13, block: -7, hit: 3, reach: 1.0, wall: true },
  snap: { id: 'snap', name: 'Front Snap', limb: 'lk', aim: 'mid', level: 'mid', startup: 14, active: 3, recovery: 18, dmg: 10, block: -8, hit: 3, reach: 0.95, lunge: 0.3, next: { lk: 'snap2' } },
  snap2: { id: 'snap2', name: 'Second Snap', limb: 'lk', aim: 'mid', level: 'mid', startup: 15, active: 3, recovery: 24, dmg: 12, block: -12, hit: 0, reach: 1.0, lunge: 0.25, wall: true, next: { rp: 'snap3' } },
  snap3: { id: 'snap3', name: 'Lifting Palm', limb: 'rp', aim: 'up', level: 'mid', startup: 18, active: 3, recovery: 28, dmg: 10, block: -15, hit: 0, reach: 0.85, launch: true },
  axe: { id: 'axe', name: 'Axe Drop', limb: 'rk', aim: 'high', level: 'mid', startup: 20, active: 3, recovery: 22, dmg: 16, block: -5, hit: 0, reach: 0.95, lunge: 0.35, knock: true, wall: true },
  push: { id: 'push', name: 'Push Kick', limb: 'lk', aim: 'mid', level: 'mid', startup: 15, active: 4, recovery: 20, dmg: 9, block: 0, hit: 2, reach: 1.05, wall: true },
  heel: { id: 'heel', name: 'Spinning Heel', limb: 'rk', aim: 'mid', level: 'mid', startup: 19, active: 3, recovery: 26, dmg: 15, block: -10, hit: 0, reach: 1.05, knock: true, wall: true },
  sweep: { id: 'sweep', name: 'Low Sweep', limb: 'lk', aim: 'low', level: 'low', startup: 16, active: 3, recovery: 20, dmg: 7, block: -13, hit: -2, reach: 0.95, crouch: true },
  longsweep: { id: 'longsweep', name: 'Long Sweep', limb: 'rk', aim: 'low', level: 'low', startup: 22, active: 4, recovery: 30, dmg: 13, block: -23, hit: 0, reach: 1.1, crouch: true, knock: true },
  // Jumping
  leap: { id: 'leap', name: 'Leaping Kick', limb: 'rk', aim: 'mid', level: 'mid', startup: 9, active: 8, recovery: 10, dmg: 12, block: -6, hit: 4, reach: 0.85, air: true, knock: true },
  dive: { id: 'dive', name: 'Diving Fist', limb: 'lp', aim: 'mid', level: 'mid', startup: 8, active: 8, recovery: 10, dmg: 9, block: -4, hit: 5, reach: 0.75, air: true },
  // Both hands at once
  throw: { id: 'throw', name: 'Hip Toss', limb: 'throw', aim: 'grab', level: 'throw', startup: 12, active: 3, recovery: 28, dmg: 18, block: 0, hit: 0, reach: 0.8, knock: true },
};
/** Which move a limb starts from a direction: '' neutral, f forward, b back, d down, u up (in the air). */
const COMMANDS: Record<string, string> = {
  lp: 'jab', rp: 'straight', lk: 'shin', rk: 'wheel',
  flp: 'hammer', frp: 'palm', flk: 'snap', frk: 'axe',
  blp: 'jab', brp: 'hook', blk: 'push', brk: 'heel',
  dlp: 'lowpalm', drp: 'uppercut', dlk: 'sweep', drk: 'longsweep',
  ulp: 'dive', urp: 'dive', ulk: 'leap', urk: 'leap',
};
export function command(dir: '' | 'f' | 'b' | 'd' | 'u', limb: Limb): Move { return MOVES[COMMANDS[dir + limb]]; }

export const STAGE = { half: 3.4 };   // the walls stand at -half and +half
const F = 1 / 60;
export const STEP = F;
const GRAVITY = 26, HOP = 7.2, WALK = 2.4, BACK = 1.4, MAX_HP = 100, ROUND_TIME = 60;
export const BODY = 0.28;            // half a body's width (m)
const BUFFER = 8;          // frames a press is remembered for (a string's next button, a move after stun)
const THROW_WINDOW = 3;    // frames between the two hand presses for a throw
const BREAK = 20;          // frames to break a throw by pressing a hand
const THROW_TIME = BREAK + 10;
const DOWN = 48;           // frames lying down after a knockdown or juggle
const SPLAT = 34;          // frames stuck on the wall

export type FState = 'idle' | 'walk' | 'crouch' | 'guard' | 'lowguard' | 'air' | 'move' | 'block' | 'stun' | 'juggle' | 'down' | 'thrown' | 'splat' | 'ko';
export class Fighter {
  x: number; y = 0; vx = 0; vy = 0; facing: 1 | -1;
  hp = MAX_HP;
  state: FState = 'idle';
  move: Move | null = null; t = 0;   // frames into the current move
  stun = 0;                           // frames left in block / hit stun, down, splat or a throw
  juggles = 0;                        // hits taken in the air this juggle
  hitThisMove = false;
  /** Limbs pressed lately and how many frames ago, for strings, throws and a move pressed a moment early. */
  buf: { limb: Limb; age: number }[] = [];
  /** The last hit on this fighter was a counter hit (it was in a move's startup). */
  counter = false;
  /** The last move that hit this fighter can splat it on a wall. */
  wallHit = false;
  /** In a block stun from a low (crouching) block. */
  blockLow = false;
  /** Thrower: the fighter being thrown (the throw lands when `stun` runs out). */
  holding: Fighter | null = null;
  constructor(readonly name: string, x: number, facing: 1 | -1) { this.x = x; this.facing = facing; }
  get grounded() { return this.y <= 0 && this.vy <= 0; }
  /** Which part of the current move: startup, active or recovery (null when not in a move). */
  get phase(): 'startup' | 'active' | 'recovery' | null {
    const m = this.move; if (!m) return null;
    return this.t < m.startup ? 'startup' : this.t < m.startup + m.active ? 'active' : 'recovery';
  }
  /** Low enough that highs and throws pass over: crouching, a low guard, a crouching move, lying down. */
  get low() {
    return this.state === 'crouch' || this.state === 'lowguard' || (this.state === 'block' && this.blockLow)
      || (!!this.move?.crouch && this.phase !== 'recovery') || this.state === 'down';
  }
  reset(x: number, facing: 1 | -1) {
    Object.assign(this, { x, y: 0, vx: 0, vy: 0, facing, hp: MAX_HP, state: 'idle', move: null, t: 0, stun: 0, juggles: 0, hitThisMove: false, buf: [], counter: false, wallHit: false, blockLow: false, holding: null });
  }
}

export type Phase = 'intro' | 'fight' | 'roundEnd' | 'matchEnd';
export type Outcome = 'hit' | 'block' | 'counter' | 'throw' | 'break' | 'splat';
export interface HitEvent { by: Fighter; on: Fighter; move: Move; blocked: boolean; outcome: Outcome }

export class Fight {
  readonly a = new Fighter('player', -1.6, 1);
  readonly b = new Fighter('kavik', 1.6, -1);
  phase: Phase = 'intro';
  phaseT = 0;
  round = 1;
  wins: [number, number] = [0, 0];
  time = ROUND_TIME;
  roundWinner: Fighter | null = null;
  /** Things that happened this step, for sounds, haptics and animation. */
  events: HitEvent[] = [];
  onHit?: (e: HitEvent) => void;

  get winner(): Fighter | null { return this.wins[0] >= 2 ? this.a : this.wins[1] >= 2 ? this.b : null; }
  get banner(): string {
    if (this.phase === 'intro') return this.phaseT < 1.0 ? `Round ${this.round}` : 'Fight!';
    if (this.phase === 'roundEnd') return this.roundWinner ? (this.time <= 0 ? 'Time!' : 'Down!') : 'Draw';
    if (this.phase === 'matchEnd') return this.winner === this.a ? 'You win!' : 'Kavik wins';
    return '';
  }

  step(pa: Pad, pb: Pad) {
    this.events = [];
    this.phaseT += F;
    if (this.phase === 'intro') { if (this.phaseT >= 1.6) this.setPhase('fight'); pa = pb = IDLE_PAD; }
    else if (this.phase !== 'fight') {
      pa = pb = IDLE_PAD;
      if (this.phase === 'roundEnd' && this.phaseT >= 2.2) {
        if (this.winner) this.setPhase('matchEnd');
        else { this.round++; this.startRound(); }
      }
    } else {
      this.time = Math.max(0, this.time - F);
    }
    this.press(this.a, pa); this.press(this.b, pb);
    this.control(this.a, this.b, pa); this.control(this.b, this.a, pb);
    this.physics(this.a); this.physics(this.b);
    this.push();
    this.hits(this.a, this.b); this.hits(this.b, this.a);
    this.throws(this.a); this.throws(this.b);
    if (this.phase === 'fight') {
      const ka = this.a.hp <= 0, kb = this.b.hp <= 0;
      if (ka || kb || this.time <= 0) {
        this.roundWinner = ka && !kb ? this.b : kb && !ka ? this.a : this.a.hp > this.b.hp ? this.a : this.b.hp > this.a.hp ? this.b : null;
        if (this.roundWinner) this.wins[this.roundWinner === this.a ? 0 : 1]++;
        for (const f of [this.a, this.b]) if (f.hp <= 0) { f.state = 'ko'; f.move = null; f.holding = null; }
        this.setPhase('roundEnd');
      }
    }
  }

  startRound() {
    this.a.reset(-1.6, 1); this.b.reset(1.6, -1);
    this.time = ROUND_TIME; this.roundWinner = null;
    this.setPhase('intro');
  }
  private setPhase(p: Phase) { this.phase = p; this.phaseT = 0; }

  /** Age the press buffer and add this step's presses. */
  private press(f: Fighter, p: Pad) {
    for (const b of f.buf) b.age++;
    f.buf = f.buf.filter((b) => b.age <= BUFFER);
    for (const l of LIMBS) if (p[l]) f.buf.push({ limb: l, age: 0 });
  }

  private control(f: Fighter, o: Fighter, p: Pad) {
    if (f.state === 'ko' || f.holding) return;   // a throw plays out in throws()
    if (f.state === 'thrown') {
      // Caught: press a hand in time to break free.
      if (f.buf.some((b) => (b.limb === 'lp' || b.limb === 'rp') && b.age === 0)) this.breakThrow(f);
      return;
    }
    if (f.state === 'block' || f.state === 'stun' || f.state === 'splat' || f.state === 'down') {
      if (--f.stun > 0) return;
      if (f.state === 'down') f.juggles = 0;
      f.state = 'idle';
    }
    if (f.state === 'juggle') return;   // lands in physics()
    const fwd = p.x * f.facing > 0.4, back = p.x * f.facing < -0.4;
    if (f.move) {
      const m = f.move;
      f.t++;
      // The other hand a frame or three after a jab or straight makes it a throw.
      const other = m.limb === 'lp' ? 'rp' : 'lp';
      if ((m.id === 'jab' || m.id === 'straight') && f.t <= THROW_WINDOW && f.buf.some((b) => b.limb === other)) { f.buf = []; return this.start(f, MOVES.throw); }
      if (m.lunge && f.t <= m.startup) f.x += (m.lunge / m.startup) * f.facing;
      // Strings: the next button, pressed any time in the move, goes once this one has had its active frames.
      if (m.next && f.t >= m.startup + m.active && f.t <= m.startup + m.active + 14) {
        const nb = f.buf.find((b) => m.next![b.limb]);
        if (nb) { f.buf = []; return this.start(f, MOVES[m.next[nb.limb]!]); }
      }
      if (f.t < m.startup + m.active + m.recovery) return;
      f.move = null; f.state = f.grounded ? 'idle' : 'air';
    }
    if (!f.grounded) {
      const b = f.buf[0];
      if (b && f.state === 'air') { f.buf = []; this.start(f, command('u', b.limb)); }
      return;
    }
    // Face the other fighter whenever on the ground and free.
    f.facing = o.x >= f.x ? 1 : -1;
    // Both hands together (or nearly) throw.
    const hands = f.buf.filter((b) => b.limb === 'lp' || b.limb === 'rp');
    if (hands.some((b) => b.limb === 'lp') && hands.some((b) => b.limb === 'rp') && hands.every((b) => b.age <= THROW_WINDOW)) { f.buf = []; return this.start(f, MOVES.throw); }
    const b = f.buf[0];
    if (b) {
      const dir = p.down ? 'd' : p.up ? 'u' : fwd ? 'f' : back ? 'b' : '';
      if (dir === 'u') return this.hop(f, p);   // the press stays buffered: a jumping attack once in the air
      f.buf = f.buf.filter((x) => x !== b);
      return this.start(f, command(dir, b.limb));
    }
    if (p.up) return this.hop(f, p);
    if (p.down) { f.state = back ? 'lowguard' : 'crouch'; f.vx = 0; return; }
    if (back) { f.vx = -f.facing * BACK; f.state = 'guard'; return; }
    f.vx = fwd ? f.facing * WALK : 0;
    f.state = fwd ? 'walk' : 'idle';
  }
  private hop(f: Fighter, p: Pad) { f.vy = HOP; f.y = 0.01; f.vx = Math.abs(p.x) > 0.4 ? Math.sign(p.x) * 2.2 : 0; f.state = 'air'; }
  private start(f: Fighter, m: Move) { f.move = m; f.t = 0; f.state = 'move'; f.hitThisMove = false; if (f.grounded) f.vx = 0; }

  private physics(f: Fighter) {
    if (f.holding || f.state === 'thrown') return;
    if (f.y > 0 || f.vy > 0) {
      f.vy -= GRAVITY * (f.state === 'juggle' ? 0.85 : 1) * F; f.y += f.vy * F;   // a juggle floats a little
      if (f.y <= 0) {
        f.y = 0; f.vy = 0;
        if (f.state === 'juggle') { f.state = 'down'; f.stun = DOWN; f.vx = 0; }
        else if (f.state === 'air') f.state = 'idle';
        else if (f.move?.air) { f.move = null; f.state = 'idle'; }
      }
    }
    f.x += f.vx * F;
    if (f.grounded && f.state !== 'walk' && f.state !== 'guard') f.vx *= Math.max(0, 1 - F * 10);   // friction
    // The walls. A fighter knocked hard into one sticks to it for a moment, open to a follow-up.
    if (Math.abs(f.x) > STAGE.half) {
      const hard = Math.abs(f.vx) > 1.5 && (f.state === 'stun' || f.state === 'juggle') && f.wallHit;
      f.x = Math.sign(f.x) * STAGE.half; f.vx = 0;
      if (hard) {
        f.state = 'splat'; f.stun = SPLAT; f.vy = 0; f.y = 0; f.wallHit = false; f.juggles = 0;
        const o = f === this.a ? this.b : this.a;
        this.events.push({ by: o, on: f, move: o.move ?? MOVES.push, blocked: false, outcome: 'splat' });
      }
    }
  }
  /** Bodies don't pass through each other. */
  private push() {
    const a = this.a, b = this.b, gap = BODY * 2, d = b.x - a.x;
    if (a.holding || b.holding) return;
    if (Math.abs(d) < gap && Math.abs(a.y - b.y) < 1.2) {
      const s = (gap - Math.abs(d)) / 2 * (d >= 0 ? 1 : -1);
      a.x -= s; b.x += s;
      for (const [f, o] of [[a, b], [b, a]] as const) if (Math.abs(f.x) > STAGE.half) { const over = f.x - Math.sign(f.x) * STAGE.half; f.x -= over; o.x -= over; }
    }
  }

  private hits(f: Fighter, o: Fighter) {
    const m = f.move;
    if (!m || f.phase !== 'active' || f.hitThisMove || o.state === 'ko' || o.state === 'down' || o.state === 'thrown' || o.holding) return;
    const gap = (o.x - f.x) * f.facing - BODY * 2;   // the space between the two bodies, in front
    if (gap > m.reach || gap < -BODY * 2) return;
    if (Math.abs(o.y - f.y) > 1.4) return;
    if (m.level === 'throw') {
      if (o.low || !o.grounded || o.state === 'juggle' || o.state === 'stun' || o.state === 'block' || o.state === 'splat') return;   // whiffs on a crouch
      f.hitThisMove = true;
      f.holding = o; f.stun = THROW_TIME; o.state = 'thrown'; o.move = null; o.buf = [];
      o.x = f.x + f.facing * BODY * 2.2;
      return;
    }
    if (m.level === 'high' && o.low && o.grounded) return;                     // highs whiff over a crouch
    if (m.level === 'low' && !o.grounded && o.state !== 'juggle') return;      // lows go under a hop
    f.hitThisMove = true;
    const standing = o.state === 'guard' || (o.state === 'block' && !o.blockLow);
    const crouching = o.state === 'lowguard' || (o.state === 'block' && o.blockLow);
    const blocked = o.grounded && (m.level === 'low' ? crouching : standing);
    this.land(f, o, m, blocked);
  }
  /** A hit or a block. Stun comes from the move's frame advantage: at -10 on block the blocker can punish. */
  private land(f: Fighter, o: Fighter, m: Move, blocked: boolean): void {
    const left = m.startup + m.active + m.recovery - f.t;   // the attacker's frames still to go
    const away = o.x >= f.x ? 1 : -1;
    let outcome: Outcome = 'block';
    if (blocked) {
      o.blockLow = o.state === 'lowguard' || (o.state === 'block' && o.blockLow);
      o.state = 'block'; o.stun = Math.max(1, left + m.block); o.vx = away * 1.6;
    } else {
      const counter = !!o.move && o.phase === 'startup';
      const air = o.state === 'juggle' || !o.grounded;
      const scale = air ? Math.max(0.35, 0.8 ** o.juggles) : 1;
      o.hp = Math.max(0, o.hp - Math.round(m.dmg * scale * (counter ? 1.2 : 1)));
      o.move = null; o.counter = counter; o.blockLow = false; o.wallHit = !!m.wall;
      if (air || m.launch) {
        // Launched, or hit again in the air: pop up, each hit a little lower.
        o.state = 'juggle'; o.juggles++;
        o.vy = m.launch && !air ? 9 : Math.max(2, 5.2 - o.juggles * 0.6);
        o.y = Math.max(o.y, 0.02); o.vx = away * (m.wall ? 3.6 : m.launch && !air ? 0.4 : 1.2);   // a launch goes straight up, to follow
      } else if (m.knock) {
        o.state = 'juggle'; o.juggles = 5; o.vy = 3.4; o.y = 0.02; o.vx = away * (m.wall ? 4.2 : 2.6);
      } else {
        o.state = 'stun'; o.stun = Math.max(1, left + m.hit + (counter ? 8 : 0)); o.vx = away * (m.wall ? 3.4 : 1.8);
      }
      outcome = counter ? 'counter' : 'hit';
    }
    const ev: HitEvent = { by: f, on: o, move: m, blocked, outcome };
    this.events.push(ev); this.onHit?.(ev);
  }
  /** A throw in progress: the one caught can break it with a hand early on; otherwise it lands. */
  private throws(f: Fighter) {
    const o = f.holding; if (!o) return;
    f.t++;
    if (--f.stun > 0) return;
    f.holding = null; f.move = null; f.state = 'idle';
    o.hp = Math.max(0, o.hp - MOVES.throw.dmg);
    o.state = 'juggle'; o.juggles = 5; o.vy = 3; o.y = 0.02; o.counter = false;
    o.x = f.x - f.facing * 0.6; o.vx = -f.facing * 2.5;   // over the hip, landing behind
    if (Math.abs(o.x) > STAGE.half) { o.x = Math.sign(o.x) * STAGE.half; f.x = o.x + f.facing * 0.6; }
    f.facing = o.x >= f.x ? 1 : -1;
    const ev: HitEvent = { by: f, on: o, move: MOVES.throw, blocked: false, outcome: 'throw' };
    this.events.push(ev); this.onHit?.(ev);
  }
  private breakThrow(o: Fighter) {
    const f = o === this.a ? this.b : this.a;
    if (f.holding !== o || f.stun <= THROW_TIME - BREAK) return;   // too late
    f.holding = null; f.move = null;
    for (const x of [f, o]) { x.state = 'block'; x.stun = 14; x.blockLow = false; }
    const away = o.x >= f.x ? 1 : -1; o.vx = away * 2.5; f.vx = -away * 2.5;
    const ev: HitEvent = { by: f, on: o, move: MOVES.throw, blocked: true, outcome: 'break' };
    this.events.push(ev); this.onHit?.(ev);
  }
}
