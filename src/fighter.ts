// Mike 2026-11-06 ("fighter: bonus attack techniques, maybe assign to LB and RB. Fighters can take a breath and gain
// temp HP"): a Fighter's two techniques and the steadying breath. Main wires the inputs (LB / Z, RB / X, both held /
// V, and three touch buttons), the damage (the sword's own slash path, so goblins, scrolls and imbues all apply)
// and spends the temporary health before real health.
//   Lunge (LB):  a dash 2.6 m forward that ends in a heavy thrust (3 damage, knocks back); 4 s to recover.
//   Sweep (RB):  a full circle at 2.3 m, everything around you (2 damage, knocks back); 6 s.
//   Breath (LB + RB held 0.6 s, or V): 1 s still and quiet, then +4 temporary health for 30 s; 45 s to recover.
// Unarmed, a technique lands one less (at least 1). Cooldowns and the breath only tick in play.
export type Technique = 'lunge' | 'sweep';
export const TECH = {
  lunge: { cd: 4, reach: 2.0, arc: 0.55, damage: 3, dash: 2.6, dashSec: 0.18, name: 'Lunge' },
  sweep: { cd: 6, reach: 2.3, arc: Math.PI, damage: 2, name: 'Sweep' },
} as const;
export const BREATH = { cd: 45, temp: 4, lasts: 30, still: 1.0, hold: 0.6 };

export class FighterKit {
  cd: Record<Technique | 'breath', number> = { lunge: 0, sweep: 0, breath: 0 };
  /** Temporary health from the breath (spent before real health). */
  temp = 0;
  private tempT = 0;
  /** Seconds left of drawing the breath (the hero stands still). */
  breathing = 0;
  uses = { lunge: 0, sweep: 0, breath: 0 };

  ready(t: Technique | 'breath') { return this.cd[t] <= 0 && this.breathing <= 0; }
  /** Start a technique's cooldown; false if it isn't ready. */
  use(t: Technique): boolean {
    if (!this.ready(t)) return false;
    this.cd[t] = TECH[t].cd; this.uses[t]++;
    return true;
  }
  breathe(): boolean {
    if (!this.ready('breath')) return false;
    this.cd.breath = BREATH.cd; this.breathing = BREATH.still; this.uses.breath++;
    return true;
  }
  /** Take a blow: returns what gets through to real health. */
  absorb(dmg: number): number {
    const a = Math.min(this.temp, dmg);
    this.temp -= a;
    return dmg - a;
  }
  /** Ticks cooldowns; returns true on the frame the breath completes (temp health granted). */
  update(dt: number): boolean {
    for (const k of Object.keys(this.cd) as (Technique | 'breath')[]) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.temp > 0 && (this.tempT -= dt) <= 0) this.temp = 0;
    if (this.breathing > 0 && (this.breathing -= dt) <= 0) { this.breathing = 0; this.temp = BREATH.temp; this.tempT = BREATH.lasts; return true; }
    return false;
  }
}
