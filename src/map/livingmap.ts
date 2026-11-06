import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';
import './map.css';
import { storeSet } from '../store';

// B7 living map (M): a hand-inked map of the glade that fills in as you walk (fog of war, 4 m cells),
// and records what you did there: clues found, where your theory led, the friend you found, the fire
// where your ballad was sung, the dungeon seeds you went down, and your own pinned notes.
const HALF = 50, CELLM = 4, G = (HALF * 2) / CELLM;   // 25 × 25 cells
const KEY = 'gametool.map';
export interface Pin { id: string; x: number; z: number; text: string; created: string }
export interface Mark { x: number; z: number; label: string; kind: 'clue' | 'lead' | 'found' | 'song' | 'delve' | 'place' }
/** Mike 2026-11-05 ("Update the map so that new players can see what the game has to offer"): things to do, shown
 *  from the start (over the fog) and listed beside the map. `locked`: not open yet, `note` says how. */
export interface Sight { x: number; z: number; icon: string; label: string; note: string; locked?: boolean }
/** A building on the green, drawn to scale (centre, facing, width, depth) with its name. */
export interface MapLot { x: number; z: number; ry: number; w: number; d: number; name: string }
/** A road out of town: where it leaves the map and where it goes. */
export interface MapExit { x: number; z: number; label: string; shut?: boolean }
interface MapState { fog: string; pins: Pin[] }

export class LivingMap {
  readonly el: HTMLDivElement;
  private seen = new Uint8Array(G * G);
  pins: Pin[] = [];
  private canvas!: HTMLCanvasElement;
  /** Mike 2026-11-06: where a right-click (or a long-press on a phone) asked for a note, in world metres. */
  noteAt: { x: number; z: number } | null = null;
  private pressTimer = 0;

  constructor(readonly marks: () => Mark[], private player: () => { x: number; z: number; yaw: number }, private onClose: () => void, private author: () => string,
    readonly sights: () => Sight[] = () => [], private lots: MapLot[] = [], private exits: MapExit[] = []) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as MapState | null;
      if (s?.fog) for (let i = 0; i < G * G; i++) this.seen[i] = (parseInt(s.fog[i >> 2] ?? '0', 16) >> (i & 3)) & 1;
      if (Array.isArray(s?.pins)) this.pins = s!.pins;
    } catch { /* fresh map */ }
    this.el = document.createElement('div');
    this.el.id = 'livingMap';
    this.el.className = 'map-screen hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    // Mike 2026-11-06: right-click the map (long-press on touch) to add a note at that spot.
    this.el.addEventListener('contextmenu', (e) => { if ((e.target as HTMLElement).id !== 'mpCanvas') return; e.preventDefault(); this.askNote(e.clientX, e.clientY); });
    let down: { x: number; y: number } | null = null;
    const cancelPress = () => { clearTimeout(this.pressTimer); down = null; };
    this.el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).id !== 'mpCanvas' || e.pointerType === 'mouse') return;
      down = { x: e.clientX, y: e.clientY };
      clearTimeout(this.pressTimer);
      this.pressTimer = window.setTimeout(() => { if (down) this.askNote(down.x, down.y); down = null; }, 500);
    });
    this.el.addEventListener('pointermove', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) cancelPress(); });
    this.el.addEventListener('pointerup', cancelPress);
    this.el.addEventListener('pointercancel', cancelPress);
    this.el.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t.id !== 'mpNoteText') return;
      if (e.key === 'Enter') { e.preventDefault(); this.addPin((t as HTMLInputElement).value, this.noteAt ?? undefined); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.cancelNote(); }
    });
  }
  /** Screen point on the map canvas -> world metres (x east, z south), or null off the map. */
  mapToWorld(clientX: number, clientY: number): { x: number; z: number } | null {
    const c = this.canvas, r = c.getBoundingClientRect();
    if (!c.clientWidth || !c.clientHeight) return null;
    const u = (clientX - r.left - c.clientLeft) / c.clientWidth, v = (clientY - r.top - c.clientTop) / c.clientHeight;   // inside the border
    if (u < 0 || v < 0 || u > 1 || v > 1) return null;
    return { x: Math.round((u * HALF * 2 - HALF) * 10) / 10, z: Math.round((v * HALF * 2 - HALF) * 10) / 10 };
  }
  /** Open the little note box where the map was right-clicked / long-pressed. */
  askNote(clientX: number, clientY: number) {
    const at = this.mapToWorld(clientX, clientY);
    if (!at) return;
    this.noteAt = at;
    this.draw();
    const wrap = this.el.querySelector<HTMLElement>('.map-canvas-wrap')!, r = wrap.getBoundingClientRect();
    wrap.querySelector('.map-note-pop')?.remove();
    const pop = document.createElement('div');
    pop.className = 'map-note-pop';
    pop.innerHTML = `<input id="mpNoteText" type="text" maxlength="120" placeholder="A note for this spot" aria-label="Note for this spot"><div class="map-note-btns"><button class="secondary" id="mpNoteCancel">Cancel</button><button class="primary" id="mpNoteAdd">Add note</button></div>`;
    pop.style.left = Math.max(4, Math.min(r.width - 234, clientX - r.left + 12)) + 'px';
    pop.style.top = Math.max(4, Math.min(r.height - 90, clientY - r.top + 12)) + 'px';
    wrap.appendChild(pop);
    pop.querySelector<HTMLInputElement>('input')!.focus();
  }
  cancelNote() { this.noteAt = null; this.el.querySelector('.map-note-pop')?.remove(); this.draw(); }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get revealed() { return this.seen.reduce((n, v) => n + v, 0) / (G * G); }

  private save() {
    let fog = '';
    for (let i = 0; i < G * G; i += 4) fog += ((this.seen[i] | (this.seen[i + 1] << 1) | (this.seen[i + 2] << 2) | (this.seen[i + 3] << 3)) & 15).toString(16);
    storeSet(KEY, JSON.stringify({ fog, pins: this.pins } satisfies MapState));
  }
  // Reveal everything within 10 m. Called from the game loop about once a second.
  reveal(x: number, z: number) {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return;
    let changed = false;
    for (let cy = 0; cy < G; cy++) for (let cx = 0; cx < G; cx++) {
      const wx = -HALF + (cx + 0.5) * CELLM, wz = -HALF + (cy + 0.5) * CELLM;
      if (!this.seen[cy * G + cx] && Math.hypot(wx - x, wz - z) < 10) { this.seen[cy * G + cx] = 1; changed = true; }
    }
    if (changed) this.save();
  }
  isSeen(x: number, z: number) { const cx = Math.floor((x + HALF) / CELLM), cy = Math.floor((z + HALF) / CELLM); return cx >= 0 && cy >= 0 && cx < G && cy < G && !!this.seen[cy * G + cx]; }

  addPin(text: string, at?: { x: number; z: number }): Pin | null {
    const p = at ?? this.player();
    if (!text.trim() || Math.abs(p.x) > HALF || Math.abs(p.z) > HALF) return null;
    const pin = { id: 'pin' + Date.now().toString(36), x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, text: text.trim().slice(0, 120), created: new Date().toISOString().slice(0, 10) };
    this.pins.push(pin); this.noteAt = null; this.save(); this.render();
    return pin;
  }
  open() { this.noteAt = null; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.id === 'mpNoteAdd') this.addPin((this.el.querySelector('#mpNoteText') as HTMLInputElement).value, this.noteAt ?? undefined);
    else if (b.id === 'mpNoteCancel') this.cancelNote();
    else if (b.id === 'mpPin') this.addPin((this.el.querySelector('#mpText') as HTMLInputElement).value);
    else if (b.dataset.del) { this.pins = this.pins.filter((p) => p.id !== b.dataset.del); this.save(); this.render(); }
    else if (b.id === 'mpSubmit' && this.pins.length) openSubmitSheet({ kind: 'map notes', title: 'Notes on the glade map', markdown: entryMarkdown({
      title: 'Notes on the glade map', author: this.author(), type: 'map-notes', tags: ['map'],
      body: this.pins.map((p) => `- (${p.x}, ${p.z}): ${p.text}`).join('\n'),
    }) });
    else if (b.id === 'mpClose') this.close();
  }

  private render() {
    this.el.innerHTML = `
      <div class="map-card">
        <div class="eyebrow">The living map · M</div>
        <div class="map-canvas-wrap"><canvas id="mpCanvas" width="600" height="600"></canvas></div>
        <div class="map-side">
          <p class="fine">${Math.round(this.revealed * 100)}% of Aralon explored. The land fills in as you walk; the places to visit are marked from the start.</p>
          ${this.sightList()}
          <p class="fine">Right-click the map (long-press on a phone) to add a note at that spot.</p>
          <div class="map-pin-row"><input id="mpText" type="text" maxlength="120" placeholder="A note for this spot"><button class="secondary" id="mpPin">Pin it here</button></div>
          <ul class="map-pins">${this.pins.map((p) => `<li>${escapeHtml(p.text)} <button class="sk-del" data-del="${p.id}" aria-label="Remove">×</button></li>`).join('')}</ul>
          <div class="forge-actions">${this.pins.length ? '<button class="secondary" id="mpSubmit">Submit my notes…</button>' : ''}<button class="primary" id="mpClose">Close</button></div>
        </div>
      </div>`;
    this.canvas = this.el.querySelector('#mpCanvas')!;
    this.draw();
  }

  private sightList(): string {
    const list = this.sights();
    if (!list.length) return '';
    return `<div class="map-sights"><div class="map-sights-h">What's here</div><ul>${list.map((t) =>
      `<li class="${t.locked ? 'locked' : ''}"><span class="map-ic">${escapeHtml(t.icon)}</span><span><b>${escapeHtml(t.label)}</b>${t.locked ? ' 🔒' : ''}<br><span class="fine">${escapeHtml(t.note)}</span></span></li>`).join('')}</ul></div>`;
  }

  draw() {
    const g = this.canvas.getContext('2d')!, S = this.canvas.width / (HALF * 2);
    const X = (x: number) => (x + HALF) * S, Z = (z: number) => (z + HALF) * S;
    g.fillStyle = '#E9DCB8'; g.fillRect(0, 0, 600, 600);
    // Forest stipple, deterministic.
    let r = 7;
    const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    g.fillStyle = 'rgba(70,90,50,.55)';
    for (let i = 0; i < 900; i++) { const x = rnd() * 100 - 50, z = rnd() * 100 - 50; if (Math.hypot(x, z) > 6 && !(Math.abs(x) < 14 && z < -16 && z > -44)) { g.beginPath(); g.arc(X(x), Z(z), 2.2, 0, 7); g.fill(); } }
    // Landmarks.
    g.strokeStyle = '#3A3024'; g.fillStyle = '#3A3024'; g.lineWidth = 2;
    g.setLineDash([6, 4]); g.beginPath(); g.moveTo(X(0), Z(12)); g.lineTo(X(0), Z(-18)); g.stroke(); g.setLineDash([]);   // paved path
    g.strokeRect(X(-13), Z(-42), 26 * S, 24 * S);                                                                         // library
    // What happened here.
    const icon: Record<Mark['kind'], [string, string]> = { clue: ['✕', '#7A2420'], lead: ['◆', '#2E5FA8'], found: ['★', '#A8322A'], song: ['♪', '#6B4423'], delve: ['▼', '#2B2A24'], place: ['•', '#2B2418'] };
    for (const m of this.marks()) {
      if (!this.isSeen(m.x, m.z) && m.kind !== 'found') continue;
      const [ch, col] = icon[m.kind];
      g.fillStyle = col; g.font = 'bold 16px Georgia, serif'; g.textAlign = 'center'; g.fillText(ch, X(m.x), Z(m.z) + 5);
      if (m.label) { g.font = 'italic 12px Georgia, serif'; g.fillText(m.label, X(m.x), Z(m.z) + 20); }
    }
    // Fog over the unexplored cells.
    for (let cy = 0; cy < G; cy++) for (let cx = 0; cx < G; cx++) if (!this.seen[cy * G + cx]) { g.fillStyle = 'rgba(120,100,70,.82)'; g.fillRect(cx * CELLM * S, cy * CELLM * S, CELLM * S + 0.5, CELLM * S + 0.5); }
    // Over the fog, so a new player sees the town and what there is to do from the start.
    for (const L of this.lots) {
      g.save(); g.translate(X(L.x), Z(L.z)); g.rotate(-L.ry);
      g.fillStyle = 'rgba(233,220,184,.92)'; g.strokeStyle = '#3A3024'; g.lineWidth = 2;
      g.fillRect(-L.w / 2 * S, -L.d / 2 * S, L.w * S, L.d * S); g.strokeRect(-L.w / 2 * S, -L.d / 2 * S, L.w * S, L.d * S);
      g.restore();
      g.font = 'italic 11px Georgia, serif'; g.fillStyle = '#2B2418'; g.textAlign = 'center'; g.fillText(L.name.split(' & ')[0], X(L.x), Z(L.z) + 4);
    }
    g.font = 'italic 15px Georgia, serif'; g.fillStyle = '#2B2418'; g.textAlign = 'center'; g.fillText('The Ruined Library', X(0), Z(-39.5));
    for (const e of this.exits) {
      const ax = Math.max(14, Math.min(586, X(e.x))), az = Math.max(22, Math.min(586, Z(e.z)));
      g.font = 'bold 12px Georgia, serif'; g.fillStyle = e.shut ? '#6B5A3A' : '#2B2418'; g.textAlign = ax < 60 ? 'left' : ax > 540 ? 'right' : 'center';
      g.fillText(`${e.label}${e.shut ? ' (shut)' : ''}`, ax, az);
    }
    for (const t of this.sights()) {
      const x = X(t.x), z = Z(t.z);
      g.fillStyle = t.locked ? 'rgba(110,100,85,.95)' : '#F4E6C0'; g.strokeStyle = t.locked ? '#4A4238' : '#7A2420'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(x, z, 11, 0, 7); g.fill(); g.stroke();
      g.font = '13px "Segoe UI Symbol", "Apple Symbols", Georgia, serif'; g.textAlign = 'center'; g.fillStyle = t.locked ? '#E9DCB8' : '#2B2418'; g.fillText(t.icon, x, z + 5);
      g.font = 'bold 11px Georgia, serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(233,220,184,.9)';
      const name = t.label;
      g.strokeText(name, x, z + 24); g.fillStyle = t.locked ? '#4A4238' : '#7A2420'; g.fillText(name, x, z + 24);
    }
    // Your notes, over the fog (a note can mark a place you haven't walked to yet).
    for (const p of this.pins) { g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--my-ink') || '#2B2A24'; g.beginPath(); g.arc(X(p.x), Z(p.z), 5, 0, 7); g.fill(); g.font = '12px Georgia, serif'; g.textAlign = 'left'; g.fillText(p.text.slice(0, 28), X(p.x) + 8, Z(p.z) + 4); }
    if (this.noteAt) { g.strokeStyle = '#C8423A'; g.lineWidth = 3; g.beginPath(); g.arc(X(this.noteAt.x), Z(this.noteAt.z), 9, 0, 7); g.stroke(); }
    // You are here.
    const me = this.player();
    if (Math.abs(me.x) <= HALF && Math.abs(me.z) <= HALF) {
      g.save(); g.translate(X(me.x), Z(me.z)); g.rotate(-me.yaw); g.fillStyle = '#C8423A';
      g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.restore();
    }
    g.strokeStyle = '#6B5A3A'; g.lineWidth = 6; g.strokeRect(3, 3, 594, 594);
    g.font = 'bold 20px Georgia, serif'; g.fillStyle = '#6B5A3A'; g.textAlign = 'right'; g.fillText('N ↑', 586, 28);
  }
}
