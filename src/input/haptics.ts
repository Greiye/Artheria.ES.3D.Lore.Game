// v0.04: haptic feedback. A connected gamepad rumbles (Chrome/Edge/Safari dual-rumble); a phone vibrates
// (Android; iOS Safari has no vibration API). Off with Settings > Vibration.
export type Haptic = 'tap' | 'jump' | 'land' | 'fire' | 'jam' | 'reload' | 'hit' | 'hurt' | 'pickup';

const FX: Record<Haptic, { ms: number; strong: number; weak: number }> = {
  tap: { ms: 25, strong: 0, weak: 0.35 },
  jump: { ms: 40, strong: 0.1, weak: 0.4 },
  land: { ms: 60, strong: 0.45, weak: 0.2 },
  fire: { ms: 110, strong: 0.85, weak: 0.5 },
  reload: { ms: 50, strong: 0.2, weak: 0.5 },
  jam: { ms: 260, strong: 1, weak: 0.7 },
  // UX pass (Mike 2026-10-31): a bolt landing on a foe, a foe landing on you, and anything going into the bag.
  hit: { ms: 70, strong: 0.6, weak: 0.4 },
  hurt: { ms: 160, strong: 0.9, weak: 0.3 },
  pickup: { ms: 30, strong: 0, weak: 0.5 },
};

let enabled = true;
let mode: 'mouse' | 'touch' | 'pad' = 'mouse';
let count = 0;   // effects played (tests)
export const haptics = {
  setEnabled(on: boolean) { enabled = on; },
  setMode(m: 'mouse' | 'touch' | 'pad') { mode = m; },
  get played() { return count; },
  last: '' as Haptic | '',
  play(kind: Haptic) {
    if (!enabled || mode === 'mouse') return;
    const f = FX[kind];
    count++; this.last = kind;
    if (mode === 'pad') {
      for (const p of navigator.getGamepads ? navigator.getGamepads() : []) {
        const act = (p as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null)?.vibrationActuator;
        act?.playEffect?.('dual-rumble', { duration: f.ms, strongMagnitude: f.strong, weakMagnitude: f.weak })?.catch?.(() => undefined);
      }
    } else navigator.vibrate?.(f.ms);
  },
};
