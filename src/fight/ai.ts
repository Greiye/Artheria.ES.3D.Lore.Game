import { type Fight, type Fighter, type Limb, type Pad, IDLE_PAD } from './engine';

// B35: Kavik's brain, a small state machine: approach, poke, block, punish, anti-air, back off. Mike 2026-11-03:
// easy until you win your first match, then one fixed "fair" level for good. Reworked 2026-11-04 for the limb
// buttons: he blocks standing or low depending on what he sees coming, punishes moves left unsafe on block, mixes
// highs, mids, lows and throws, and leaves openings after his own attacks. He reacts like a person (a delay
// before he sees things), so a fast mix still gets through. With the 3D mat (PR 2) he sidesteps straight moves
// he sees coming, sidesteps to get round you, and answers your sidesteps with round moves that track.
export type Level = 'easy' | 'fair';
interface Tuning { react: number; block: number; lowRead: number; antiAir: number; punish: number; aggro: number; rest: [number, number]; read: number; breakThrow: number; step: number; track: number; circle: number }
const TUNING: Record<Level, Tuning> = {
  easy: { react: 0.5, block: 0.12, lowRead: 0.2, antiAir: 0.1, punish: 0.1, aggro: 0.35, rest: [0.6, 1.2], read: 0, breakThrow: 0.1, step: 0.05, track: 0.1, circle: 0.002 },
  fair: { react: 0.24, block: 0.5, lowRead: 0.55, antiAir: 0.5, punish: 0.6, aggro: 0.6, rest: [0.25, 0.6], read: 0.6, breakThrow: 0.45, step: 0.3, track: 0.55, circle: 0.006 },
};
// `step`: how often he sidesteps a straight move he sees starting; `track`: how often he answers your sidestep with
// a round move; `circle`: a chance each frame, at range, to sidestep to get round you.
// `read`: how often he learns from habit. A jab comes out faster than anyone can react, so a fair Kavik counts
// how often you've attacked lately; against a button-masher he guards first, then punishes the recovery.

/** What Kavik "sees" of you: a snapshot from `react` seconds ago. */
interface Seen { x: number; z: number; air: boolean; low: boolean; startup: boolean; recovering: boolean; lowMove: boolean; linear: boolean; stepping: boolean; guarding: boolean; unsafe: boolean }

type Plan = { dir: '' | 'f' | 'b' | 'd'; limb: Limb } | 'throw';
// What he throws out when he pokes: weighted toward safe moves, with lows and a throw to open a guard.
const POKES: [Plan, number][] = [
  [{ dir: '', limb: 'lp' }, 3], [{ dir: '', limb: 'lk' }, 2], [{ dir: 'f', limb: 'lp' }, 2], [{ dir: 'b', limb: 'lk' }, 1],
  [{ dir: 'd', limb: 'lk' }, 2], [{ dir: 'f', limb: 'lk' }, 1], [{ dir: '', limb: 'rk' }, 1], [{ dir: 'f', limb: 'rk' }, 1], ['throw', 1],
];

export class KavikAI {
  state: 'approach' | 'poke' | 'block' | 'punish' | 'antiair' | 'back' | 'rest' | 'step' | 'track' = 'approach';
  private t = 0;
  private seen: { at: number; s: Seen }[] = [];
  private clock = 0;
  private starts: number[] = [];       // when he saw your attacks begin (for reads)
  private prev: Seen | null = null;
  private lowGuard = false;
  private follow: Limb | null = null;  // the next button of a string he's in
  constructor(public level: Level, private rnd: () => number = Math.random) {}

  /** Kavik's buttons for this step. */
  pad(fight: Fight): Pad {
    const me = fight.b, you = fight.a, T = TUNING[this.level];
    this.clock += 1 / 60;
    this.seen.push({ at: this.clock, s: snap(you) });
    while (this.seen.length > 1 && this.seen[1].at <= this.clock - T.react) this.seen.shift();
    const s = this.seen[0].s;
    const p: Pad = { ...IDLE_PAD };
    if (fight.phase !== 'fight' || me.state === 'ko') return p;
    // Caught in a throw: maybe press a hand in time to break it.
    if (me.state === 'thrown') { if (this.rnd() < T.breakThrow / 10) p.lp = true; return p; }
    if (s.startup && !this.prev?.startup) this.starts.push(this.clock);
    this.starts = this.starts.filter((at) => at > this.clock - 2);
    // Where you are (as he saw you), and which way on the stick is toward you (the stick's x is the screen's right).
    const dx = s.x - me.x, dz = s.z - me.z, dist = Math.hypot(dx, dz);
    const toward = Math.sign(dx * fight.right.x + dz * fight.right.z) || 1;
    this.t -= 1 / 60;
    // Strings: press the next button once the first one is out.
    if (me.move && this.follow) { if (me.phase !== 'startup') { p[this.follow] = true; this.follow = null; } return p; }
    if (me.state === 'stun' || me.state === 'juggle' || me.state === 'down' || me.state === 'splat' || me.move) { this.follow = null; return p; }
    // Blocking: if what he blocked left you open, punish it.
    if (me.state === 'block') {
      if (you.move && s.unsafe && this.rnd() < T.punish * 0.25) this.go('punish', 0.05);
      this.hold(p, toward, this.lowGuard);
      return p;
    }
    // Reactions, rolled once per thing seen (an attack starting, a recovery starting, a hop), not every frame.
    const seenStart = s.startup && !this.prev?.startup, seenRecover = s.recovering && !this.prev?.recovering, seenHop = s.air && !this.prev?.air;
    const seenStep = s.stepping && !this.prev?.stepping;
    this.prev = s;
    if (seenHop && dist < 2.4 && this.rnd() < T.antiAir) this.go('antiair', 0.05);
    if (seenStep && dist < 2 && this.rnd() < T.track) this.go('track', 0.05);
    if (seenStart && dist < 2 && s.linear && this.rnd() < T.step) this.go('step', 0.05);   // step off its line
    else if (seenStart && dist < 2 && this.rnd() < T.block) { this.lowGuard = s.lowMove && this.rnd() < T.lowRead / T.block + 0.2; this.go('block', 0.4); }
    else if (seenRecover && dist < 1.6 && this.rnd() < T.punish) this.go('punish', 0.05);
    if (this.state === 'approach' && dist < 1.4 && this.starts.length >= 3 && this.rnd() < T.read * 0.1) { this.lowGuard = false; this.go('block', 0.5); }
    switch (this.state) {
      case 'approach':
        if (dist > 1.25) { p.x = toward; if (dist < 2.6 && this.rnd() < T.circle) this.go('step', 0.05); }
        else if (this.rnd() < T.aggro * 0.08) this.go('poke', 0);
        else if (this.rnd() < 0.012) this.go('back', 0.35);
        break;
      case 'poke': {
        const plan: Plan = s.guarding && !s.low && this.level === 'fair' && this.rnd() < 0.35 ? 'throw'
          : s.guarding && s.low && this.rnd() < 0.5 ? { dir: 'f', limb: 'lk' }   // a mid opens a low guard
          : pick(POKES, this.rnd);
        this.act(p, plan, toward);
        if (plan !== 'throw' && plan.dir === '' && this.level === 'fair' && this.rnd() < 0.4) this.follow = plan.limb === 'lp' ? 'rp' : plan.limb === 'lk' ? 'rk' : null;
        this.go('rest', T.rest[0] + this.rnd() * (T.rest[1] - T.rest[0]));   // the opening he leaves
        break;
      }
      case 'block':
        this.hold(p, toward, this.lowGuard);
        if (this.t <= 0) this.go('approach', 0);
        break;
      case 'antiair': this.act(p, { dir: 'f', limb: 'rp' }, toward); this.go('rest', T.rest[0]); break;
      case 'punish':
        if (dist > 1.3) p.x = toward;
        else { const close = dist < 0.9; this.act(p, close ? { dir: '', limb: 'lp' } : { dir: 'f', limb: 'rp' }, toward); this.follow = close ? 'rp' : null; this.go('rest', T.rest[0]); }
        break;
      case 'step':   // one tap of up or down: a sidestep
        if (this.rnd() < 0.5) p.up = true; else p.down = true;
        this.go('rest', 0.3);
        break;
      case 'track':   // a round move to catch the sidestep: a high wheel, a spinning heel or a low sweep
        this.act(p, pick<Plan>([[{ dir: '', limb: 'rk' }, 2], [{ dir: 'b', limb: 'rk' }, 1], [{ dir: 'd', limb: 'lk' }, 1]], this.rnd), toward);
        this.go('rest', T.rest[0]);
        break;
      case 'back': p.x = -toward; if (this.t <= 0) this.go('approach', 0); break;
      case 'rest': if (this.t <= 0) this.go('approach', 0); break;
    }
    return p;
  }
  private hold(p: Pad, toward: number, low: boolean) { p.x = -toward; p.down = low; }
  private act(p: Pad, plan: Plan, toward: number) {
    if (plan === 'throw') { p.lp = p.rp = true; return; }
    p[plan.limb] = true;
    if (plan.dir === 'f') p.x = toward; else if (plan.dir === 'b') p.x = -toward; else if (plan.dir === 'd') p.down = true;
  }
  private go(s: KavikAI['state'], t: number) { this.state = s; this.t = t; }
}

function pick<T>(list: [T, number][], rnd: () => number): T {
  let r = rnd() * list.reduce((n, [, w]) => n + w, 0);
  for (const [v, w] of list) if ((r -= w) < 0) return v;
  return list[0][0];
}

function snap(f: Fighter): Seen {
  const ph = f.phase, m = f.move;
  return {
    x: f.x, z: f.z, air: !f.grounded, low: f.low, startup: ph === 'startup', recovering: ph === 'recovery',
    lowMove: m?.level === 'low', linear: !!m && !m.track, stepping: f.state === 'step', guarding: f.state === 'guard' || f.state === 'lowguard' || f.state === 'block',
    unsafe: !!m && m.block <= -10,
  };
}
