import { controls } from '../controls';
import type { GameHooks } from './hooks';
import { haptics } from './haptics';
import { padFamily, type PadFamily } from './glyphs';
import type { PadDir } from './padnav';

// Gamepad support via the standard Gamepad API mapping (Xbox / PlayStation / Switch Pro on
// Chrome, Edge, Firefox, Safari incl. iOS). Owner promoted B7 gamepad on 2026-10-16.
// Bindings live in controls.gamepad (F2.2). Browsers only expose a pad after a button press.
export class GamepadControls {
  private prev: boolean[] = [];
  private bookStickArmed = true;
  private torchHold = 0;   // when D-pad down went down (ms)
  private torchDone = false;
  private rt = false;   // the triggers' last state (each hand's button acts on a change)
  private lt = false;
  private viewHold = 0;    // B40: when View went down (ms); a hold opens the map, a tap the bag
  private viewDone = false;
  private navDir: PadDir | null = null;   // B40: the direction held on the D-pad / left stick in a panel, for repeats
  private navNext = 0;
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
      // v0.06 C3: at the campfire, X / Y / LB / RB / LT / RT play the note pads (A and B stay on the menu).
      [B.reload, B.jump, B.zoomIn, B.zoomOut, B.aim, B.fire].forEach((b, i) => { if (pressed(b)) this.g.bandPad?.(i); });
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
      // B40: View: a tap opens the bag, a 0.4 s hold opens the map.
      if (pressed(B.inventory)) { this.viewHold = performance.now(); this.viewDone = false; }
      if (now[B.inventory] && !this.viewDone && performance.now() - this.viewHold >= 400) { this.viewDone = true; this.g.openMap(); }
      if (!now[B.inventory] && this.prev[B.inventory] && !this.viewDone) this.g.openInventory();
      if (pressed(B.pause)) this.g.pause();
      const cb = this.g.crossbow;   // F4
      if (pressed(B.equip)) this.g.shoulderSwap();
      if (pressed(B.dpadLeft)) this.g.quickSwap('left');
      if (pressed(B.dpadRight)) this.g.quickSwap('right');
      // Torch: hold D-pad down for 0.4 s to light it or put it out.
      if (pressed(B.dpadDown)) { this.torchHold = performance.now(); this.torchDone = false; }
      if (now[B.dpadDown] && !this.torchDone && performance.now() - this.torchHold >= 400) { this.torchDone = true; this.g.toggleTorch(); }
      // Mike 2026-11-05: RT is the right hand, LT the left (fire, swing, or aim when that hand holds nothing).
      if (!!now[B.fire] !== this.rt) { this.rt = !!now[B.fire]; this.g.hand('right', this.rt); }
      if (!!now[B.aim] !== this.lt) { this.lt = !!now[B.aim]; this.g.hand('left', this.lt); }
      if (pressed(B.reload)) cb.pressReload();
    } else {
      this.release();
      if (st === 'forge' && (rx || ry)) this.g.forgeStick?.(rx, ry);
      if ((st === 'forge' || st === 'editor') && this.g.panel) {
        // B40: station panels, the map, the journal, the books and the lore editor. A held job (sharpening) takes A.
        const holding = this.g.panelHold?.(!!now[B.activate]) ?? false;
        const d = this.nav(now, lx, ly);
        if (d) this.g.panel(d);
        if (pressed(B.activate) && !holding) this.g.panel('ok');
        if (pressed(B.back) || pressed(B.pause)) this.g.panel('back');
      } else if (st === 'book' && this.g.deskOpen?.()) {
        // B40: the margin-note desk in an open book: the same panel controls; B puts the pen down.
        const d = this.nav(now, lx, ly);
        if (d) this.g.panel?.(d);
        if (pressed(B.activate)) this.g.panel?.('ok');
        if (pressed(B.back) || pressed(B.pause)) this.g.panel?.('back');
      } else if (st === 'book') {
        if (pressed(B.jump)) this.g.bookPen?.();   // B40: Y picks up the pen (margin notes)
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

  /** B40: the direction to move in a panel this frame: a D-pad press or a left-stick flick, repeating while held. */
  private nav(now: boolean[], lx: number, ly: number): PadDir | null {
    const B = controls.gamepad.buttons;
    const held: PadDir | null = now[B.dpadUp] ? 'up' : now[B.dpadDown] ? 'down' : now[B.dpadLeft] ? 'left' : now[B.dpadRight] ? 'right'
      : Math.hypot(lx, ly) > 0.75 ? (Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? 'right' : 'left') : (ly > 0 ? 'down' : 'up')) : null;
    const t = performance.now();
    if (held !== this.navDir) { this.navDir = held; this.navNext = t + 400; return held; }
    if (held && t >= this.navNext) { this.navNext = t + 120; return held; }
    return null;
  }
}
