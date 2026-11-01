import { escapeHtml } from '../submit';
import type { DialogueNode, DialogueScript } from '../dialogue';
import './dm.css';

// B20 (Mike 2026-11-01): the DM view. Same app, opened with ?dm and a passphrase (checked against a SHA-256 hash, so
// the phrase itself is not in the code). This only keeps it out of players' way: the site is public and anyone can
// read the code, so nothing secret belongs here. Part III (the DM-private lore) is never loaded or shipped.
// Two tools, both saved on this device (not in a player profile) and exported as JSON for Mike to merge by hand:
//  - Map: a top-down plan of the glade and town. Click to drop pins for NPCs, doors, dungeon seeds, kit pieces, notes.
//  - Quest graph: dialogue / quest nodes (a line, choices with an optional condition, actions such as give:item:n or
//    quest:start), drawn as a graph. It exports in the game's own dialogue format (content/dialogue/*.json).
export const DM_HASH = '043812dc2bb9092a3d556b155fc2971ecc655948a38e355e7f143b5c789ce98a';
const KEY = 'gametool~dm';          // outside the per-profile "gametool." keys: the DM's work isn't a player save
const UNLOCK = 'gametool~dm.unlocked';
const HALF = 50;

export type PinKind = 'npc' | 'door' | 'dungeon' | 'kit' | 'note';
export const PIN_KINDS: [PinKind, string, string][] = [['npc', '☺', 'NPC'], ['door', '⌂', 'Door'], ['dungeon', '▼', 'Dungeon seed'], ['kit', '▣', 'Kit piece'], ['note', '✎', 'Note']];
export interface DmPin { id: string; kind: PinKind; x: number; z: number; label: string; notes: string; seed?: number }
export interface GraphNode extends DialogueNode { x: number; y: number; choices?: { text: string; next: string; if?: string }[] }
export interface Graph { id: string; speaker: string; start: string; nodes: Record<string, GraphNode> }
export interface DmState { pins: DmPin[]; graphs: Graph[]; current: string }
export interface Place { x: number; z: number; w: number; d: number; ry: number; label: string }

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const blankGraph = (id = 'quest1'): Graph => ({ id, speaker: 'Someone', start: 'n1', nodes: { n1: { text: 'Hello, traveller.', x: 40, y: 40, end: true } } });
export function loadDm(): DmState {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v && Array.isArray(v.pins) && Array.isArray(v.graphs) && v.graphs.length) return v; } catch { /* fresh */ }
  const g = blankGraph();
  return { pins: [], graphs: [g], current: g.id };
}
/** The game's dialogue JSON (content/dialogue/*.json) as a graph, laid out in rows by depth from the start. */
export function graphFromScript(id: string, s: DialogueScript): Graph {
  const depth = new Map<string, number>([[s.start, 0]]), q = [s.start];
  while (q.length) {
    const k = q.shift()!, n = s.nodes[k]; if (!n) continue;
    for (const t of [n.next, ...(n.choices ?? []).map((c) => c.next)]) if (t && s.nodes[t] && !depth.has(t)) { depth.set(t, depth.get(k)! + 1); q.push(t); }
  }
  const col = new Map<number, number>(), nodes: Record<string, GraphNode> = {};
  for (const [k, n] of Object.entries(s.nodes)) {
    const d = depth.get(k) ?? 0, c = col.get(d) ?? 0; col.set(d, c + 1);
    nodes[k] = { ...structuredClone(n), x: 30 + c * 230, y: 30 + d * 150 };
  }
  return { id, speaker: s.speaker, start: s.start, nodes };
}
/** A graph in the game's dialogue format (positions dropped; `if` on a choice is kept for the game to grow into). */
export function scriptFromGraph(g: Graph): DialogueScript {
  const nodes: Record<string, DialogueNode> = {};
  for (const [k, n] of Object.entries(g.nodes)) {
    const { x: _x, y: _y, ...rest } = n;
    const out: DialogueNode = { text: rest.text };
    if (rest.choices?.length) out.choices = rest.choices.map((c) => ({ ...c }));
    else if (rest.next) out.next = rest.next;
    if (rest.actions?.length) out.actions = [...rest.actions];
    if (rest.end || (!rest.next && !rest.choices?.length)) out.end = true;
    nodes[k] = out;
  }
  return { speaker: g.speaker, start: g.start, nodes };
}

export class DmView {
  readonly el: HTMLDivElement;
  st: DmState = loadDm();
  tab: 'map' | 'graph' = 'map';
  pinKind: PinKind = 'npc';
  selPin: string | null = null;
  selNode: string | null = null;
  linking: string | null = null;
  unlocked = false;
  private drag: { id: string; dx: number; dy: number } | null = null;

  /** Places to draw on the plan, and the game's dialogue scripts that can be loaded as graphs. Set by main. */
  places: () => Place[] = () => [];
  scripts: () => Record<string, DialogueScript> = () => ({});
  onClose: () => void = () => undefined;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'dmView';
    this.el.className = 'dm hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('input', (e) => this.input(e));
    this.el.addEventListener('change', (e) => this.change(e));
    this.el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', () => { if (this.drag) { this.drag = null; this.save(); this.renderEdges(); } });
    try { this.unlocked = sessionStorage.getItem(UNLOCK) === '1'; } catch { /* blocked */ }
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get graph(): Graph { return this.st.graphs.find((g) => g.id === this.st.current) ?? this.st.graphs[0]; }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.st)); } catch { /* blocked */ } }
  open() { this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }

  async unlock(phrase: string): Promise<boolean> {
    const ok = (await sha256(phrase.trim().toLowerCase())) === DM_HASH;
    if (ok) { this.unlocked = true; try { sessionStorage.setItem(UNLOCK, '1'); } catch { /* blocked */ } }
    this.render();
    if (!ok) { const m = this.el.querySelector('#dmMsg'); if (m) m.textContent = 'That isn\'t it.'; }
    return ok;
  }

  // ---------- map ----------
  addPin(x: number, z: number, kind = this.pinKind): DmPin {
    const p: DmPin = { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), kind, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, label: PIN_KINDS.find((k) => k[0] === kind)![2], notes: '' };
    if (kind === 'dungeon') p.seed = Math.floor(Math.random() * 9000) + 1000;
    this.st.pins.push(p); this.selPin = p.id; this.save(); this.render();
    return p;
  }
  private toWorld(e: MouseEvent, c: HTMLCanvasElement) { const r = c.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * HALF * 2 - HALF, z: ((e.clientY - r.top) / r.height) * HALF * 2 - HALF }; }
  drawMap() {
    const c = this.el.querySelector<HTMLCanvasElement>('#dmCanvas'); if (!c) return;
    const g = c.getContext('2d')!, S = c.width / (HALF * 2), X = (x: number) => (x + HALF) * S, Z = (z: number) => (z + HALF) * S;
    g.fillStyle = '#1E2A22'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let v = -HALF; v <= HALF; v += 10) { g.beginPath(); g.moveTo(X(v), 0); g.lineTo(X(v), c.height); g.moveTo(0, Z(v)); g.lineTo(c.width, Z(v)); g.stroke(); }
    g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
    for (const p of this.places()) {
      g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(-p.ry);
      g.fillStyle = 'rgba(232,200,120,.18)'; g.strokeStyle = 'rgba(232,200,120,.7)';
      g.fillRect(-p.w / 2 * S, -p.d / 2 * S, p.w * S, p.d * S); g.strokeRect(-p.w / 2 * S, -p.d / 2 * S, p.w * S, p.d * S);
      g.restore(); g.fillStyle = '#E8D9B0'; g.fillText(p.label, X(p.x), Z(p.z) + 4);
    }
    for (const p of this.st.pins) {
      const k = PIN_KINDS.find((x) => x[0] === p.kind)!, sel = p.id === this.selPin;
      g.fillStyle = sel ? '#F2C94C' : '#C8423A'; g.beginPath(); g.arc(X(p.x), Z(p.z), sel ? 9 : 7, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 11px system-ui'; g.fillText(k[1], X(p.x), Z(p.z) + 4);
      g.fillStyle = '#F4EEDD'; g.font = '11px system-ui'; g.textAlign = 'left'; g.fillText(p.label + (p.seed ? ` #${p.seed}` : ''), X(p.x) + 11, Z(p.z) + 4); g.textAlign = 'center';
    }
    g.fillStyle = '#E8D9B0'; g.textAlign = 'right'; g.font = 'bold 14px system-ui'; g.fillText('N ↑', c.width - 10, 20);
  }

  // ---------- graph ----------
  addNode(): string {
    const g = this.graph; let i = Object.keys(g.nodes).length + 1; while (g.nodes['n' + i]) i++;
    const id = 'n' + i, sel = this.selNode && g.nodes[this.selNode];
    g.nodes[id] = { text: 'A new line.', x: sel ? sel.x + 30 : 40, y: sel ? sel.y + 150 : 40, end: true };
    this.selNode = id; this.save(); this.render();
    return id;
  }
  /** Link the selected node to `to`: as its next line, or as a new choice once it has choices. */
  link(from: string, to: string) {
    const n = this.graph.nodes[from]; if (!n || !this.graph.nodes[to] || from === to) return;
    if (n.choices?.length) n.choices.push({ text: 'Another choice', next: to });
    else { n.next = to; delete n.end; }
    this.linking = null; this.save(); this.render();
  }
  deleteNode(id: string) {
    const g = this.graph; if (id === g.start && Object.keys(g.nodes).length === 1) return;
    delete g.nodes[id];
    for (const n of Object.values(g.nodes)) { if (n.next === id) { delete n.next; n.end = !n.choices?.length; } if (n.choices) n.choices = n.choices.filter((c) => c.next !== id); }
    if (g.start === id) g.start = Object.keys(g.nodes)[0];
    this.selNode = null; this.save(); this.render();
  }
  loadScript(name: string) {
    const s = this.scripts()[name]; if (!s) return;
    let id = name, i = 2; while (this.st.graphs.some((g) => g.id === id)) id = `${name}-${i++}`;
    this.st.graphs.push(graphFromScript(id, s)); this.st.current = id; this.selNode = null; this.save(); this.render();
  }
  newGraph() { let i = this.st.graphs.length + 1; while (this.st.graphs.some((g) => g.id === 'quest' + i)) i++; const g = blankGraph('quest' + i); this.st.graphs.push(g); this.st.current = g.id; this.selNode = null; this.save(); this.render(); }
  /** Everything as JSON: pins, every graph, and each graph in the game's dialogue format. */
  exportJson(): string {
    return JSON.stringify({ schemaVersion: 1, exported: new Date().toISOString(), pins: this.st.pins, graphs: this.st.graphs, dialogue: Object.fromEntries(this.st.graphs.map((g) => [g.id, scriptFromGraph(g)])) }, null, 2);
  }
  importJson(text: string): boolean {
    try {
      const v = JSON.parse(text);
      if (!Array.isArray(v.pins) || !Array.isArray(v.graphs) || !v.graphs.length) return false;
      this.st = { pins: v.pins, graphs: v.graphs, current: v.graphs[0].id }; this.save(); this.render(); return true;
    } catch { return false; }
  }
  private download() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([this.exportJson()], { type: 'application/json' }));
    a.download = `artheria-dm-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- events ----------
  private click(e: Event) {
    const t = e.target as HTMLElement, b = t.closest('button') as HTMLButtonElement | null, d = b?.dataset ?? {};
    if (t.id === 'dmCanvas' && this.tab === 'map') {
      const w = this.toWorld(e as MouseEvent, t as HTMLCanvasElement);
      const hit = this.st.pins.find((p) => Math.hypot(p.x - w.x, p.z - w.z) < 1.6);
      if (hit) { this.selPin = hit.id; this.render(); } else this.addPin(w.x, w.z);
      return;
    }
    const node = t.closest<HTMLElement>('.dm-node');
    if (node && !b && this.tab === 'graph') { const id = node.dataset.node!; if (this.linking && this.linking !== id) this.link(this.linking, id); else { this.selNode = id; this.render(); } return; }
    if (!b) return;
    if (b.id === 'dmUnlock') void this.unlock(this.el.querySelector<HTMLInputElement>('#dmPhrase')?.value ?? '');
    else if (d.tab) { this.tab = d.tab as 'map' | 'graph'; this.render(); }
    else if (d.kind) { this.pinKind = d.kind as PinKind; this.render(); }
    else if (b.id === 'dmDelPin' && this.selPin) { this.st.pins = this.st.pins.filter((p) => p.id !== this.selPin); this.selPin = null; this.save(); this.render(); }
    else if (b.id === 'dmAddNode') this.addNode();
    else if (b.id === 'dmLink' && this.selNode) { this.linking = this.linking ? null : this.selNode; this.render(); }
    else if (b.id === 'dmDelNode' && this.selNode) this.deleteNode(this.selNode);
    else if (b.id === 'dmStart' && this.selNode) { this.graph.start = this.selNode; this.save(); this.render(); }
    else if (b.id === 'dmAddChoice' && this.selNode) { const n = this.graph.nodes[this.selNode]; n.choices = [...(n.choices ?? []), { text: 'A choice', next: n.next ?? this.graph.start }]; delete n.next; delete n.end; this.save(); this.render(); }
    else if (d.delChoice !== undefined && this.selNode) { const n = this.graph.nodes[this.selNode]; n.choices!.splice(Number(d.delChoice), 1); if (!n.choices!.length) { delete n.choices; n.end = true; } this.save(); this.render(); }
    else if (b.id === 'dmNewGraph') this.newGraph();
    else if (b.id === 'dmLoad') this.loadScript(this.el.querySelector<HTMLSelectElement>('#dmScript')?.value ?? '');
    else if (b.id === 'dmExport') this.download();
    else if (b.id === 'dmImport') this.el.querySelector<HTMLInputElement>('#dmFile')?.click();
    else if (b.id === 'dmClose') this.close();
  }
  private input(e: Event) {
    const t = e.target as HTMLInputElement, f = t.dataset.f;
    if (!f) return;
    if (f.startsWith('pin.') && this.selPin) {
      const p = this.st.pins.find((x) => x.id === this.selPin)!, k = f.slice(4) as 'label' | 'notes' | 'seed' | 'x' | 'z';
      if (k === 'seed' || k === 'x' || k === 'z') p[k] = Number(t.value) || 0; else p[k] = t.value;
      this.save(); this.drawMap();
    } else if (f.startsWith('node.') && this.selNode) {
      const n = this.graph.nodes[this.selNode], k = f.slice(5);
      if (k === 'text') n.text = t.value;
      else if (k === 'actions') n.actions = t.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (k.startsWith('choice.')) { const [, i, part] = k.split('.'); (n.choices![Number(i)] as Record<string, string>)[part] = t.value; }
      this.save();
      const box = this.el.querySelector(`.dm-node[data-node="${this.selNode}"] .dm-text`); if (box) box.textContent = n.text;
    } else if (f === 'speaker') { this.graph.speaker = t.value; this.save(); }
  }
  private change(e: Event) {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.id === 'dmGraph') { this.st.current = t.value; this.selNode = null; this.save(); this.render(); }
    else if (t.dataset.f === 'node.next' && this.selNode) { const n = this.graph.nodes[this.selNode]; if (t.value) { n.next = t.value; delete n.end; } else { delete n.next; n.end = true; } this.save(); this.render(); }
    else if (t.dataset.f?.startsWith('node.choice.') && t.dataset.f.endsWith('.next') && this.selNode) this.render();
    else if (t.id === 'dmFile') {
      const file = (t as HTMLInputElement).files?.[0]; if (!file) return;
      void file.text().then((s) => { const ok = this.importJson(s); const m = this.el.querySelector('#dmMsg'); if (m) m.textContent = ok ? 'Imported.' : 'That file isn\'t a DM export.'; });
    }
  }
  private down(e: PointerEvent) {
    const n = (e.target as HTMLElement).closest<HTMLElement>('.dm-node');
    if (!n || this.tab !== 'graph' || (e.target as HTMLElement).closest('button, input, textarea')) return;
    const g = this.graph.nodes[n.dataset.node!];
    this.drag = { id: n.dataset.node!, dx: e.clientX - g.x, dy: e.clientY - g.y };
  }
  private move(e: PointerEvent) {
    if (!this.drag) return;
    const g = this.graph.nodes[this.drag.id]; if (!g) return;
    g.x = Math.max(0, e.clientX - this.drag.dx); g.y = Math.max(0, e.clientY - this.drag.dy);
    const el = this.el.querySelector<HTMLElement>(`.dm-node[data-node="${this.drag.id}"]`);
    if (el) { el.style.left = g.x + 'px'; el.style.top = g.y + 'px'; }
    this.renderEdges();
  }

  // ---------- render ----------
  renderEdges() {
    const svg = this.el.querySelector('#dmEdges'); if (!svg) return;
    const g = this.graph, W = 200, H = 70, lines: string[] = [];
    const edge = (a: GraphNode, b: GraphNode, label = '', cond = '') => {
      const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y, my = (y1 + y2) / 2;
      lines.push(`<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" class="dm-edge${cond ? ' cond' : ''}" marker-end="url(#dmArrow)"/>`);
      if (label) lines.push(`<text x="${(x1 + x2) / 2}" y="${my - 4}" class="dm-elabel">${escapeHtml(label.slice(0, 26))}${cond ? ` [${escapeHtml(cond)}]` : ''}</text>`);
    };
    for (const n of Object.values(g.nodes)) {
      if (n.next && g.nodes[n.next]) edge(n, g.nodes[n.next]);
      for (const c of n.choices ?? []) if (g.nodes[c.next]) edge(n, g.nodes[c.next], c.text, c.if ?? '');
    }
    const maxX = Math.max(800, ...Object.values(g.nodes).map((n) => n.x + W + 40)), maxY = Math.max(500, ...Object.values(g.nodes).map((n) => n.y + H + 60));
    svg.setAttribute('width', String(maxX)); svg.setAttribute('height', String(maxY));
    svg.innerHTML = `<defs><marker id="dmArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#E8C878"/></marker></defs>${lines.join('')}`;
  }

  render() {
    if (!this.unlocked) {
      this.el.innerHTML = `<div class="dm-gate card"><div class="eyebrow">DM view</div><h1>Dungeon Master</h1>
        <p class="fine">This is the DM's planning view, not part of the game. Enter the passphrase.</p>
        <label class="field">Passphrase<input id="dmPhrase" type="password" autocomplete="off"></label><p class="fine" id="dmMsg" role="status"></p>
        <div class="row"><button class="primary" id="dmUnlock">Open</button><button class="secondary" id="dmClose">Back to the game</button></div></div>`;
      return;
    }
    const g = this.graph, pin = this.st.pins.find((p) => p.id === this.selPin), node = this.selNode ? g.nodes[this.selNode] : null, ids = Object.keys(g.nodes);
    const side = this.tab === 'map' ? `
      <h3>Pins</h3>
      <div class="chips">${PIN_KINDS.map(([k, i, n]) => `<button class="chip${k === this.pinKind ? ' on' : ''}" data-kind="${k}">${i} ${n}</button>`).join('')}</div>
      <p class="fine">Click the plan to drop a ${PIN_KINDS.find((k) => k[0] === this.pinKind)![2].toLowerCase()} pin; click a pin to edit it. ${this.st.pins.length} pin${this.st.pins.length === 1 ? '' : 's'}.</p>
      ${pin ? `<div class="dm-edit"><label class="field">Label<input data-f="pin.label" value="${escapeHtml(pin.label)}" maxlength="60"></label>
        <div class="dm-xz"><label class="field">x<input data-f="pin.x" type="number" step="0.1" value="${pin.x}"></label><label class="field">z<input data-f="pin.z" type="number" step="0.1" value="${pin.z}"></label>${pin.kind === 'dungeon' ? `<label class="field">Seed<input data-f="pin.seed" type="number" value="${pin.seed ?? 0}"></label>` : ''}</div>
        <label class="field">Notes<textarea data-f="pin.notes" rows="3" maxlength="600">${escapeHtml(pin.notes)}</textarea></label>
        <button class="secondary" id="dmDelPin">Delete pin</button></div>` : ''}`
      : `
      <h3>Quest graph</h3>
      <div class="row"><select id="dmGraph" aria-label="Graph">${this.st.graphs.map((x) => `<option value="${escapeHtml(x.id)}"${x.id === g.id ? ' selected' : ''}>${escapeHtml(x.id)}</option>`).join('')}</select><button class="secondary" id="dmNewGraph">New</button></div>
      <div class="row"><select id="dmScript" aria-label="Game dialogue">${Object.keys(this.scripts()).map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}.json</option>`).join('')}</select><button class="secondary" id="dmLoad">Load from the game</button></div>
      <label class="field">Speaker<input data-f="speaker" value="${escapeHtml(g.speaker)}" maxlength="60"></label>
      <div class="row"><button class="primary" id="dmAddNode">+ Node</button>${node ? `<button class="secondary${this.linking ? ' on' : ''}" id="dmLink">${this.linking ? 'Click a node…' : 'Link to…'}</button>` : ''}</div>
      ${node ? `<div class="dm-edit"><h4>${escapeHtml(this.selNode!)}${this.selNode === g.start ? ' · start' : ''}</h4>
        <label class="field">Line<textarea data-f="node.text" rows="3" maxlength="600">${escapeHtml(node.text)}</textarea></label>
        ${node.choices?.length ? node.choices.map((c, i) => `<div class="dm-choice"><input data-f="node.choice.${i}.text" value="${escapeHtml(c.text)}" aria-label="Choice ${i + 1}">
            <select data-f="node.choice.${i}.next" aria-label="Goes to">${ids.map((k) => `<option${k === c.next ? ' selected' : ''}>${k}</option>`).join('')}</select>
            <input data-f="node.choice.${i}.if" value="${escapeHtml(c.if ?? '')}" placeholder="if: has:crossbow, flag:x, spanish:cook" aria-label="Condition"><button class="sk-del" data-del-choice="${i}" aria-label="Remove choice">×</button></div>`).join('')
          : `<label class="field">Then<select data-f="node.next"><option value="">(end)</option>${ids.filter((k) => k !== this.selNode).map((k) => `<option${k === node.next ? ' selected' : ''}>${k}</option>`).join('')}</select></label>`}
        <label class="field">Actions (one per line: give:item:n, crowns:n, flag:name, unlock:door, quest:start)<textarea data-f="node.actions" rows="2">${escapeHtml((node.actions ?? []).join('\n'))}</textarea></label>
        <div class="row"><button class="secondary" id="dmAddChoice">+ Choice</button><button class="secondary" id="dmStart">Make start</button><button class="secondary" id="dmDelNode">Delete</button></div></div>` : '<p class="fine">Click a node to edit it. Drag nodes to arrange them.</p>'}`;
    this.el.innerHTML = `
      <header class="dm-head"><b>DM view</b>
        <div class="chips"><button class="chip${this.tab === 'map' ? ' on' : ''}" data-tab="map">Map</button><button class="chip${this.tab === 'graph' ? ' on' : ''}" data-tab="graph">Quest graph</button></div>
        <span class="fine">Saved on this device. Part III stays in your private notes; this view never loads it.</span>
        <div class="row"><button class="secondary" id="dmImport">Import…</button><button class="primary" id="dmExport">Export JSON</button><button class="secondary" id="dmClose">Back to the game</button></div>
        <input id="dmFile" type="file" accept="application/json,.json" style="display:none"><span class="fine" id="dmMsg" role="status"></span></header>
      <main class="dm-main">
        <section class="dm-stage">${this.tab === 'map' ? '<canvas id="dmCanvas" width="800" height="800"></canvas>'
          : `<div class="dm-graph"><svg id="dmEdges"></svg>${Object.entries(g.nodes).map(([k, n]) => `<div class="dm-node${k === this.selNode ? ' sel' : ''}${k === g.start ? ' start' : ''}${n.end && !n.next && !n.choices?.length ? ' end' : ''}" data-node="${k}" style="left:${n.x}px;top:${n.y}px">
              <span class="dm-id">${k}${n.actions?.length ? ` · ${n.actions.length} action${n.actions.length > 1 ? 's' : ''}` : ''}</span><span class="dm-text">${escapeHtml(n.text)}</span></div>`).join('')}</div>`}</section>
        <aside class="dm-side">${side}</aside>
      </main>`;
    if (this.tab === 'map') this.drawMap(); else this.renderEdges();
  }
}
