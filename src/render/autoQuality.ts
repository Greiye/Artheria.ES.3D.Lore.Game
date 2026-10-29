// References review (the idea behind Edelweiss's Optimizer.js, CC0; no code taken): watch the real time between
// drawn frames and step quality down when the game can't hold its target, then back up once it has had headroom
// for a while. Each step only scales what the player picked in Settings; it never rewrites their settings.
export interface QualityStep { scale: number; shadows: boolean; foliage: number; folk: 'low' | 'full' }
export const STEPS: QualityStep[] = [
  { scale: 1, shadows: true, foliage: 1, folk: 'full' },
  { scale: 0.85, shadows: true, foliage: 1, folk: 'full' },
  { scale: 0.85, shadows: false, foliage: 0.6, folk: 'full' },
  { scale: 0.7, shadows: false, foliage: 0.35, folk: 'low' },
  { scale: 0.6, shadows: false, foliage: 0.15, folk: 'low' },
];

export class AutoQuality {
  level = 0;
  enabled = true;
  private sum = 0; private n = 0; private slow = 0; private good = 0;
  private t = 0; private lastUp = -1e9; private noUpUntil = 0;
  constructor(private apply: (step: QualityStep, level: number) => void) {}

  get step(): QualityStep { return STEPS[this.enabled ? this.level : 0]; }

  /** Once per drawn frame: `ms` since the last drawn frame, `fps` the target (the cap, or 60 uncapped). */
  frame(ms: number, fps: number) {
    this.t += ms / 1000;
    if (!this.enabled || ms > 250) return;   // a stall (hidden tab, a load) says nothing about the GPU
    this.sum += ms; this.n++;
    if (this.sum < 1000) return;              // judge once a second
    const avg = this.sum / this.n, budget = 1000 / fps;
    this.sum = this.n = 0;
    if (avg > budget * 1.2) {                 // two slow seconds in a row: one step down
      this.good = 0;
      if (++this.slow >= 2 && this.level < STEPS.length - 1) {
        if (this.t - this.lastUp < 12) this.noUpUntil = this.t + 60;   // it just came up and couldn't hold it
        this.set(this.level + 1);
      }
    } else if (avg < budget * 1.05) {         // eight easy seconds: one step up
      this.slow = 0;
      if (++this.good >= 8 && this.level > 0 && this.t >= this.noUpUntil) { this.lastUp = this.t; this.set(this.level - 1); }
    } else this.slow = this.good = 0;
  }

  set(level: number) {
    this.level = Math.max(0, Math.min(STEPS.length - 1, level));
    this.slow = this.good = 0;
    this.apply(this.step, this.level);
  }

  setEnabled(on: boolean) { this.enabled = on; this.set(on ? this.level : 0); }
}
