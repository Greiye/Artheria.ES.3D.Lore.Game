import * as THREE from 'three';
import { Batch } from '../world/batch';
import { pixelTexture } from '../tex/pixel';
import type { Collider } from '../world/index';
import { escapeHtml } from '../submit';

// B17 (Mike 2026-11-01): weapon and gear care at the smith's grindstone, outside the smithy. Gear wears with use:
// every sword hit dulls the edge, a trip below leaves rust on the blade, every bolt loosed frays the crossbow string.
// Worn gear still works (it never breaks), it just does less: a dull or rusty blade cuts for less, a frayed string
// throws bolts slower. Caring for it brings it back and shows on the model. The smith (a placeholder NPC, role name
// only) teaches three jobs: sharpen on the whetstone (hold the angle steady), clean and oil the blade, restring the
// crossbow. Doing all three earns the Gear care card in the Skills book. Real-skill notes and a knife-safety note
// first, like the dojo and the practice table.
export const GEAR_DISCLAIMER = 'Blades are sharp and can cut you badly. These are beginner basics to learn about, not training. Only sharpen, clean or handle a real knife or tool with an adult who knows how, and never on your own.';
export const GEAR_SAFETY = 'Knife safety: keep your fingers behind the edge, and stroke or cut away from your body. Never test an edge on your skin. Carry a blade point down, or in a sheath. Put tools away when you finish.';
export const BAND = { lo: 15, hi: 20 };      // degrees: a common angle for kitchen and pocket knives
export const STROKES = 8;
const STROKE_S = 1.2;
const KEY = 'gametool.gear';

export const OIL_STEPS = [
  'Wipe the blade clean of dirt and blood with a damp cloth, spine to edge, never along the edge toward your hand.',
  'Dry it completely. Water left on steel is what rusts it.',
  'Rub a few drops of oil over the whole blade with a cloth.',
  'Wipe off the extra so only a thin film is left.',
  'Put it away dry, in its sheath or on a rack, not in a damp bag.',
];
export const STRING_STEPS = [
  'Check it is unloaded: no bolt on the rail, and the string not drawn back.',
  'Look along the old string for fraying or loose strands.',
  'Use a stringer (a cord that bends the bow for you), never your hands alone.',
  'Seat the new string in both nocks at the ends of the bow.',
  'Ease off the stringer and check the string sits centred on the rail.',
  'Rub a little string wax along it.',
];
export const GEAR_CARD = {
  title: 'Gear care', icon: '⚒',
  lines: [
    'Sharpen: the same steady angle every stroke (about 15–20° for most knives), the same number of strokes each side, edge first.',
    'Clean and oil: wipe, dry completely, a thin film of oil, wipe off the extra, store dry.',
    'Bow strings: unloaded first, a stringer to bend the bow, wax the string, and look for fraying before every use.',
  ],
  when: 'Looking after knives, tools and outdoor gear, with an adult, so they stay safe and last.',
};

export type Job = 'sharpen' | 'oil' | 'string';
export interface GearState { ack: boolean; sharp: number; rust: number; string: number; done: Partial<Record<Job, number>>; card: { at: number; real: boolean } | null }
const fresh = (): GearState => ({ ack: false, sharp: 1, rust: 0, string: 1, done: {}, card: null });
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function loadGear(): GearState {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (!v) return fresh();
    return { ack: !!v.ack, sharp: clamp01(Number(v.sharp ?? 1)), rust: clamp01(Number(v.rust ?? 0)), string: clamp01(Number(v.string ?? 1)), done: v.done && typeof v.done === 'object' ? v.done : {}, card: v.card ?? null };
  } catch { return fresh(); }
}

/** How much a blade cuts for, 0..1: dull and rust both take off. */
export const swordSharpness = (g: GearState) => g.sharp * (1 - 0.35 * g.rust);
/** How hard the crossbow throws, 0..1: a frayed string loses power. */
export const bowPower = (g: GearState) => (g.string < 0.5 ? 0.75 : 1);
export const conditionWord = (k: number) => (k > 0.8 ? 'keen' : k > 0.55 ? 'worn' : 'dull');

// ---------- the grindstone ----------
export function grindstonePos(lot: { x: number; z: number; ry: number; w: number; d: number }) {
  const c = Math.cos(lot.ry), s = Math.sin(lot.ry), lx = lot.w / 2 - 0.9, lz = lot.d / 2 + 1.1;
  return { x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c, ry: lot.ry };
}
/** A treadle grindstone on a wooden frame, a whetstone and an oil pot on the bench beside it. Returns the hit box and the wheel (it turns while you work). */
export function buildGrindstone(scene: THREE.Scene, colliders: Collider[], at: { x: number; z: number; ry: number }, y: number): { hit: THREE.Mesh; wheel: THREE.Object3D } {
  const g = new THREE.Group(); g.position.set(at.x, y, at.z); g.rotation.y = at.ry; scene.add(g);
  const B = new Batch(), V = (x: number, yy: number, z: number) => new THREE.Vector3(x, yy, z);
  const wood = new THREE.MeshLambertMaterial({ map: pixelTexture('wood') }), planks = new THREE.MeshLambertMaterial({ map: pixelTexture('planks') });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3A3A3E }), clay = new THREE.MeshLambertMaterial({ color: 0x8A5A3A }), grey = new THREE.MeshLambertMaterial({ color: 0x7C776E });
  for (const dz of [-0.24, 0.24]) { B.box(wood, V(0, 0.42, dz), 0.1, 0.84, 0.1); }
  B.box(wood, V(0, 0.12, 0), 0.9, 0.08, 0.56);                                   // base
  B.box(wood, V(0, 0.84, 0), 0.12, 0.06, 0.6);                                    // axle bearer
  B.box(dark, V(0, 0.08, 0.38), 0.5, 0.05, 0.12);                                 // treadle
  B.box(planks, V(0.9, 0.72, 0), 0.6, 0.06, 0.5);                                 // bench
  for (const dx of [0.66, 1.14]) for (const dz of [-0.2, 0.2]) B.box(wood, V(dx, 0.35, dz), 0.06, 0.7, 0.06);
  B.box(grey, V(0.85, 0.78, -0.08), 0.26, 0.05, 0.07);                            // whetstone
  B.add(clay, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), V(1.02, 0.8, 0.12));  // oil pot
  const meshes = B.flush(g, 'grindstone');
  meshes.forEach((m) => { m.castShadow = m.receiveShadow = true; m.raycast = () => {}; });
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 14), new THREE.MeshLambertMaterial({ color: 0x9C968A }));
  wheel.rotation.x = Math.PI / 2; wheel.castShadow = true; wheel.raycast = () => {};
  const spin = new THREE.Group(); spin.name = 'grind-wheel'; spin.position.set(0, 0.84, 0); spin.add(wheel); g.add(spin);   // turns about z (the axle)
  colliders.push({ kind: 'circle', x: at.x, z: at.z, r: 0.5 });
  const wp = new THREE.Vector3(0.9, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), at.ry);
  colliders.push({ kind: 'circle', x: at.x + wp.x, z: at.z + wp.z, r: 0.4 });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0.45, 0.65, 0); hit.name = 'grindstone'; g.add(hit);
  return { hit, wheel: spin };
}

// ---------- the care panel ----------
function shuffled(n: number): number[] {
  const a = [...Array(n).keys()];
  do { for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } } while (n > 1 && a.every((v, i) => v === i));
  return a;
}

export class GearPanel {
  readonly el: HTMLDivElement;
  st: GearState = loadGear();
  job: Job | null = null;
  // sharpen
  angle = 26; holding = false; stroke = 0; strokeT = 0; inBand = 0; good = 0;
  // order jobs
  placed = 0; order: number[] = []; note = ''; noteOk = false;
  /** Has the player got a sword / a crossbow (only those jobs can be done). */
  has: { sword: () => boolean; crossbow: () => boolean } = { sword: () => false, crossbow: () => false };
  onChange: () => void = () => undefined;
  onCard: () => void = () => undefined;
  onStroke: (good: boolean) => void = () => undefined;
  private drift = 0;

  constructor(private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'gear';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    const hold = (on: boolean) => (e: Event) => { if ((e.target as HTMLElement).closest('#gHold')) { e.preventDefault(); this.holding = on; } };
    this.el.addEventListener('pointerdown', hold(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.el.addEventListener(ev, (e) => { if (this.holding && (e.type !== 'pointerleave' || (e.target as HTMLElement).closest('#gHold'))) this.holding = false; });
    window.addEventListener('keydown', (e) => { if (this.job === 'sharpen' && this.isOpen && e.code === 'Space') { e.preventDefault(); this.holding = true; } });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.holding = false; });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.st)); } catch { /* blocked */ } }
  open() { this.st = loadGear(); this.job = null; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.job = null; this.holding = false; this.onClose(); }

  // ----- wear, from play -----
  wearSword(hits: number) { if (!hits) return; this.st.sharp = Math.max(0.35, this.st.sharp - 0.04 * hits); this.save(); this.onChange(); }
  rustSword() { this.st.rust = Math.min(1, this.st.rust + 0.25); this.save(); this.onChange(); }
  wearString() { this.st.string = Math.max(0.3, this.st.string - 0.03); this.save(); this.onChange(); }

  start(job: Job) {
    if (job !== 'string' && !this.has.sword()) { this.note = 'Bring a blade first. The practice sword is on the stand by the door.'; this.render(); return; }
    if (job === 'string' && !this.has.crossbow()) { this.note = 'You have no crossbow to restring yet.'; this.render(); return; }
    this.job = job; this.note = ''; this.noteOk = false;
    if (job === 'sharpen') { this.angle = 26; this.stroke = 0; this.strokeT = 0; this.inBand = 0; this.good = 0; this.holding = false; this.drift = 0; }
    else { this.placed = 0; this.order = shuffled((job === 'oil' ? OIL_STEPS : STRING_STEPS).length); }
    this.render();
  }

  /** Each frame while the panel is open. Sharpening: the blade tips flat unless you hold it up; keep it in the band. */
  update(dt: number) {
    if (!this.isOpen || this.job !== 'sharpen' || this.stroke >= STROKES) return;
    this.drift += (Math.random() - 0.5) * dt * 30;
    this.drift = THREE.MathUtils.clamp(this.drift, -6, 6);
    this.angle = THREE.MathUtils.clamp(this.angle + ((this.holding ? 13 : -9) + this.drift) * dt, 0, 45);
    const ok = this.angle >= BAND.lo && this.angle <= BAND.hi;
    if (ok) this.inBand += dt;
    this.strokeT += dt;
    if (this.strokeT >= STROKE_S) this.endStroke();
    this.paintGauge();
  }
  private endStroke() {
    const good = this.inBand / this.strokeT >= 0.6;
    this.stroke++; this.strokeT = 0; this.inBand = 0;
    if (good) { this.good++; this.st.sharp = Math.min(1, this.st.sharp + 0.12); this.save(); this.onChange(); }
    this.note = good ? `Stroke ${this.stroke}: clean. ${this.stroke < STROKES ? 'Again, the same angle.' : ''}` : this.angle > BAND.hi ? `Stroke ${this.stroke}: too steep. That rounds the edge off.` : `Stroke ${this.stroke}: too flat. That only scratches the side.`;
    this.noteOk = good;
    this.onStroke(good);
    if (this.stroke >= STROKES) this.finish('sharpen');
    else this.render();
  }
  tapStep(i: number): boolean {
    this.noteOk = false;
    if (this.job !== 'oil' && this.job !== 'string') return false;
    const steps = this.job === 'oil' ? OIL_STEPS : STRING_STEPS;
    if (i === this.placed) { this.placed++; this.note = ''; if (this.placed >= steps.length) this.finish(this.job); else this.render(); return true; }
    this.note = this.placed === 0 ? 'Not first. The smith shakes their head: what comes before anything else?' : `Not yet. What comes right after "${steps[this.placed - 1]}"`;
    this.render();
    return false;
  }
  private finish(job: Job) {
    if (job === 'oil') this.st.rust = 0;
    if (job === 'string') this.st.string = 1;
    if (job !== 'sharpen' || this.good >= STROKES / 2) this.st.done[job] = Date.now();
    const learned = (['sharpen', 'oil', 'string'] as Job[]).every((j) => this.st.done[j]);
    const first = learned && !this.st.card;
    if (first) this.st.card = { at: Date.now(), real: false };
    this.save(); this.onChange();
    if (job === 'sharpen' && this.good < STROKES / 2) this.note = `${this.good} of ${STROKES} strokes were clean. Try again: hold the angle in the gold band.`;
    else this.note = job === 'sharpen' ? `${this.good} of ${STROKES} strokes clean. The edge is ${conditionWord(this.st.sharp)}.` : job === 'oil' ? 'Clean, oiled and dry. The rust is gone.' : 'A new string, waxed and centred. Full power again.';
    this.noteOk = !(job === 'sharpen' && this.good < STROKES / 2);
    this.job = null;
    this.render();
    if (first) this.onCard();
  }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.id === 'gAck') { this.st.ack = true; this.save(); this.render(); }
    else if (b.dataset.job) this.start(b.dataset.job as Job);
    else if (b.dataset.step !== undefined) this.tapStep(Number(b.dataset.step));
    else if (b.id === 'gReal' && this.st.card) { this.st.card.real = !this.st.card.real; this.save(); this.render(); }
    else if (b.id === 'gBack') { this.job = null; this.note = ''; this.render(); }
    else if (b.id === 'gClose') this.close();
  }

  private bar(label: string, k: number, word: string) {
    return `<div class="g-bar"><span>${label}</span><div class="g-track"><div class="g-fill" style="width:${Math.round(k * 100)}%"></div></div><span class="g-word">${word}</span></div>`;
  }
  private paintGauge() {
    const n = this.el.querySelector<HTMLElement>('.g-needle'), t = this.el.querySelector('#gAngle');
    if (n) n.style.transform = `rotate(${-this.angle}deg)`;
    if (t) t.textContent = `${Math.round(this.angle)}°`;
    const s = this.el.querySelector<HTMLElement>('.g-stroke');
    if (s) s.style.width = `${Math.min(100, (this.strokeT / STROKE_S) * 100)}%`;
    this.el.querySelector('.g-gauge')?.classList.toggle('in', this.angle >= BAND.lo && this.angle <= BAND.hi);
  }

  render() {
    const st = this.st, J = this.job;
    let body: string;
    if (!st.ack) body = `
      <h4>Before you start</h4>
      <p class="dj-disclaimer">${escapeHtml(GEAR_DISCLAIMER)}</p>
      <p class="dj-safety">⚠ ${escapeHtml(GEAR_SAFETY)}</p>
      <div class="forge-actions"><button class="primary" id="gAck">I understand</button></div>`;
    else if (J === 'sharpen') body = `
      <h4>Sharpen on the whetstone · stroke ${Math.min(this.stroke + 1, STROKES)} of ${STROKES}</h4>
      <p class="fine">The smith: "Same angle, every stroke. Keep the blade in the gold band." Hold <b>Lift</b> (or Space) to raise the spine; let go and it tips flat.</p>
      <div class="g-gauge"><div class="g-band" style="--lo:${BAND.lo};--hi:${BAND.hi}"></div><div class="g-needle"></div><div class="g-stone"></div><span id="gAngle">${Math.round(this.angle)}°</span></div>
      <div class="g-strokebar"><div class="g-stroke"></div></div>
      <p class="fine">${this.good} clean so far.</p>
      ${this.note ? `<p class="sk-note${this.noteOk ? ' g-ok' : ''}" role="status">${escapeHtml(this.note)}</p>` : ''}
      <button class="primary g-hold" id="gHold">Lift</button>
      <div class="forge-actions"><button class="secondary" id="gBack">Stop</button></div>`;
    else if (J === 'oil' || J === 'string') {
      const steps = J === 'oil' ? OIL_STEPS : STRING_STEPS;
      body = `
      <h4>${J === 'oil' ? 'Clean and oil the blade' : 'Restring the crossbow'}</h4>
      <p class="fine">The smith shows you once. Tap the steps in order.</p>
      <ol class="sk-done">${steps.slice(0, this.placed).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ol>
      <div class="sk-steps">${this.order.filter((i) => i >= this.placed).map((i) => `<button class="secondary" data-step="${i}">${escapeHtml(steps[i])}</button>`).join('')}</div>
      ${this.note ? `<p class="sk-note${this.noteOk ? ' g-ok' : ''}" role="status">${escapeHtml(this.note)}</p>` : ''}
      <div class="forge-actions"><button class="secondary" id="gBack">Stop</button></div>`;
    } else {
      const sw = this.has.sword(), cb = this.has.crossbow(), k = swordSharpness(st);
      body = `
      <p class="fine">The smith keeps a grindstone, a whetstone and a pot of oil here, and will show you how to look after what you carry. Worn gear still works; cared-for gear works better.</p>
      ${sw ? this.bar('Edge', st.sharp, conditionWord(st.sharp)) + this.bar('Clean', 1 - st.rust, st.rust > 0.4 ? 'rusty' : st.rust > 0 ? 'spotted' : 'bright') : '<p class="fine">No blade with you. The practice sword stands by the smithy door.</p>'}
      ${cb ? this.bar('String', st.string, st.string < 0.5 ? 'frayed' : st.string < 0.85 ? 'worn' : 'sound') : ''}
      ${sw ? `<p class="fine">Your sword cuts at ${Math.round(k * 100)}%.</p>` : ''}
      <div class="sk-list">
        <button class="secondary sk-pick" data-job="sharpen"${sw ? '' : ' disabled'}><span class="sk-icon">🗡</span><b>Sharpen</b>${st.done.sharpen ? ' <span class="sk-got">✓</span>' : ''}<span class="fine">Hold the angle on the whetstone, eight strokes.</span></button>
        <button class="secondary sk-pick" data-job="oil"${sw ? '' : ' disabled'}><span class="sk-icon">🫙</span><b>Clean and oil</b>${st.done.oil ? ' <span class="sk-got">✓</span>' : ''}<span class="fine">Take the rust off and keep it off.</span></button>
        <button class="secondary sk-pick" data-job="string"${cb ? '' : ' disabled'}><span class="sk-icon">🏹</span><b>Restring the crossbow</b>${st.done.string ? ' <span class="sk-got">✓</span>' : ''}<span class="fine">A new string, safely.</span></button>
      </div>
      ${this.note ? `<p class="sk-note${this.noteOk ? ' g-ok' : ''}" role="status">${escapeHtml(this.note)}</p>` : ''}
      ${st.card ? `${gearCardHtml(st)}<div class="forge-actions"><button class="secondary" id="gReal">${st.card.real ? '✓ Done for real' : 'I\'ve done this for real'}</button></div>` : '<p class="fine">Do all three once to earn the Gear care card for your Skills book.</p>'}
      <p class="dj-safety">⚠ ${escapeHtml(GEAR_SAFETY)}</p>`;
    }
    this.el.innerHTML = `
      <div class="forge-panel skills-panel gear-panel">
        <div class="eyebrow">Smithy · the grindstone</div>
        <h2>Gear care</h2>
        ${body}
        <div class="forge-actions"><button class="secondary" id="gClose">Leave the grindstone</button></div>
      </div>`;
    this.paintGauge();
  }
}

export function gearCardHtml(st: GearState): string {
  const c = GEAR_CARD;
  return `<div class="sk-card gear-card"><div class="sk-card-head"><span>${c.icon}</span><b>${escapeHtml(c.title)}</b>${st.card?.real ? '<span class="sk-real">done for real</span>' : ''}</div>
    <ul>${c.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul><p class="fine">${escapeHtml(c.when)}</p></div>`;
}
