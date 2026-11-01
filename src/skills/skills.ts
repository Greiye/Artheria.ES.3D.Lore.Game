import * as THREE from 'three';
import { Batch } from '../world/batch';
import { pixelTexture } from '../tex/pixel';
import type { Collider } from '../world/index';
import { escapeHtml } from '../submit';
import { SKILLS, SKILLS_DISCLAIMER, type Skill, type Round } from './content';

// B19 (Mike 2026-10-31): real-skill mini games at the practice table beside the dojo mats. Two kinds of round:
// "order" (tap the steps in the right order) and "pick" (tap everything that helps, leave the rest). Both rounds
// done = the skill's card in the Skills book (Journal). "I've done this for real" is on the honour system.
export const SKILL_TABLE = { x: -7.6, z: 11.2 };
const KEY = 'gametool.skills';
interface CardState { at: number; real: boolean }
interface SkillsState { ack: boolean; cards: Record<string, CardState> }

export function buildSkillTable(scene: THREE.Scene, colliders: Collider[], heightAt: (x: number, z: number) => number): THREE.Object3D {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const { x, z } = SKILL_TABLE, y = heightAt(x, z);
  const B = new Batch();
  const planks = new THREE.MeshLambertMaterial({ map: pixelTexture('planks') }), wood = new THREE.MeshLambertMaterial({ map: pixelTexture('wood') });
  const rope = new THREE.MeshLambertMaterial({ color: 0xC9A66B }), white = new THREE.MeshLambertMaterial({ color: 0xEDE6D6 }), red = new THREE.MeshLambertMaterial({ color: 0xB8432F });
  const stone = new THREE.MeshLambertMaterial({ color: 0x6E6A64 });
  B.box(planks, V(x, y + 0.82, z), 0.9, 0.08, 2.0);   // long along z, the mats to the west
  for (const dx of [-0.36, 0.36]) for (const dz of [-0.85, 0.85]) B.box(wood, V(x + dx, y + 0.4, z + dz), 0.08, 0.8, 0.08);
  // A coil of rope, a first-aid tin with a red cross, a bundle of kindling and a ring of stones beside it.
  B.add(rope, new THREE.TorusGeometry(0.16, 0.035, 6, 14), V(x, y + 0.89, z - 0.6), undefined, 0, Math.PI / 2, 0);
  B.add(rope, new THREE.TorusGeometry(0.11, 0.035, 6, 12), V(x, y + 0.93, z - 0.6), undefined, 0, Math.PI / 2, 0);
  B.box(white, V(x, y + 0.92, z), 0.3, 0.12, 0.22); B.box(red, V(x - 0.152, y + 0.93, z), 0.01, 0.08, 0.025); B.box(red, V(x - 0.152, y + 0.93, z), 0.01, 0.025, 0.08);
  for (let i = 0; i < 6; i++) B.add(wood, new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5), V(x + (i % 3 - 1) * 0.04, y + 0.9 + Math.floor(i / 3) * 0.035, z + 0.6), undefined, 0, Math.PI / 2, 0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.add(stone, new THREE.DodecahedronGeometry(0.13, 0), V(x - 1.3 + Math.cos(a) * 0.45, y + 0.07, z + 1.6 + Math.sin(a) * 0.45)); }
  const meshes = B.flush(scene, 'skill-table');
  meshes.forEach((m) => { m.castShadow = m.receiveShadow = true; m.raycast = () => {}; });
  colliders.push({ kind: 'circle', x, z: z - 0.5, r: 0.55 }, { kind: 'circle', x, z: z + 0.5, r: 0.55 });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 2.2), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, y + 0.7, z); hit.name = 'skill-table'; scene.add(hit);
  return hit;
}

/** A shuffle that never leaves the steps in their right order. */
function shuffled(n: number, seed: number): number[] {
  const a = [...Array(n).keys()];
  let s = seed || 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  do { for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } } while (n > 1 && a.every((v, i) => v === i));
  return a;
}

export class SkillsPanel {
  readonly el: HTMLDivElement;
  st: SkillsState;
  skill: Skill | null = null;
  round = 0;
  /** order rounds: how many steps are placed; pick rounds: which options are tapped. */
  placed = 0;
  tapped = new Set<string>();
  order: number[] = [];
  options: string[] = [];
  note = '';
  mistakes = 0;

  constructor(private onEarn: (s: Skill) => void, private onClose: () => void) {
    try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); this.st = { ack: !!v.ack, cards: v.cards && typeof v.cards === 'object' ? v.cards : {} }; }
    catch { this.st = { ack: false, cards: {} }; }
    this.el = document.createElement('div');
    this.el.id = 'skills';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.st)); } catch { /* blocked */ } }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.skill = null; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.skill = null; this.onClose(); }
  get current(): Round | null { return this.skill?.rounds[this.round] ?? null; }

  start(id: string) {
    this.skill = SKILLS.find((s) => s.id === id) ?? null;
    this.round = 0; this.mistakes = 0; this.setRound(); this.render();
  }
  private setRound() {
    const r = this.current;
    this.placed = 0; this.tapped.clear(); this.note = '';
    if (!r) return;
    const seed = (Date.now() & 0xffff) + this.round * 7919;
    if (r.kind === 'order') this.order = shuffled(r.steps.length, seed);
    else { const all = [...r.right, ...r.wrong.map((w) => w.text)]; this.options = shuffled(all.length, seed).map((i) => all[i]); }
  }
  /** Order rounds: tap the step with this index (its place in the right order). */
  tapStep(i: number): boolean {
    const r = this.current;
    if (!r || r.kind !== 'order') return false;
    if (i === this.placed) { this.placed++; this.note = ''; if (this.placed >= r.steps.length) this.next(); else this.render(); return true; }
    this.mistakes++;
    this.note = this.placed === 0 ? 'Not first. What would you do before anything else?' : `Not yet. What comes right after "${r.steps[this.placed - 1]}"`;
    this.render();
    return false;
  }
  /** Pick rounds: tap an option by its text. */
  tapOption(text: string): boolean {
    const r = this.current;
    if (!r || r.kind !== 'pick' || this.tapped.has(text)) return false;
    this.tapped.add(text);
    const wrong = r.wrong.find((w) => w.text === text);
    if (wrong) { this.mistakes++; this.note = `✗ ${wrong.why}`; this.render(); return false; }
    this.note = '';
    if (r.right.every((t) => this.tapped.has(t))) this.next(); else this.render();
    return true;
  }
  private next() {
    const s = this.skill!;
    this.round++;
    if (this.round < s.rounds.length) { this.setRound(); this.render(); return; }
    const first = !this.st.cards[s.id];
    if (first) { this.st.cards[s.id] = { at: Date.now(), real: false }; this.save(); this.onEarn(s); }
    this.render();
  }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.id === 'skAck') { this.st.ack = true; this.save(); this.render(); }
    else if (b.dataset.skill) this.start(b.dataset.skill);
    else if (b.dataset.step !== undefined) this.tapStep(Number(b.dataset.step));
    else if (b.dataset.opt !== undefined) this.tapOption(this.options[Number(b.dataset.opt)]);
    else if (b.id === 'skReal' && this.skill) { const c = this.st.cards[this.skill.id]; if (c) { c.real = !c.real; this.save(); this.render(); } }
    else if (b.id === 'skBack') { this.skill = null; this.render(); }
    else if (b.id === 'skClose') this.close();
  }

  render() {
    const s = this.skill, r = this.current;
    let body: string;
    if (!this.st.ack) body = `
      <h4>Before you practise</h4>
      <p class="dj-disclaimer">${escapeHtml(SKILLS_DISCLAIMER)}</p>
      <div class="forge-actions"><button class="primary" id="skAck">I understand</button></div>`;
    else if (!s) body = `
      <p class="fine">Real skills, learned by doing. Finish a skill's two rounds to earn its card for your Skills book (Journal).</p>
      <div class="sk-list">${SKILLS.map((k) => `<button class="secondary sk-pick" data-skill="${k.id}"><span class="sk-icon">${k.icon}</span><b>${escapeHtml(k.name)}</b>${this.st.cards[k.id] ? ' <span class="sk-got">card ✓</span>' : ''}<span class="fine">${escapeHtml(k.blurb)}</span></button>`).join('')}</div>`;
    else if (!r) {
      const c = this.st.cards[s.id];
      body = `
      <h4>${s.icon} ${escapeHtml(s.name)}: card earned</h4>
      ${cardHtml(s, c)}
      <p class="dj-safety">⚠ ${escapeHtml(s.safety)}</p>
      <div class="forge-actions"><button class="secondary" id="skReal">${c?.real ? '✓ Done for real' : 'I\'ve done this for real'}</button><button class="secondary" data-skill="${s.id}">Practise again</button><button class="secondary" id="skBack">Other skills</button></div>`;
    } else {
      const head = `<h4>${s.icon} ${escapeHtml(s.name)} · round ${this.round + 1} of ${s.rounds.length}</h4><h5>${escapeHtml(r.title)}</h5><p class="fine">${escapeHtml(r.ask)}</p>`;
      const play = r.kind === 'order'
        ? `<ol class="sk-done">${r.steps.slice(0, this.placed).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ol>
           <div class="sk-steps">${this.order.filter((i) => i >= this.placed).map((i) => `<button class="secondary" data-step="${i}">${escapeHtml(r.steps[i])}</button>`).join('')}</div>`
        : `<div class="sk-steps">${this.options.map((t, i) => { const got = this.tapped.has(t), ok = r.right.includes(t); return `<button class="secondary${got ? (ok ? ' ok' : ' no') : ''}" data-opt="${i}"${got ? ' disabled' : ''}>${got ? (ok ? '✓ ' : '✗ ') : ''}${escapeHtml(t)}</button>`; }).join('')}</div>
           <p class="fine">${r.right.filter((t) => this.tapped.has(t)).length} of ${r.right.length} found.</p>`;
      body = `${head}${play}${this.note ? `<p class="sk-note" role="status">${escapeHtml(this.note)}</p>` : ''}<p class="dj-safety">⚠ ${escapeHtml(s.safety)}</p>
        <div class="forge-actions"><button class="secondary" id="skBack">Other skills</button></div>`;
    }
    this.el.innerHTML = `
      <div class="forge-panel skills-panel">
        <div class="eyebrow">Practice table · real skills</div>
        <h2>Learn by doing</h2>
        ${body}
        <div class="forge-actions"><button class="secondary" id="skClose">Leave the table</button></div>
      </div>`;
  }
}

function cardHtml(s: Skill, c: CardState | undefined): string {
  return `<div class="sk-card"><div class="sk-card-head"><span>${s.icon}</span><b>${escapeHtml(s.card.title)}</b>${c?.real ? '<span class="sk-real">done for real</span>' : ''}</div>
    <ul>${s.card.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul><p class="fine">${escapeHtml(s.card.when)}</p></div>`;
}

/** The Journal's Skills book: one card per skill learned; the rest say where to learn them. */
export class SkillsBook {
  readonly el: HTMLDivElement;
  constructor(private panel: SkillsPanel, private onClose: () => void, private extra: () => string = () => '') {
    this.el = document.createElement('div');
    this.el.id = 'skillsBook';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('#sbClose')) this.close(); });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  render() {
    const cards = this.panel.st.cards;
    this.el.innerHTML = `
      <div class="forge-panel skills-panel">
        <div class="eyebrow">Journal · Skills book</div>
        <h2>Skills book</h2>
        <p class="fine">${Object.keys(cards).length} of ${SKILLS.length} skills learned.</p>
        ${SKILLS.map((s) => cards[s.id] ? cardHtml(s, cards[s.id]) : `<div class="sk-card locked"><div class="sk-card-head"><span>${s.icon}</span><b>${escapeHtml(s.name)}</b></div><p class="fine">Not learned yet. Practise it at the table by the dojo mats.</p></div>`).join('')}
        ${this.extra()}
        <div class="forge-actions"><button class="secondary" id="sbClose">Close</button></div>
      </div>`;
  }
}
