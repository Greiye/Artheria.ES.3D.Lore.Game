import * as THREE from 'three';
import { storeSet } from '../store';
import { escapeHtml } from '../submit';

// B36 (Mike 2026-11-04 "All 3 yes"): the first-day guided quest. A short chain that teaches the main loop:
// get up (B31) → write at the Scriptorium → make something at the Tailor or the Smithy → sit at the campfire.
// Natalie points the way (her lines under the screen, a gold marker over the next door) rather than walking with
// you. It runs once per profile (the key is a profile key, B24), and the casebook (J) can skip it.
// Lore-first round, item 4 (Mike 2026-11-05): the day now starts with the lore. Reading a tale in the town Library
// comes straight after getting up, and the side games (spar, sky run, trapdoor, dojo) wait until the day is done.
export type DayStep = 'up' | 'read' | 'write' | 'make' | 'fire';
export const DAY_STEPS: DayStep[] = ['up', 'read', 'write', 'make', 'fire'];
const TEXT: Record<DayStep, { goal: string; natalie: string }> = {
  up: { goal: 'Get up', natalie: 'Right. Let me show you how a day goes.' },
  read: { goal: 'Read a tale in the Library 📖', natalie: 'Everything here grew out of stories. Start at the Library, where the gold light is, and read one.' },
  write: { goal: 'Write something at the Scriptorium ✒', natalie: 'Now add your own words. The Scriptorium by the water.' },
  make: { goal: 'Make something at the Tailor ✂ or the Smithy ⚒', natalie: 'Good. Now make something: a new look at the Tailor, or a weapon at the Smithy.' },
  fire: { goal: 'Sit at the campfire', natalie: 'End the day at the fire, out past the glade. Cook something, or play.' },
};
const DONE_LINE = "That's a day in Artheria. Every day after this one is yours.";
const KEY = 'gametool.firstday';

export interface DayState { step: number; done: boolean; skipped?: boolean }
export function loadDay(): DayState | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return v && typeof v.step === 'number' ? { step: v.step, done: !!v.done, skipped: !!v.skipped } : null; } catch { return null; }
}

/** What the player is doing this frame (main.ts polls its panels). */
export interface DayFlags { waking: boolean; reading: boolean; writing: boolean; making: boolean; atFire: boolean }

export class FirstDay {
  state: DayState | null = loadDay();
  readonly marker: THREE.Mesh;
  private hud: HTMLDivElement;
  private upFor = 0;
  private t = 0;

  constructor(scene: THREE.Scene, private targets: Partial<Record<DayStep, () => THREE.Vector3>>, private say: (text: string) => void, private onDone: (skipped: boolean) => void) {
    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xF2C94C }));
    this.marker.name = 'firstDayMarker'; this.marker.visible = false; this.marker.raycast = () => {};
    scene.add(this.marker);
    this.hud = document.createElement('div');
    this.hud.id = 'firstDay';
    this.hud.className = 'first-day hidden';
    document.body.appendChild(this.hud);
  }

  get active() { return !!this.state && !this.state.done; }
  /** Side games open once the first day is over (or skipped), and always for profiles from before it existed. */
  get sideGamesOpen() { return !this.active; }
  get step(): DayStep | null { return this.active ? DAY_STEPS[this.state!.step] ?? null : null; }

  /** A profile part-way through picks it up again. Mike 2026-11-06: "Make it so that the players don't have a quest
   *  when they start new game", so a new profile no longer starts one. */
  begin() {
    this.upFor = 0;
    this.render();
  }
  skip() {
    if (!this.active) return;
    this.state = { step: this.state!.step, done: true, skipped: true };
    this.save(); this.render(); this.onDone(true);
  }
  private save() { storeSet(KEY, JSON.stringify(this.state)); }

  private advance() {
    const s = this.state!;
    s.step++;
    if (s.step >= DAY_STEPS.length) { s.done = true; this.save(); this.render(); this.say(DONE_LINE); this.onDone(false); return; }
    this.save(); this.render();
    this.say((s.step === 1 ? TEXT.up.natalie + ' ' : '') + TEXT[DAY_STEPS[s.step]].natalie);
  }

  update(dt: number, f: DayFlags, playing: boolean) {
    this.t += dt;
    const step = this.step;
    this.hud.classList.toggle('hidden', !step || !playing);
    if (!step) { this.marker.visible = false; return; }
    if (step === 'up') {
      // Up once the wake-up is over and you've stood a moment; Natalie's hello is the first line.
      if (!f.waking && playing) { this.upFor += dt; if (this.upFor > 0.8) this.advance(); }
    } else if ((step === 'read' && f.reading) || (step === 'write' && f.writing) || (step === 'make' && f.making) || (step === 'fire' && f.atFire)) this.advance();
    const at = this.step ? this.targets[this.step]?.() : undefined;
    this.marker.visible = !!at && playing;
    if (at) {
      this.marker.position.set(at.x, at.y + 3.2 + Math.sin(this.t * 2.2) * 0.18, at.z);
      this.marker.rotation.y = this.t * 1.4;
    }
  }

  private render() {
    const step = this.step;
    if (!step) { this.hud.innerHTML = ''; return; }
    const n = this.state!.step + 1;
    this.hud.innerHTML = `<b>First day · ${n} of ${DAY_STEPS.length}</b><span>${escapeHtml(TEXT[step].goal)}</span>`;
  }

  /** The casebook's first-day page: the steps with ticks, and Skip. */
  casebookHtml(): string {
    if (!this.state) return '';
    const s = this.state;
    const rows = DAY_STEPS.map((k, i) => `<li class="${s.done || i < s.step ? 'done' : i === s.step ? 'now' : ''}">${escapeHtml(TEXT[k].goal)}</li>`).join('');
    return `<h4>First day${s.done ? (s.skipped ? ' · skipped' : ' · done') : ''}</h4><ol class="fd-steps">${rows}</ol>
      ${this.active ? '<div class="forge-actions"><button class="secondary" id="fdSkip">Skip the first day</button></div>' : ''}`;
  }
}
