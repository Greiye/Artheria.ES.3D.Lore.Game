import { controls } from '../controls';
import type { GameHooks } from './hooks';
import { haptics } from './haptics';
import { padFamily, type PadFamily } from './glyphs';

// Gamepad support via the standard Gamepad API mapping (Xbox / PlayStation / Switch Pro on
// Chrome, Edge, Firefox, Safari incl. iOS). Owner promoted B7 gamepad on 2026-10-16.
// Bindings live in controls.gamepad (F2.2). Browsers only expose a pad after a button press.
export class GamepadControls {
  private prev: boolean[] = [];
  private bookStickArmed = true;
  private torchHold = 0;   // when D-pad down went down (ms)
  private torchDone = false;
  connected = false;
  family: PadFamily = 'xbox';   // whose button names to show
  onFamily: (f: PadFamily) => void = () => {};

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
    const fam = padFamily(p.id);
    if (fam !== this.family) { this.family = fam; this.onFamily(fam); }
    // Triggers count as pressed past the threshold of their analog travel.
    const now = p.buttons.map((b, i) => i === B.aim || i === B.fire ? b.value > controls.gamepad.trigger || (b.pressed && b.value === 0) : b.pressed);
    const pressed = (i: number) => !!now[i] && !this.prev[i];
    const [lx, ly] = this.stick(p.axes[0] ?? 0, p.axes[1] ?? 0);
    const [rx, ry] = this.stick(p.axes[2] ?? 0, p.axes[3] ?? 0);
    if (now.some(Boolean) || lx || ly || rx || ry) this.g.setMode('pad');

    const st = this.g.state(), pl = this.g.player;
    if (st === 'title' || this.g.menuActive()) {
      // v0.05: the intro, main menu, Extras and the gate prompt: D-pad moves, A presses, B goes back.
      if (pressed(B.dpadUp) || pressed(B.dpadDown) || pressed(B.dpadLeft) || pressed(B.dpadRight) || pressed(B.activate) || pressed(B.back) || pressed(B.pause)) {
        const dir = pressed(B.dpadUp) ? 'up' : pressed(B.dpadDown) ? 'down' : pressed(B.dpadLeft) ? 'left' : pressed(B.dpadRight) ? 'right' : pressed(B.back) ? 'back' : 'ok';
        if (!this.g.menu(dir) && dir === 'ok') this.g.begin();
      }
    } else if (st === 'play') {
      pl.analog.x = lx; pl.analog.y = -ly;
      const ls = controls.gamepad.lookSpeed * this.sensitivity();
      pl.analogLook.x = rx * Math.abs(rx) * ls;     // squared response: fine aim near centre
      pl.analogLook.y = ry * Math.abs(ry) * ls;
      // Sprint: click L3, it holds until the stick is let go.
      if (pressed(B.sprint)) pl.held.add('sprint');
      else if (Math.hypot(lx, ly) < 0.2) pl.held.delete('sprint');
      if (pressed(B.jump)) { pl.jump(); haptics.play('jump'); }
      if (pressed(B.sneak)) pl.toggleSneak();
      if (pressed(B.view)) this.g.toggleView();
      if (pressed(B.zoomIn)) this.g.stepCamera(-1);
      if (pressed(B.zoomOut)) this.g.stepCamera(1);
      if (pressed(B.activate)) this.g.activate();
      if (pressed(B.inventory)) this.g.openInventory();
      if (pressed(B.pause)) this.g.pause();
      const cb = this.g.crossbow;   // F4
      if (pressed(B.equip)) this.g.shoulderSwap();
      if (pressed(B.dpadLeft)) this.g.quickSwap('left');
      if (pressed(B.dpadRight)) this.g.quickSwap('right');
      // Torch: hold D-pad down for 0.4 s to light it or put it out.
      if (pressed(B.dpadDown)) { this.torchHold = performance.now(); this.torchDone = false; }
      if (now[B.dpadDown] && !this.torchDone && performance.now() - this.torchHold >= 400) { this.torchDone = true; this.g.toggleTorch(); }
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
        // v0.05: D-pad up / down (or a stick flick) moves between choices; A picks the highlighted one.
        if (pressed(B.dpadUp)) this.g.dialogueMove(-1);
        if (pressed(B.dpadDown)) this.g.dialogueMove(1);
        if (Math.abs(ly) < 0.3) this.bookStickArmed = true;
        else if (this.bookStickArmed && Math.abs(ly) > 0.75) { this.bookStickArmed = false; this.g.dialogueMove(ly > 0 ? 1 : -1); }
        if (pressed(B.activate)) this.g.advanceDialogue();
      } else if (st === 'inventory') {
        if (pressed(B.back) || pressed(B.activate) || pressed(B.pause)) this.g.closeInventory();
      } else if (st === 'pause') {
        // v0.06 P1: Start resumes; the D-pad, A and B work the pause menu's sidebar and groups.
        if (pressed(B.pause)) this.g.resume();
        else if (pressed(B.dpadUp) || pressed(B.dpadDown) || pressed(B.dpadLeft) || pressed(B.dpadRight) || pressed(B.activate) || pressed(B.back)) {
          this.g.menu(pressed(B.dpadUp) ? 'up' : pressed(B.dpadDown) ? 'down' : pressed(B.dpadLeft) ? 'left' : pressed(B.dpadRight) ? 'right' : pressed(B.back) ? 'back' : 'ok');
        }
      } else if (st === 'resume') {
        if (pressed(B.pause) || pressed(B.back) || pressed(B.activate)) this.g.resume();
      }
    }
    this.prev = now;
  }
}
