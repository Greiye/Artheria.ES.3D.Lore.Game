import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';

// B10 sketch-to-world: a 32×32 pixel painter. Sketches stay on this device and get stamped onto
// things in the world (the camp banner) and onto margin notes as wax seals (B3). Pixels are stored
// as one hex digit per pixel (palette index, 0 = clear), so a sketch is 1024 characters: small
// enough for localStorage and for a lore file's front matter when it is submitted.
export const SIZE = 32;
// Legends-bright primaries + Vintage Story earths. Index 0 is transparent.
export const PALETTE = ['', '#2B2A24', '#EFE3C4', '#C8423A', '#E8873A', '#F2C94C', '#7C9A45', '#3E6FA8',
  '#3FE0E8', '#7A3A5A', '#553823', '#B0693F', '#7A7D80', '#FFFFFF', '#F0C8A0', '#2E4A6E'];
export interface Sketch { id: string; name: string; px: string }
const KEY = 'gametool.sketches';
const MAX = 12;

// The default banner emblem (a rune ring) so the camp banner is never blank.
export const DEFAULT_SKETCH: Sketch = (() => {
  const px: string[] = Array(SIZE * SIZE).fill('7');
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const d = Math.hypot(x - 15.5, y - 13.5);
    if (d > 7.5 && d < 10) px[y * SIZE + x] = '8';
    if (Math.abs(x - 15.5) < 1.2 && y > 7 && y < 20) px[y * SIZE + x] = '5';
    if (y > 26 && (x + y) % 4 < 2) px[y * SIZE + x] = 'f';
  }
  return { id: 'default', name: 'Rune ring', px: px.join('') };
})();

export function loadSketches(): Sketch[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Sketch[];
    return Array.isArray(v) ? v.filter((s) => typeof s.px === 'string' && s.px.length === SIZE * SIZE) : [];
  } catch { return []; }
}
export function saveSketches(list: Sketch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* storage full or blocked */ }
}
export function sketchById(id: string | undefined): Sketch | undefined {
  if (!id) return undefined;
  return id === DEFAULT_SKETCH.id ? DEFAULT_SKETCH : loadSketches().find((s) => s.id === id);
}

// Paint a sketch into a canvas at `scale` px per pixel (also used for thumbnails and seals).
export function drawSketch(ctx: CanvasRenderingContext2D, s: Sketch, x0 = 0, y0 = 0, scale = 1) {
  for (let i = 0; i < SIZE * SIZE; i++) {
    const c = PALETTE[parseInt(s.px[i], 16)];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(x0 + (i % SIZE) * scale, y0 + Math.floor(i / SIZE) * scale, scale, scale);
  }
}
export function sketchDataUrl(s: Sketch, scale = 2): string {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE * scale;
  drawSketch(c.getContext('2d')!, s, 0, 0, scale);
  return c.toDataURL();
}

export function sketchMarkdown(s: Sketch, author: string): string {
  return entryMarkdown({
    title: s.name || 'Untitled sketch', author, type: 'sketch', tags: ['sketch'],
    body: `A 32×32 sketch made in the game. \`pixels\` is one hex digit per pixel (palette index, row by row).\n`,
    extra: { pixels: s.px, palette: PALETTE.slice(1).join(' ') },
  });
}

type Tool = 'pen' | 'fill' | 'erase';

// The painter: a forge-style side panel. `onStamp` hangs the sketch on the camp banner.
export class SketchPad {
  readonly el: HTMLDivElement;
  private px: string[] = DEFAULT_SKETCH.px.split('');
  private name = '';
  private id = '';
  private colour = 1;
  private tool: Tool = 'pen';
  private mirror = false;
  private undo: string[] = [];
  private canvas!: HTMLCanvasElement;
  private drawing = false;

  constructor(private onStamp: (s: Sketch) => void, private onClose: () => void, private author: () => string) {
    this.el = document.createElement('div');
    this.el.id = 'sketchpad';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }

  get isOpen() { return !this.el.classList.contains('hidden'); }
  get pixels() { return this.px.join(''); }
  open(start?: Sketch) {
    const s = start ?? loadSketches()[0] ?? DEFAULT_SKETCH;
    this.px = s.px.split(''); this.name = s.id === 'default' ? '' : s.name; this.id = s.id === 'default' ? '' : s.id;
    this.undo = [];
    this.render();
    this.el.classList.remove('hidden');
  }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }

  current(): Sketch {
    const n = (this.el.querySelector('#skName') as HTMLInputElement | null)?.value.trim();
    if (n !== undefined) this.name = n;
    return { id: this.id || 'sk' + Date.now().toString(36), name: this.name || 'Untitled sketch', px: this.pixels };
  }
  save(): Sketch {
    const s = this.current();
    this.id = s.id;
    saveSketches([s, ...loadSketches().filter((o) => o.id !== s.id)]);
    this.renderList();
    return s;
  }
  // Paint one pixel (with the mirror) — exposed for tests and for the pointer handler.
  paint(x: number, y: number) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const v = this.tool === 'erase' ? '0' : this.colour.toString(16);
    if (this.tool === 'fill') { this.fill(x, y, v); return; }
    this.px[y * SIZE + x] = v;
    if (this.mirror) this.px[y * SIZE + (SIZE - 1 - x)] = v;
    this.paintCanvas();
  }
  private fill(x: number, y: number, v: string) {
    const from = this.px[y * SIZE + x];
    if (from === v) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE || this.px[cy * SIZE + cx] !== from) continue;
      this.px[cy * SIZE + cx] = v;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    this.paintCanvas();
  }

  private click(e: Event) {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    const d = t.dataset;
    if (d.c !== undefined) { this.colour = Number(d.c); if (this.tool === 'erase') this.tool = 'pen'; this.renderTools(); }
    else if (d.tool) { this.tool = d.tool as Tool; this.renderTools(); }
    else if (t.id === 'skMirror') { this.mirror = !this.mirror; this.renderTools(); }
    else if (t.id === 'skUndo') { const u = this.undo.pop(); if (u) { this.px = u.split(''); this.paintCanvas(); } }
    else if (t.id === 'skClear') { this.pushUndo(); this.px.fill('0'); this.paintCanvas(); }
    else if (t.id === 'skNew') { this.id = ''; this.name = ''; this.px.fill('0'); this.render(); }
    else if (t.id === 'skStamp') { const s = this.save(); this.onStamp(s); }
    else if (t.id === 'skDone') { this.save(); this.close(); }
    else if (t.id === 'skSubmit') { const s = this.save(); openSubmitSheet({ kind: 'sketch', title: s.name, markdown: sketchMarkdown(s, this.author()) }); }
    else if (d.load) { const s = sketchById(d.load); if (s) { this.px = s.px.split(''); this.name = s.id === 'default' ? '' : s.name; this.id = s.id === 'default' ? '' : s.id; this.render(); } }
    else if (d.del) { saveSketches(loadSketches().filter((s) => s.id !== d.del)); if (this.id === d.del) this.id = ''; this.renderList(); }
  }
  private pushUndo() { this.undo.push(this.pixels); if (this.undo.length > 30) this.undo.shift(); }

  private render() {
    this.el.innerHTML = `
      <div class="forge-panel sketch-panel">
        <div class="eyebrow">Sketchbook · 32 × 32</div>
        <h2>Paint a banner</h2>
        <canvas id="skCanvas" width="${SIZE}" height="${SIZE}"></canvas>
        <div class="swatches sk-palette">${PALETTE.map((c, i) => i ? `<button class="sw" data-c="${i}" style="background:${c}" aria-label="colour ${i}"></button>` : '').join('')}</div>
        <div class="chips sk-tools">
          <button class="chip" data-tool="pen">Pen</button><button class="chip" data-tool="fill">Fill</button><button class="chip" data-tool="erase">Eraser</button>
          <button class="chip" id="skMirror">Mirror</button><button class="chip" id="skUndo">Undo</button><button class="chip" id="skClear">Clear</button>
        </div>
        <label class="field">Name<input id="skName" type="text" maxlength="40" value="${escapeHtml(this.name)}" placeholder="e.g. The Lantern Crest"></label>
        <h4>Saved on this device</h4>
        <div class="sk-list"></div>
        <div class="forge-actions"><button class="primary" id="skStamp">Hang on the banner</button></div>
        <div class="forge-actions"><button class="secondary" id="skDone">Done</button><button class="secondary" id="skSubmit">Submit…</button></div>
        <p class="fine">Sketches also work as wax seals on margin notes.</p>
      </div>`;
    this.canvas = this.el.querySelector('#skCanvas')!;
    const at = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / r.width * SIZE), Math.floor((e.clientY - r.top) / r.height * SIZE)];
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      this.pushUndo(); this.drawing = this.tool !== 'fill';
      this.canvas.setPointerCapture?.(e.pointerId);
      const [x, y] = at(e); this.paint(x, y);
    });
    this.canvas.addEventListener('pointermove', (e) => { if (this.drawing) { const [x, y] = at(e); this.paint(x, y); } });
    const stop = () => { this.drawing = false; };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
    this.paintCanvas(); this.renderTools(); this.renderList();
  }
  private renderTools() {
    this.el.querySelectorAll<HTMLButtonElement>('[data-c]').forEach((b) => b.classList.toggle('on', this.tool !== 'erase' && Number(b.dataset.c) === this.colour));
    this.el.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === this.tool));
    this.el.querySelector('#skMirror')?.classList.toggle('on', this.mirror);
  }
  private renderList() {
    const list = this.el.querySelector('.sk-list');
    if (!list) return;
    const all = [...loadSketches(), DEFAULT_SKETCH];
    list.innerHTML = all.map((s) => `<span class="sk-item"><button class="sk-thumb" data-load="${s.id}" title="${escapeHtml(s.name)}"><img alt="" src="${sketchDataUrl(s, 1)}"></button>${s.id === 'default' ? '' : `<button class="sk-del" data-del="${s.id}" aria-label="Delete">×</button>`}</span>`).join('');
  }
  private paintCanvas() {
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawSketch(ctx, { id: '', name: '', px: this.pixels });
  }
}
