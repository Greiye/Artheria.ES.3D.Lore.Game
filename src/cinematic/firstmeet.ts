// B50 (Mike 2026-11-04): the first time you talk to Natalie, a short cinematic plays before her dialogue. Letterbox
// bars slide in to a wide 2.39:1 frame over a wide shot of her by the library door, then narrow to a set height
// (1.85:1) as the camera pushes in on her face, with her name and role as a title card. Then the bars open and her
// dialogue box starts as usual. Once per profile; any key, click, tap or pad button skips it.
import * as THREE from 'three';
import type { Shot } from '../camera/rig';
import './firstmeet.css';

const KEY = 'gametool.metnatalie';   // per profile (not in profiles.ts SHARED)
export const metNatalie = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const setMet = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } };

const WIDE = 2.4, PUSH = 5.4, END = 6.0;   // seconds: wide shot ends, push-in ends, bars open
const ease = (t: number) => t * t * (3 - 2 * t);

export class FirstMeeting {
  active = false;
  t = 0;
  private bars: HTMLDivElement;
  private card: HTMLDivElement;
  private at = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private side = new THREE.Vector3();
  private done: () => void = () => {};
  private armed = false;   // a pad button only skips once every button has been let go
  private skipping = false;
  constructor(private setShot: (s: Shot | null) => void) {
    this.bars = document.createElement('div');
    this.bars.id = 'letterbox';
    this.bars.innerHTML = '<div class="lb top"></div><div class="lb bottom"></div>';
    this.card = document.createElement('div');
    this.card.id = 'meetCard';
    this.card.innerHTML = '<div class="mc-name">Natalie Bourbon</div><div class="mc-role">the one who came out alone</div><div class="mc-skip">any key to skip</div>';
    document.body.append(this.bars, this.card);
    const skip = (e: Event) => { if (!this.active) return; if ((e as KeyboardEvent).repeat) return; e.preventDefault(); e.stopImmediatePropagation(); this.skip(); };
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
  }

  /** Natalie's feet and the direction she faces. Calls onDone when it ends or is skipped. */
  play(feet: THREE.Vector3, yaw: number, onDone: () => void) {
    setMet();
    this.active = true; this.t = 0; this.armed = false; this.skipping = false; this.done = onDone;
    this.at.copy(feet);
    this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.bars.classList.add('on'); this.card.classList.remove('on');
    document.body.classList.add('cutscene');
    this.update(0, false);
  }

  skip() { if (this.active && !this.skipping) { this.skipping = true; this.t = Math.max(this.t, PUSH); } }

  /** Barheight in px for a frame of aspect a, capped so a phone held upright still shows her. */
  private bar(a: number) { const W = innerWidth, H = innerHeight; return Math.min(H * 0.2, Math.max(0, (H - W / a) / 2)); }

  update(dt: number, padPressed: boolean) {
    if (!this.active) return;
    if (!padPressed) this.armed = true; else if (this.armed) this.skip();
    this.t += dt;
    const t = this.t;
    // Letterbox: in to 2.39:1 over 0.7 s, narrow to 1.85:1 as the push-in starts, open over the last 0.6 s.
    let h: number;
    if (t < WIDE) h = this.bar(2.39) * ease(Math.min(1, t / 0.7));
    else if (t < PUSH) h = THREE.MathUtils.lerp(this.bar(2.39), this.bar(1.85), ease(Math.min(1, (t - WIDE) / 1)));
    else h = this.bar(1.85) * (1 - ease(Math.min(1, (t - PUSH) / (END - PUSH))));
    this.bars.style.setProperty('--lb', `${h.toFixed(1)}px`);
    this.card.classList.toggle('on', t > 0.8 && t < PUSH - 0.6 && !this.skipping);
    // Camera: a slow wide drift off her shoulder, then a push-in to her face.
    const face = this.at.clone().setY(1.55);
    let pos: THREE.Vector3, look: THREE.Vector3, fov: number;
    if (t < WIDE) {
      const k = t / WIDE;
      pos = this.at.clone().addScaledVector(this.fwd, 5.5).addScaledVector(this.side, THREE.MathUtils.lerp(4.2, 3.2, k)).setY(2.6);
      look = this.at.clone().setY(1.25); fov = 55;
    } else {
      const k = ease(Math.min(1, (t - WIDE) / (PUSH - WIDE)));
      pos = this.at.clone().addScaledVector(this.fwd, THREE.MathUtils.lerp(3.4, 1.15, k)).addScaledVector(this.side, THREE.MathUtils.lerp(0.9, 0.25, k)).setY(THREE.MathUtils.lerp(1.9, 1.6, k));
      look = face; fov = THREE.MathUtils.lerp(50, 36, k);
    }
    this.setShot({ pos, look, fov });
    if (t >= END) this.finish();
  }

  private finish() {
    this.active = false;
    this.bars.classList.remove('on'); this.card.classList.remove('on');
    document.body.classList.remove('cutscene');
    this.bars.style.setProperty('--lb', '0px');
    this.done();
  }
}
