import type { InputMode } from './input/hooks';

// UX pass (Mike 2026-10-31): teach the controls by doing, in the first minute. One short line at a time, in the
// words of whatever you're holding (keys, thumbs or a pad); each goes away as soon as you've done it, and the
// next waits until it's useful (the "use" line only once something is in reach). Done once per device.
type Step = 'move' | 'look' | 'use';
const LINES: Record<Step, Record<InputMode, string>> = {
  move: { mouse: 'W A S D to walk', touch: 'Drag anywhere on the left to walk', pad: 'Left stick to walk' },
  look: { mouse: 'Move the mouse to look around', touch: 'Drag on the right to look around', pad: 'Right stick to look around' },
  use: { mouse: 'E to talk, read or open', touch: 'Tap the gold button to talk, read or open', pad: 'A to talk, read or open' },
};
const ORDER: Step[] = ['move', 'look', 'use'];
const KEY = 'gametool.coached';

export class Coach {
  done = new Set<Step>();
  private from: { x: number; z: number } | null = null;
  private turned = 0;
  private lastYaw: number | null = null;
  enabled = true;

  constructor(private el: HTMLElement) {
    try { for (const s of JSON.parse(localStorage.getItem(KEY) ?? '[]') as Step[]) this.done.add(s); } catch { /* fresh */ }
  }
  get current(): Step | null { return ORDER.find((s) => !this.done.has(s)) ?? null; }

  private finish(s: Step) {
    this.done.add(s);
    try { localStorage.setItem(KEY, JSON.stringify([...this.done])); } catch { /* blocked */ }
  }
  /** Called when E / the context button / A does something. */
  used() { if (!this.done.has('use')) this.finish('use'); }

  /** Each frame in play: what the player did, and whether something is in reach for E. */
  update(mode: InputMode, pos: { x: number; z: number }, yaw: number, canUse: boolean, playing: boolean) {
    const step = this.enabled && playing ? this.current : null;
    if (step === 'move') {
      this.from ??= { x: pos.x, z: pos.z };
      if (Math.hypot(pos.x - this.from.x, pos.z - this.from.z) > 3) this.finish('move');
    }
    if (step === 'look') {
      if (this.lastYaw !== null) this.turned += Math.abs(yaw - this.lastYaw);
      if (this.turned > 1.0) this.finish('look');
    }
    this.lastYaw = yaw;
    const show = step && (step !== 'use' || canUse) ? LINES[step][mode] : '';
    if (this.el.textContent !== show) this.el.textContent = show;
    this.el.classList.toggle('hidden', !show);
  }
}
