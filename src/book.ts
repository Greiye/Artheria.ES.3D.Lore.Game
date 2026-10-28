import { renderMarkdown } from './markdown';
import { resolveImage, entryById, type LoreEntry } from './lore';
import { controls } from './controls';
import { saveSettings, type Settings } from './settings';
import { audio } from './audio';

// M4 — interactive lore book. Covers F3.2–F3.7 (opening/closing input is wired in main.ts).
// Content is paginated block by block into fixed-size pages; paragraphs and lists that do not
// fit are split at a word boundary (DOM Range keeps inline formatting intact), so long entries
// flow across pages with no clipped text (F3.5).

interface Page { blocks: Node[]; entryId?: string }
// B3: what a page on screen shows, so margin notes can be drawn onto it. `rel` = page number within its entry.
export interface PageView { page: HTMLDivElement; index: number; entryId?: string; rel: number }

const TURN_MS = 260; // F3.3: page-turn animation <= 300 ms

export class Book {
  readonly root: HTMLDivElement;
  private spread: HTMLDivElement;
  private left: HTMLDivElement;
  private right: HTMLDivElement;
  private folioL: HTMLDivElement;
  private folioR: HTMLDivElement;
  private measure: HTMLDivElement;
  private flip: HTMLDivElement;
  private pages: Page[] = [];
  private entryStart = new Map<string, number>();
  private first = 0;            // index of the left-most visible page
  private sizeKey = '';
  private turning = false;
  isOpen = false;
  onClose: () => void = () => {};
  onLink: (slug: string) => void = () => {};   // F5.6
  onRender: (views: PageView[]) => void = () => {};   // B3 margins
  onHide: () => void = () => {};
  private contents: boolean;
  private persist: boolean;

  // The lectern book (contents page, remembers the last page read, F3.7) and the shelf reader (F5.4: one
  // book at a time, no contents) are two instances of this class.
  constructor(private entries: LoreEntry[], private settings: Settings, opts: { id?: string; contents?: boolean; persist?: boolean } = {}) {
    this.contents = opts.contents ?? true;
    this.persist = opts.persist ?? true;
    this.root = document.createElement('div');
    this.root.id = opts.id ?? 'book';
    this.root.className = 'book hidden';
    this.root.innerHTML = `
      <div class="spread">
        <div class="page left"><div class="page-inner"></div><div class="folio"></div></div>
        <div class="page right"><div class="page-inner"></div><div class="folio"></div></div>
        <div class="page measure" aria-hidden="true"><div class="page-inner"></div></div>
        <div class="flip"></div>
        <button class="edge prev" aria-label="Previous page"></button>
        <button class="edge next" aria-label="Next page"></button>
        <button class="book-close" aria-label="Close book">✕</button>
      </div>
      <div class="book-hint"></div>`;
    document.body.appendChild(this.root);
    this.spread = this.root.querySelector('.spread')!;
    this.left = this.root.querySelector('.page.left .page-inner')!;
    this.right = this.root.querySelector('.page.right .page-inner')!;
    this.folioL = this.root.querySelector('.page.left .folio')!;
    this.folioR = this.root.querySelector('.page.right .folio')!;
    this.measure = this.root.querySelector('.page.measure .page-inner')!;
    this.flip = this.root.querySelector('.flip')!;
    this.root.querySelector('.edge.prev')!.addEventListener('click', () => this.prev());
    this.root.querySelector('.edge.next')!.addEventListener('click', () => this.next());
    this.root.querySelector('.book-close')!.addEventListener('click', () => this.close());
    // Touch: swipe left/right to turn pages.
    let sx = 0, sy = 0, st = 0;
    this.spread.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = performance.now(); }, { passive: true });
    this.spread.addEventListener('touchend', (e) => {
      if (this.scroll) return;   // portrait scroll mode: a swipe scrolls instead
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3 && performance.now() - st < 2000) (dx < 0 ? this.next() : this.prev());
    }, { passive: true });
    // F3.4: contents links jump to the entry.
    this.spread.addEventListener('click', (e) => {
      const l = (e.target as HTMLElement).closest('[data-link]') as HTMLElement | null;
      if (l) { e.preventDefault(); this.onLink(l.dataset.link!); return; }   // F5.6
      const a = (e.target as HTMLElement).closest('[data-entry]') as HTMLElement | null;
      if (a) { e.preventDefault(); this.goto(this.entryStart.get(a.dataset.entry!) ?? 0); }
    });
    window.addEventListener('resize', () => { if (this.isOpen) { this.applyMode(); void this.layout(true); } });
    // v0.04 portrait scroll: the page at the top of the column is the current page (remembered, F3.7).
    let queued = false;
    this.left.addEventListener('scroll', () => {
      if (!this.scroll || queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; this.syncScroll(); });
    }, { passive: true });
  }

  get pageCount() { return this.pages.length; }
  get currentPage() { return this.first; }
  // Phones in portrait (or any narrow window) show one page at a time.
  get perView(): 1 | 2 { return this.scroll || window.innerWidth < 760 || window.innerWidth < window.innerHeight * 0.9 || window.innerHeight < 500 ? 1 : 2; }
  // v0.04: a phone held upright reads the book as one vertical scroll instead of turning pages.
  get scroll(): boolean { return matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth; }
  private align(page: number) { return this.perView === 2 ? Math.floor(page / 2) * 2 : page; }
  private applyMode() {
    this.root.classList.toggle('single', this.perView === 1);
    this.root.classList.toggle('scroll', this.scroll);
    const touch = matchMedia('(pointer: coarse)').matches;
    this.root.querySelector('.book-hint')!.textContent = touch
      ? 'Swipe or tap a page edge to turn · ✕ to close'
      : 'A / D or ← / → turn · click a page edge · Tab, Esc or E to close · gamepad: LB / RB, B';
  }

  // F3.2: open on the last page read (F3.7).
  async open() {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.applyMode();
    await this.layout(false);
    const start = this.persist ? this.settings.lastPage : 0;
    this.first = this.align(Math.min(start, Math.max(0, this.pages.length - 1)));
    this.render();
  }

  // F5.4: show one entry (the shelf reader). Re-paginates for the new content.
  async openEntries(entries: LoreEntry[]) {
    this.entries = entries;
    this.sizeKey = '';
    this.pages = [];
    await this.open();
  }
  get entryIds() { return this.entries.map((e) => e.id); }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.onHide();
    this.onClose();
  }

  // Returns true when the key was consumed by the book.
  handleKey(code: string): boolean {
    const k = controls.keys;
    if ((k.pagePrev as readonly string[]).includes(code)) { this.prev(); return true; }
    if ((k.pageNext as readonly string[]).includes(code)) { this.next(); return true; }
    if ([...k.close, ...k.pause, ...k.activate].includes(code as never)) { this.close(); return true; }
    return false;
  }

  next() { if (this.first + this.perView < this.pages.length) this.turnTo(this.first + this.perView, 'next'); }
  prev() { if (this.first > 0) this.turnTo(Math.max(0, this.first - this.perView), 'prev'); }
  goto(page: number) {
    const s = this.align(Math.max(0, Math.min(page, this.pages.length - 1)));
    if (s !== this.first) this.turnTo(s, s > this.first ? 'next' : 'prev');
  }

  private turnTo(s: number, dir: 'next' | 'prev') {
    this.first = s;
    if (this.scroll) { this.scrollToFirst(true); return; }
    this.render();
    audio.pageTurn(); // A7
    // Visual-only flip; input is never blocked by it, so fast readers can keep turning.
    this.flip.className = 'flip ' + dir;
    void this.flip.offsetWidth;
    this.flip.classList.add('go');
    if (this.turning) return;
    this.turning = true;
    setTimeout(() => { this.flip.className = 'flip'; this.turning = false; }, TURN_MS);
  }

  private render() {
    if (this.scroll) { this.renderScroll(); return; }
    const show = (el: HTMLDivElement, folio: HTMLDivElement, i: number) => {
      const pg = i >= 0 ? this.pages[i] : undefined;
      el.replaceChildren(...(pg?.blocks.map((b) => b.cloneNode(true)) ?? []));
      folio.textContent = pg ? String(i + 1) : '';
    };
    show(this.left, this.folioL, this.first);
    show(this.right, this.folioR, this.perView === 2 ? this.first + 1 : -1);
    this.root.querySelector<HTMLButtonElement>('.edge.prev')!.disabled = this.first === 0;
    this.root.querySelector<HTMLButtonElement>('.edge.next')!.disabled = this.first + this.perView >= this.pages.length;
    if (this.persist) { this.settings.lastPage = this.first; saveSettings(this.settings); }
    const views: PageView[] = [];
    const view = (el: HTMLDivElement, i: number) => {
      const pg = this.pages[i];
      if (!pg) return;
      const start = pg.entryId ? this.entryStart.get(pg.entryId) ?? i : i;
      views.push({ page: el.parentElement as HTMLDivElement, index: i, entryId: pg.entryId, rel: i - start });
    };
    view(this.left, this.first);
    if (this.perView === 2) view(this.right, this.first + 1);
    this.onRender(views);
  }

  // ---------- portrait scroll (v0.04) ----------
  private sections: HTMLElement[] = [];
  private renderScroll() {
    this.sections = this.pages.map((pg, i) => {
      const sec = document.createElement('section');
      sec.className = 'scroll-page';
      sec.append(...pg.blocks.map((b) => b.cloneNode(true)));
      const f = document.createElement('div');
      f.className = 'scroll-folio';
      f.textContent = String(i + 1);
      sec.append(f);
      return sec;
    });
    this.left.replaceChildren(...this.sections);
    this.folioL.textContent = this.folioR.textContent = '';
    this.right.replaceChildren();
    this.scrollToFirst(false);
    this.emitScroll();
  }
  private scrollToFirst(smooth: boolean) {
    const sec = this.sections[this.first];
    if (sec) this.left.scrollTo({ top: sec.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
  }
  private syncScroll() {
    const top = this.left.scrollTop + 8;
    let i = 0;
    while (i + 1 < this.sections.length && this.sections[i + 1].offsetTop <= top) i++;
    if (i === this.first) return;
    this.first = i;
    this.emitScroll();
  }
  private emitScroll() {
    if (this.persist) { this.settings.lastPage = this.first; saveSettings(this.settings); }
    const pg = this.pages[this.first], sec = this.sections[this.first];
    if (!pg || !sec) { this.onRender([]); return; }
    const start = pg.entryId ? this.entryStart.get(pg.entryId) ?? this.first : this.first;
    this.onRender([{ page: sec as HTMLDivElement, index: this.first, entryId: pg.entryId, rel: this.first - start }]);
  }

  // ---------- pagination ----------
  private async layout(keepPosition: boolean) {
    const key = `${this.measure.clientWidth}x${this.measure.clientHeight}`;
    if (key === this.sizeKey && this.pages.length) return;
    const anchor = this.pages[this.first]?.entryId;
    this.sizeKey = key;
    this.pages = [];
    this.entryStart.clear();

    // Entries first (each starts on a fresh page), then the contents pages are prepended.
    const entryPages: Page[] = [];
    const starts: [string, number][] = [];
    for (const e of this.entries) {
      const blocks: HTMLElement[] = [];
      const head = document.createElement('header');
      head.className = 'chapter';
      head.innerHTML = '<h1></h1><div class="byline"></div>';
      head.classList.add('tier-' + (e.tier ?? 'note'));   // F5.5: tiers look different
      head.querySelector('h1')!.textContent = e.title;
      // L3 / D9: every entry is credited by its own credit_as. F5.5: the tier is shown, never hidden.
      const kind = e.type && e.type !== 'lore' ? e.type + ' · ' : '';
      head.querySelector('.byline')!.textContent = `${kind}by ${e.credit_as} · ${e.created} · ${e.tier ?? 'note'}${e.tags.length ? ' · ' + e.tags.join(', ') : ''}`;
      // §6.4 reply book: "In reply to <title> by <credit_as>", from the linked file's own frontmatter.
      for (const r of e.replyTo ?? []) {
        const t = entryById.get(r);
        const line = document.createElement('div');
        line.className = 'reply-to';
        line.innerHTML = 'In reply to <a href="#" class="wikilink"></a> by <span></span>';
        const a = line.querySelector('a')!;
        if (t) { a.textContent = t.title; a.dataset.link = t.id; line.querySelector('span')!.textContent = t.credit_as; }
        else { line.textContent = `In reply to ${r} (missing page)`; }
        head.appendChild(line);
      }
      if (e.tier === 'fragment') {
        const f = document.createElement('div');
        f.className = 'tier-note';
        f.textContent = 'A fragment: unfinished on purpose.';
        head.appendChild(f);
      }
      blocks.push(head, ...renderMarkdown(stripTitle(e.body, e.title), resolveImage));
      await decodeImages(blocks);
      starts.push([e.id, entryPages.length]);
      for (const p of this.paginate(blocks)) entryPages.push({ ...p, entryId: e.id });
    }
    const contents = this.contents ? this.paginate(this.contentsBlocks(starts, 0)) : [];
    const offset = contents.length;
    // Second pass with real page numbers (same line count, so same page count).
    const contentsFinal = this.contents ? this.paginate(this.contentsBlocks(starts, offset)) : [];
    this.pages = [...contentsFinal, ...entryPages];
    starts.forEach(([id, p]) => this.entryStart.set(id, p + offset));
    if (keepPosition && anchor) {
      this.first = this.align(this.entryStart.get(anchor) ?? 0);
      this.render();
    } else if (keepPosition) {
      this.first = this.align(Math.min(this.first, Math.max(0, this.pages.length - 1)));
      this.render();
    }
  }

  // F3.4: page 1 is the contents — entry title + contributor, each a link.
  private contentsBlocks(starts: [string, number][], offset: number): HTMLElement[] {
    const h = document.createElement('header');
    h.className = 'chapter';
    h.innerHTML = '<h1>Tales of Artheria</h1><div class="byline">Compiled by Natalie Bourbon · ' + this.entries.length + ' entries</div>';
    const items = this.entries.map((e, i) => {
      const row = document.createElement('a');
      row.className = 'toc-row';
      row.href = '#';
      row.dataset.entry = e.id;
      row.innerHTML = '<span class="toc-title"></span><span class="toc-by"></span><span class="toc-page"></span>';
      row.querySelector('.toc-title')!.textContent = e.title;
      row.querySelector('.toc-by')!.textContent = e.credit_as;
      row.querySelector('.toc-page')!.textContent = String(starts[i][1] + offset + 1);
      return row;
    });
    if (!items.length) {
      const p = document.createElement('p');
      p.textContent = 'No lore yet. Add a Markdown file to content/lore/ and run `npm run lore`.';
      return [h, p];
    }
    return [h, ...items];
  }

  private paginate(blocks: HTMLElement[]): Page[] {
    const pages: Page[] = [];
    const m = this.measure;
    m.replaceChildren();
    const fits = () => m.scrollHeight <= m.clientHeight + 1;
    const flush = () => {
      // Never leave a heading stranded at the bottom of a page.
      const moved: Node[] = [];
      while (m.childNodes.length > 1 && /^H[1-6]$/.test((m.lastChild as HTMLElement).tagName)) moved.unshift(m.lastChild!.cloneNode(true)), m.removeChild(m.lastChild!);
      pages.push({ blocks: [...m.childNodes].map((n) => n.cloneNode(true)) });
      m.replaceChildren(...moved);
    };
    const queue: HTMLElement[] = blocks.slice();
    let guard = 0;
    while (queue.length && guard++ < 100000) {
      const b = queue.shift()!;
      m.appendChild(b);
      if (fits()) continue;
      m.removeChild(b);
      if (/^(P|UL|OL|BLOCKQUOTE)$/.test(b.tagName)) {
        const [head, tail] = splitToFit(b, m, fits);
        if (head) m.appendChild(head);
        if (!m.childNodes.length) { m.appendChild(b); flush(); continue; } // cannot split (one huge word)
        flush();
        if (tail) queue.unshift(tail);
        continue;
      }
      if (!m.childNodes.length) { m.appendChild(b); flush(); continue; } // oversized single block: CSS caps it
      flush();
      queue.unshift(b);
    }
    if (m.childNodes.length || !pages.length) flush();
    m.replaceChildren();
    return pages;
  }
}

// Remove a leading "# Title" line that duplicates the chapter header.
function stripTitle(body: string, title: string): string {
  const m = /^\s*#\s+(.+)\n?/.exec(body);
  return m && m[1].trim().toLowerCase() === title.trim().toLowerCase() ? body.slice(m[0].length) : body;
}

async function decodeImages(blocks: HTMLElement[]) {
  const imgs = blocks.flatMap((b) => [...b.querySelectorAll('img')]);
  await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));
}

// Largest word-boundary prefix of `el` that still fits on the current page.
function splitToFit(el: HTMLElement, m: HTMLElement, fits: () => boolean): [HTMLElement | null, HTMLElement | null] {
  const cuts: [Text, number][] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const re = /\s+/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(n.data))) cuts.push([n, mm.index]);
  }
  // Also allow cuts between list items.
  if (el.tagName === 'UL' || el.tagName === 'OL') {
    [...el.children].forEach((li, i) => { if (i > 0) { const t = document.createTextNode(''); li.prepend(t); cuts.push([t, 0]); } });
    cuts.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }
  const part = (from: [Text, number] | null, to: [Text, number] | null) => {
    const r = document.createRange();
    if (from) r.setStart(from[0], from[1]); else r.setStart(el, 0);
    if (to) r.setEnd(to[0], to[1]); else r.setEnd(el, el.childNodes.length);
    const shell = el.cloneNode(false) as HTMLElement;
    shell.appendChild(r.cloneContents());
    shell.querySelectorAll('li').forEach((li) => { if (!li.textContent!.trim() && !li.querySelector('img')) li.remove(); });
    return shell;
  };
  let lo = 0, hi = cuts.length - 1, best = -1, bestEl: HTMLElement | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const h = part(null, cuts[mid]);
    m.appendChild(h);
    const ok = fits();
    m.removeChild(h);
    if (ok) { best = mid; bestEl = h; lo = mid + 1; } else hi = mid - 1;
  }
  if (best < 0) return [null, el];
  const tail = part(cuts[best], null);
  // Trim the leading whitespace of the continuation; mark it so it doesn't indent like a new paragraph.
  const first = document.createTreeWalker(tail, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
  if (first) first.data = first.data.replace(/^\s+/, '');
  tail.classList.add('cont');
  if (el.tagName === 'UL' || el.tagName === 'OL') {
    // Cut inside an item (not at an item boundary marker): the first tail item continues it.
    const midItem = cuts[best][0].data !== '';
    if (midItem) tail.firstElementChild?.classList.add('cont-li');
    if (el.tagName === 'OL') {
      const startN = Number(el.getAttribute('start') ?? 1);
      const headCount = bestEl!.querySelectorAll(':scope > li').length;
      tail.setAttribute('start', String(startN + headCount - (midItem ? 1 : 0)));
    }
  }
  return [bestEl, tail.textContent!.trim() || tail.querySelector('img') ? tail : null];
}
