import { escapeHtml } from './submit';
import './extras.css';

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

export class Extras {
  readonly el: HTMLDivElement;
  tab: 'menu' | 'inspirations' | 'evolution' = 'menu';
  shots: Shot[] = typeof __EVOLUTION__ === 'undefined' ? [] : __EVOLUTION__;
  index = 0;
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
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.show('menu'); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  /** B / Esc: from a page back to the Extras list, from the list back to the main menu. */
  back() { if (this.tab === 'menu') this.close(); else this.show('menu'); }

  show(tab: Extras['tab']) {
    this.tab = tab;
    const back = '<button class="secondary" data-act="back">Back</button>';
    if (tab === 'menu') {
      this.el.innerHTML = `<div class="card narrow extras-card"><div class="eyebrow">Extras</div><h1>Extras</h1>
        <button class="primary" data-tab="inspirations">Inspirations</button>
        <button class="secondary" data-tab="evolution">Evolution of the game</button>
        ${back}</div>`;
    } else if (tab === 'inspirations') {
      this.el.innerHTML = `<div class="card narrow extras-card"><div class="eyebrow">Extras</div><h1>Inspirations</h1>
        <div class="insp-list">${INSPIRATIONS.map((p) => `<figure class="insp"><figcaption>${escapeHtml(p.name)}</figcaption><blockquote>${escapeHtml(p.note)}</blockquote></figure>`).join('')}</div>
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
