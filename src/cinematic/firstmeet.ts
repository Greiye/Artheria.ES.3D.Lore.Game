// B50 (Mike 2026-11-04), rewritten Mike 2026-11-05: the first time you talk to Natalie, a short cinematic plays before
// her dialogue: Magister Greer has come up from the coach road to check on her for her patron, a close friend of his.
// Letterbox bars slide in to a wide 2.39:1 frame over a two-shot of them by the library door, with her name and role as
// a title card; then the bars narrow to 1.85:1 and the camera cuts between them, over the listener's shoulder, as they
// talk (subtitled). Then the bars open, Greer goes back to his post and her dialogue box starts as usual. Once per
// profile; any key, click, tap or pad button skips it.
import * as THREE from 'three';
import type { Shot } from '../camera/rig';
import './firstmeet.css';

const KEY = 'gametool.metnatalie';   // per profile (not in profiles.ts SHARED)
export const metNatalie = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const setMet = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } };

export type Speaker = 'greer' | 'natalie' | 'hero';
/** The conversation, in order, with how long each line holds (seconds). */
export const LINES: { who: Speaker; text: string; hold: number }[] = [
  { who: 'greer', text: 'Miss Bourbon. Our mutual friend asked me to look in on you. They read your last findings twice over, then a third time aloud, to the cat.', hold: 6.6 },
  { who: 'natalie', text: 'Tell them the library moved again last night. The stairs are not where I left them.', hold: 4.8 },
  { who: 'greer', text: 'Which is exactly what delights them. They cannot wait to see what you uncover down there.', hold: 5.0 },
  { who: 'natalie', text: "Then they'll need patience. And someone else willing to go down.", hold: 4.6 },
];
const NAME: Record<Speaker, string> = { greer: 'Magister Greer', natalie: 'Natalie', hero: 'You' };
/** A scene this player can play: its lines, and whether it is Natalie's first meeting (which it marks done). */
export interface Scene { lines: { who: Speaker; text: string; hold: number }[]; first: boolean }
export const MEET: Scene = { lines: LINES, first: true };
// Mike 2026-11-06: "When players start the game, they go right into character creation. Then a cinematic plays of
// Natalie talking to the player. I want Natalie to say that she saw the entire creation process, and that it was so
// odd to see someone transmogrify and change so quickly and suddenly. And that she is a little bothered by it."
// Played with the hero as the listener (the second position).
export const TRANSMOGRIFY: Scene = { first: false, lines: [
  { who: 'natalie', text: 'I saw all of that, you know. Every bit of it.', hold: 3.4 },
  { who: 'natalie', text: 'You were one person, then you were someone else. Just like that.', hold: 4.6 },
  { who: 'natalie', text: "I've seen a witch do a lot of things, but never anyone transmogrify that fast. Hair, face, shoulders, the lot.", hold: 6.2 },
  { who: 'natalie', text: "I'll be honest, it bothers me a little. Give me a moment to get used to the new you.", hold: 5.0 },
] };
export const WIDE = 3.0;   // seconds of the establishing two-shot
export const TALK_END = WIDE + LINES.reduce((s, l) => s + l.hold, 0);   // (the first meeting's)
export const END = TALK_END + 0.7;   // bars open
const ease = (t: number) => t * t * (3 - 2 * t);

export class FirstMeeting {
  active = false;
  t = 0;
  /** The line on screen now (-1: none). */
  line = -1;
  private bars: HTMLDivElement;
  private card: HTMLDivElement;
  private sub: HTMLDivElement;
  private nat = new THREE.Vector3();
  private gre = new THREE.Vector3();
  private done: () => void = () => {};
  private armed = false;   // a pad button only skips once every button has been let go
  private skipping = false;
  private scene: Scene = MEET;
  private talkEnd = TALK_END;
  private end = END;
  constructor(private setShot: (s: Shot | null) => void) {
    this.bars = document.createElement('div');
    this.bars.id = 'letterbox';
    this.bars.innerHTML = '<div class="lb top"></div><div class="lb bottom"></div>';
    this.card = document.createElement('div');
    this.card.id = 'meetCard';
    this.card.innerHTML = '<div class="mc-name">Natalie Bourbon</div><div class="mc-role">the one who came out alone</div><div class="mc-skip">any key to skip</div>';
    this.sub = document.createElement('div');
    this.sub.id = 'meetSub';
    this.sub.innerHTML = '<span class="ms-who"></span><span class="ms-text"></span>';
    document.body.append(this.bars, this.card, this.sub);
    const skip = (e: Event) => { if (!this.active) return; if ((e as KeyboardEvent).repeat) return; e.preventDefault(); e.stopImmediatePropagation(); this.skip(); };
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
  }

  /** Natalie's feet, and where Greer stands for the scene (main.ts puts his figure there). Calls onDone when it ends or is skipped. */
  play(natalie: THREE.Vector3, greer: THREE.Vector3, onDone: () => void, scene: Scene = MEET) {
    this.scene = scene; this.talkEnd = WIDE + scene.lines.reduce((s, l) => s + l.hold, 0); this.end = this.talkEnd + 0.7;
    if (scene.first) setMet();
    this.active = true; this.t = 0; this.line = -1; this.armed = false; this.skipping = false; this.done = onDone;
    this.nat.copy(natalie).setY(0); this.gre.copy(greer).setY(0);
    this.bars.classList.add('on'); this.card.classList.remove('on'); this.sub.classList.remove('on');
    document.body.classList.add('cutscene');
    this.update(0, false);
  }

  skip() { if (this.active && !this.skipping) { this.skipping = true; this.t = Math.max(this.t, this.talkEnd); } }

  /** Bar height in px for a frame of aspect a, capped so a phone held upright still shows them. */
  private bar(a: number) { const W = innerWidth, H = innerHeight; return Math.min(H * 0.2, Math.max(0, (H - W / a) / 2)); }

  /** The line playing at time t, and how far into it (0..1). */
  private lineAt(t: number): [number, number] {
    if (t < WIDE) return [-1, 0];
    let s = WIDE;
    const L = this.scene.lines;
    for (let i = 0; i < L.length; i++) { if (t < s + L[i].hold) return [i, (t - s) / L[i].hold]; s += L[i].hold; }
    return [-1, 0];
  }

  update(dt: number, padPressed: boolean) {
    if (!this.active) return;
    if (!padPressed) this.armed = true; else if (this.armed) this.skip();
    this.t += dt;
    const t = this.t;
    // Letterbox: in to 2.39:1 over 0.7 s, narrow to 1.85:1 as the talk starts, open over the last 0.7 s.
    let h: number;
    if (t < WIDE) h = this.bar(2.39) * ease(Math.min(1, t / 0.7));
    else if (t < this.talkEnd) h = THREE.MathUtils.lerp(this.bar(2.39), this.bar(1.85), ease(Math.min(1, (t - WIDE) / 0.8)));
    else h = this.bar(1.85) * (1 - ease(Math.min(1, (t - this.talkEnd) / (this.end - this.talkEnd))));
    this.bars.style.setProperty('--lb', `${h.toFixed(1)}px`);
    this.card.classList.toggle('on', t > 0.6 && t < WIDE - 0.3 && !this.skipping);
    const [i, k] = t < this.talkEnd ? this.lineAt(t) : [-1, 0];
    if (i !== this.line) {
      this.line = i;
      if (i >= 0) {
        const L = this.scene.lines[i];
        this.sub.querySelector('.ms-who')!.textContent = NAME[L.who];
        this.sub.querySelector('.ms-text')!.textContent = L.text;
        this.sub.dataset.who = L.who;
      }
    }
    this.sub.classList.toggle('on', i >= 0 && !this.skipping);
    this.setShot(this.shot(t, i, k));
    if (t >= this.end) this.finish();
  }

  /** The establishing two-shot drifts; each line cuts to the speaker over the listener's shoulder, easing in slowly. */
  private shot(t: number, i: number, k: number): Shot {
    const mid = this.nat.clone().lerp(this.gre, 0.5), across = this.gre.clone().sub(this.nat).setY(0);
    if (across.lengthSq() < 1e-4) across.set(1, 0, 0);
    across.normalize();
    const side = new THREE.Vector3(-across.z, 0, across.x);   // perpendicular to the line between them
    if (i < 0) {   // the two-shot (and the bars opening at the end)
      const d = t < WIDE ? t / WIDE : 1;
      return { pos: mid.clone().addScaledVector(side, THREE.MathUtils.lerp(5.2, 4.4, d)).addScaledVector(across, THREE.MathUtils.lerp(-1.2, -0.6, d)).setY(2.3), look: mid.clone().setY(1.3), fov: 50 };
    }
    const speaker = this.scene.lines[i].who === 'natalie' ? this.nat : this.gre, listener = this.scene.lines[i].who === 'natalie' ? this.gre : this.nat;
    const toSpk = speaker.clone().sub(listener).setY(0).normalize();
    // Behind and beside the listener's shoulder, looking at the speaker's face; a slow push as the line plays.
    const push = ease(Math.min(1, k));
    const pos = listener.clone().addScaledVector(toSpk, THREE.MathUtils.lerp(-0.9, -0.7, push)).addScaledVector(side, 0.45).setY(1.68);
    return { pos, look: speaker.clone().setY(1.52), fov: THREE.MathUtils.lerp(40, 36, push) };
  }

  private finish() {
    this.active = false; this.line = -1;
    this.bars.classList.remove('on'); this.card.classList.remove('on'); this.sub.classList.remove('on');
    document.body.classList.remove('cutscene');
    this.bars.style.setProperty('--lb', '0px');
    this.done();
  }
}
