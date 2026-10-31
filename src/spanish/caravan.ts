import * as THREE from 'three';
import { Batch } from '../world/batch';
import { pixelTexture } from '../tex/pixel';
import { buildFigure } from '../world/figure';
import type { Collider } from '../world/index';
import { rollTownsfolk } from '../traits/townsfolk';
import { escapeHtml } from '../submit';
import { TALKS, type Talk, type Line } from './talks';

// B16 (Mike 2026-10-31): a Spanish-speaking caravan camped beside the coach road, west of the glade. Its three
// people (role names only) speak Spanish and are never translated. You answer by picking a Spanish reply or by
// writing one; a picture, a gesture and "listen again" help a beginner. Every line you get through goes into the
// phrasebook, where you write down what you think it means (the game never tells you).
export const CARAVAN = { x: -20, z: 1.8 };
const KEY = 'gametool.spanish';
export interface Phrase { es: string; who: string; note: string }
interface SpanishState { step: Record<string, number>; done: string[]; phrases: Phrase[]; write: boolean }

export interface CaravanFolk { id: string; talk: Talk; root: THREE.Group; hit: THREE.Mesh; stand: THREE.Vector3 }

export function buildCaravan(scene: THREE.Scene, colliders: Collider[], heightAt: (x: number, z: number) => number): CaravanFolk[] {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const { x, z } = CARAVAN, y = heightAt(x, z);
  const B = new Batch();
  const wood = new THREE.MeshLambertMaterial({ map: pixelTexture('wood') }), planks = new THREE.MeshLambertMaterial({ map: pixelTexture('planks') });
  const canvas = new THREE.MeshLambertMaterial({ color: 0xE6D6B0, side: THREE.DoubleSide }), red = new THREE.MeshLambertMaterial({ color: 0xB8432F });
  const ochre = new THREE.MeshLambertMaterial({ color: 0xD99A2B }), teal = new THREE.MeshLambertMaterial({ color: 0x2F7F86 }), iron = new THREE.MeshLambertMaterial({ color: 0x2E2A28 });
  const mule = new THREE.MeshLambertMaterial({ color: 0x7A5A44 });
  // The wagon, side-on to the road: bed, painted boards, a canvas hood on hoops, four wheels and a shaft.
  B.box(planks, V(x, y + 0.95, z), 3.6, 0.16, 1.7);
  B.box(red, V(x, y + 1.25, z - 0.86), 3.6, 0.46, 0.06); B.box(red, V(x, y + 1.25, z + 0.86), 3.6, 0.46, 0.06);
  B.box(ochre, V(x, y + 1.25, z - 0.9), 3.4, 0.08, 0.02);
  B.add(canvas, new THREE.CylinderGeometry(1.0, 1.0, 3.4, 12, 1, true, -Math.PI / 2, Math.PI), V(x, y + 1.45, z), new THREE.Vector3(1, 1, 0.9), 0, 0, Math.PI / 2);
  for (const dx of [-1.3, 1.3]) for (const dz of [-0.95, 0.95])
    B.add(wood, new THREE.CylinderGeometry(0.52, 0.52, 0.1, 10), V(x + dx, y + 0.52, z + dz), undefined, 0, Math.PI / 2, 0);
  B.add(wood, new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), V(x + 2.7, y + 0.7, z), undefined, 0, 0, Math.PI / 2 - 0.12);
  // The Muleteer's mule, by the shaft.
  const mx = x + 3.9, mz = z - 0.6;
  B.box(mule, V(mx, y + 1.0, mz), 1.3, 0.55, 0.5); B.box(mule, V(mx + 0.75, y + 1.35, mz), 0.3, 0.6, 0.3, 0);
  B.box(mule, V(mx + 0.95, y + 1.55, mz), 0.45, 0.25, 0.26);
  for (const dx of [-0.5, 0.5]) for (const dz of [-0.17, 0.17]) B.box(mule, V(mx + dx, y + 0.38, mz + dz), 0.12, 0.76, 0.12);
  B.box(teal, V(mx, y + 1.3, mz), 0.6, 0.06, 0.56);
  // The Cook's fire and pot; the Weaver's frame with shawls.
  const cx = x - 2.8, cz = z - 2.2;
  B.add(iron, new THREE.CylinderGeometry(0.32, 0.26, 0.36, 10), V(cx, y + 0.5, cz));
  for (const a of [0, 2.1, 4.2]) B.add(wood, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), V(cx + Math.sin(a) * 0.35, y + 0.4, cz + Math.cos(a) * 0.35), undefined, a, 0.35, 0);
  const wx = x - 0.2, wz = z - 2.6;
  B.box(wood, V(wx - 0.8, y + 0.8, wz), 0.08, 1.6, 0.08); B.box(wood, V(wx + 0.8, y + 0.8, wz), 0.08, 1.6, 0.08); B.box(wood, V(wx, y + 1.55, wz), 1.7, 0.07, 0.07);
  B.box(red, V(wx - 0.45, y + 1.1, wz), 0.5, 0.85, 0.03); B.box(teal, V(wx + 0.1, y + 1.15, wz), 0.45, 0.75, 0.03); B.box(ochre, V(wx + 0.55, y + 1.05, wz), 0.38, 0.95, 0.03);
  B.box(wood, V(x - 1.6, y + 0.25, z - 1.4), 0.6, 0.5, 0.5, 0.3); B.box(wood, V(x + 1.9, y + 0.22, z - 1.3), 0.5, 0.44, 0.44, -0.2);
  const meshes = B.flush(scene, 'caravan');
  meshes.forEach((m) => { m.castShadow = m.receiveShadow = true; m.raycast = () => {}; });
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFF8A3A }));
  embers.position.set(cx, y + 0.06, cz); embers.raycast = () => {}; scene.add(embers);
  colliders.push(
    { kind: 'circle', x: x - 1.1, z, r: 1.0 }, { kind: 'circle', x: x + 1.1, z, r: 1.0 }, { kind: 'circle', x: mx, z: mz, r: 0.8 },
    { kind: 'circle', x: cx, z: cz, r: 0.4 }, { kind: 'circle', x: wx - 0.8, z: wz, r: 0.12 }, { kind: 'circle', x: wx + 0.8, z: wz, r: 0.12 },
  );
  // The three people, standing toward the road, each with an invisible box to look at and press E on.
  const spots: Record<string, [number, number, number]> = { cook: [cx + 0.75, cz - 0.15, -1.2], weaver: [wx, wz - 0.7, Math.PI], muleteer: [mx - 0.4, mz - 1.0, Math.PI * 0.85] };
  return TALKS.map((talk, i) => {
    const [px, pz, yaw] = spots[talk.id], r = rollTownsfolk(9100 + i * 37);
    const root = buildFigure({ ...r.look, ...talk.look }, r.height);
    root.position.set(px, heightAt(px, pz), pz); root.rotation.y = yaw; root.name = 'caravan:' + talk.id;
    root.userData.folk = { id: 'caravan:' + talk.id, name: talk.role, role: 'chat', root, speed: 0, talking: false, pose: null, active: true };
    scene.add(root);
    colliders.push({ kind: 'circle', x: px, z: pz, r: 0.3 });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(px, root.position.y + 0.95, pz); hit.name = 'caravan-hit:' + talk.id; scene.add(hit);
    const stand = new THREE.Vector3(px + Math.sin(yaw) * 1.6, 0, pz + Math.cos(yaw) * 1.6);
    return { id: talk.id, talk, root, hit, stand };
  });
}

/** Lower case, no accents, no ¡¿!?.,; so "¡Sí, claro!" and "si claro" match. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¡¿!?.,;:"'()]/g, ' ').replace(/\s+/g, ' ').trim();
export function accepts(line: Line, typed: string): boolean {
  const t = ` ${norm(typed)} `;
  if (t.trim().length < 2) return false;
  if ((line.wrongTyped ?? []).some((w) => t.includes(` ${norm(w)} `))) return false;
  return line.typed.some((w) => t.includes(` ${norm(w)} `));
}
const PUZZLED = [
  { es: '¿Cómo?', cue: '🤷', gesture: 'tilts their head and waits.' },
  { es: 'No te entiendo.', cue: '😕', gesture: 'frowns kindly and shrugs.' },
  { es: '¿Perdón? Otra vez, por favor.', cue: '👂', gesture: 'cups a hand to their ear.' },
];

export class CaravanPanel {
  readonly el: HTMLDivElement;
  st: SpanishState;
  talk: Talk | null = null;
  /** The last wrong reply, shown as the NPC's puzzled answer (in Spanish). */
  private puzzled: typeof PUZZLED[number] | null = null;
  private struck = new Set<number>();
  private lastSaid = '';
  /** Speaks a Spanish line aloud (es-ES), when the browser can. */
  speak: (es: string) => void = (es) => {
    try {
      if (navigator.webdriver || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(es); u.lang = 'es-ES'; u.rate = 0.85;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* no voice */ }
  };

  constructor(private onTalk: (t: Talk | null) => void, private onDone: (t: Talk) => void, private onClose: () => void, private heroName: () => string) {
    this.st = this.load();
    this.el = document.createElement('div');
    this.el.id = 'caravan';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('submit', (e) => { e.preventDefault(); this.tryTyped(); });
  }
  private load(): SpanishState {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      return { step: v.step && typeof v.step === 'object' ? v.step : {}, done: Array.isArray(v.done) ? v.done : [], phrases: Array.isArray(v.phrases) ? v.phrases : [], write: !!v.write };
    } catch { return { step: {}, done: [], phrases: [], write: false }; }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.st)); } catch { /* blocked */ } }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get talking() { return this.isOpen && !!this.talk; }

  open(t: Talk) {
    this.talk = t; this.puzzled = null; this.struck.clear();
    if ((this.st.step[t.id] ?? 0) >= t.lines.length) this.st.step[t.id] = 0;   // a finished talk starts over
    this.render(); this.el.classList.remove('hidden'); this.onTalk(t);
    this.say();
  }
  close() { if (!this.isOpen) return; try { speechSynthesis?.cancel(); } catch { /* none */ } this.el.classList.add('hidden'); this.talk = null; this.onTalk(null); this.onClose(); }

  get line(): Line | null { return this.talk ? this.talk.lines[this.st.step[this.talk.id] ?? 0] ?? null : null; }
  private fill(s: string) { return s.replace('{name}', this.heroName() || 'Viajero'); }
  private say() { const l = this.line; if (l) { this.lastSaid = this.fill(l.es); this.speak(this.lastSaid); } }

  addPhrase(es: string, who: string) {
    if (!es || this.st.phrases.some((p) => p.es === es)) return;
    this.st.phrases.push({ es, who, note: '' });
  }
  /** Answer the current line with option i (or a typed reply). Returns true when it was understood. */
  answer(i: number | string): boolean {
    const t = this.talk, l = this.line;
    if (!t || !l) return false;
    const ok = typeof i === 'number' ? !!l.answers[i]?.ok : accepts(l, i);
    if (!ok) {
      if (typeof i === 'number') this.struck.add(i);
      this.puzzled = PUZZLED[(this.struck.size + (typeof i === 'string' ? 1 : 0)) % PUZZLED.length];
      this.speak(this.puzzled.es);
      this.render();
      return false;
    }
    this.addPhrase(this.fill(l.es), t.role);
    this.addPhrase(typeof i === 'number' ? this.fill(l.answers[i].es) : i.trim().slice(0, 80), 'you');
    this.puzzled = null; this.struck.clear();
    const next = (this.st.step[t.id] ?? 0) + 1;
    this.st.step[t.id] = next;
    if (next >= t.lines.length) {
      const first = !this.st.done.includes(t.id);
      if (first) this.st.done.push(t.id);
      this.save(); this.render();
      if (first) this.onDone(t);
      return true;
    }
    this.save(); this.render(); this.say();
    return true;
  }
  private tryTyped() { const inp = this.el.querySelector<HTMLInputElement>('#esType'); if (inp && inp.value.trim()) this.answer(inp.value); }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.dataset.ans !== undefined) this.answer(Number(b.dataset.ans));
    else if (b.id === 'esListen') this.speak(this.puzzled ? this.puzzled.es : this.lastSaid);
    else if (b.id === 'esMode') { this.st.write = !this.st.write; this.save(); this.render(); this.el.querySelector<HTMLInputElement>('#esType')?.focus(); }
    else if (b.id === 'esAgain' && this.talk) { this.st.step[this.talk.id] = 0; this.save(); this.render(); this.say(); }
    else if (b.id === 'esClose') this.close();
  }

  render() {
    const t = this.talk;
    if (!t) return;
    const l = this.line, finished = !l;
    const shown = this.puzzled ?? (l ? { es: this.fill(l.es), cue: l.cue, gesture: l.gesture } : { ...t.farewell, es: this.fill(t.farewell.es) });
    const choices = !l ? '' : this.st.write
      ? `<form class="es-write"><input id="esType" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="80" placeholder="Escribe en español…" lang="es"><button class="primary" type="submit">✓</button></form>`
      : `<div class="es-answers">${l.answers.map((a, i) => `<button class="secondary${this.struck.has(i) ? ' struck' : ''}" data-ans="${i}"${this.struck.has(i) ? ' disabled' : ''} lang="es">${escapeHtml(this.fill(a.es))}</button>`).join('')}</div>`;
    this.el.innerHTML = `
      <div class="forge-panel caravan-panel">
        <div class="eyebrow">Caravan · solo en español</div>
        <h2 lang="es">${escapeHtml(t.role)}</h2>
        <div class="es-cue" aria-hidden="true">${shown.cue}</div>
        <blockquote class="es-line" lang="es">${escapeHtml(shown.es)}</blockquote>
        <p class="es-gesture"><i>${escapeHtml(t.pronoun)} ${escapeHtml(shown.gesture)}</i></p>
        ${finished ? `<p class="fine">Every line you got through is in your phrasebook (Journal → Phrasebook).</p>
          <div class="forge-actions"><button class="secondary" id="esAgain">Talk again</button></div>` : choices}
        <div class="forge-actions es-tools">
          <button class="secondary" id="esListen" title="Hear it again">🔊 Otra vez</button>
          ${finished ? '' : `<button class="secondary" id="esMode">${this.st.write ? 'Pick a reply' : 'Write my reply'}</button>`}
          <button class="secondary" id="esClose">Adiós</button>
        </div>
      </div>`;
  }
}

/** The Journal's phrasebook: every Spanish line you got through, with your own guess at its meaning. */
export class Phrasebook {
  readonly el: HTMLDivElement;
  constructor(private panel: CaravanPanel, private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'phrasebook';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('#pbClose')) this.close(); });
    this.el.addEventListener('change', (e) => {
      const inp = e.target as HTMLInputElement;
      const p = this.panel.st.phrases[Number(inp.dataset.i)];
      if (p) { p.note = inp.value.trim().slice(0, 120); this.panel.save(); }
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  render() {
    const ps = this.panel.st.phrases;
    this.el.innerHTML = `
      <div class="forge-panel phrasebook-panel">
        <div class="eyebrow">Journal · Phrasebook</div>
        <h2>Phrasebook</h2>
        <p class="fine">Lines from the caravan, in the words they were said. Write what you think each one means; nobody will tell you.</p>
        ${ps.length ? `<ol class="pb-list">${ps.map((p, i) => `<li><span class="pb-es" lang="es">${escapeHtml(p.es)}</span><span class="fine">${p.who === 'you' ? 'you said' : escapeHtml(p.who)}</span>
          <input type="text" data-i="${i}" maxlength="120" value="${escapeHtml(p.note)}" placeholder="What I think it means" aria-label="What I think it means"></li>`).join('')}</ol>`
          : '<p class="fine">Empty. The caravan camps by the coach road, west of the glade.</p>'}
        <div class="forge-actions"><button class="secondary" id="pbClose">Close</button></div>
      </div>`;
  }
}
