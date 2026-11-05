// v0.04: haptic feedback. A connected gamepad rumbles (Chrome/Edge/Safari dual-rumble); a phone vibrates
// (Android). iPhone Safari has no vibration API, so on iOS 18+ a tap ticks the Taptic Engine by flipping a hidden
// system switch (<input type="checkbox" switch>), the one web-reachable haptic on iOS. Off with Settings > Vibration.
type Haptic = 'tap' | 'jump' | 'land' | 'fire' | 'jam' | 'reload' | 'hit' | 'hurt' | 'pickup' | 'stomp' | 'slam';

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
  // Mike 2026-11-05: the knight frame's footfalls and its ground-slam.
  stomp: { ms: 70, strong: 0.5, weak: 0 },
  slam: { ms: 300, strong: 1, weak: 0.8 },
};

// Mike 2026-11-04: "No haptic feedback for mobile buttons" (iPhone): the iOS switch tick below.
let iosSwitch: HTMLLabelElement | null = null;
function iosTick() {
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1;
    iosSwitch.appendChild(input);
    // The flip is ours alone: keep its clicks away from the game's own listeners.
    iosSwitch.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(iosSwitch);
  }
  iosSwitch.click();
  iosTicks++;
}
let iosTicks = 0;
let enabled = true;
let mode: 'mouse' | 'touch' | 'pad' = 'mouse';
let count = 0;   // effects played (tests)
export const haptics = {
  setEnabled(on: boolean) { enabled = on; },
  setMode(m: 'mouse' | 'touch' | 'pad') { mode = m; },
  get played() { return count; },
  get iosTicks() { return iosTicks; },
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
    } else if (typeof navigator.vibrate === 'function') navigator.vibrate(f.ms);
    else iosTick();
  },
};
