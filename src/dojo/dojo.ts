import * as THREE from 'three';
import data from '../../content/dojo/drills.json';
import { Batch } from '../world/batch';
import { pixelTexture } from '../tex/pixel';
import type { Collider } from '../world/index';
import type { Pose } from '../anim/procedural';
import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';

// B14 dojo: follow-along training. Your own character demonstrates each drill on the mats; the panel
// gives your real-life, beginner-safe version. Risky moves (hanging upside down, punching water) are
// done by the character only (docs/backlog.md B14 safety framing). Reps are on the honour system.
export const DOJO = { x: -14, z: 14, bar: new THREE.Vector3(-12, 0, 16.4) };
export type Drill = typeof data.drills[number] & { characterOnly?: boolean };
export const DRILLS = data.drills as Drill[];
const KEY = 'gametool.dojo';
interface DojoState { ack: boolean; done: string[]; taught: { name: string; how: string; safe: string }[] }

export function buildDojo(scene: THREE.Scene, colliders: Collider[]): THREE.Object3D {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const B = new Batch();
  const planks = new THREE.MeshLambertMaterial({ map: pixelTexture('planks') }), wood = new THREE.MeshLambertMaterial({ map: pixelTexture('wood') });
  const matR = new THREE.MeshLambertMaterial({ color: 0xA8423A }), matB = new THREE.MeshLambertMaterial({ color: 0x3E6FA8 });
  const { x, z } = DOJO;
  B.add(planks, new THREE.BoxGeometry(8, 0.2, 7), V(x, 0.1, z));
  for (let i = 0; i < 4; i++) B.box(i % 2 ? matB : matR, V(x - 1.8 + (i % 2) * 1.6, 0.22, z - 1 + Math.floor(i / 2) * 1.6), 1.5, 0.04, 1.5);
  for (const [px, pz] of [[-3.8, -3.3], [3.8, -3.3], [-3.8, 3.3], [3.8, 3.3]]) B.box(wood, V(x + px, 1.4, z + pz), 0.2, 2.8, 0.2);
  // The bar (for the hanging drill) with a bowl below and one on a shelf above.
  const bx = DOJO.bar.x, bz = DOJO.bar.z;
  B.box(wood, V(bx - 0.9, 1.3, bz), 0.14, 2.6, 0.14); B.box(wood, V(bx + 0.9, 1.3, bz), 0.14, 2.6, 0.14);
  B.add(wood, new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6), V(bx, 2.3, bz), undefined, 0, 0, Math.PI / 2);
  B.box(planks, V(bx, 2.62, bz - 0.25), 1.9, 0.06, 0.3);
  B.add(wood, new THREE.CylinderGeometry(0.2, 0.14, 0.12, 8), V(bx, 0.27, bz), undefined);
  B.add(wood, new THREE.CylinderGeometry(0.16, 0.11, 0.1, 8), V(bx + 0.4, 2.7, bz - 0.25), undefined);
  // Water barrel (eyes-open drill), and a scroll board with the drills.
  B.add(wood, new THREE.CylinderGeometry(0.35, 0.32, 0.9, 8), V(x - 3, 0.65, z + 2.3));
  B.box(wood, V(x + 3.2, 1.1, z - 2.6), 1.4, 1.6, 0.12, -0.5);
  B.box(planks, V(x + 3.2, 1.25, z - 2.52), 1.1, 1.1, 0.04, -0.5);
  const meshes = B.flush(scene, 'dojo');
  meshes.forEach((m) => { m.castShadow = m.receiveShadow = true; m.raycast = () => {}; });
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.32, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5FA8D8 }));
  water.position.set(x - 3, 1.11, z + 2.3); water.raycast = () => {}; scene.add(water);
  colliders.push({ kind: 'circle', x: x - 3, z: z + 2.3, r: 0.4 }, { kind: 'circle', x: bx - 0.9, z: bz, r: 0.15 }, { kind: 'circle', x: bx + 0.9, z: bz, r: 0.15 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  board.position.set(x + 3.2, 1.1, z - 2.4); board.name = 'dojo-board';
  scene.add(board);
  return board;
}

export class DojoPanel {
  readonly el: HTMLDivElement;
  st: DojoState;
  drill: Drill = DRILLS[0];
  count = 0;
  private timer = 0;
  private running = false;

  constructor(private onDrill: (d: Drill | null) => void, private onClose: () => void, private author: () => string) {
    try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); this.st = { ack: !!v.ack, done: Array.isArray(v.done) ? v.done : [], taught: Array.isArray(v.taught) ? v.taught : [] }; }
    catch { this.st = { ack: false, done: [], taught: [] }; }
    this.el = document.createElement('div');
    this.el.id = 'dojo';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get pose(): Pose | null { return this.isOpen && this.st.ack ? this.drill.pose as Pose : null; }
  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.st)); } catch { /* blocked */ } }
  open() { this.count = 0; this.running = false; this.render(); this.el.classList.remove('hidden'); this.onDrill(this.st.ack ? this.drill : null); }
  close() { if (!this.isOpen) return; this.running = false; this.el.classList.add('hidden'); this.onDrill(null); this.onClose(); }

  // Hold drills count seconds while running; called from the game loop.
  tick(dt: number) {
    if (!this.running || this.drill.kind !== 'hold') return;
    this.timer += dt;
    if (this.timer >= 1) { this.timer -= 1; this.bump(); }
  }
  bump() {
    this.count = Math.min(this.drill.target, this.count + 1);
    if (this.count >= this.drill.target) { this.running = false; if (!this.st.done.includes(this.drill.id)) { this.st.done.push(this.drill.id); this.save(); } this.render(); }
    else { const c = this.el.querySelector('.dj-count'); if (c) c.textContent = this.countText(); }
  }
  private countText() { return this.drill.kind === 'hold' ? `${this.count} / ${this.drill.target} s` : `${this.count} / ${this.drill.target} reps`; }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.id === 'djAck') { this.st.ack = true; this.save(); this.render(); this.onDrill(this.drill); }
    else if (b.dataset.drill) { this.drill = DRILLS.find((d) => d.id === b.dataset.drill)!; this.count = 0; this.running = false; this.render(); this.onDrill(this.drill); }
    else if (b.id === 'djStart') { this.running = !this.running; this.timer = 0; this.render(); }
    else if (b.id === 'djRep') this.bump();
    else if (b.id === 'djTeach') {
      const v = (id: string) => (this.el.querySelector('#' + id) as HTMLInputElement).value.trim();
      const t = { name: v('djName'), how: v('djHow'), safe: v('djSafe') };
      if (!t.name || !t.how || !t.safe) return;
      this.st.taught.push(t); this.save();
      openSubmitSheet({ kind: 'dojo drill', title: t.name, markdown: entryMarkdown({ title: t.name, author: this.author(), type: 'drill', tags: ['dojo', 'drill'],
        body: `**How the character does it.** ${t.how}\n\n**Beginner-safe version for real life.** ${t.safe}\n\n*${data.disclaimer}*` }) });
      this.render();
    }
    else if (b.id === 'djClose') this.close();
  }

  private render() {
    const d = this.drill;
    const body = !this.st.ack ? `
      <h4>Before you train</h4>
      <p class="dj-disclaimer">${escapeHtml(data.disclaimer)}</p>
      <div class="forge-actions"><button class="primary" id="djAck">I understand</button></div>`
      : `
      <div class="chips">${DRILLS.map((x) => `<button class="chip${x.id === d.id ? ' on' : ''}" data-drill="${x.id}">${escapeHtml(x.name)}${this.st.done.includes(x.id) ? ' ✓' : ''}</button>`).join('')}</div>
      <h4>${escapeHtml(d.name)} ${d.characterOnly ? '<span class="dj-badge">character only</span>' : ''}</h4>
      <p class="fine">${escapeHtml(d.character)}</p>
      <h5>Your version</h5>
      <ol class="dj-steps">${d.you.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
      <p class="dj-safety">⚠ ${escapeHtml(d.safety)}</p>
      <div class="dj-count">${this.countText()}</div>
      <div class="forge-actions">${d.kind === 'hold' ? `<button class="primary" id="djStart">${this.running ? 'Pause' : this.count ? 'Resume' : 'Start the hold'}</button>` : '<button class="primary" id="djRep">Rep done</button>'}</div>
      <p class="fine">Honour system: count only what you actually did. Doing less is fine.</p>
      <details><summary>Teach a drill</summary>
        <label class="field">Name<input id="djName" type="text" maxlength="48"></label>
        <label class="field">What the character does<textarea id="djHow" rows="2" maxlength="400"></textarea></label>
        <label class="field">A beginner-safe version for real life<textarea id="djSafe" rows="2" maxlength="400"></textarea></label>
        <div class="forge-actions"><button class="secondary" id="djTeach">Submit the drill…</button></div>
      </details>`;
    this.el.innerHTML = `
      <div class="forge-panel dojo-panel">
        <div class="eyebrow">Dojo · follow along</div>
        <h2>Train with your character</h2>
        ${body}
        <div class="forge-actions"><button class="secondary" id="djClose">Leave the mats</button></div>
      </div>`;
  }
}
