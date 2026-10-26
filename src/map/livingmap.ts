import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';
import './map.css';

// B7 living map (M): a hand-inked map of the glade that fills in as you walk (fog of war, 4 m cells),
// and records what you did there: clues found, where your theory led, the friend you found, the fire
// where your ballad was sung, the dungeon seeds you went down, and your own pinned notes.
const HALF = 50, CELLM = 4, G = (HALF * 2) / CELLM;   // 25 × 25 cells
const KEY = 'gametool.map';
export interface Pin { id: string; x: number; z: number; text: string; created: string }
export interface Mark { x: number; z: number; label: string; kind: 'clue' | 'lead' | 'found' | 'song' | 'delve' | 'place' }
interface MapState { fog: string; pins: Pin[] }

export class LivingMap {
  readonly el: HTMLDivElement;
  private seen = new Uint8Array(G * G);
  pins: Pin[] = [];
  private canvas!: HTMLCanvasElement;

  constructor(private marks: () => Mark[], private player: () => { x: number; z: number; yaw: number }, private onClose: () => void, private author: () => string) {
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
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get revealed() { return this.seen.reduce((n, v) => n + v, 0) / (G * G); }

  private save() {
    let fog = '';
    for (let i = 0; i < G * G; i += 4) fog += ((this.seen[i] | (this.seen[i + 1] << 1) | (this.seen[i + 2] << 2) | (this.seen[i + 3] << 3)) & 15).toString(16);
    try { localStorage.setItem(KEY, JSON.stringify({ fog, pins: this.pins } satisfies MapState)); } catch { /* blocked */ }
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

  addPin(text: string): Pin | null {
    const p = this.player();
    if (!text.trim() || Math.abs(p.x) > HALF || Math.abs(p.z) > HALF) return null;
    const pin = { id: 'pin' + Date.now().toString(36), x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, text: text.trim().slice(0, 120), created: new Date().toISOString().slice(0, 10) };
    this.pins.push(pin); this.save(); this.render();
    return pin;
  }
  open() { this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.id === 'mpPin') this.addPin((this.el.querySelector('#mpText') as HTMLInputElement).value);
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
        <canvas id="mpCanvas" width="600" height="600"></canvas>
        <div class="map-side">
          <p class="fine">${Math.round(this.revealed * 100)}% of the glade explored. Places fill in as you walk.</p>
          <div class="map-pin-row"><input id="mpText" type="text" maxlength="120" placeholder="A note for this spot"><button class="secondary" id="mpPin">Pin it here</button></div>
          <ul class="map-pins">${this.pins.map((p) => `<li>${escapeHtml(p.text)} <button class="sk-del" data-del="${p.id}" aria-label="Remove">×</button></li>`).join('')}</ul>
          <div class="forge-actions">${this.pins.length ? '<button class="secondary" id="mpSubmit">Submit my notes…</button>' : ''}<button class="primary" id="mpClose">Close</button></div>
        </div>
      </div>`;
    this.canvas = this.el.querySelector('#mpCanvas')!;
    this.draw();
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
    g.beginPath(); g.arc(X(0), Z(0), 2.2 * S, 0, 7); g.stroke();                                                          // dais
    g.strokeRect(X(10), Z(2.5), 10 * S, 7 * S);                                                                           // gallery
    g.beginPath(); g.arc(X(-7), Z(0), 3.5 * S, 0, 7); g.stroke();                                                         // camp
    const label = (x: number, z: number, t: string, size = 15) => { if (!this.isSeen(x, z)) return; g.font = `italic ${size}px Georgia, serif`; g.fillStyle = '#2B2418'; g.textAlign = 'center'; g.fillText(t, X(x), Z(z)); };
    label(0, -30, 'The Ruined Library', 18); label(0, 3.8, 'Rune dais'); label(15, 1.6, 'Gallery hall'); label(-7, 5.2, 'Camp'); label(0, 12.5, 'Paved road'); label(-14, 10.2, 'Dojo');
    g.strokeRect(X(-18), Z(10.5), 8 * S, 7 * S);                                                                          // dojo
    // What happened here.
    const icon: Record<Mark['kind'], [string, string]> = { clue: ['✕', '#7A2420'], lead: ['◆', '#2E5FA8'], found: ['★', '#A8322A'], song: ['♪', '#6B4423'], delve: ['▼', '#2B2A24'], place: ['•', '#2B2418'] };
    for (const m of this.marks()) {
      if (!this.isSeen(m.x, m.z) && m.kind !== 'found') continue;
      const [ch, col] = icon[m.kind];
      g.fillStyle = col; g.font = 'bold 16px Georgia, serif'; g.textAlign = 'center'; g.fillText(ch, X(m.x), Z(m.z) + 5);
      if (m.label) { g.font = 'italic 12px Georgia, serif'; g.fillText(m.label, X(m.x), Z(m.z) + 20); }
    }
    for (const p of this.pins) { g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--my-ink') || '#2B2A24'; g.beginPath(); g.arc(X(p.x), Z(p.z), 5, 0, 7); g.fill(); g.font = '12px Georgia, serif'; g.textAlign = 'left'; g.fillText(p.text.slice(0, 28), X(p.x) + 8, Z(p.z) + 4); }
    // Fog over the unexplored cells.
    for (let cy = 0; cy < G; cy++) for (let cx = 0; cx < G; cx++) if (!this.seen[cy * G + cx]) { g.fillStyle = 'rgba(120,100,70,.82)'; g.fillRect(cx * CELLM * S, cy * CELLM * S, CELLM * S + 0.5, CELLM * S + 0.5); }
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
