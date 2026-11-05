// Mike 2026-11-05: a short cinematic down the stairs, when you drop through the trapdoor and each time you go down a
// floor. The screen goes black, the next floor is built behind it, then the camera rides down a torch-lit spiral
// stair shaft while a card reads "Leaving Floor 3 / Floor 4 of 30" and a hint of what's below (src/delve/hints.ts).
// The shaft is dressed for the floor it leads to: fog colour, torch strength and drifting particles (drips, embers,
// frost, leaves...). The trapdoor version opens with a shot over the hero's shoulder at the open trapdoor first.
// About 3 s a floor, 4 s from the trapdoor. Any key, click, tap or pad button skips it. With reduced motion the
// camera holds still.
import * as THREE from 'three';
import type { Shot } from '../camera/rig';
import { pixelTexture } from '../tex/pixel';
import type { FloorHint, ShaftFx } from '../delve/hints';
import './descend.css';

/** Where the shaft is built: far under the world, closed top and bottom, so nothing else is in view. */
const AT = new THREE.Vector3(0, -160, 0);
const H = 16, R_WALL = 3.2, R_STEP = 1.75, PER_TURN = 16, RISE = 0.22, TOP = H / 2 - 0.6;
const STEPS = Math.floor((H - 2) / RISE);
const TURNS = 1.4;   // how far round the camera goes on a ride
const N_PARTS = 160;

export interface Palette { wall: string; floor: string; torch: string; fog: string }
export interface DescentPlay {
  /** 'enter': from the trapdoor (opens on `opening`); 'down': a floor's stairs. */
  kind: 'enter' | 'down';
  eyebrow: string;
  title: string;
  /** The over-the-shoulder shot at the trapdoor ('enter' only). */
  opening?: Shot;
  /** Builds the next floor while the screen is black; returns its hint and the shaft palette. */
  mid: () => { hint: FloorHint; palette: Palette };
  /** The ride is over and the floor is showing (black lifting). */
  done: (hint: FloorHint | null) => void;
  reduced: boolean;
  /** Fewer particles (Low power). */
  light?: boolean;
  /** Footsteps and the floor's sound (drips, crackle, rumble). */
  sound?: (hint: FloorHint) => void;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const FX_COLOR: Record<ShaftFx, string> = { drip: '#9FD4F0', ember: '#FF9A3A', dust: '#E8D8B0', rise: '#E8E0FF', frost: '#F2FAFF', leaf: '#8FC060', spore: '#9CFF8A', gold: '#FFD86A', smoke: '#8A8478' };

export class DescentCine {
  active = false;
  t = 0;
  readonly group = new THREE.Group();
  private walls: THREE.MeshBasicMaterial;
  private pillar: THREE.MeshBasicMaterial;
  private steps: THREE.MeshBasicMaterial;
  private flames: THREE.Mesh[] = [];
  private glows: THREE.Sprite[] = [];
  private glowMat: THREE.SpriteMaterial;
  private parts: THREE.Points;
  private partVel: Float32Array;
  private fade: HTMLDivElement;
  private card: HTMLDivElement;
  private bars: HTMLDivElement;
  private p: DescentPlay | null = null;
  private hint: FloorHint | null = null;
  private midDone = false;
  private endDone = false;
  private savedFog: { color: THREE.Color; near: number; far: number; bg: THREE.Color } | null = null;
  private armed = false;
  // Timeline (seconds), set per play.
  private open = 0; private cover = 0; private reveal = 0; private rideEnd = 0; private out = 0; private end = 0;

  constructor(private scene: THREE.Scene, private setShot: (s: Shot | null, cut?: boolean) => void) {
    this.group.name = 'stair-shaft';
    this.group.position.copy(AT);
    this.group.visible = false;
    const stone = pixelTexture('stone').clone(); stone.needsUpdate = true; stone.repeat.set(10, 5);
    this.walls = new THREE.MeshBasicMaterial({ map: stone, side: THREE.BackSide });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R_WALL, R_WALL, H, 28, 1, true), this.walls);
    this.pillar = new THREE.MeshBasicMaterial({ map: pixelTexture('stone') });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, H, 12), this.pillar);
    this.steps = new THREE.MeshBasicMaterial({ map: pixelTexture('paving') });
    const stepMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(R_WALL - 0.6, 0.2, 0.78), this.steps, STEPS);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < STEPS; i++) {
      const a = this.angleAt(i), r = (R_WALL + 0.6) / 2;
      q.setFromAxisAngle(up, -a);
      m.compose(new THREE.Vector3(Math.cos(a) * r, TOP - i * RISE - 0.1, Math.sin(a) * r), q, one);
      stepMesh.setMatrixAt(i, m);
    }
    const cap = new THREE.MeshBasicMaterial({ color: '#050404', side: THREE.DoubleSide });
    const top = new THREE.Mesh(new THREE.CircleGeometry(R_WALL, 28).rotateX(Math.PI / 2), cap); top.position.y = H / 2;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(R_WALL, 28).rotateX(-Math.PI / 2), cap); bottom.position.y = -H / 2;
    this.group.add(wall, pillar, stepMesh, top, bottom);
    // Torches on the wall every half turn: a sconce, a flame and a soft glow.
    const sconce = new THREE.MeshBasicMaterial({ color: '#2A211A' });
    const g = document.createElement('canvas'); g.width = g.height = 64;
    const c = g.getContext('2d')!, grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad; c.fillRect(0, 0, 64, 64);
    this.glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(g), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (let i = 4; i < STEPS; i += PER_TURN / 2) {
      const a = this.angleAt(i) + 0.35, y = TOP - i * RISE + 1.9, x = Math.cos(a) * (R_WALL - 0.12), z = Math.sin(a) * (R_WALL - 0.12);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), sconce); s.position.set(x, y - 0.18, z);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), new THREE.MeshBasicMaterial({ color: '#FFB347', fog: false })); f.position.set(x, y + 0.08, z);
      const gl = new THREE.Sprite(this.glowMat); gl.position.set(x * 0.94, y + 0.05, z * 0.94); gl.scale.setScalar(1.8);
      this.flames.push(f); this.glows.push(gl);
      this.group.add(s, f, gl);
    }
    // Particles: drips fall, embers rise, dust and frost drift.
    const pos = new Float32Array(N_PARTS * 3);
    this.partVel = new Float32Array(N_PARTS);
    this.parts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ size: 0.05, color: '#FFFFFF', map: this.glowMat.map, transparent: true, opacity: 0.85, depthWrite: false }));
    this.parts.frustumCulled = false;
    this.group.add(this.parts);
    this.group.traverse((o) => { o.raycast = () => {}; });
    scene.add(this.group);

    this.fade = document.createElement('div'); this.fade.id = 'descendFade';
    this.bars = document.createElement('div'); this.bars.id = 'descendBars'; this.bars.innerHTML = '<div class="db top"></div><div class="db bottom"></div>';
    this.card = document.createElement('div'); this.card.id = 'descendCard';
    this.card.innerHTML = '<div class="dc-eyebrow"></div><div class="dc-title"></div><div class="dc-lines"></div><div class="dc-skip">any key to skip</div>';
    document.body.append(this.fade, this.bars, this.card);
    const skip = (e: Event) => { if (!this.active) return; if ((e as KeyboardEvent).repeat) return; e.preventDefault(); e.stopImmediatePropagation(); this.skip(); };
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
  }

  /** Step i's angle round the shaft (the stair turns clockwise going down). */
  private angleAt(i: number) { return -i * (Math.PI * 2 / PER_TURN); }
  /** A point on the walking line at step position i (fractional), in world space. */
  private onStairs(i: number, lift: number, out = new THREE.Vector3()) {
    const a = this.angleAt(i);
    return out.set(Math.cos(a) * R_STEP, TOP - i * RISE + lift, Math.sin(a) * R_STEP).add(AT);
  }

  play(p: DescentPlay) {
    this.p = p; this.hint = null; this.active = true; this.t = 0; this.midDone = false; this.endDone = false; this.armed = false;
    this.open = p.kind === 'enter' && p.opening ? 1.0 : 0;
    this.cover = this.open + 0.35;
    this.reveal = this.cover + 0.3;
    this.rideEnd = this.reveal + (p.kind === 'enter' ? 2.6 : 2.2);
    this.out = this.rideEnd + 0.35;
    this.end = this.out + 0.35;
    this.card.querySelector('.dc-eyebrow')!.textContent = p.eyebrow;
    this.card.querySelector('.dc-title')!.textContent = p.title;
    this.card.querySelector('.dc-lines')!.innerHTML = '';
    this.card.className = 'dc-on';
    this.bars.classList.add('on');
    document.body.classList.add('cutscene');
    if (this.open) this.setShot(p.opening!);
    this.fade.style.opacity = '0';
    this.update(0, false);
  }

  /** Jump to the end of the ride (the floor is still built first). */
  skip() { if (this.active && this.t < this.rideEnd) this.t = Math.max(this.t, this.rideEnd); }

  update(dt: number, padPressed: boolean) {
    if (!this.active || !this.p) return;
    if (!padPressed) this.armed = true; else if (this.armed) { this.armed = false; this.skip(); }
    this.t += dt;
    const t = this.t;
    if (t >= this.cover && !this.midDone) this.toShaft();
    // Black: in over the opening, out to reveal the shaft, in again at the end, out over the floor.
    let black = 0;
    if (t < this.cover) black = this.open ? ease(THREE.MathUtils.clamp((t - this.open) / 0.35, 0, 1)) : ease(Math.min(1, t / 0.35));
    else if (t < this.reveal) black = 1 - ease((t - this.cover) / (this.reveal - this.cover));
    else if (t < this.rideEnd) black = 0;
    else if (t < this.out) black = ease((t - this.rideEnd) / (this.out - this.rideEnd));
    else black = 1 - ease(Math.min(1, (t - this.out) / (this.end - this.out)));
    this.fade.style.opacity = black.toFixed(3);
    if (t >= this.out && !this.endDone) this.leaveShaft();
    if (t < this.out && this.midDone) this.ride(t, dt);
    this.card.classList.toggle('dc-full', t >= this.reveal + 0.25 && t < this.out);
    if (t >= this.end) {
      this.active = false; this.fade.style.opacity = '0'; this.card.className = ''; this.bars.classList.remove('on');
      document.body.classList.remove('cutscene');
      this.p = null;
    }
  }

  /** Under black: build the floor, dress the shaft for it and cut the camera inside. */
  private toShaft() {
    const p = this.p!;
    this.midDone = true;
    let built: { hint: FloorHint; palette: Palette } | null = null;
    try { built = p.mid(); } catch (e) { console.error(e); }
    const fog = this.scene.fog as THREE.Fog | null, bg = this.scene.background as THREE.Color | null;
    if (fog && bg) this.savedFog = { color: fog.color.clone(), near: fog.near, far: fog.far, bg: bg.clone() };
    this.hint = built?.hint ?? null;
    const pal = built?.palette ?? { wall: '#B8A07A', floor: '#C9B48A', torch: '#FFB347', fog: '#1A1510' };
    const h = this.hint;
    const fogCol = h?.fog ?? pal.fog;
    if (fog && bg) { fog.color.set(fogCol); fog.near = h && h.torch < 0.5 ? 0.8 : 1.5; fog.far = h && h.torch < 0.5 ? 6 : 11; bg.set(fogCol); }
    // A twisted floor or the hoard tints the stone toward its own colour (wet blue, scorched red, gold).
    const tint = h?.fog && h.torch >= 0.5 ? new THREE.Color(h.fog).multiplyScalar(4) : null, k = h && h.torch < 0.5 ? 0.45 : 1;
    const paint = (m: THREE.MeshBasicMaterial, c: string, f: number) => { m.color.set(c).multiplyScalar(f * k); if (tint) m.color.lerp(tint, 0.45); };
    paint(this.walls, pal.wall, 0.8); paint(this.pillar, pal.wall, 0.62); paint(this.steps, pal.floor, 0.85);
    const torch = h?.torch ?? 1;
    for (const f of this.flames) { (f.material as THREE.MeshBasicMaterial).color.set(pal.torch); f.visible = torch > 0.1; }
    this.glowMat.color.set(pal.torch); this.glowMat.opacity = 0.55 * torch;
    this.seedParticles(h?.fx ?? 'dust');
    if (h) {
      const lines = this.card.querySelector('.dc-lines')!;
      lines.innerHTML = '';
      for (const l of h.lines) { const d = document.createElement('div'); d.textContent = l; lines.appendChild(d); }
      try { p.sound?.(h); } catch { /* audio blocked */ }
    }
    this.group.visible = true;
    this.ride(this.t, 0);
  }

  /** Under black again: put the floor's fog back and hand the camera to the player. */
  private leaveShaft() {
    this.endDone = true;
    const fog = this.scene.fog as THREE.Fog | null, bg = this.scene.background as THREE.Color | null;
    if (fog && bg && this.savedFog) { fog.color.copy(this.savedFog.color); fog.near = this.savedFog.near; fog.far = this.savedFog.far; bg.copy(this.savedFog.bg); }
    this.savedFog = null;
    this.group.visible = false;
    this.setShot(null, true);
    try { this.p!.done(this.hint); } catch (e) { console.error(e); }
  }

  /** The camera walks down the spiral, eyes ahead and a little down, with a slight step bob. */
  private ride(t: number, dt: number) {
    const p = this.p!, u = p.reduced ? 0.15 : THREE.MathUtils.clamp((t - this.cover) / (this.rideEnd - this.cover), 0, 1);
    const i = 3 + ease(u) * TURNS * PER_TURN;
    const bob = p.reduced ? 0 : Math.sin(t * 8.5) * 0.035;
    const pos = this.onStairs(i, 1.62 + bob), look = this.onStairs(i + 3.2, 0.9);
    this.setShot({ pos, look, fov: 62 }, true);
    const k = performance.now() / 1000;
    this.flames.forEach((f, n) => { const s = 0.85 + 0.25 * Math.sin(k * 13 + n * 1.7) * Math.sin(k * 7.3 + n); f.scale.set(1, s, 1); });
    this.stepParticles(dt, pos.y - AT.y);
  }

  private fx: ShaftFx = 'dust';
  private seedParticles(fx: ShaftFx) {
    this.fx = fx;
    const n = this.p?.light ? N_PARTS / 2 : N_PARTS;
    const a = this.parts.geometry.getAttribute('position') as THREE.BufferAttribute;
    const mat = this.parts.material as THREE.PointsMaterial;
    mat.color.set(FX_COLOR[fx]);
    mat.size = fx === 'drip' ? 0.07 : fx === 'leaf' ? 0.14 : fx === 'smoke' ? 0.3 : 0.1;
    mat.opacity = fx === 'smoke' ? 0.35 : 0.85;
    for (let k = 0; k < N_PARTS; k++) {
      const r = Math.sqrt(Math.random()) * (R_WALL - 0.2), th = Math.random() * Math.PI * 2;
      a.setXYZ(k, Math.cos(th) * r, k < n ? (Math.random() - 0.5) * H : -H, Math.sin(th) * r);
      const sp = fx === 'drip' ? -(5 + Math.random() * 3) : fx === 'ember' ? 0.8 + Math.random() * 0.9 : fx === 'rise' ? 0.35 + Math.random() * 0.3
        : fx === 'leaf' ? -(0.4 + Math.random() * 0.3) : fx === 'frost' ? -(0.15 + Math.random() * 0.2) : fx === 'smoke' ? 0.25 + Math.random() * 0.2
        : fx === 'gold' ? (Math.random() - 0.5) * 0.3 : (Math.random() - 0.3) * 0.12;
      this.partVel[k] = k < n ? sp : 0;
    }
    a.needsUpdate = true;
  }
  private stepParticles(dt: number, camY: number) {
    if (!dt) return;
    const a = this.parts.geometry.getAttribute('position') as THREE.BufferAttribute, k0 = performance.now() / 1000;
    for (let k = 0; k < N_PARTS; k++) {
      if (!this.partVel[k]) continue;
      let y = a.getY(k) + this.partVel[k] * dt;
      // Keep them around the camera's height as it goes down.
      if (y < camY - 5) y += 10; else if (y > camY + 5) y -= 10;
      let x = a.getX(k), z = a.getZ(k);
      if (this.fx === 'leaf' || this.fx === 'ember' || this.fx === 'smoke') { x += Math.sin(k0 * 1.7 + k) * 0.25 * dt; z += Math.cos(k0 * 1.3 + k) * 0.25 * dt; }
      a.setXYZ(k, x, y, z);
    }
    a.needsUpdate = true;
  }
}
