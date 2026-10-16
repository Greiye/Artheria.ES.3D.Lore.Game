// F2.2: every binding and speed lives here. Remapping a key is a one-line change.
// Values are KeyboardEvent.code strings (layout-independent physical keys).
// D3: Skyrim PC defaults; browser-unsafe keys remapped (Ctrl -> C for sneak, see F2 table).
export const controls = {
  keys: {
    forward: ['KeyW'],
    left: ['KeyA'],
    back: ['KeyS'],
    right: ['KeyD'],
    walk: ['ShiftLeft', 'ShiftRight'],      // hold: walk (or run, if always-run is off)
    toggleRun: ['CapsLock'],                // toggle always-run
    sprint: ['AltLeft', 'AltRight'],        // hold: sprint (preventDefault so the browser menu stays shut)
    jump: ['Space'],
    sneak: ['KeyC'],                        // toggle sneak / crouch
    activate: ['KeyE'],
    close: ['Tab'],                         // close book / back
    pause: ['Escape'],
    pagePrev: ['KeyA', 'ArrowLeft'],        // F3.3 (book open only)
    pageNext: ['KeyD', 'ArrowRight'],
  },
  speeds: {
    walk: 2.5,     // m/s
    run: 5,        // m/s, default pace (Skyrim)
    sprint: 8,     // m/s
    sneak: 1.6,    // m/s (assumption, see docs/assumptions.md)
  },
  jumpHeight: 1.0,        // m
  gravity: 9.8,           // m/s^2
  eyeHeight: 1.7,         // m (D2)
  sneakEyeHeight: 1.1,    // m
  playerRadius: 0.35,     // m, collision capsule radius
  mouseBase: 0.0022,      // rad per px at sensitivity 1.0
  pitchLimitDeg: 89,
  activateRange: 2.0,     // m (F3.1)
  analogRunThreshold: 0.7, // stick deflection above this runs, below it walks

  // Gamepad (standard mapping, Xbox names; PlayStation: A=Cross, B=Circle, X=Square, Y=Triangle).
  // Skyrim controller defaults where they exist.
  gamepad: {
    buttons: {
      activate: 0,   // A: read book / begin / confirm
      back: 1,       // B: close book / back out of menus
      jump: 3,       // Y
      sprint: 4,     // LB (hold)
      pageNext: 5,   // RB (book)
      pagePrev: 4,   // LB (book)
      sneak: 10,     // L3 (left stick click), toggle
      toggleRun: 11, // R3 (right stick click), toggle always-run
      pause: 9,      // Start / Options
      dpadLeft: 14,
      dpadRight: 15,
    },
    deadzone: 0.18,
    lookSpeed: 2.6,  // rad/s at full deflection, multiplied by mouse sensitivity setting
  },

  // Touch (phones / tablets)
  touch: {
    joystickRadius: 56,   // px
    lookScale: 1.6,       // touch-drag look is scaled vs. mouse so a thumb swipe turns enough
  },
} as const;

export type Action = keyof typeof controls.keys;

export function actionFor(code: string, actions: Action[]): Action | null {
  for (const a of actions) if ((controls.keys[a] as readonly string[]).includes(code)) return a;
  return null;
}
