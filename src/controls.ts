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
    pov: ['KeyF'],                          // D2 / F2.4: toggle 1st / 3rd person
    inventory: ['KeyI'],                    // F3.4
    journal: ['KeyJ'],                      // Phase D (B2): the casebook
    map: ['KeyM'],                          // Phase F (B7): the living map
    equipCrossbow: ['Digit1'],              // F4.1 (§5: 1/2 crossbow/hands)
    equipHands: ['Digit2'],
    reload: ['KeyR'],                       // F4.3 active reload
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
  thirdPerson: { back: 3, right: 0.5, wallPad: 0.2 }, // D2 default 3rd-person camera, m

  // Gamepad (standard mapping, Xbox names; PlayStation: A=Cross, B=Circle, X=Square, Y=Triangle).
  // Skyrim controller defaults where they exist.
  gamepad: {
    // v0.04 layout (controller-first, action-RPG style). Standard Gamepad API indices; the pause menu's
    // Controls page draws this map with the pad's own button names (src/input/glyphs.ts).
    buttons: {
      activate: 0,   // A: use / talk / read / confirm
      back: 1,       // B: back out of menus, close the book
      sneak: 1,      // B (in play): sneak toggle
      reload: 2,     // X (F4.3)
      jump: 3,       // Y
      zoomIn: 4,     // LB: camera one step in (toward first person)
      zoomOut: 5,    // RB: camera one step out (toward overhead)
      pagePrev: 4,   // LB (book)
      pageNext: 5,   // RB (book)
      aim: 6,        // LT (analog, past halfway): aim
      fire: 7,       // RT (analog, past halfway): fire
      inventory: 8,  // View / Create: bag
      pause: 9,      // Menu / Options
      sprint: 10,    // L3: sprint until the stick is let go
      view: 11,      // R3: first person / follow
      equip: 12,     // D-pad up: crossbow / hands
      dpadDown: 13,
      dpadLeft: 14,
      dpadRight: 15,
    },
    trigger: 0.5,    // analog trigger threshold
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
