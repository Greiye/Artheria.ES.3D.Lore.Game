import type { Book, PageView } from '../book';
import './writing.css';
import type { LoreEntry } from '../lore';
import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';
import { loadSketches, sketchById, sketchDataUrl } from './sketch';

// B13 ink and paper + B3 margin notes. Your own stationery (an ink for everything you write, a paper
// for the books you read) and handwritten notes pinned to book pages. Everything stays on this device;
// "Submit notes" turns an entry's notes into a reply file (reply_to) for the maintainer to merge.

export const INKS = { 'iron gall': '#2B2A24', sepia: '#6B4423', cinnabar: '#B3362C', verdigris: '#2F7A62', indigo: '#2E3F7A', 'rune glow': '#1BA8B0' } as const;
export type Ink = keyof typeof INKS;
export const PAPERS = ['fresh', 'aged', 'vellum', 'charred'] as const;
export type Paper = typeof PAPERS[number];
export interface Stationery { ink: Ink; paper: Paper }
const STATIONERY = 'gametool.stationery';

export function loadStationery(): Stationery {
  try {
    const s = JSON.parse(localStorage.getItem(STATIONERY) ?? '{}');
    return { ink: s.ink in INKS ? s.ink : 'iron gall', paper: PAPERS.includes(s.paper) ? s.paper : 'fresh' };
  } catch { return { ink: 'iron gall', paper: 'fresh' }; }
}
export function saveStationery(s: Stationery) { try { localStorage.setItem(STATIONERY, JSON.stringify(s)); } catch { /* blocked */ } }
// Paper is a class on every book root; ink is a CSS variable the notes (and the editor) read.
export function applyStationery(s: Stationery) {
  document.querySelectorAll('.book').forEach((b) => { PAPERS.forEach((p) => b.classList.toggle('paper-' + p, p === s.paper)); });
  document.documentElement.style.setProperty('--my-ink', INKS[s.ink]);
}

export interface MarginNote { id: string; entryId: string; page: number; text: string; ink: Ink; seal?: string; created: string }
const MARGINS = 'gametool.margins';
export function loadMargins(): MarginNote[] {
  try { const v = JSON.parse(localStorage.getItem(MARGINS) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveMargins(list: MarginNote[]) { try { localStorage.setItem(MARGINS, JSON.stringify(list.slice(-300))); } catch { /* full */ } }

export function marginsMarkdown(e: LoreEntry, notes: MarginNote[], author: string): string {
  const body = notes.map((n) => `> ${n.text.replace(/\n/g, '\n> ')}\n\n— in ${n.ink} ink, page ${n.page + 1}${n.seal ? ', sealed' : ''}`).join('\n\n');
  return entryMarkdown({
    title: `Margins: ${e.title}`, author, type: 'margin', tags: ['margins'],
    body: `Notes written in the margins of *${e.title}*.\n\n${body}`,
    extra: { reply_to: e.id },
  });
}

// One controller per book: draws the notes on the visible pages and owns the "write in the margin" desk.
export class MarginDesk {
  private notes = loadMargins();
  private desk: HTMLDivElement;
  private pen: HTMLButtonElement;
  private views: PageView[] = [];
  private side = 0;
  private seal = '';
  onChange: () => void = () => {};

  constructor(book: Book, private stationery: () => Stationery, private setStationery: (s: Stationery) => void, private entry: (id: string) => LoreEntry | undefined, private author: () => string) {
    this.pen = document.createElement('button');
    this.pen.className = 'book-pen';
    this.pen.setAttribute('aria-label', 'Write in the margin');
    this.pen.textContent = '✎';
    book.root.querySelector('.spread')!.appendChild(this.pen);
    this.desk = document.createElement('div');
    this.desk.className = 'margin-desk hidden';
    book.root.appendChild(this.desk);
    this.pen.addEventListener('click', () => (this.isWriting ? this.closeDesk() : this.openDesk()));
    this.desk.addEventListener('click', (e) => this.click(e));
    book.onRender = (v) => { this.views = v; this.draw(); };
    book.onHide = () => this.closeDesk();
  }

  reload() { this.notes = loadMargins(); this.draw(); }
  get isWriting() { return !this.desk.classList.contains('hidden'); }
  get all() { return this.notes; }
  forEntry(id: string) { return this.notes.filter((n) => n.entryId === id); }

  add(text: string, view = this.views[this.side] ?? this.views[0]): MarginNote | null {
    if (!text.trim() || !view?.entryId) return null;
    const n: MarginNote = { id: 'mn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), entryId: view.entryId, page: view.rel, text: text.trim().slice(0, 280), ink: this.stationery().ink, seal: this.seal || undefined, created: new Date().toISOString().slice(0, 10) };
    this.notes.push(n);
    saveMargins(this.notes);
    this.draw();
    this.onChange();
    return n;
  }
  remove(id: string) { this.notes = this.notes.filter((n) => n.id !== id); saveMargins(this.notes); this.draw(); this.onChange(); }

  openDesk() {
    const pages = this.views.filter((v) => v.entryId);
    if (!pages.length) { this.desk.innerHTML = '<p class="fine">Turn to a story page to write in its margin.</p><div class="forge-actions"><button class="secondary" data-act="cancel">Close</button></div>'; this.desk.classList.remove('hidden'); return; }
    this.side = Math.max(0, this.views.indexOf(pages[pages.length - 1]));
    this.renderDesk();
    this.desk.classList.remove('hidden');
    (this.desk.querySelector('textarea') as HTMLTextAreaElement | null)?.focus();
  }
  closeDesk() { this.desk.classList.add('hidden'); }

  private renderDesk() {
    const st = this.stationery();
    const id = this.views[this.side]?.entryId;
    const e = id ? this.entry(id) : undefined;
    const sketches = loadSketches();
    this.desk.innerHTML = `
      <div class="eyebrow">In the margin${e ? ' of ' + escapeHtml(e.title) : ''}</div>
      ${this.views.length > 1 ? `<div class="chips">${this.views.map((v, i) => `<button class="chip${i === this.side ? ' on' : ''}" data-side="${i}" ${v.entryId ? '' : 'disabled'}>${i ? 'Right' : 'Left'} page</button>`).join('')}</div>` : ''}
      <textarea maxlength="280" rows="3" placeholder="A thought, a doubt, a correction…"></textarea>
      <h5>Ink</h5>
      <div class="swatches">${(Object.keys(INKS) as Ink[]).map((k) => `<button class="sw${k === st.ink ? ' on' : ''}" data-ink="${k}" title="${k}" style="background:${INKS[k]}"></button>`).join('')}</div>
      <h5>Paper</h5>
      <div class="chips">${PAPERS.map((p) => `<button class="chip${p === st.paper ? ' on' : ''}" data-paper="${p}">${p}</button>`).join('')}</div>
      ${sketches.length ? `<h5>Wax seal</h5><div class="chips seals"><button class="chip${this.seal ? '' : ' on'}" data-seal="">None</button>${sketches.map((s) => `<button class="chip seal-chip${this.seal === s.id ? ' on' : ''}" data-seal="${s.id}" title="${escapeHtml(s.name)}"><img alt="" src="${sketchDataUrl(s, 1)}"></button>`).join('')}</div>` : ''}
      <div class="forge-actions">
        <button class="primary" data-act="pin">Pin the note</button>
        <button class="secondary" data-act="cancel">Close</button>
      </div>
      ${e && this.forEntry(e.id).length ? `<button class="linkish" data-act="submit">Submit my notes on this story…</button>` : ''}`;
  }

  private click(ev: Event) {
    const t = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    const d = t.dataset, st = this.stationery();
    const keep = () => (this.desk.querySelector('textarea') as HTMLTextAreaElement | null)?.value ?? '';
    const rerender = () => { const txt = keep(); this.renderDesk(); const ta = this.desk.querySelector('textarea'); if (ta) ta.value = txt; };
    if (d.side) { this.side = Number(d.side); rerender(); }
    else if (d.ink) { this.setStationery({ ...st, ink: d.ink as Ink }); rerender(); this.draw(); }
    else if (d.paper) { this.setStationery({ ...st, paper: d.paper as Paper }); rerender(); }
    else if (d.seal !== undefined) { this.seal = d.seal; rerender(); }
    else if (d.act === 'pin') { if (this.add(keep())) this.closeDesk(); }
    else if (d.act === 'cancel') this.closeDesk();
    else if (d.act === 'submit') {
      const e = this.entry(this.views[this.side]?.entryId ?? '');
      if (e) openSubmitSheet({ kind: 'margins', title: `Margins: ${e.title}`, markdown: marginsMarkdown(e, this.forEntry(e.id), this.author()) });
    }
  }

  // Notes on the visible pages: handwritten slips tucked over the bottom of the page, newest on top.
  private draw() {
    for (const v of this.views) {
      v.page.querySelector('.margins')?.remove();
      const mine = v.entryId ? this.notes.filter((n) => n.entryId === v.entryId && n.page === v.rel) : [];
      if (!mine.length) continue;
      const box = document.createElement('div');
      box.className = 'margins';
      mine.slice(-3).forEach((n, i) => {
        const slip = document.createElement('div');
        slip.className = 'margin-note';
        slip.style.setProperty('--ink', INKS[n.ink] ?? INKS['iron gall']);
        slip.style.setProperty('--tilt', `${((n.id.charCodeAt(n.id.length - 1) % 7) - 3) * 0.8}deg`);
        slip.style.setProperty('--i', String(i));
        slip.innerHTML = `<span class="mn-text"></span><button class="mn-del" aria-label="Remove note" data-del="${n.id}">×</button>`;
        slip.querySelector('.mn-text')!.textContent = n.text;
        const seal = sketchById(n.seal);
        if (seal) { const img = document.createElement('img'); img.className = 'mn-seal'; img.alt = ''; img.src = sketchDataUrl(seal, 1); slip.prepend(img); }
        box.appendChild(slip);
      });
      if (mine.length > 3) { const more = document.createElement('div'); more.className = 'mn-more'; more.textContent = `+${mine.length - 3} more`; box.appendChild(more); }
      box.addEventListener('click', (e) => {
        const del = (e.target as HTMLElement).closest('[data-del]') as HTMLElement | null;
        if (del) { e.stopPropagation(); this.remove(del.dataset.del!); return; }
        const slip = (e.target as HTMLElement).closest('.margin-note');
        if (slip) { e.stopPropagation(); slip.classList.toggle('open'); }
      });
      v.page.appendChild(box);
    }
  }
}
