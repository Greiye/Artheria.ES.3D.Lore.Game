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
    pov: ['KeyF'],                          // v0.05: cycle first person / over the shoulder / overhead
    shoulder: ['KeyQ'],                     // v0.05: swap shoulder (shoulder view) or weapon (other views)
    inventory: ['KeyI'],                    // F3.4
    journal: ['KeyJ'],                      // Phase D (B2): the casebook
    map: ['KeyM'],                          // Phase F (B7): the living map
    equipCrossbow: ['Digit1'],              // F4.1 (§5: 1/2 crossbow/hands)
    equipHands: ['Digit2'],
    equipSword: ['Digit3'],                 // v0.08 the practice sword
    reload: ['KeyR'],                       // F4.3 active reload
    torch: ['KeyT'],                        // v0.04 torch
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
      view: 11,      // R3: cycle first person / shoulder / overhead
      equip: 12,     // D-pad up: swap shoulder (shoulder view) or crossbow / hands
      dpadUp: 12,    // (menus: up)
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

// v0.05: keyboard keys can be rebound from the pause menu (Controls). `binds` is what the game reads; it starts
// from the defaults above and takes this device's saved changes on top.
export const binds = Object.fromEntries(Object.entries(controls.keys).map(([a, k]) => [a, [...k]])) as Record<Action, string[]>;
/** The actions the Controls page lets you rebind, in the order it lists them. */
export const REBINDABLE: [Action, string][] = [
  ['forward', 'Forward'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right'], ['jump', 'Jump'], ['sneak', 'Sneak'],
  ['walk', 'Walk (hold)'], ['sprint', 'Sprint (hold)'], ['activate', 'Use · talk · read'], ['pov', 'Camera view'], ['shoulder', 'Swap shoulder / weapon'],
  ['torch', 'Torch'], ['inventory', 'Bag'], ['journal', 'Casebook'], ['map', 'Map'],
  ['equipCrossbow', 'Crossbow'], ['equipHands', 'Hands'], ['equipSword', 'Sword'], ['reload', 'Reload'],
];
const BINDS_KEY = 'gametool.keys';
try {
  const saved = JSON.parse(localStorage.getItem(BINDS_KEY) ?? '{}') as Partial<Record<Action, string>>;
  for (const [a, code] of Object.entries(saved)) if (a in binds && typeof code === 'string') binds[a as Action][0] = code;
} catch { /* storage blocked: defaults */ }
const saveBinds = () => {
  const out: Partial<Record<Action, string>> = {};
  for (const [a] of REBINDABLE) if (binds[a][0] !== controls.keys[a][0]) out[a] = binds[a][0];
  try { localStorage.setItem(BINDS_KEY, JSON.stringify(out)); } catch { /* blocked */ }
};
/** Put `code` on `action` (its main key). A key already on another rebindable action swaps over to it. */
export function bindKey(action: Action, code: string) {
  const old = binds[action][0];
  for (const [a] of REBINDABLE) if (a !== action && binds[a][0] === code) binds[a][0] = old;
  binds[action][0] = code;
  saveBinds();
}
export function resetKeys() {
  for (const a of Object.keys(binds) as Action[]) binds[a] = [...controls.keys[a]];
  saveBinds();
}
/** A key code as a short label: KeyW → W, Digit1 → 1, ShiftLeft → Shift. */
export const keyLabel = (code: string) => code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow(\w+)$/, (_, d: string) => ({ Up: '↑', Down: '↓', Left: '←', Right: '→' }[d] ?? d)).replace(/(Left|Right)$/, '').replace('Escape', 'Esc');

export function actionFor(code: string, actions: Action[]): Action | null {
  for (const a of actions) if (binds[a].includes(code)) return a;
  return null;
}
