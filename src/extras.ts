import { escapeHtml } from './submit';
import './extras.css';
import { SLOTS, slotInfo, slotLabel, switchTo, clearSlot, exportSlot, fileName, importInto } from './profiles';

// v0.05 main menu → Extras: Inspirations (the people behind the game; names used with their consent) and
// Evolution (screenshots from each stage of the build, oldest first, from assets/evolution/). Move between
// screenshots by scrolling or swiping, the arrow keys, or the D-pad left / right.
export interface Shot { src: string; title: string; caption: string }
declare const __EVOLUTION__: Shot[];

const INSPIRATIONS: { name: string; note: string }[] = [
  { name: 'Jason Molina', note: "For showing me what an inspired friend looks like. You're a creative rock to me, forever moved that I played in a part in your becoming an author." },
  { name: 'Vanessa Escalambre', note: "When you sing, I am reminded of a simple joy that you've always had to yourself since I met you in childhood." },
  { name: 'Revlis Go', note: 'Being there when I need you without judgement.' },
  { name: 'Little Miguel', note: 'Confiding in me your interest in game dev.' },
];

// References review: third-party models in public/models/ and their licences (also public/models/CREDITS.md).
const ASSET_CREDITS: { what: string; who: string; licence: string; href?: string; note?: string }[] = [
  { what: 'Witch (rig and animations) and Sword', who: 'Quaternius', licence: 'CC0', href: 'https://quaternius.com', note: 'Witch simplified for phones.' },
  { what: 'Low Poly Forest Tree Pack', who: '99.Miles', licence: 'CC BY 4.0', href: 'https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b', note: 'Textures resized to 512 px; unused maps removed.' },
];

export class Extras {
  readonly el: HTMLDivElement;
  tab: 'menu' | 'inspirations' | 'evolution' | 'profiles' = 'menu';
  /** B24: opened straight onto a page from the main menu, so Back returns to the menu. */
  private direct = false;
  /** B24: a profile changed under the running game (switch, clear, import into the live one): reload. */
  onProfileChange = () => location.reload();
  private armed = '';   // B24: "Clear" needs a second tap
  private note = '';
  shots: Shot[] = typeof __EVOLUTION__ === 'undefined' ? [] : __EVOLUTION__;
  index = 0;
  /** v0.06: Write lore lives here now (the main menu is Begin, Extras, Options). */
  onWrite = () => {};
  /** Mike 2026-10-30: What's new opens from here (it no longer pops up on Begin). */
  onWhatsNew = () => {};
  /** B21: the wiki, baked in at build time. */
  onWiki = () => {};
  private seeking = false;   // a smooth scroll we started is still on its way

  constructor(private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'extras';
    this.el.className = 'screen hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!b) return;
      if (b.dataset.tab) this.show(b.dataset.tab as Extras['tab']);
      else if (b.dataset.go) this.go(this.index + Number(b.dataset.go));
      else if (b.dataset.act === 'back') this.back();
      else if (b.dataset.act === 'write') this.onWrite();
      else if (b.dataset.act === 'whatsnew') this.onWhatsNew();
      else if (b.dataset.act === 'wiki') this.onWiki();
      else if (b.dataset.act?.startsWith('p')) this.profileAct(b.dataset.act, Number(b.dataset.slot));
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open(tab: Extras['tab'] = 'menu') { this.direct = tab !== 'menu'; this.armed = ''; this.note = ''; this.show(tab); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  /** B / Esc: from a page back to the Extras list, from the list back to the main menu. */
  back() { if (this.tab === 'menu' || this.direct) this.close(); else this.show('menu'); }

  private profileRow(i: number): string {
    const s = slotInfo(i), when = s.savedAt ? new Date(s.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const btn = (act: string, label: string, cls = 'secondary') => `<button class="${cls}" data-act="${act}" data-slot="${i}">${label}</button>`;
    return `<li class="prof${s.active ? ' on' : ''}" data-slot="${i}">
      <div class="prof-head"><b>${escapeHtml(slotLabel(s))}</b><span class="fine">${s.active ? 'Playing now' : s.empty ? 'Empty' : 'Saved'}${when ? ` · ${escapeHtml(when)}` : ''}</span></div>
      <div class="prof-acts">${s.active ? '' : btn('pplay', s.empty ? 'Start here' : 'Play this one', 'primary')}${s.empty ? '' : btn('pexport', 'Export')}${btn('pimport', 'Import')}${s.empty ? '' : btn('pclear', this.armed === `c${i}` ? 'Tap again to clear' : 'Clear')}</div></li>`;
  }

  private profileAct(act: string, i: number) {
    if (act === 'pplay') { if (switchTo(i)) this.onProfileChange(); return; }
    if (act === 'pexport') {
      const f = exportSlot(i), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' }));
      a.download = fileName(f); a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      this.note = `Exported ${f.name}.`; this.show('profiles'); return;
    }
    if (act === 'pimport') { const file = this.el.querySelector<HTMLInputElement>('#profFile')!; file.dataset.slot = String(i); file.value = ''; file.click(); return; }
    if (act === 'pclear') {
      if (this.armed !== `c${i}`) { this.armed = `c${i}`; this.show('profiles'); return; }
      this.armed = ''; const live = slotInfo(i).active; clearSlot(i);
      if (live) { this.onProfileChange(); return; }
      this.note = `Profile ${i + 1} cleared.`; this.show('profiles');
    }
  }

  show(tab: Extras['tab']) {
    this.tab = tab;
    const back = '<button class="secondary" data-act="back">Back</button>';
    if (tab === 'menu') {
      this.el.innerHTML = `<div class="card narrow extras-card"><div class="eyebrow">Extras</div><h1>Extras</h1>
        <button class="primary" data-tab="inspirations">Inspirations</button>
        <button class="secondary" data-tab="evolution">Evolution of the game</button>
        <button class="secondary" id="profilesBtn" data-tab="profiles">Profiles</button>
        <button class="secondary" id="writeLoreTitle" data-act="write">Write lore</button>
        <button class="secondary" id="whatsNewBtn" data-act="whatsnew">What's new</button>
        <button class="secondary" id="wikiBtn" data-act="wiki">Wiki</button>
        ${back}</div>`;
    } else if (tab === 'profiles') {
      this.el.innerHTML = `<div class="card narrow extras-card"><div class="eyebrow">Extras</div><h1>Profiles</h1>
        <p class="fine">Three profiles on this device, each with its own hero, save, bag, writing and progress. Settings are shared. Nothing is stored online: export a profile to keep a copy or move it to another device.</p>
        <ul class="prof-list">${Array.from({ length: SLOTS }, (_, i) => this.profileRow(i)).join('')}</ul>
        ${this.note ? `<p class="prof-note" role="status">${escapeHtml(this.note)}</p>` : ''}
        <input type="file" id="profFile" accept="application/json,.json" style="display:none">
        ${back}</div>`;
      const file = this.el.querySelector<HTMLInputElement>('#profFile')!;
      file.addEventListener('change', async () => {
        const f = file.files?.[0], i = Number(file.dataset.slot);
        if (!f || !(i >= 0 && i < SLOTS)) return;
        const err = importInto(i, await f.text());
        if (err) { this.note = err; this.show('profiles'); return; }
        if (slotInfo(i).active) { this.onProfileChange(); return; }
        this.note = `Imported into ${slotLabel(slotInfo(i))}.`; this.show('profiles');
      });
    } else if (tab === 'inspirations') {
      this.el.innerHTML = `<div class="card narrow extras-card"><div class="eyebrow">Extras</div><h1>Inspirations</h1>
        <div class="insp-list">${INSPIRATIONS.map((p) => `<figure class="insp"><figcaption>${escapeHtml(p.name)}</figcaption><blockquote>${escapeHtml(p.note)}</blockquote></figure>`).join('')}</div>
        <h2 class="credits-head">Asset credits</h2>
        <ul class="asset-credits">${ASSET_CREDITS.map((c) => `<li><b>${escapeHtml(c.what)}</b> by ${c.href ? `<a href="${escapeHtml(c.href)}" target="_blank" rel="noopener">${escapeHtml(c.who)}</a>` : escapeHtml(c.who)}, ${c.licence === 'CC BY 4.0' ? '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>' : escapeHtml(c.licence)}.${c.note ? ` <span class="fine">${escapeHtml(c.note)}</span>` : ''}</li>`).join('')}</ul>
        ${back}</div>`;
    } else {
      this.el.innerHTML = `<div class="card evo-card"><div class="eyebrow">Extras · Evolution of the game</div>
        <div class="evo-strip" tabindex="0">${this.shots.map((s, i) => `<figure class="evo" data-i="${i}"><img src="${escapeHtml(s.src)}" alt="${escapeHtml(s.title)}" loading="lazy"><figcaption><b>${escapeHtml(s.title)}</b>${s.caption ? `<span>${escapeHtml(s.caption)}</span>` : ''}</figcaption></figure>`).join('') || '<p class="fine">No screenshots yet.</p>'}</div>
        <div class="evo-nav"><button class="secondary" data-go="-1" aria-label="Previous">‹</button><span class="evo-count"></span><button class="secondary" data-go="1" aria-label="Next">›</button></div>
        ${back}</div>`;
      const strip = this.el.querySelector('.evo-strip') as HTMLElement;
      // Scrolling (wheel or swipe) snaps from one screenshot to the next; keep the counter in step.
      strip.addEventListener('scroll', () => {
        const w = Math.max(1, strip.clientWidth);
        if (this.seeking) { if (Math.abs(strip.scrollLeft - this.index * w) < 2) this.seeking = false; return; }   // our own smooth scroll
        const i = Math.round(strip.scrollLeft / w);
        if (i !== this.index) { this.index = i; this.count(); }
      }, { passive: true });
      strip.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); this.go(this.index + Math.sign(e.deltaY)); } }, { passive: false });
      this.go(this.index, true);
    }
  }
  private count() { const c = this.el.querySelector('.evo-count'); if (c) c.textContent = this.shots.length ? `${this.index + 1} / ${this.shots.length}` : ''; }
  /** Show screenshot `i` (clamped). */
  go(i: number, instant = false) {
    if (this.tab !== 'evolution' || !this.shots.length) return;
    this.index = Math.max(0, Math.min(this.shots.length - 1, i));
    const strip = this.el.querySelector('.evo-strip') as HTMLElement | null;
    this.seeking = !instant && !!strip && Math.abs(strip.scrollLeft - this.index * strip.clientWidth) >= 2;
    strip?.scrollTo({ left: this.index * strip.clientWidth, behavior: instant ? 'auto' : 'smooth' });
    this.count();
  }
  /** Arrow keys / D-pad: left and right page the screenshots; Esc / Tab go back. */
  handleKey(code: string): boolean {
    if (this.tab === 'evolution' && (code === 'ArrowRight' || code === 'KeyD')) { this.go(this.index + 1); return true; }
    if (this.tab === 'evolution' && (code === 'ArrowLeft' || code === 'KeyA')) { this.go(this.index - 1); return true; }
    if (code === 'Escape' || code === 'Tab' || code === 'Backspace') { this.back(); return true; }
    return false;
  }
}
