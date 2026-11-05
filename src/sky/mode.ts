import * as THREE from 'three';
import { generateSky, groundAt, surfaceAt, CRUISE, type SkyMap } from './gen';
import { buildSkyScene, buildGlider, PERCH_H, type SkyScene } from './scene';
import { Plane, FoeAI, fireBolt, BOLT, type Bolt, type Ctl } from './flight';
import { mulberry32 } from '../dungeon/gen';
import { haptics } from '../input/haptics';
import { storeSet } from '../store';
import './sky.css';

// Skyrunner (Mike 2026-11-05): "ride a fixed-wing plane and pilot it on a random gen map ... get from point A to
// point B within 1 minute ... simple dogfighting ... one out of 20" for another magical plane. A run is its own
// scene (like the fight with Kavik is its own mode): a seeded landscape, the launch perch (A), the beacon (B),
// 60 seconds on the clock, wind rings for +2 s, and one run in twenty a hexed skyrunner comes for you.
export const RUN_TIME = 60, RING_BONUS = 2, FOE_CHANCE = 1 / 20, FOE_AFTER = 10;
export const PAY = { win: 20, kill: 30 };
const KEY = 'gametool.sky';
const INVERT_KEY = 'gametool.sky.invert';

export interface SkyRecord { runs: number; wins: number; kills: number; foes: number; best: Record<string, number> }
export function loadSkyRecord(): SkyRecord {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { runs: +v.runs || 0, wins: +v.wins || 0, kills: +v.kills || 0, foes: +v.foes || 0, best: v.best && typeof v.best === 'object' ? v.best : {} }; }
  catch { return { runs: 0, wins: 0, kills: 0, foes: 0, best: {} }; }
}
const VIEW_KEY = 'gametool.sky.view';
const loadFirstPerson = () => { try { return localStorage.getItem(VIEW_KEY) === 'first'; } catch { return false; } };
const loadInvert = () => { try { return localStorage.getItem(INVERT_KEY) === 'on'; } catch { return false; } };

type Phase = 'ready' | 'fly' | 'done';
type End = 'won' | 'late' | 'crashed' | 'downed';
const newSeed = () => 100000 + Math.floor(Math.random() * 900000);

// Gamepad (standard mapping): left stick flies, RT / LT throttle, A or RB fires, Y surges, R3 looks back,
// Back / View swaps the camera, Start leaves. On the result: A again, X a new map, B leave.
const PAD = { a: 0, b: 1, x: 2, y: 3, rb: 5, lt: 6, rt: 7, back: 8, start: 9, r3: 11 };
const DEAD = 0.15;
/** The pilot's eye in the glider's own frame (the head sits at 0, 0.75, -1.4). */
const EYE = new THREE.Vector3(0, 1.05, -1.4);

export class SkyRun {
  readonly el: HTMLDivElement;
  readonly camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.5, 4000);
  isOpen = false;
  map: SkyMap | null = null;
  sky: SkyScene | null = null;
  me = new Plane(5);
  foe: Plane | null = null;
  ai: FoeAI | null = null;
  bolts: Bolt[] = [];
  phase: Phase = 'ready';
  /** Seconds left on the clock; seconds flown. */
  time = RUN_TIME;
  flown = 0;
  readyT = 0;
  /** Whether this run rolled the hexed skyrunner, and whether it's been shot down. */
  foeRolled = false;
  kill = false;
  ringsTaken = 0;
  end: End | null = null;
  record = loadSkyRecord();
  invert = loadInvert();
  /** First-person view from the pilot's seat (V, Back, or the View button); remembered on the device. */
  cockpit = loadFirstPerson();
  /** For tests: force (true) or forbid (false) the encounter on the next runs; null = the 1 in 20 roll. */
  forceFoe: boolean | null = new URLSearchParams(location.search).has('dogfight') ? true : null;
  onClose: () => void = () => {};
  onResult: (won: boolean, crowns: number, why: string) => void = () => {};

  private meMesh = buildGlider(false);
  private foeMesh = buildGlider(true);
  private boltMeshes: THREE.Mesh[] = [];
  private puffs: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private held = new Set<string>();
  private touch = { fire: false, surge: false, back: false };
  private stick = { id: -1, x0: 0, y0: 0, x: 0, y: 0 };
  private gp = { x: 0, y: 0, lt: 0, rt: 0, fire: false, surge: false, back: false, prev: [] as boolean[] };
  private mouseFire = false;
  private rand = mulberry32(1);
  private foeLost = 0;
  private camPos = new THREE.Vector3();
  private camUp = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'skyRun';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="sk-top">
        <div class="sk-left"><span class="sk-hp" title="Hull"></span><span class="sk-heat"><i></i></span><span class="sk-surge">Surge</span></div>
        <div class="sk-clock">60</div>
        <div class="sk-right"><span class="sk-dist"></span><span class="sk-speed"></span></div>
      </div>
      <div class="sk-banner" aria-live="polite"></div>
      <div class="sk-mark sk-goal" aria-hidden="true"><b>▲</b><span>Beacon</span></div>
      <div class="sk-mark sk-foe hidden" aria-hidden="true"><b>▲</b><span>Hexed</span></div>
      <div class="sk-result hidden" role="dialog" aria-label="Run result">
        <h3 class="sk-r-title"></h3><p class="sk-r-line"></p><p class="sk-r-map"></p>
        <div class="sk-r-row"><button id="skAgain">Again (same map)</button><button id="skNew">New map</button><button class="secondary" id="skLeave">Leave</button></div>
        <div class="sk-r-row sk-r-seed"><label>Fly map # <input id="skSeed" inputmode="numeric" maxlength="6" size="7"></label><button class="secondary" id="skSeedGo">Fly</button></div>
      </div>
      <p class="sk-help sk-help-keys">Fly <b>W A S D</b> or arrows (W dives) · throttle <b>Shift</b> / <b>Z</b> · fire <b>Space</b> or click · surge <b>Q</b> · look back <b>R</b> · view <b>V</b> · <b>Esc</b> leaves</p>
      <p class="sk-help sk-help-pad only-pad">Fly <b>left stick</b> · throttle <b>RT / LT</b> · fire <b>A</b> or <b>RB</b> · surge <b>Y</b> · look back <b>R3</b> · view <b>Back</b> · <b>Start</b> leaves</p>
      <div class="sk-stick" aria-hidden="true"><div class="sk-knob"></div></div>
      <div class="sk-pad">
        <button class="sk-b sk-fire" data-b="fire">Fire</button>
        <button class="sk-b" data-b="surge">Surge</button>
        <button class="sk-b" data-b="back">Look back</button>
      </div>
      <div class="sk-tools"><button class="secondary" id="skView"></button><button class="secondary" id="skInvert"></button><button class="secondary" id="skQuit">Leave</button></div>`;
    document.body.appendChild(this.el);
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
    q('#skAgain').addEventListener('click', () => this.start(this.map?.seed ?? newSeed()));
    q('#skNew').addEventListener('click', () => this.start(newSeed()));
    q('#skLeave').addEventListener('click', () => this.close());
    q('#skQuit').addEventListener('click', () => this.close());
    q('#skInvert').addEventListener('click', () => this.setInvert(!this.invert));
    q('#skView').addEventListener('click', () => this.setView(!this.cockpit));
    q('#skSeedGo').addEventListener('click', () => { const n = parseInt(q<HTMLInputElement>('#skSeed').value, 10); if (n > 0) this.start(n); });
    this.setInvert(this.invert);
    this.setView(this.cockpit);
    window.addEventListener('keydown', (e) => this.key(e, true), true);
    window.addEventListener('keyup', (e) => this.key(e, false), true);
    this.el.addEventListener('mousedown', (e) => { if (e.button === 0 && !(e.target as Element).closest('button, input, .sk-result')) this.mouseFire = true; });
    window.addEventListener('mouseup', () => { this.mouseFire = false; });
    // Touch: a floating stick on the left; Fire (hold), Surge and Look back on the right.
    this.el.querySelectorAll<HTMLButtonElement>('.sk-b').forEach((b) => {
      const k = b.dataset.b as 'fire' | 'surge' | 'back';
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); this.touch[k] = true; });
      const up = () => { b.classList.remove('on'); this.touch[k] = false; };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    const zone = q<HTMLDivElement>('.sk-stick'), knob = q<HTMLDivElement>('.sk-knob');
    this.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.stick.id !== -1 || e.clientX > innerWidth * 0.5 || (e.target as Element).closest('button, input, .sk-result')) return;
      this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
      zone.style.left = e.clientX + 'px'; zone.style.top = e.clientY + 'px'; zone.classList.add('on');
      (e.target as Element).setPointerCapture?.(e.pointerId);
    });
    this.el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      const R = 55, dx = e.clientX - this.stick.x0, dy = e.clientY - this.stick.y0, d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
      this.stick.x = (dx * k) / R; this.stick.y = (dy * k) / R;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    });
    const end = (e: PointerEvent) => { if (e.pointerId !== this.stick.id) return; this.stick = { id: -1, x0: 0, y0: 0, x: 0, y: 0 }; zone.classList.remove('on'); knob.style.transform = ''; };
    this.el.addEventListener('pointerup', end); this.el.addEventListener('pointercancel', end);
    this.meMesh.name = 'skyrunner'; this.foeMesh.name = 'hexed-skyrunner';
  }

  /** Chase camera or first person from the seat. */
  setView(first: boolean) {
    this.cockpit = first; storeSet(VIEW_KEY, first ? 'first' : 'chase');
    this.el.querySelector('#skView')!.textContent = first ? 'View: first person' : 'View: chase';
  }
  private setInvert(on: boolean) {
    this.invert = on; storeSet(INVERT_KEY, on ? 'on' : 'off');
    this.el.querySelector('#skInvert')!.textContent = on ? 'Pitch: inverted' : 'Pitch: normal';
  }

  /** Open a run: a new map unless a seed is given. */
  open(seed?: number) {
    if (this.isOpen) return;
    this.isOpen = true;
    this.el.classList.remove('hidden');
    document.body.classList.add('skyrunning');
    this.gp.prev = this.padButtons();   // the A press that opened the run isn't a shot
    this.start(seed ?? newSeed());
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('skyrunning');
    this.held.clear(); this.mouseFire = false; this.touch = { fire: false, surge: false, back: false };
    this.sky?.dispose(); this.sky = null;
    this.onClose();
  }

  /** A fresh run on map `seed`: back on the perch, the clock full, the encounter rolled. */
  start(seed: number) {
    const m = this.map?.seed === seed ? this.map : generateSky(seed);
    if (this.sky && this.map !== m) { this.sky.dispose(); this.sky = null; }
    this.map = m;
    if (!this.sky) {
      this.sky = buildSkyScene(m);
      this.sky.scene.add(this.meMesh, this.foeMesh);
      this.boltMeshes = [];
      const geo = new THREE.BoxGeometry(0.35, 0.35, 5);
      const mine = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9FE4FF').multiplyScalar(1.6) }), theirs = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C78BFF').multiplyScalar(1.6) });
      for (let i = 0; i < 64; i++) { const b = new THREE.Mesh(geo, i < 40 ? mine : theirs); b.visible = false; this.sky.scene.add(b); this.boltMeshes.push(b); }
      this.puffs = [];
      const pg = new THREE.IcosahedronGeometry(1, 0);
      for (let i = 0; i < 40; i++) { const p = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: '#777', transparent: true, depthWrite: false })); p.visible = false; this.sky.scene.add(p); this.puffs.push({ m: p, v: new THREE.Vector3(), life: 0 }); }
    }
    this.sky.rings.forEach((r) => { r.visible = true; });
    this.me = new Plane(5);
    const s = m.start, deck = s.y + PERCH_H + 1;
    this.me.pos.set(s.x, deck + 2, s.z); this.me.face(s.yaw + Math.PI); this.me.speed = 0;
    this.foe = null; this.ai = null; this.bolts = []; this.foeLost = 0;
    this.foeRolled = this.forceFoe ?? Math.random() < FOE_CHANCE;
    this.rand = mulberry32(seed ^ Date.now());
    this.kill = false; this.ringsTaken = 0; this.end = null;
    this.time = RUN_TIME; this.flown = 0; this.phase = 'ready'; this.readyT = 3;
    this.foeMesh.visible = false;
    this.meMesh.visible = true;
    this.el.querySelector('.sk-result')!.classList.add('hidden');
    this.el.querySelector('.sk-foe')!.classList.add('hidden');
    this.camPos.set(0, 0, 0);
    this.camera.fov = 70; this.camera.updateProjectionMatrix();
  }

  private padButtons(): boolean[] {
    const p = [...(navigator.getGamepads?.() ?? [])].find((g) => !!g && g.connected);
    return p ? p.buttons.map((b) => b.pressed || b.value > 0.5) : [];
  }
  private pollPad() {
    const p = [...(navigator.getGamepads?.() ?? [])].find((g) => !!g && g.connected);
    const now = this.padButtons(), prev = this.gp.prev, hit = (i: number) => !!now[i] && !prev[i];
    this.gp.prev = now;
    if (!p) { Object.assign(this.gp, { x: 0, y: 0, lt: 0, rt: 0, fire: false, surge: false, back: false }); return; }
    if (this.phase === 'done') {
      if (hit(PAD.a)) this.start(this.map!.seed); else if (hit(PAD.x)) this.start(newSeed()); else if (hit(PAD.b) || hit(PAD.start)) this.close();
      return;
    }
    if (hit(PAD.start)) { this.close(); return; }
    if (hit(PAD.back)) this.setView(!this.cockpit);
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    this.gp.x = Math.abs(ax) > DEAD ? ax : 0; this.gp.y = Math.abs(ay) > DEAD ? ay : 0;
    this.gp.lt = p.buttons[PAD.lt]?.value ?? 0; this.gp.rt = p.buttons[PAD.rt]?.value ?? 0;
    this.gp.fire = !!now[PAD.a] || !!now[PAD.rb]; this.gp.surge = !!now[PAD.y]; this.gp.back = !!now[PAD.r3] || (p.axes[3] ?? 0) > 0.7;
  }

  private key(e: KeyboardEvent, down: boolean) {
    if (!this.isOpen) return;
    if (e.target instanceof HTMLInputElement) { if (down && e.code === 'Enter') (this.el.querySelector('#skSeedGo') as HTMLButtonElement).click(); return; }
    if (down && e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); return; }
    e.preventDefault(); e.stopPropagation();
    if (down && e.code === 'KeyV' && !e.repeat) this.setView(!this.cockpit);
    if (down && this.phase === 'done' && !e.repeat) {
      if (e.code === 'Enter' || e.code === 'Space') this.start(this.map!.seed);
      else if (e.code === 'KeyN') this.start(newSeed());
      return;
    }
    if (down) this.held.add(e.code); else this.held.delete(e.code);
  }

  /** The player's controls from keys, mouse, touch and pad, together. */
  private controls(dt: number): Ctl & { back: boolean } {
    const h = (...k: string[]) => k.some((c) => this.held.has(c)) ? 1 : 0;
    const touching = this.stick.id !== -1 || this.touch.fire || this.touch.surge;
    // Stick forward (up the screen) dives, the way a flight stick does; "Pitch: inverted" swaps it.
    let pitch = h('KeyS', 'ArrowDown') - h('KeyW', 'ArrowUp') - this.gp.y - this.stick.y;
    if (this.invert) pitch = -pitch;
    const roll = h('KeyD', 'ArrowRight') - h('KeyA', 'ArrowLeft') + this.gp.x + this.stick.x;
    let throttle = this.me.throttle + (h('ShiftLeft', 'ShiftRight') - h('KeyZ')) * 0.7 * dt;
    if (this.gp.rt > 0.05 || this.gp.lt > 0.05) throttle = 0.5 + this.gp.rt * 0.5 - this.gp.lt * 0.5;
    else if (touching) throttle += (0.5 - throttle) * Math.min(1, dt * 2);   // touch: auto-throttle back to cruise
    return {
      pitch: THREE.MathUtils.clamp(pitch, -1, 1), roll: THREE.MathUtils.clamp(roll, -1, 1), throttle: THREE.MathUtils.clamp(throttle, 0, 1),
      fire: !!h('Space') || this.mouseFire || this.touch.fire || this.gp.fire,
      surge: !!h('KeyQ') || this.touch.surge || this.gp.surge,
      back: !!h('KeyR') || this.touch.back || this.gp.back,
    };
  }

  update(dt: number) {
    if (!this.isOpen || !this.map) return;
    this.pollPad();
    if (!this.isOpen) return;
    dt = Math.min(dt, 0.05);
    const m = this.map, c = this.controls(dt);
    if (this.phase === 'ready') {
      this.readyT -= dt;
      this.banner(this.readyT > 0 ? String(Math.ceil(this.readyT)) : 'Go!');
      if (this.readyT <= 0) { this.phase = 'fly'; this.me.speed = CRUISE * 0.9; this.me.throttle = 0.5; }
    } else if (this.phase === 'fly') {
      this.time -= dt; this.flown += dt;
      if (this.me.step(c, dt)) { this.bolts.push(fireBolt(this.me, this.foe, 0.105, 0, this.rand, true)); haptics.play('tap'); }
      if (this.me.jammed > BOLT.jam - dt * 1.5) haptics.play('jam');
      this.flyFoe(dt);
      this.flyBolts(dt);
      // Wind rings.
      m.rings.forEach((r, i) => {
        const mesh = this.sky!.rings[i];
        if (mesh.visible && this.me.pos.distanceTo(mesh.position) < 17) { mesh.visible = false; this.ringsTaken++; this.time += RING_BONUS; haptics.play('pickup'); this.banner('+2 s', 0.8); }
      });
      // The ground, the water, the spires.
      const p = this.me.pos;
      if (p.y < surfaceAt(m, p.x, p.z) + 1.2 || m.spires.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < s.r * 0.85 + 2 && p.y < s.h)) this.finish('crashed');
      else if (!this.me.alive && this.me.sinceHit > 1.2) this.finish('downed');
      else if (Math.hypot(p.x - m.goal.x, p.z - m.goal.z) < 48 && p.y < m.goal.y + 180) this.finish('won');
      else if (this.time <= 0) { this.time = 0; this.finish('late'); }
      else if (this.bannerT <= 0) {
        const edge = Math.max(Math.abs(p.x), Math.abs(p.z));
        this.banner(edge > 1250 ? 'Turn back!' : p.y - groundAt(m, p.x, p.z) < 20 ? 'Pull up!' : '', 0);
      }
    } else {
      // After the end: the foe and the bolts carry on a moment, the plane glides (or falls).
      if (this.end === 'won' || this.end === 'late') this.me.step({ pitch: 0, roll: 0, throttle: 0.3, fire: false, surge: false }, dt);
      else this.me.speed = 0;   // down: it stays where it hit
      this.flyBolts(dt);
    }
    this.bannerT -= dt;
    this.puffTick(dt);
    this.place(c.back);
    this.draw();
  }

  private flyFoe(dt: number) {
    if (this.foeRolled && !this.foe && this.flown >= FOE_AFTER) {
      const f = new Plane(4, 0.85), me = this.me, fw = me.forward(new THREE.Vector3()), side = this.rand() < 0.5 ? -1 : 1;
      f.pos.copy(me.pos).addScaledVector(fw, 550).add(new THREE.Vector3(0, 70, 0)).addScaledVector(me.right(new THREE.Vector3()), side * 120);
      f.q.setFromRotationMatrix(new THREE.Matrix4().lookAt(f.pos, me.pos, new THREE.Vector3(0, 1, 0)));
      f.speed = CRUISE;
      this.foe = f; this.ai = new FoeAI(this.rand);
      this.foeMesh.visible = true;
      this.record.foes++;
      this.el.querySelector('.sk-foe')!.classList.remove('hidden');
      this.banner('Hexed skyrunner!', 2);
    }
    const f = this.foe;
    if (!f) return;
    const m = this.map!;
    const ctl = f.alive ? this.ai!.ctl(f, this.me, surfaceAt(m, f.pos.x, f.pos.z), dt) : { pitch: 0, roll: 1, throttle: 0.4, fire: false, surge: false };
    if (!this.me.alive) ctl.fire = false;
    if (f.step(ctl, dt)) this.bolts.push(fireBolt(f, this.me, 0.05, 0.05, this.rand, false));
    if (f.alive && (f.pos.y < surfaceAt(m, f.pos.x, f.pos.z) + 1)) { f.alive = false; f.hp = 0; }
    if (!f.alive) {
      this.foeLost += dt;
      if (this.foeLost > 3 || f.pos.y < surfaceAt(m, f.pos.x, f.pos.z)) { this.foeMesh.visible = false; this.el.querySelector('.sk-foe')!.classList.add('hidden'); }
      if (this.foeLost < 1.5 && Math.random() < 0.5) this.puff(f.pos, '#9A6CD0', 6);
    } else if (f.hp <= 1 && Math.random() < 0.3) this.puff(f.pos, '#555', 2);
    if (this.me.alive && this.me.hp <= 1 && Math.random() < 0.3) this.puff(this.me.pos, '#555', 2);
  }

  private flyBolts(dt: number) {
    const seg = new THREE.Line3(), close = new THREE.Vector3();
    this.bolts = this.bolts.filter((b) => {
      const from = b.pos.clone();
      b.pos.addScaledVector(b.vel, dt); b.life -= dt;
      const target = b.mine ? this.foe : this.me;
      if (target?.alive) {
        seg.set(from, b.pos); seg.closestPointToPoint(target.pos, true, close);
        if (close.distanceTo(target.pos) < BOLT.hitR) { this.hit(target); return false; }
      }
      return b.life > 0 && b.pos.y > surfaceAt(this.map!, b.pos.x, b.pos.z);
    });
  }

  private hit(p: Plane) {
    p.hp--; p.sinceHit = 0;
    this.puff(p.pos, p === this.me ? '#FFE08A' : '#C78BFF', 3);
    if (p === this.me) haptics.play('hurt'); else haptics.play('hit');
    if (p.hp > 0) return;
    p.alive = false;
    if (p === this.foe) { this.kill = true; this.record.kills++; this.banner('Hexed skyrunner down!', 1.8); }
    else this.banner('Shot down!', 2);
  }

  private finish(end: End) {
    if (this.phase === 'done') return;
    this.phase = 'done'; this.end = end;
    const m = this.map!, won = end === 'won', key = String(m.seed);
    if (end === 'crashed' || end === 'downed') haptics.play('jam');
    this.record.runs++;
    let crowns = 0, best = this.record.best[key], newBest = false;
    if (won) {
      this.record.wins++;
      crowns = PAY.win + (this.kill ? PAY.kill : 0);
      if (!best || this.flown < best) { this.record.best[key] = best = Math.round(this.flown * 10) / 10; newBest = true; }
    }
    storeSet(KEY, JSON.stringify(this.record));
    const box = this.el.querySelector('.sk-result')!;
    box.querySelector('.sk-r-title')!.textContent = won ? 'Beacon reached!' : end === 'late' ? 'Out of time' : end === 'crashed' ? 'Crashed' : 'Shot down';
    box.querySelector('.sk-r-line')!.textContent = won
      ? `${this.flown.toFixed(1)} s${this.ringsTaken ? `, ${this.ringsTaken} wind ring${this.ringsTaken > 1 ? 's' : ''}` : ''}. +${crowns} ◎${this.kill ? ' (with a hexed skyrunner shot down)' : ''}${newBest ? '. Best on this map!' : ''}`
      : end === 'late' ? `The beacon was ${Math.round(this.distLeft())} m off. Wind rings add 2 s each.`
      : end === 'crashed' ? 'Keep above the hills: the mana sails glide, they do not bounce.' : 'Bank hard and pull to shake it off, or surge away.';
    box.querySelector('.sk-r-map')!.textContent = `Map #${m.seed}${best ? ` · best ${best.toFixed(1)} s` : ''}`;
    (box.querySelector('#skSeed') as HTMLInputElement).value = '';
    box.classList.remove('hidden');
    this.banner('', 0);
    this.onResult(won, crowns, this.kill ? 'a sky run and a hexed skyrunner' : 'a sky run');
  }

  private distLeft() { const m = this.map!; return Math.hypot(this.me.pos.x - m.goal.x, this.me.pos.z - m.goal.z); }

  private bannerT = 0;
  private banner(text: string, hold = 0) {
    if (hold === 0 && this.bannerT > 0 && text === '') return;
    const b = this.el.querySelector('.sk-banner')!;
    if (b.textContent !== text) b.textContent = text;
    if (hold) this.bannerT = hold;
  }

  private puff(at: THREE.Vector3, color: string, n: number) {
    for (let k = 0; k < n; k++) {
      const p = this.puffs.find((x) => x.life <= 0);
      if (!p) return;
      p.life = 1; p.m.visible = true; p.m.position.copy(at);
      (p.m.material as THREE.MeshBasicMaterial).color.set(color);
      p.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(14);
    }
  }
  private puffTick(dt: number) {
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt * 0.9; p.m.position.addScaledVector(p.v, dt);
      p.m.scale.setScalar(1 + (1 - p.life) * 3); (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life);
      if (p.life <= 0) p.m.visible = false;
    }
  }

  /** The planes, the bolts and the camera where the run says. */
  private place(lookBack: boolean) {
    const me = this.me, t = performance.now() / 1000;
    this.meMesh.position.copy(me.pos); this.meMesh.quaternion.copy(me.q);
    if (this.foe) { this.foeMesh.position.copy(this.foe.pos); this.foeMesh.quaternion.copy(this.foe.q); }
    this.boltMeshes.forEach((b) => { b.visible = false; });
    let mi = 0, ti = 40;
    for (const b of this.bolts) {
      const mesh = this.boltMeshes[b.mine ? mi++ : ti++];
      if (!mesh || (b.mine && mi > 40)) continue;
      mesh.visible = true; mesh.position.copy(b.pos); mesh.lookAt(b.pos.clone().add(b.vel));
    }
    const fire = this.sky!.beacon.getObjectByName('beacon-fire');
    if (fire) fire.rotation.y = t * 0.5;
    const fw = me.forward(new THREE.Vector3()), up = me.up(new THREE.Vector3());
    const cam = this.camera;
    const first = this.cockpit && !lookBack;
    // In first person the pilot's own head is hidden and the cowl, sighting ring and gunwales show.
    const pilot = this.meMesh.getObjectByName('pilot'), pit = this.meMesh.getObjectByName('cockpit');
    if (pilot) pilot.visible = !first;
    if (pit) pit.visible = first;
    const near = first ? 0.1 : 0.5;
    if (cam.near !== near) { cam.near = near; cam.updateProjectionMatrix(); }
    const speedFov = (first ? 74 : 66) + (me.speed - 25) * 0.25 + (me.surge > 0 ? 6 : 0);
    if (Math.abs(cam.fov - speedFov) > 0.3) { cam.fov += (speedFov - cam.fov) * 0.1; cam.updateProjectionMatrix(); }
    if (first) {
      // The eye sits where the pilot's head is, and the view rolls with the wings.
      cam.position.copy(EYE).applyQuaternion(me.q).add(me.pos);
      cam.quaternion.copy(me.q);
      cam.up.copy(up);
      this.camPos.copy(me.pos).addScaledVector(fw, -17).addScaledVector(up, 4.8);   // so switching back doesn't swoop
      return;
    }
    const wantUp = this.camUp.lerp(up.clone().lerp(new THREE.Vector3(0, 1, 0), 0.55), 0.15).normalize();
    const want = lookBack ? me.pos.clone().addScaledVector(fw, 12).addScaledVector(wantUp, 3.5)
      : me.pos.clone().addScaledVector(fw, -17).addScaledVector(wantUp, 4.8);
    if (this.camPos.lengthSq() === 0 || lookBack) this.camPos.copy(want); else this.camPos.lerp(want, 0.18);
    const floor = surfaceAt(this.map!, this.camPos.x, this.camPos.z) + 2;
    if (this.camPos.y < floor) this.camPos.y = floor;
    cam.position.copy(this.camPos);
    cam.up.copy(wantUp);
    cam.lookAt(me.pos.clone().addScaledVector(fw, lookBack ? -40 : 30));
  }

  /** Screen-edge marker for a point in the world: on it when it's in view, pinned to the edge (pointing) when not. */
  private mark(el: HTMLElement, at: THREE.Vector3, label: string) {
    const v = at.clone().project(this.camera), behind = v.z > 1;
    let x = v.x, y = v.y;
    if (behind) { x = -x; y = -y; }
    const inView = !behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.88;
    if (!inView) { const k = 1 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.88, 1e-3); x *= k; y *= k; }
    el.style.left = ((x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - y) / 2 * innerHeight) + 'px';
    el.classList.toggle('edge', !inView);
    (el.firstElementChild as HTMLElement).style.transform = inView ? 'rotate(180deg)' : `rotate(${Math.atan2(x, y)}rad)`;
    const s = el.lastElementChild as HTMLElement; if (s.textContent !== label) s.textContent = label;
  }

  private draw() {
    const q = (s: string) => this.el.querySelector<HTMLElement>(s)!, me = this.me, m = this.map!;
    q('.sk-clock').textContent = this.phase === 'ready' ? String(RUN_TIME) : this.time.toFixed(this.time < 10 ? 1 : 0);
    q('.sk-clock').classList.toggle('low', this.phase === 'fly' && this.time < 10);
    q('.sk-hp').textContent = '◆'.repeat(Math.max(0, me.hp)) + '◇'.repeat(me.maxHp - Math.max(0, me.hp));
    const heat = q('.sk-heat i'); heat.style.width = Math.round(me.heat * 100) + '%'; heat.classList.toggle('jam', me.jammed > 0);
    q('.sk-surge').classList.toggle('ready', me.surgeCd <= 0); q('.sk-surge').classList.toggle('on', me.surge > 0);
    q('.sk-surge').textContent = me.surgeCd <= 0 ? 'Surge ready' : me.surge > 0 ? 'Surging!' : `Surge ${Math.ceil(me.surgeCd)} s`;
    q('.sk-dist').textContent = `${Math.round(this.distLeft())} m to the beacon`;
    q('.sk-speed').textContent = `${Math.round(me.speed * 3.6)} km/h · ${Math.round(Math.max(0, me.pos.y - surfaceAt(m, me.pos.x, me.pos.z)))} m up`;
    this.mark(q('.sk-goal'), new THREE.Vector3(m.goal.x, m.goal.y + 70, m.goal.z), `Beacon ${Math.round(this.distLeft())} m`);
    if (this.foe?.alive) this.mark(q('.sk-foe'), this.foe.pos, `Hexed ${Math.round(this.foe.pos.distanceTo(me.pos))} m`);
    q('.sk-tools').classList.toggle('hidden', this.phase === 'done');
  }

  render(renderer: THREE.WebGLRenderer) {
    if (!this.sky) return;
    if (this.camera.aspect !== innerWidth / innerHeight) { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
    renderer.setRenderTarget(null);
    renderer.render(this.sky.scene, this.camera);
  }
}

