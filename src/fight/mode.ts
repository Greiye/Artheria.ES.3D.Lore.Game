import { Fight, IDLE_PAD, MOVES, STEP, type Fighter, type HitEvent, type Pad } from './engine';
import { KavikAI, type Level } from './ai';
import { storeSet } from '../store';
import './fight.css';

// B35 (Mike 2026-11-03): the fighter mode's screen: health bars, round pips and timer, the round banners, the
// controls (keyboard, and touch: a stick on the left, Attack / Special / Shield / Jump on the right), the result
// with its reward, and the save that remembers whether you've beaten Kavik (easy until then, fair for good after).
const KEY = 'gametool.fight';
export interface FightRecord { beaten: boolean; wins: number; losses: number }
export function loadRecord(): FightRecord {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { beaten: !!v.beaten, wins: +v.wins || 0, losses: +v.losses || 0 }; }
  catch { return { beaten: false, wins: 0, losses: 0 }; }
}

const KEYS: Record<string, keyof Pad | 'left' | 'right'> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  Space: 'jump', KeyJ: 'attack', KeyK: 'special', KeyL: 'shield', ShiftLeft: 'shield', KeyI: 'grab', KeyU: 'grab',
};
const PRESS = new Set(['attack', 'special', 'jump', 'grab']);
// Gamepad (standard mapping; Mike 2026-11-03 "Add that now"): left stick or D-pad moves and aims, A attack,
// B special, Y jump, X grab, any shoulder or trigger holds the shield, Start leaves. On the result: A rematch, B leave.
const PAD_PRESS: [number, string][] = [[0, 'attack'], [1, 'special'], [3, 'jump'], [2, 'grab']];
const PAD_SHIELD = [4, 5, 6, 7], PAD_START = 9, PAD_UP = 12, PAD_DOWN = 13, PAD_LEFT = 14, PAD_RIGHT = 15;
const DEAD = 0.25;

export class FightMode {
  readonly el: HTMLDivElement;
  fight = new Fight();
  ai = new KavikAI('easy');
  record = loadRecord();
  isOpen = false;
  /** Reward and line for the match just finished (null while fighting). */
  result: { won: boolean; crowns: number; first: boolean } | null = null;
  onClose: () => void = () => {};
  onResult: (won: boolean, crowns: number, first: boolean) => void = () => {};
  onHit: (e: HitEvent) => void = () => {};
  private acc = 0;
  private held = new Set<string>();
  private pressed = new Set<string>();
  private stick = { id: -1, x0: 0, y0: 0, x: 0, y: 0 };
  /** The gamepad as last read: stick, held buttons, and the buttons down last poll (for presses). */
  private gp = { x: 0, y: 0, shield: false, up: false, down: false, prev: [] as boolean[] };

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'fight';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="fx-top">
        <div class="fx-side"><span class="fx-name">You</span><div class="fx-bar"><i class="fx-hp" data-who="a"></i></div><span class="fx-pips" data-who="a"></span></div>
        <div class="fx-clock">60</div>
        <div class="fx-side fx-right"><span class="fx-name">Kavik <small class="fx-level"></small></span><div class="fx-bar"><i class="fx-hp" data-who="b"></i></div><span class="fx-pips" data-who="b"></span></div>
      </div>
      <div class="fx-banner" aria-live="polite"></div>
      <div class="fx-result hidden" role="dialog" aria-label="Match result">
        <h3 class="fx-r-title"></h3><p class="fx-r-line"></p>
        <div class="fx-r-row"><button id="fxRematch">Rematch</button><button class="secondary" id="fxLeave">Leave the mat</button></div>
      </div>
      <p class="fx-help fx-help-pad only-pad">Move <b>stick / D-pad</b> · attack <b>A</b> · special <b>B</b> · jump <b>Y</b> · grab <b>X</b> · shield <b>LB RB LT RT</b> · <b>Start</b> leaves</p>
      <p class="fx-help fx-help-keys">Move <b>A D</b> · aim <b>W S</b> · jump <b>Space</b> · attack <b>J</b> · special <b>K</b> · shield <b>L</b> (+ a direction: roll) · grab <b>I</b> · <b>Esc</b> leaves</p>
      <div class="fx-stick" aria-hidden="true"><div class="fx-knob"></div></div>
      <div class="fx-pad">
        <button class="fx-b" data-b="special">Special</button><button class="fx-b fx-big" data-b="attack">Attack</button>
        <button class="fx-b" data-b="shield">Shield</button><button class="fx-b" data-b="jump">Jump</button>
      </div>
      <button class="secondary fx-quit" id="fxQuit">Leave</button>`;
    document.body.appendChild(this.el);
    this.el.querySelector('#fxRematch')!.addEventListener('click', () => this.start());
    this.el.querySelector('#fxLeave')!.addEventListener('click', () => this.close());
    this.el.querySelector('#fxQuit')!.addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => this.key(e, true), true);
    window.addEventListener('keyup', (e) => this.key(e, false), true);
    // Touch: face buttons (shield is held; the rest are presses) and a floating stick on the left half.
    this.el.querySelectorAll<HTMLButtonElement>('.fx-b').forEach((b) => {
      const k = b.dataset.b!;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); this.held.add(k); if (PRESS.has(k)) this.pressed.add(k); });
      const up = () => { b.classList.remove('on'); this.held.delete(k); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    const zone = this.el.querySelector<HTMLDivElement>('.fx-stick')!, knob = zone.querySelector<HTMLDivElement>('.fx-knob')!;
    this.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.stick.id !== -1 || e.clientX > innerWidth * 0.45 || (e.target as Element).closest('button')) return;
      this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
      zone.style.left = e.clientX + 'px'; zone.style.top = e.clientY + 'px'; zone.classList.add('on');
      (e.target as Element).setPointerCapture?.(e.pointerId);
    });
    this.el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      const R = 50, dx = e.clientX - this.stick.x0, dy = e.clientY - this.stick.y0, d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
      this.stick.x = (dx * k) / R; this.stick.y = (dy * k) / R;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    });
    const end = (e: PointerEvent) => { if (e.pointerId !== this.stick.id) return; this.stick = { id: -1, x0: 0, y0: 0, x: 0, y: 0 }; zone.classList.remove('on'); knob.style.transform = ''; };
    this.el.addEventListener('pointerup', end); this.el.addEventListener('pointercancel', end);
  }

  get level(): Level { return this.record.beaten ? 'fair' : 'easy'; }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.el.classList.remove('hidden');
    document.body.classList.add('fighting');
    this.start();
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('fighting');
    this.held.clear(); this.pressed.clear(); this.gp.x = this.gp.y = 0; this.gp.shield = this.gp.up = this.gp.down = false;
    this.onClose();
  }
  /** A new best-of-3 against Kavik at the level the save says. */
  start() {
    this.fight = new Fight();
    this.fight.onHit = (e) => this.onHit(e);
    this.fight.startRound();
    this.ai = new KavikAI(this.level);
    this.result = null;
    this.el.querySelector('.fx-result')!.classList.add('hidden');
    this.el.querySelector('.fx-level')!.textContent = this.level === 'fair' ? '(for real now)' : '(going easy)';
    this.acc = 0;
    this.gp.prev = this.padButtons();   // the A press that opened the fight isn't an attack
  }

  private padButtons(): boolean[] {
    const p = [...(navigator.getGamepads?.() ?? [])].find((g) => !!g && g.connected);
    return p ? p.buttons.map((b) => b.pressed || b.value > 0.5) : [];
  }
  /** Read the gamepad: presses go to the same queue as keys and touch; the stick and shield are held. */
  private pollPad() {
    const now = this.padButtons(), prev = this.gp.prev, hit = (i: number) => !!now[i] && !prev[i];
    this.gp.prev = now;
    const p = [...(navigator.getGamepads?.() ?? [])].find((g) => !!g && g.connected);
    if (!p) { this.gp.x = this.gp.y = 0; this.gp.shield = false; return; }
    if (this.result) {
      if (hit(0)) this.start(); else if (hit(1) || hit(PAD_START)) this.close();
      return;
    }
    if (hit(PAD_START)) { this.close(); return; }
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    this.gp.x = (Math.abs(ax) > DEAD ? ax : 0) + (now[PAD_RIGHT] ? 1 : 0) - (now[PAD_LEFT] ? 1 : 0);
    this.gp.y = ay;
    this.gp.up = !!now[PAD_UP] || ay < -0.55; this.gp.down = !!now[PAD_DOWN] || ay > 0.55;
    this.gp.shield = PAD_SHIELD.some((i) => now[i]);
    for (const [i, k] of PAD_PRESS) if (hit(i)) this.pressed.add(k);
  }

  private key(e: KeyboardEvent, down: boolean) {
    if (!this.isOpen) return;
    if (e.target instanceof HTMLInputElement) return;
    if (down && e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); return; }
    const k = KEYS[e.code];
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (down) { if (!this.held.has(k) && PRESS.has(k)) this.pressed.add(k); this.held.add(k); } else this.held.delete(k);
  }

  /** The player's pad from the keys and touch held now (presses are used up). */
  private pad(): Pad {
    const h = this.held, sx = this.stick.x, sy = this.stick.y, g = this.gp;
    const p: Pad = {
      x: (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0) + (Math.abs(sx) > 0.3 ? sx : 0) + g.x,
      up: h.has('up') || sy < -0.55 || g.up, down: h.has('down') || sy > 0.55 || g.down,
      attack: this.pressed.has('attack'), special: this.pressed.has('special'), jump: this.pressed.has('jump'), grab: this.pressed.has('grab'),
      shield: h.has('shield') || g.shield,
    };
    p.x = Math.max(-1, Math.min(1, p.x));
    this.pressed.clear();
    return p;
  }

  /** Run the fight for `dt` seconds of real time (fixed 60 Hz steps) and redraw the screen. */
  update(dt: number) {
    if (!this.isOpen) return;
    this.pollPad();
    if (!this.isOpen) return;   // Start left the mat
    this.acc += Math.min(dt, 0.25);
    let p = this.pad();
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.fight.step(p, this.ai.pad(this.fight));
      p = { ...p, attack: false, special: false, jump: false, grab: false };   // a press counts once
      if (this.fight.phase === 'matchEnd' && !this.result) this.finish();
    }
    this.draw();
  }

  private finish() {
    const won = this.fight.winner === this.fight.a, first = won && !this.record.beaten;
    const crowns = won ? (first ? 25 : 5) : 0;
    this.record = { beaten: this.record.beaten || won, wins: this.record.wins + (won ? 1 : 0), losses: this.record.losses + (won ? 0 : 1) };
    storeSet(KEY, JSON.stringify(this.record));
    this.result = { won, crowns, first };
    const box = this.el.querySelector('.fx-result')!;
    box.querySelector('.fx-r-title')!.textContent = won ? 'You win!' : 'Kavik wins';
    box.querySelector('.fx-r-line')!.textContent = first ? `+${crowns} ◎. Kavik: "Good. Now I stop going easy on you. For good."`
      : won ? `+${crowns} ◎. Kavik: "Hm. Again."` : this.level === 'easy' ? 'Kavik: "Keep your guard up. Shield, then hit back while I recover."' : 'Kavik: "Closer. Watch what I do after I swing."';
    box.classList.remove('hidden');
    this.onResult(won, crowns, first);
  }

  private draw() {
    const f = this.fight, q = <T extends Element>(s: string) => this.el.querySelector<T & HTMLElement>(s)!;
    const bar = (who: 'a' | 'b', x: Fighter) => { q<HTMLElement>(`.fx-hp[data-who="${who}"]`).style.width = x.hp + '%'; };
    bar('a', f.a); bar('b', f.b);
    q('.fx-pips[data-who="a"]').textContent = '●'.repeat(f.wins[0]) + '○'.repeat(2 - f.wins[0]);
    q('.fx-pips[data-who="b"]').textContent = '●'.repeat(f.wins[1]) + '○'.repeat(2 - f.wins[1]);
    q('.fx-clock').textContent = String(Math.ceil(f.time));
    const b = q('.fx-banner'); if (b.textContent !== f.banner) b.textContent = f.banner;
  }
}

export { MOVES, IDLE_PAD };
