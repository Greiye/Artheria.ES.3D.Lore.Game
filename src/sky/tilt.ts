// Skyrunner tilt steering (Mike 2026-11-05: "controllable with a mobile ... motion control"). The phone's gyro
// (DeviceOrientation) flies the glider: tip the phone left / right to bank, forward / back to dive / climb, measured
// from where you held it when the run started (or when you tapped Recenter). Works held upright or sideways: the
// screen's turn (screen.orientation.angle) picks which sensor axis is which. iPhone asks permission on the first tap.
const RANGE = 25, DEAD = 3;   // degrees of tilt for full stick; degrees ignored round the centre

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

export class Tilt {
  on = false;
  /** -1..1, like a stick: x = bank right, y = up the screen (nose down, as the stick does). */
  x = 0;
  y = 0;
  /** Readings seen since enabled (a device with no gyro never sends one). */
  readings = 0;
  private zero: { sx: number; sy: number } | null = null;
  private onEvent = (e: DeviceOrientationEvent) => this.read(e.beta ?? 0, e.gamma ?? 0);

  static supported() { return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window; }

  /** Turn tilt on. Must run inside a tap on iPhone (the permission prompt). Resolves false if refused or absent. */
  async enable(): Promise<boolean> {
    if (!Tilt.supported()) return false;
    const C = DeviceOrientationEvent as OrientationCtor;
    if (typeof C.requestPermission === 'function') {
      try { if ((await C.requestPermission()) !== 'granted') return false; } catch { return false; }
    }
    if (!this.on) window.addEventListener('deviceorientation', this.onEvent);
    this.on = true; this.recenter();
    return true;
  }
  disable() {
    window.removeEventListener('deviceorientation', this.onEvent);
    this.on = false; this.x = this.y = 0;
  }
  /** The next reading becomes level. */
  recenter() { this.zero = null; this.x = this.y = 0; }

  /** One sensor reading (degrees): beta = front-back, gamma = left-right, in the phone's own frame. */
  read(beta: number, gamma: number) {
    this.readings++;
    const angle = ((screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0) + 360) % 360;
    // Screen-relative tilt: sx = the screen's right edge going down, sy = the screen's top edge tipping away.
    const sx = angle === 90 ? beta : angle === 270 ? -beta : angle === 180 ? -gamma : gamma;
    const sy = angle === 90 ? gamma : angle === 270 ? -gamma : angle === 180 ? beta : -beta;
    if (!this.zero) this.zero = { sx, sy };
    const f = (d: number) => { const a = Math.abs(d) < DEAD ? 0 : d - Math.sign(d) * DEAD; return Math.max(-1, Math.min(1, a / RANGE)); };
    this.x = f(sx - this.zero.sx);
    this.y = -f(sy - this.zero.sy);   // top tipped away = stick pushed up the screen = negative y
  }
}
