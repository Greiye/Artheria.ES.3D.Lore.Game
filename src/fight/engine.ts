// B35 (Mike 2026-11-03): fighter mode vs Kavik. The fight itself, with no drawing: two fighters on a flat stage,
// side view, one attack button and one special button, each by direction (neutral / side / up / down), a shield
// that turns into a dodge roll with a direction, and a grab that beats the shield. Health bars, best of 3 rounds.
// The set-up is a classic 1v1; the move list is our own, built the "direction + button" way. Fixed 60 Hz steps.

export type Dir = 'neutral' | 'side' | 'up' | 'down';
/** One fighter's buttons this step. attack / special / jump / grab are presses (true on the step they go down). */
export interface Pad { x: number; up: boolean; down: boolean; attack: boolean; special: boolean; shield: boolean; jump: boolean; grab: boolean }
export const IDLE_PAD: Pad = { x: 0, up: false, down: false, attack: false, special: false, shield: false, jump: false, grab: false };

export interface Move {
  id: string; name: string;
  startup: number; active: number; recovery: number;   // seconds
  dmg: number; kb: [number, number];                   // knockback (m/s) away from the attacker, and up
  box: [number, number, number, number];               // hitbox: forward offset, height, half width, half height (m)
  lunge?: [number, number];                            // velocity at startup (forward, up)
  bolt?: boolean;                                      // throws an ember bolt instead of a hitbox
  counter?: boolean;                                   // a hit landing on it during its active time is turned back
  grab?: boolean;
}
// Our own moves. "Side" means toward where you're pushing the stick.
export const MOVES: Record<string, Move> = {
  'attack-neutral': { id: 'attack-neutral', name: 'Quick Cut', startup: 0.07, active: 0.08, recovery: 0.16, dmg: 5, kb: [2.5, 1], box: [0.75, 1.2, 0.45, 0.3] },
  'attack-side': { id: 'attack-side', name: 'Stepping Slash', startup: 0.14, active: 0.1, recovery: 0.3, dmg: 9, kb: [5, 2.5], box: [0.95, 1.1, 0.55, 0.35], lunge: [3.5, 0] },
  'attack-up': { id: 'attack-up', name: 'Rising Arc', startup: 0.1, active: 0.14, recovery: 0.28, dmg: 8, kb: [1.5, 7], box: [0.35, 2.0, 0.6, 0.55] },
  'attack-down': { id: 'attack-down', name: 'Low Sweep', startup: 0.12, active: 0.1, recovery: 0.3, dmg: 7, kb: [2, 4.5], box: [0.85, 0.25, 0.6, 0.25] },
  'special-neutral': { id: 'special-neutral', name: 'Ember Bolt', startup: 0.22, active: 0.05, recovery: 0.35, dmg: 6, kb: [3, 1.5], box: [0, 1.25, 0.2, 0.2], bolt: true },
  'special-side': { id: 'special-side', name: 'Comet Dash', startup: 0.18, active: 0.22, recovery: 0.4, dmg: 11, kb: [6, 3], box: [0.6, 1.1, 0.5, 0.45], lunge: [8, 0] },
  'special-up': { id: 'special-up', name: 'Updraft', startup: 0.08, active: 0.25, recovery: 0.45, dmg: 7, kb: [1, 8], box: [0.2, 1.6, 0.55, 0.7], lunge: [1.5, 11] },
  'special-down': { id: 'special-down', name: 'Still Water', startup: 0.05, active: 0.4, recovery: 0.35, dmg: 12, kb: [6, 4], box: [0.7, 1.1, 0.7, 0.6], counter: true },
  grab: { id: 'grab', name: 'Shoulder Throw', startup: 0.1, active: 0.08, recovery: 0.35, dmg: 9, kb: [6, 4.5], box: [0.6, 1.1, 0.35, 0.4], grab: true },
};

export const STAGE = { half: 3.4 };   // the mat runs from -half to +half
const GRAVITY = 26, JUMP = 9, WALK = 3.2, AIR = 2.6, ROLL = 6.5, ROLL_TIME = 0.3, MAX_HP = 100, ROUND_TIME = 60;
export const STEP = 1 / 60;

export type FState = 'idle' | 'walk' | 'air' | 'move' | 'shield' | 'roll' | 'stun' | 'ko';
export class Fighter {
  x: number; y = 0; vx = 0; vy = 0; facing: 1 | -1;
  hp = MAX_HP;
  state: FState = 'idle';
  move: Move | null = null; t = 0;    // time in the current move / roll / stun
  stun = 0; jumps = 2; hitThisMove = false; whiffed = false;
  shieldHp = 1;                        // 0..1; drains while held and on blocks, a broken shield stuns
  constructor(readonly name: string, x: number, facing: 1 | -1) { this.x = x; this.facing = facing; }
  get grounded() { return this.y <= 0 && this.vy <= 0; }
  /** Which part of the current move: startup, active or recovery (null when not in a move). */
  get phase(): 'startup' | 'active' | 'recovery' | null {
    const m = this.move; if (!m) return null;
    return this.t < m.startup ? 'startup' : this.t < m.startup + m.active ? 'active' : 'recovery';
  }
  reset(x: number, facing: 1 | -1) { Object.assign(this, { x, y: 0, vx: 0, vy: 0, facing, hp: MAX_HP, state: 'idle', move: null, t: 0, stun: 0, jumps: 2, shieldHp: 1 }); }
}

export interface Bolt { x: number; y: number; vx: number; owner: Fighter; life: number }
export type Phase = 'intro' | 'fight' | 'roundEnd' | 'matchEnd';
export interface HitEvent { by: Fighter; on: Fighter; move: Move; blocked: boolean }

export class Fight {
  readonly a = new Fighter('player', -1.6, 1);
  readonly b = new Fighter('kavik', 1.6, -1);
  bolts: Bolt[] = [];
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
    this.phaseT += STEP;
    if (this.phase === 'intro') { if (this.phaseT >= 1.6) this.setPhase('fight'); pa = pb = IDLE_PAD; }
    else if (this.phase !== 'fight') {
      pa = pb = IDLE_PAD;
      if (this.phase === 'roundEnd' && this.phaseT >= 2.2) {
        if (this.winner) this.setPhase('matchEnd');
        else { this.round++; this.startRound(); }
      }
    } else {
      this.time = Math.max(0, this.time - STEP);
    }
    this.control(this.a, this.b, pa); this.control(this.b, this.a, pb);
    this.physics(this.a); this.physics(this.b);
    this.push();
    this.hits(this.a, this.b); this.hits(this.b, this.a);
    this.stepBolts();
    if (this.phase === 'fight') {
      const ka = this.a.hp <= 0, kb = this.b.hp <= 0;
      if (ka || kb || this.time <= 0) {
        this.roundWinner = ka && !kb ? this.b : kb && !ka ? this.a : this.a.hp > this.b.hp ? this.a : this.b.hp > this.a.hp ? this.b : null;
        if (this.roundWinner) this.wins[this.roundWinner === this.a ? 0 : 1]++;
        for (const f of [this.a, this.b]) if (f.hp <= 0) { f.state = 'ko'; f.move = null; }
        this.setPhase('roundEnd');
      }
    }
  }

  startRound() {
    this.a.reset(-1.6, 1); this.b.reset(1.6, -1);
    this.bolts = []; this.time = ROUND_TIME; this.roundWinner = null;
    this.setPhase('intro');
  }
  private setPhase(p: Phase) { this.phase = p; this.phaseT = 0; }

  private control(f: Fighter, o: Fighter, p: Pad) {
    if (f.state === 'ko') return;
    if (f.state === 'stun') { f.stun -= STEP; if (f.stun <= 0) f.state = f.grounded ? 'idle' : 'air'; return; }
    if (f.state === 'roll') { f.t += STEP; if (f.t >= ROLL_TIME) { f.state = 'idle'; f.vx = 0; } return; }
    if (f.move) {
      const m = f.move, before = f.phase;
      f.t += STEP;
      if (before === 'startup' && f.phase !== 'startup') {
        if (m.lunge) { f.vx = m.lunge[0] * f.facing; if (m.lunge[1]) { f.vy = m.lunge[1]; f.y = Math.max(f.y, 0.01); } }
        if (m.bolt) this.bolts.push({ x: f.x + 0.5 * f.facing, y: 1.25, vx: 7 * f.facing, owner: f, life: 1.4 });
      }
      if (f.t >= m.startup + m.active + m.recovery) { f.move = null; f.state = f.grounded ? 'idle' : 'air'; }
      return;
    }
    // Face the other fighter whenever on the ground and free.
    if (f.grounded) f.facing = o.x >= f.x ? 1 : -1;
    const dir: Dir = p.up ? 'up' : p.down ? 'down' : Math.abs(p.x) > 0.4 ? 'side' : 'neutral';
    if (p.grab || (p.shield && p.attack)) return this.start(f, MOVES.grab);
    if (p.attack) { if (dir === 'side') f.facing = p.x > 0 ? 1 : -1; return this.start(f, MOVES['attack-' + dir]); }
    if (p.special) { if (dir === 'side') f.facing = p.x > 0 ? 1 : -1; return this.start(f, MOVES['special-' + dir]); }
    if (p.shield && f.grounded) {
      if (Math.abs(p.x) > 0.6 && f.state === 'shield') { f.state = 'roll'; f.t = 0; f.vx = Math.sign(p.x) * ROLL; return; }   // shield + a direction: dodge roll
      if (f.shieldHp > 0) { f.state = 'shield'; f.vx = 0; f.shieldHp = Math.max(0, f.shieldHp - STEP * 0.25); return; }
    }
    if (f.state === 'shield') f.state = 'idle';
    f.shieldHp = Math.min(1, f.shieldHp + STEP * 0.2);
    if (p.jump && f.jumps > 0) { f.vy = JUMP * (f.jumps === 2 ? 1 : 0.85); f.y = Math.max(f.y, 0.01); f.jumps--; }
    if (f.grounded) { f.vx = p.x * WALK; f.state = Math.abs(p.x) > 0.1 ? 'walk' : 'idle'; }
    else { f.vx += (p.x * AIR - f.vx) * Math.min(1, STEP * 6); f.state = 'air'; }
  }
  private start(f: Fighter, m: Move) { f.move = m; f.t = 0; f.state = 'move'; f.hitThisMove = false; f.whiffed = false; if (f.grounded) f.vx = 0; }

  private physics(f: Fighter) {
    if (f.y > 0 || f.vy > 0) { f.vy -= GRAVITY * STEP; f.y += f.vy * STEP; if (f.y <= 0) { f.y = 0; f.vy = 0; f.jumps = 2; if (f.state === 'air') f.state = 'idle'; } }
    f.x += f.vx * STEP;
    if (f.grounded && (f.state === 'stun' || f.state === 'move' || f.state === 'ko')) f.vx *= Math.max(0, 1 - STEP * 8);   // friction
    if (Math.abs(f.x) > STAGE.half) { f.x = Math.sign(f.x) * STAGE.half; f.vx = 0; }
  }
  /** Bodies don't pass through each other on the ground. */
  private push() {
    const a = this.a, b = this.b, gap = 0.55, d = b.x - a.x;
    if (Math.abs(d) < gap && Math.abs(a.y - b.y) < 1.2) { const s = (gap - Math.abs(d)) / 2 * (d >= 0 ? 1 : -1); a.x -= s; b.x += s; }
  }

  private hits(f: Fighter, o: Fighter) {
    const m = f.move;
    if (!m || m.bolt || f.phase !== 'active' || f.hitThisMove || o.state === 'ko' || o.state === 'roll') return;
    const cx = f.x + m.box[0] * f.facing, cy = f.y + m.box[1];
    const inX = Math.abs(o.x - cx) < m.box[2] + 0.28, inY = cy + m.box[3] > o.y && cy - m.box[3] < o.y + 1.8;
    if (!inX || !inY) return;
    f.hitThisMove = true;
    if (m.grab) { if (o.state === 'move' && o.phase === 'active') return; this.land(f, o, m, false); return; }   // grabs beat the shield
    this.land(f, o, m, o.state === 'shield');
  }
  private land(f: Fighter, o: Fighter, m: Move, blocked: boolean): void {
    // A counter stance turns a hit that lands in its active time back on the attacker.
    if (!blocked && o.move?.counter && o.phase === 'active' && !m.grab) { o.hitThisMove = true; return this.land(o, f, o.move, false); }
    const ev: HitEvent = { by: f, on: o, move: m, blocked };
    const away = o.x >= f.x ? 1 : -1;
    if (blocked) { o.vx = away * 2; o.shieldHp = Math.max(0, o.shieldHp - m.dmg * 0.03); if (o.shieldHp <= 0) { o.state = 'stun'; o.stun = 1.2; o.move = null; } }
    else {
      o.hp = Math.max(0, o.hp - m.dmg);
      o.move = null; o.state = 'stun'; o.stun = 0.1 + m.dmg * 0.02;   // shorter than a jab's full cycle: no endless jab locks
      o.vx = away * m.kb[0]; if (m.kb[1] > 2) { o.vy = m.kb[1]; o.y = Math.max(o.y, 0.01); }
    }
    this.events.push(ev); this.onHit?.(ev);
  }
  private stepBolts() {
    for (const b of this.bolts) {
      b.x += b.vx * STEP; b.life -= STEP;
      const o = b.owner === this.a ? this.b : this.a;
      if (b.life > 0 && o.state !== 'roll' && o.state !== 'ko' && Math.abs(o.x - b.x) < 0.35 && b.y > o.y && b.y < o.y + 1.8) {
        b.life = 0; this.land(b.owner, o, MOVES['special-neutral'], o.state === 'shield');
      }
      if (Math.abs(b.x) > STAGE.half + 0.5) b.life = 0;
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }
}
