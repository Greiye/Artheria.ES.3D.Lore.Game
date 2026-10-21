import { controls } from '../controls';
import type { GameHooks } from './hooks';

// Gamepad support via the standard Gamepad API mapping (Xbox / PlayStation / Switch Pro on
// Chrome, Edge, Firefox, Safari incl. iOS). Owner promoted B7 gamepad on 2026-10-16.
// Bindings live in controls.gamepad (F2.2). Browsers only expose a pad after a button press.
export class GamepadControls {
  private prev: boolean[] = [];
  private bookStickArmed = true;
  connected = false;

  constructor(private g: GameHooks, private sensitivity: () => number) {
    window.addEventListener('gamepadconnected', () => { this.connected = true; });
    window.addEventListener('gamepaddisconnected', () => { this.connected = !!this.pad(); this.release(); });
  }

  private pad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  private release() {
    const pl = this.g.player;
    pl.analog.x = pl.analog.y = 0;
    pl.analogLook.x = pl.analogLook.y = 0;
    pl.held.delete('sprint');
  }

  // Radial deadzone, rescaled so movement starts smoothly at the edge of the deadzone.
  private stick(x: number, y: number): [number, number] {
    const dz = controls.gamepad.deadzone, m = Math.hypot(x, y);
    if (m < dz) return [0, 0];
    const k = Math.min(1, (m - dz) / (1 - dz)) / m;
    return [x * k, y * k];
  }

  update() {
    const p = this.pad();
    if (!p) return;
    this.connected = true;
    const B = controls.gamepad.buttons;
    const now = p.buttons.map((b) => b.pressed);
    const pressed = (i: number) => !!now[i] && !this.prev[i];
    const released = (i: number) => !now[i] && !!this.prev[i];
    const [lx, ly] = this.stick(p.axes[0] ?? 0, p.axes[1] ?? 0);
    const [rx, ry] = this.stick(p.axes[2] ?? 0, p.axes[3] ?? 0);
    if (now.some(Boolean) || lx || ly || rx || ry) this.g.setMode('pad');

    const st = this.g.state(), pl = this.g.player;
    if (st === 'title') {
      if (pressed(B.activate) || pressed(B.pause)) this.g.begin();
    } else if (st === 'play') {
      pl.analog.x = lx; pl.analog.y = -ly;
      const ls = controls.gamepad.lookSpeed * this.sensitivity();
      pl.analogLook.x = rx * Math.abs(rx) * ls;     // squared response: fine aim near centre
      pl.analogLook.y = ry * Math.abs(ry) * ls;
      if (pressed(B.sprint)) pl.held.add('sprint');
      if (released(B.sprint)) pl.held.delete('sprint');
      if (pressed(B.jump)) pl.jump();
      if (pressed(B.sneak)) pl.toggleSneak();
      if (pressed(B.toggleRun)) this.g.toggleRun();
      if (pressed(B.activate)) this.g.activate();
      if (pressed(B.pause)) this.g.pause();
      const cb = this.g.crossbow;   // F4
      if (pressed(B.equip)) { if (cb.equipped) cb.unequip(); else cb.equip(); }
      if (pressed(B.fire)) this.g.fire();
      if (pressed(B.reload)) cb.pressReload();
      cb.setADS(!!now[B.aim]);
    } else {
      this.release();
      if (st === 'book') {
        const bk = this.g.book;
        if (pressed(B.pageNext) || pressed(B.dpadRight)) bk.next();
        if (pressed(B.pagePrev) || pressed(B.dpadLeft)) bk.prev();
        // Left-stick flick turns one page per flick.
        if (Math.abs(lx) < 0.3) this.bookStickArmed = true;
        else if (this.bookStickArmed && Math.abs(lx) > 0.75) { this.bookStickArmed = false; (lx > 0 ? bk.next() : bk.prev()); }
        if (pressed(B.back) || pressed(B.activate) || pressed(B.pause)) bk.close();
      } else if (st === 'dialogue') {
        if (pressed(B.activate)) this.g.advanceDialogue();
      } else if (st === 'inventory') {
        if (pressed(B.back) || pressed(B.activate) || pressed(B.pause)) this.g.closeInventory();
      } else if (st === 'pause' || st === 'resume') {
        if (pressed(B.pause) || pressed(B.back) || pressed(B.activate)) this.g.resume();
      }
    }
    this.prev = now;
  }
}
