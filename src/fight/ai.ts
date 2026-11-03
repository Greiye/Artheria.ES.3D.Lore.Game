import { type Fight, type Fighter, type Pad, IDLE_PAD, MOVES } from './engine';

// B35: Kavik's brain, a small state machine: approach, poke, block, punish, anti-air, back off. Mike 2026-11-03:
// easy until you win your first match, then one fixed "fair" level for good. Fair blocks, anti-airs and punishes
// some whiffs, but it reacts like a person (a delay before it sees things) and leaves openings after its attacks.
export type Level = 'easy' | 'fair';
interface Tuning { react: number; block: number; antiAir: number; punish: number; aggro: number; rest: [number, number]; read: number }
const TUNING: Record<Level, Tuning> = {
  easy: { react: 0.55, block: 0.08, antiAir: 0.1, punish: 0.1, aggro: 0.35, rest: [0.6, 1.2], read: 0 },
  fair: { react: 0.24, block: 0.5, antiAir: 0.55, punish: 0.5, aggro: 0.6, rest: [0.25, 0.6], read: 0.6 },
};
// `read`: how often it learns from habit. Jabs come out faster than anyone can react, so a fair Kavik counts how
// often you've attacked lately; against a button-masher it shields first, then punishes the recovery.

/** What Kavik "sees" of you: a snapshot from `react` seconds ago. */
interface Seen { x: number; y: number; vy: number; attacking: boolean; startup: boolean; recovering: boolean; air: boolean; shield: boolean }

export class KavikAI {
  state: 'approach' | 'poke' | 'block' | 'punish' | 'antiair' | 'back' | 'rest' = 'approach';
  private t = 0;
  private seen: { at: number; s: Seen }[] = [];
  private clock = 0;
  private wantJump = false;
  private starts: number[] = [];       // when it saw your attacks begin (for reads)
  private lastAttacking = false;
  private wasStunned = false;
  private prev: Seen | null = null;
  private armedAntiAir = false;
  constructor(public level: Level, private rnd: () => number = Math.random) {}

  /** Kavik's buttons for this step. */
  pad(fight: Fight): Pad {
    const me = fight.b, you = fight.a, T = TUNING[this.level];
    this.clock += 1 / 60;
    this.seen.push({ at: this.clock, s: snap(you) });
    while (this.seen.length > 1 && this.seen[1].at <= this.clock - T.react) this.seen.shift();
    const s = this.seen[0].s;
    if (s.attacking && !this.lastAttacking) this.starts.push(this.clock);
    this.lastAttacking = s.attacking;
    this.starts = this.starts.filter((at) => at > this.clock - 2);
    if (me.state === 'stun') this.wasStunned = true;
    if (fight.phase !== 'fight' || me.state === 'stun' || me.state === 'ko' || me.move) return IDLE_PAD;
    const d = s.x - me.x, dist = Math.abs(d), toward = Math.sign(d) || 1;
    const p: Pad = { ...IDLE_PAD };
    this.t -= 1 / 60;
    // Just out of a hit: a fair Kavik covers up or backs off instead of walking straight back in.
    if (this.wasStunned) { this.wasStunned = false; if (this.rnd() < T.read) this.go(this.rnd() < 0.6 ? 'block' : 'back', 0.3 + this.rnd() * 0.3); }
    // A read: you've been attacking a lot up close, so shield before the next one and punish after it.
    if (this.state === 'approach' && dist < 1.5 && this.starts.length >= 3 && this.rnd() < T.read * 0.12) this.go('block', 0.4);
    // Reactions, rolled once per thing seen (an attack starting, a recovery starting, a jump), not every frame.
    const seenStart = s.startup && !this.prev?.startup, seenRecover = s.recovering && !this.prev?.recovering, seenJump = s.air && !this.prev?.air;
    this.prev = s;
    if (seenJump && dist < 2.6 && this.rnd() < T.antiAir) this.armedAntiAir = true;
    if (this.armedAntiAir && s.air && s.vy < 2 && dist < 1.6) { this.armedAntiAir = false; this.go('antiair', 0.1); }
    if (!s.air) this.armedAntiAir = false;
    if (seenStart && dist < 1.8 && this.rnd() < T.block) this.go('block', 0.35);
    else if (seenRecover && dist < 2.2 && this.rnd() < T.punish) this.go('punish', 0.1);
    switch (this.state) {
      case 'approach':
        if (dist > 1.1) p.x = toward;
        else if (this.rnd() < T.aggro * 0.08) this.go('poke', 0.05);
        else if (this.rnd() < 0.01) this.go('back', 0.4);
        if (dist > 3.2 && this.rnd() < 0.004 * (this.level === 'fair' ? 2 : 1)) p.special = true;   // an ember bolt from range
        if (this.rnd() < 0.002) this.wantJump = true;
        break;
      case 'poke': {
        const r = this.rnd();
        if (s.shield && this.level === 'fair' && r < 0.4) p.grab = true;
        else if (r < 0.55) p.attack = true;
        else if (r < 0.75) { p.attack = true; p.x = toward; }
        else if (r < 0.9) { p.attack = true; p.down = true; }
        else { p.special = true; p.x = toward; }
        this.go('rest', T.rest[0] + this.rnd() * (T.rest[1] - T.rest[0]));   // the opening it leaves
        break;
      }
      case 'block':
        p.shield = true;
        if (s.recovering && dist < 1.3 && this.rnd() < T.punish) this.go('punish', 0.1);   // blocked it: now punish
        else if (this.t <= 0) this.go('approach', 0);
        break;
      case 'antiair': p.attack = true; p.up = true; this.go('rest', T.rest[0]); break;
      case 'punish':
        if (dist > 1.3) { p.special = true; p.x = toward; } else if (s.shield) p.grab = true; else { p.attack = true; p.x = toward; }
        this.go('rest', T.rest[0]);
        break;
      case 'back': p.x = -toward; if (this.t <= 0) this.go('approach', 0); break;
      case 'rest': if (this.t <= 0) this.go('approach', 0); break;
    }
    if (this.wantJump && me.grounded) { p.jump = true; this.wantJump = false; }
    return p;
  }
  private go(s: KavikAI['state'], t: number) { this.state = s; this.t = t; }
}

function snap(f: Fighter): Seen {
  const ph = f.phase;
  return { x: f.x, y: f.y, vy: f.vy, attacking: !!f.move, startup: ph === 'startup' && !MOVES.grab.id.includes(f.move?.id ?? '-'), recovering: ph === 'recovery', air: !f.grounded, shield: f.state === 'shield' };
}
