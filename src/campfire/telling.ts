import './telling.css';

// v0.05 §5: Natalie tells a lore page by the fire, with kinetic type. Writers tag the page with plain markdown and
// the renderer turns the tags into delivery (Mike, 2026-10-28):
//   *x*   whisper: smaller, lighter, slower      **x**  emphasis: bold, swells as it lands
//   ***x*** dramatic beat: big, with a pause before   ... or —  a lingering pause
// Words appear one at a time; the pace follows the punctuation and the tags. On a phone held sideways, a prompt
// asks for portrait (the telling is laid out tall: Natalie and the fire above, the words below).
export type Tone = 'plain' | 'whisper' | 'em' | 'drama';
export interface Beat { word: string; tone: Tone; wait: number; para: number }

const BASE = 230;                                                          // ms per word, about 260 words a minute
const PACE: Record<Tone, number> = { plain: 1, whisper: 1.6, em: 1.2, drama: 1.9 };

/** Markdown → timed words. `wait` is how long after the previous word this one appears. */
export function parseTelling(md: string): { title: string; beats: Beat[] } {
  let title = '';
  const paras: string[] = [];
  for (const block of md.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t) continue;
    const h = /^#{1,6}\s+(.*)$/.exec(t);
    if (h) { if (!title) title = h[1].trim(); else paras.push(h[1].trim()); continue; }
    if (/^chords:/i.test(t) || /^!\[[^\]]*\]\([^)]*\)$/.test(t) || /^(\*\s*\*\s*\*|-\s*-\s*-)[\s*-]*$/.test(t)) continue;
    paras.push(t.split('\n').map((l) => l.replace(/^>\s?|^\s*([-*+]|\d+[.)])\s+/, '').trim()).join(' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, ''));
  }
  const beats: Beat[] = [];
  let carry = 0;   // extra pause owed to the next word (end of sentence, ellipsis, dash, paragraph)
  paras.forEach((p, pi) => {
    if (pi) carry += 700;
    // Split into toned runs: ***x***, **x**, *x* / _x_, and the plain text between.
    const re = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|(?<![\w])_([^_]+)_(?![\w])/g;
    let at = 0, m: RegExpExecArray | null;
    const runs: [string, Tone][] = [];
    while ((m = re.exec(p))) {
      if (m.index > at) runs.push([p.slice(at, m.index), 'plain']);
      runs.push(m[1] ? [m[1], 'drama'] : m[2] ? [m[2], 'em'] : [m[3] ?? m[4], 'whisper']);
      at = re.lastIndex;
    }
    if (at < p.length) runs.push([p.slice(at), 'plain']);
    for (const [text, tone] of runs) {
      // Dashes and ellipses are pauses in their own right, so they split words.
      const words = text.replace(/\s*(—|\.\.\.|…)\s*/g, '$1 ').split(/\s+/).filter(Boolean);
      words.forEach((w, wi) => {
        let wait = BASE * PACE[tone] + Math.max(0, w.length - 6) * 18 + carry;
        if (tone === 'drama' && wi === 0) wait += 650;   // a breath before the dramatic beat
        beats.push({ word: w, tone, wait, para: pi });
        carry = /(\.\.\.|…|—)$/.test(w) ? 900 : /[.!?]["”’)]?$/.test(w) ? 380 : /[,;:]$/.test(w) ? 160 : 0;
      });
    }
  });
  return { title, beats };
}

export class TellingView {
  readonly el: HTMLDivElement;
  beats: Beat[] = [];
  shown = 0;
  private clock = 0;
  private last = 0;
  private raf = 0;
  /** Called as each word lands (main flares the fire on emphasis and dramatic beats). */
  onBeat: (b: Beat) => void = () => {};
  onClose: () => void = () => {};

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'telling';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b?.id === 'ktClose') this.close();
      else if (b?.id === 'ktPortraitOk') this.el.classList.remove('ask-portrait');
      else if (!b) this.press();
    });
    addEventListener('keydown', (e) => {
      if (!this.isOpen || e.repeat) return;
      if (e.code === 'Escape') this.close();
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') this.press();
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    const mq = matchMedia('(orientation: portrait)');
    mq.addEventListener?.('change', () => { if (mq.matches) this.el.classList.remove('ask-portrait'); });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get done() { return this.shown >= this.beats.length; }
  /** Whether to ask for portrait: a touch screen held sideways. */
  static wantsPortrait() { return matchMedia('(pointer: coarse)').matches && innerWidth > innerHeight; }

  open(title: string, credit: string, md: string) {
    const t = parseTelling(md);
    this.beats = t.beats;
    this.shown = 0; this.clock = 0; this.last = performance.now();
    this.el.innerHTML = `
      <div class="kt-portrait"><p>Turn your phone upright.<br><span>Natalie tells it best in portrait.</span></p><button class="secondary" id="ktPortraitOk">Carry on sideways</button></div>
      <div class="kt-stage">
        <div class="kt-head"><div class="eyebrow">Natalie tells it</div><h2>${esc(t.title || title)}</h2><div class="kt-credit">${esc(credit)}</div></div>
        <div class="kt-text" aria-live="polite">${this.beats.map((b, i) => `${i && this.beats[i - 1].para !== b.para ? '</p>' : ''}${!i || this.beats[i - 1].para !== b.para ? '<p>' : ''}<span class="kt-w kt-${b.tone}">${esc(b.word)}</span> `).join('')}</p></div>
        <div class="kt-foot"><span class="fine">Tap or press A to hurry her along</span><button class="secondary" id="ktClose">Back to the fire</button></div>
      </div>`;
    this.el.classList.toggle('ask-portrait', TellingView.wantsPortrait());
    this.el.classList.remove('hidden');
    cancelAnimationFrame(this.raf);
    const tick = () => { if (!this.isOpen) return; this.step(); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }
  close() {
    if (!this.isOpen) return;
    cancelAnimationFrame(this.raf);
    this.el.classList.add('hidden');
    this.onClose();
  }
  /** A / tap / Space: finish the paragraph she's on; when she's done, go back to the fire. */
  press() {
    if (this.done) { this.close(); return; }
    const para = this.beats[this.shown].para;
    while (this.shown < this.beats.length && this.beats[this.shown].para === para) this.reveal(false);
    this.clock = 0;
  }
  /** Total telling time in ms (for tests). */
  get length() { return this.beats.reduce((s, b) => s + b.wait, 0); }

  private step() {
    const now = performance.now();
    this.clock += Math.min(250, now - this.last);
    this.last = now;
    while (!this.done && this.clock >= this.beats[this.shown].wait) { this.clock -= this.beats[this.shown].wait; this.reveal(true); }
  }
  private reveal(live: boolean) {
    const b = this.beats[this.shown], span = this.el.querySelectorAll<HTMLElement>('.kt-w')[this.shown];
    this.shown++;
    if (!span) return;
    span.classList.add('on');
    this.onBeat(b);
    if (live) span.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    if (this.done) this.el.classList.add('kt-done');
  }
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
