import { controls } from '../controls';
import type { GameHooks } from './hooks';
import { haptics } from './haptics';

// Touch controls for phones / tablets (owner promoted B7 touch on 2026-10-16).
// Left side: floating joystick (small push = walk, full push = run).
// Right side: drag to look. Buttons: Jump, Sneak, Sprint (hold), View, camera −/+, Read (when aimed at the
// book), Menu. v0.04: landscape first, face buttons in a controller's diamond, a buzz on each press.
// UX pass (Mike 2026-10-31): thumb zones. One context button beside the face buttons names what it will do
// (Talk / Read / Open ...); Map, Journal, Bag and Menu sit in a row in the top corner, one tap each; a faint
// ring shows where the joystick appears; Left-handed mirrors it all and Button size scales it (Pause > Gameplay).
export class TouchControls {
  readonly root: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private readBtn: HTMLButtonElement;
  private ghost: HTMLDivElement;
  /** Pause > Gameplay > Left-handed: the joystick takes the right side, the buttons the left. */
  lefty = false;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private looks = new Map<number, { x: number; y: number }>();

  constructor(private g: GameHooks) {
    this.root = document.createElement('div');
    this.root.id = 'touch';
    this.root.innerHTML = `
      <div class="t-zone"></div>
      <div class="t-ghost" aria-hidden="true"><span>Move</span></div>
      <div class="t-base hidden"><div class="t-knob"></div></div>
      <div class="t-row">
        <button class="t-btn" data-act="map" aria-label="Map">Map</button>
        <button class="t-btn" data-act="journal" aria-label="Journal">Journal</button>
        <button class="t-btn t-inv" data-act="inventory" aria-label="Inventory">Bag</button>
        <button class="t-btn t-menu" data-act="menu" aria-label="Menu">☰</button>
      </div>
      <button class="t-btn t-read t-use hidden" data-act="read">Use</button>
      <div class="t-bow hidden">
        <button class="t-btn" data-act="bow">Bow</button>
        <button class="t-btn" data-act="reload">Reload</button>
        <button class="t-btn" data-act="aim">Aim</button>
        <button class="t-btn t-fire" data-act="fire">Fire</button>
      </div>
      <div class="t-cam">
        <button class="t-btn" data-act="camin" aria-label="Camera in">−</button>
        <button class="t-btn" data-act="camout" aria-label="Camera out">+</button>
        <button class="t-btn" data-act="torch" aria-label="Torch">🔥</button>
      </div>
      <div class="t-cluster">
        <button class="t-btn" data-act="sprint">Sprint</button>
        <button class="t-btn" data-act="pov">View</button>
        <button class="t-btn" data-act="sneak">Sneak</button>
        <button class="t-btn t-jump" data-act="jump">Jump</button>
      </div>`;
    document.body.appendChild(this.root);
    this.base = this.root.querySelector('.t-base')!;
    this.knob = this.root.querySelector('.t-knob')!;
    this.readBtn = this.root.querySelector('.t-read')!;
    this.ghost = this.root.querySelector('.t-ghost')!;
    const zone = this.root.querySelector('.t-zone') as HTMLDivElement;

    zone.addEventListener('pointerdown', (e) => this.down(e));
    zone.addEventListener('pointermove', (e) => this.move(e));
    zone.addEventListener('pointerup', (e) => this.up(e));
    zone.addEventListener('pointercancel', (e) => this.up(e));

    this.root.querySelectorAll<HTMLButtonElement>('.t-btn').forEach((b) => {
      const act = b.dataset.act!;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.g.setMode('touch');
        b.classList.add('on');
        const p = this.g.player;
        haptics.play(act === 'jump' ? 'jump' : 'tap');
        if (act === 'jump') p.jump();
        else if (act === 'camin') this.g.stepCamera(-1);
        else if (act === 'camout') this.g.stepCamera(1);
        else if (act === 'torch') this.g.toggleTorch();
        else if (act === 'sneak') { p.toggleSneak(); b.classList.toggle('latched', p.sneaking); }
        else if (act === 'sprint') p.held.add('sprint');
        else if (act === 'pov') this.g.toggleView();   // F2.4
        else if (act === 'read') this.g.activate();
        else if (act === 'menu') this.g.pause();
        else if (act === 'inventory') this.g.openInventory();
        else if (act === 'map') this.g.openMap();
        else if (act === 'journal') this.g.openJournal();
        else if (act === 'bow') { if (this.g.crossbow.equipped) this.g.crossbow.unequip(); else this.g.crossbow.equip(); }
        else if (act === 'reload') this.g.crossbow.pressReload();
        else if (act === 'fire') this.g.fire();
        else if (act === 'aim') this.g.crossbow.setADS(!this.g.crossbow.ads);
      });
      const release = () => { b.classList.remove('on'); if (act === 'sprint') this.g.player.held.delete('sprint'); };
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('pointerleave', release);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  private down(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;           // desktop mouse keeps the normal controls
    e.preventDefault();
    this.g.setMode('touch');
    (e.target as Element).setPointerCapture(e.pointerId);
    const stickSide = this.lefty ? e.clientX > window.innerWidth * 0.55 : e.clientX < window.innerWidth * 0.45;
    if (stickSide && this.stickId === null) {
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.base.style.left = e.clientX + 'px';
      this.base.style.top = e.clientY + 'px';
      this.base.classList.remove('hidden');
      this.ghost.classList.add('hidden');
      this.setKnob(0, 0);
    } else {
      this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }

  private move(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      const R = controls.touch.joystickRadius;
      let dx = e.clientX - this.stickOrigin.x, dy = e.clientY - this.stickOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.setKnob(dx, dy);
      const dz = 0.12;
      const m = Math.min(1, d / R);
      const k = m < dz ? 0 : (m - dz) / (1 - dz) / (m || 1);
      this.g.player.analog.x = (dx / R) * k;
      this.g.player.analog.y = (-dy / R) * k;
      return;
    }
    const last = this.looks.get(e.pointerId);
    if (last) {
      if (this.g.state() === 'play') this.g.player.look((e.clientX - last.x) * controls.touch.lookScale, (e.clientY - last.y) * controls.touch.lookScale);
      this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }

  private up(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.base.classList.add('hidden');
      this.ghost.classList.remove('hidden');
      this.g.player.analog.x = this.g.player.analog.y = 0;
    }
    this.looks.delete(e.pointerId);
  }

  private setKnob(dx: number, dy: number) { this.knob.style.transform = `translate(${dx}px, ${dy}px)`; }

  // Called every frame by main.
  update() {
    const verb = this.g.state() === 'play' ? this.g.useVerb() : null;
    this.readBtn.classList.toggle('hidden', !verb);
    if (verb && this.readBtn.textContent !== verb) this.readBtn.textContent = verb;
    const sneak = this.root.querySelector('[data-act="sneak"]')!;
    sneak.classList.toggle('latched', this.g.player.sneaking);
    const cb = this.g.crossbow;   // F4: crossbow buttons once Natalie has handed it over
    const bow = this.root.querySelector('.t-bow')!;
    bow.classList.toggle('hidden', !(this.g.state() === 'play' && (cb.equipped || this.hasBow())));
    bow.querySelectorAll('[data-act="fire"], [data-act="reload"], [data-act="aim"]').forEach((b) => b.classList.toggle('hidden', !cb.equipped));
    this.root.querySelector('[data-act="aim"]')!.classList.toggle('latched', cb.ads);
    const ads = cb.ads ? '1' : '0';
    if (document.body.dataset.ads !== ads) document.body.dataset.ads = ads;   // v0.06 U2: fewer buttons while aiming
  }

  private hasBow() { return this.g.hasCrossbow(); }

  reset() {
    this.stickId = null; this.looks.clear();
    this.base.classList.add('hidden');
    this.root.querySelectorAll('.t-btn.on').forEach((b) => b.classList.remove('on'));
  }
}
