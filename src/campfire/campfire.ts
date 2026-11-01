import { SCALE, NOTE_NAMES, INSTRUMENTS, DEFAULT_TUNE, decodeTune, encodeTune, composeBallad, loadBallads, saveBallad, balladMarkdown, type Ballad, type Instrument, type Tune, type Telling } from './ballad';
import { openSubmitSheet, escapeHtml } from '../submit';
import { audio, type PlayKind } from '../audio';
import { STEMS } from './band';
import './campfire.css';

// B8 campfire ending + B11 bard tunes. Sit by the fire, write an 8-step tune, then tell the adventure in
// three turns (Natalie takes a turn between yours). The bard (Natalie is one) turns it into a ballad you
// can play, put on the shelf (it opens like any song) and submit.
const PROMPTS: [keyof Telling, string, string][] = [
  ['start', 'How did it start?', 'We came up the paved road at dusk…'],
  ['middle', 'What did you find?', 'Inside, the shelves went on forever…'],
  ['end', 'How did it end?', 'And when the blue light faded…'],
];
const TUNE_KEY = 'gametool.tune';
// v0.04: playable instruments. Hum and clap are always yours; the others come from the General Store.
// v0.05 §4.2: one instrument per player, and each plays its own stem of the camp song. The camp (Natalie and the
// regulars) plays every other stem while you sit; your stem is left to you ("Hear your part" plays it softly).
const PLAYABLE: { kind: PlayKind; label: string; item?: string; pads: number }[] = [
  { kind: 'hum', label: 'Hum', pads: 6 }, { kind: 'clap', label: 'Clap & stomp', pads: 2 },
  { kind: 'whistle', label: 'Tin whistle', item: 'whistle', pads: 6 }, { kind: 'drum', label: 'Hand drum', item: 'drum', pads: 2 },
  { kind: 'lute', label: 'Lute', item: 'lute', pads: 6 }, { kind: 'violin', label: 'Violin', item: 'violin', pads: 6 },
  { kind: 'ocarina', label: 'Ocarina', item: 'ocarina', pads: 6 },
];
const PENTA = [60, 62, 64, 67, 69, 72], PAD_NAMES = ['C', 'D', 'E', 'G', 'A', 'C′'];
// v0.06 C1: the panel is a list of big buttons, one open at a time, Sleep first.
export type FireSection = 'sleep' | 'play' | 'cook' | 'hear' | 'tell' | 'leave';
const SECTIONS: [FireSection, string, string][] = [
  ['sleep', '☾', 'Sleep'], ['play', '♫', 'Play along'], ['cook', '🍲', 'Cook'], ['hear', '❦', 'Hear a tale'], ['tell', '✒', 'Tell a tale'], ['leave', '⇠', 'Leave'],
];

export class CampfirePanel {
  readonly el: HTMLDivElement;
  tune: Tune = (() => { try { return decodeTune(localStorage.getItem(TUNE_KEY) ?? undefined); } catch { return structuredClone(DEFAULT_TUNE); } })();
  private telling: Telling = { start: '', middle: '', end: '' };
  private title = '';
  private chain = '';
  ballad: Ballad | null = null;
  /** v0.04: items the player owns (for the instruments), and where "Write lore" goes. Set by main. */
  owned: () => string[] = () => [];
  onWriteLore: () => void = () => {};
  /** B18: open the camp kitchen (main shows the cook panel over the fire). */
  onCook: () => void = () => {};
  /** v0.05 §5: lore Natalie can tell, and what happens when you ask for one. Set by main. */
  tales: () => { id: string; title: string }[] = () => [];
  onTell: (id: string) => void = () => {};
  instrument: PlayKind = 'hum';
  /** v0.06 C1: the open item (one at a time), and what Sleep says and does. Set by main. */
  section: FireSection | null = 'play';
  sleepLabel: () => string = () => 'Sleep';
  onSleep: () => void = () => {};
  /** v0.06 C3: a controller's button name for note pad i (null: keyboard numbers). Set by main. */
  padGlyph: ((i: number) => string) | null = null;
  private stopBand: () => void = () => {};

  constructor(private natalie: () => string[], private onShelf: (b: Ballad) => void, public onClose: () => void, private author: () => string) {
    this.el = document.createElement('div');
    this.el.id = 'campfire';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.dataset.turn) this.telling[t.dataset.turn as keyof Telling] = t.value;
      else if (t.id === 'cfTitle') this.title = t.value;
      else if (t.id === 'cfBpm') { this.tune.bpm = Number(t.value); this.saveTune(); const o = this.el.querySelector('#cfBpmOut'); if (o) o.textContent = String(this.tune.bpm); }
      else if (t.id === 'cfChain') this.chain = t.value;
    });
    // Number keys 1–6 play the pads (not while typing).
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.repeat || (e.target as HTMLElement).closest?.('input, textarea, select')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= this.pads) { this.pad(n - 1); e.preventDefault(); }
    });
  }
  /** v0.06 T3: where the fire's music comes from (a positional node at the fire); null = plain 2D. */
  out: () => AudioNode | null = () => null;
  get playable() { const own = this.owned(); return PLAYABLE.filter((p) => !p.item || own.includes(p.item)); }
  private get label() { return PLAYABLE.find((p) => p.kind === this.instrument)?.label ?? ''; }
  private get pads() { return PLAYABLE.find((p) => p.kind === this.instrument)?.pads ?? 6; }
  /** Play pad i (0-based) on the chosen instrument. Exposed for tests. */
  pad(i: number) {
    const melodic = this.pads > 2;
    audio.play(this.instrument, melodic ? PENTA[i] ?? 60 : i ? 64 : 55, this.out());
    const b = this.el.querySelector(`[data-pad="${i}"]`);
    if (b) { b.classList.remove('hit'); void (b as HTMLElement).offsetWidth; b.classList.add('hit'); }
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() {
    this.ballad = null;
    this.section = 'play';
    if (!this.playable.some((p) => p.kind === this.instrument)) this.instrument = 'hum';
    audio.band.muted = this.instrument;
    this.render(); this.el.classList.remove('hidden');
    this.stopBand = audio.playBand(STEMS, 84, this.out());   // the camp plays the other stems while you sit
  }
  close() { if (!this.isOpen) return; this.stopBand(); this.el.classList.add('hidden'); this.onClose(); }
  private saveTune() { try { localStorage.setItem(TUNE_KEY, encodeTune(this.tune)); } catch { /* blocked */ } }
  play(t: Tune = this.tune) { return audio.tune(t.steps, SCALE, t.instrument, t.bpm, 2, this.out()); }

  // Toggle one cell (step 0–7, row 0–7 from the low C). Exposed for tests.
  toggle(step: number, row: number) { this.tune.steps[step] ^= 1 << row; this.saveTune(); this.renderGrid(); }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    if (d.sec) { this.openSection(this.section === d.sec ? null : d.sec as FireSection); if (b.matches(':focus-visible')) this.focusSec(); return; }
    if (b.id === 'cfSleep') { this.close(); this.onSleep(); return; }
    if (d.step !== undefined) this.toggle(Number(d.step), Number(d.row));
    else if (d.pad !== undefined) this.pad(Number(d.pad));
    else if (d.play) { this.instrument = audio.band.muted = d.play as PlayKind; this.render(); }
    else if (b.id === 'cfGuide') { audio.band.guide = !audio.band.guide; this.render(); }
    else if (b.id === 'cfTell') { const sel = this.el.querySelector<HTMLSelectElement>('#cfTale'); if (sel?.value) this.onTell(sel.value); }
    else if (b.id === 'cfWriteLore') { this.close(); this.onWriteLore(); }
    else if (b.id === 'cfCook') this.onCook();
    else if (d.inst) { this.tune.instrument = d.inst as Instrument; this.saveTune(); this.render(); }
    else if (b.id === 'cfPlay') this.play();
    else if (b.id === 'cfClearTune') { this.tune.steps = Array(8).fill(0); this.saveTune(); this.renderGrid(); }
    else if (b.id === 'cfBard') {
      if (!PROMPTS.every(([k]) => this.telling[k].trim().length >= 3)) return;
      const prev = loadBallads().find((x) => x.id === this.chain);
      this.ballad = composeBallad(this.telling, this.natalie(), this.title.trim() || 'The Ballad of the Ruined Library', this.tune, prev);
      this.render();
      this.play(decodeTune(this.ballad.tune));
    }
    else if (b.id === 'cfShelf' && this.ballad) { saveBallad(this.ballad); this.onShelf(this.ballad); this.render(); }
    else if (b.id === 'cfSubmit' && this.ballad) openSubmitSheet({ kind: 'song', title: this.ballad.title, markdown: balladMarkdown(this.ballad, this.author()) });
    else if (b.id === 'cfAgain') { this.ballad = null; this.render(); }
    else if (b.id === 'cfClose') this.close();
  }

  /** Open one item (or none), closing the others. */
  openSection(sec: FireSection | null) { this.section = sec; this.render(); }
  private focusSec(sec = this.section) { this.el.querySelector<HTMLElement>(`[data-sec="${sec ?? 'sleep'}"]`)?.focus({ preventScroll: true }); }
  private padsHtml() {
    return Array.from({ length: this.pads }, (_, i) => `<button class="cf-pad" data-pad="${i}"><kbd>${this.padGlyph ? this.padGlyph(i) : i + 1}</kbd>${this.pads > 2 ? PAD_NAMES[i] : i ? 'Accent' : 'Beat'}</button>`).join('');
  }
  /** C3: swap the note keys' labels when a controller comes or goes. */
  setPadGlyphs(g: ((i: number) => string) | null) {
    this.padGlyph = g;
    const p = this.el.querySelector('.cf-pads');
    if (p) p.innerHTML = this.padsHtml();
  }
  /** C1 without a mouse: up / down move through the items and the open item's controls, A opens or presses,
   *  left / right change a list, B closes the open item (or, with none open, leaves the fire). */
  input(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') {
    const items = [...this.el.querySelectorAll<HTMLElement>('.cf-sec, .cf-body button, .cf-body select')].filter((e) => e.offsetParent !== null);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const cur = items[at];
    if (dir === 'back') {
      if (this.section) { const was = this.section; this.openSection(null); this.focusSec(was); } else this.close();
      return;
    }
    if (dir === 'up' || dir === 'down') { items[at < 0 ? 0 : (at + (dir === 'down' ? 1 : -1) + items.length) % items.length]?.focus({ preventScroll: true }); return; }
    if (!cur) { items[0]?.focus({ preventScroll: true }); return; }
    if (cur instanceof HTMLSelectElement) {
      if (dir === 'left' || dir === 'right' || dir === 'ok') cur.selectedIndex = (cur.selectedIndex + (dir === 'left' ? -1 : 1) + cur.options.length) % cur.options.length;
      return;
    }
    if (dir !== 'ok') return;
    const sec = cur.dataset.sec as FireSection | undefined;
    if (sec === 'leave') { this.close(); return; }
    cur.click();
    if (sec && this.section === sec) this.el.querySelector<HTMLElement>('.cf-body button, .cf-body select')?.focus({ preventScroll: true });
    else if (sec) this.focusSec(sec);
  }

  private renderGrid() {
    const g = this.el.querySelector('.cf-grid');
    if (!g) return;
    g.innerHTML = [...SCALE.keys()].reverse().map((r) => `<span class="cf-note">${NOTE_NAMES[r]}</span>${this.tune.steps.map((m, s) => `<button class="cf-cell${m & (1 << r) ? ' on' : ''}${s % 4 === 0 ? ' beat' : ''}" data-step="${s}" data-row="${r}" aria-label="${NOTE_NAMES[r]} step ${s + 1}"></button>`).join('')}`).join('');
  }

  private render() {
    const nat = this.natalie();
    const saved = loadBallads();
    const shelved = this.ballad && saved.some((x) => x.id === this.ballad!.id);
    const body = this.ballad ? `
      <h4>The bard sings</h4>
      <div class="cf-ballad"><h3>${escapeHtml(this.ballad.title)}</h3>${this.ballad.verses.map((v) => `<p>${v.map(escapeHtml).join('<br>')}</p>`).join('')}</div>
      <div class="forge-actions"><button class="secondary" id="cfPlay">Play the tune</button><button class="${shelved ? 'secondary' : 'primary'}" id="cfShelf">${shelved ? 'On the shelf ✓' : 'Put it on the shelf'}</button></div>
      <div class="forge-actions"><button class="secondary" id="cfSubmit">Submit…</button><button class="secondary" id="cfAgain">Tell it again</button></div>`
      : `
      <h4>Your tune</h4>
      <div class="chips">${INSTRUMENTS.map((i) => `<button class="chip${i === this.tune.instrument ? ' on' : ''}" data-inst="${i}">${i}</button>`).join('')}</div>
      <div class="cf-grid"></div>
      <label class="slider"><span>Slow</span><input id="cfBpm" type="range" min="60" max="180" step="5" value="${this.tune.bpm}"><span><output id="cfBpmOut">${this.tune.bpm}</output> bpm</span></label>
      <div class="forge-actions"><button class="secondary" id="cfPlay">▶ Play</button><button class="secondary" id="cfClearTune">Clear</button></div>
      <h4>Tell it to the bard</h4>
      ${saved.length ? `<label class="field">Pick up where another ballad left off<select id="cfChain"><option value="">(start fresh)</option>${saved.map((x) => `<option value="${x.id}"${x.id === this.chain ? ' selected' : ''}>${escapeHtml(x.title)}</option>`).join('')}</select></label>` : ''}
      ${PROMPTS.map(([k, q, ph], i) => `
        <label class="field">${q}<textarea data-turn="${k}" rows="2" maxlength="400" placeholder="${ph}">${escapeHtml(this.telling[k])}</textarea></label>
        ${nat[i] ? `<p class="cf-natalie">Natalie: “${escapeHtml(nat[i])}”</p>` : ''}`).join('')}
      <label class="field">Title<input id="cfTitle" type="text" maxlength="60" value="${escapeHtml(this.title)}" placeholder="The Ballad of the Ruined Library"></label>
      <div class="forge-actions"><button class="primary" id="cfBard">Hand it to the bard</button></div>`;
    const bodies: Record<FireSection, string> = {
      sleep: `<p class="fine">You've sat by the fire, so the bedroll is yours. The camp keeps watch.</p>
        <div class="forge-actions"><button class="primary" id="cfSleep">${escapeHtml(this.sleepLabel())}</button></div>`,
      play: `<div class="chips">${this.playable.map((p) => `<button class="chip${p.kind === this.instrument ? ' on' : ''}" data-play="${p.kind}">${p.label}</button>`).join('')}</div>
        <p class="fine cf-band">The camp plays ${PLAYABLE.filter((p) => p.kind !== this.instrument).map((p) => p.label.toLowerCase()).join(', ')}. The ${this.label.toLowerCase()} part is yours. <button class="chip${audio.band.guide ? ' on' : ''}" id="cfGuide">Hear your part</button></p>
        <div class="cf-pads">${this.padsHtml()}</div>
        ${this.playable.length < PLAYABLE.length ? '<p class="fine">More instruments at the General Store in town.</p>' : ''}`,
      hear: this.tales().length ? `<p class="fine">Natalie tells a page from the library, the way it was written.</p>
        <div class="forge-actions"><select id="cfTale" aria-label="Tale">${this.tales().map((t) => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('')}</select><button class="secondary" id="cfTell">Ask Natalie to tell it</button></div>` : '<p class="fine">No tales on the shelves yet.</p>',
      tell: `<p class="fine">Tell Natalie a tale, a place or a person; she writes it down as a lore page for the library.</p>
        <div class="forge-actions"><button class="secondary" id="cfWriteLore">✒ Write lore with Natalie</button></div>
        <p class="fine">Or tell her what happened, and the bard sings it back to your tune.</p>${body}`,
      cook: `<p class="fine">The camp's pot and pan hang over the fire. Cook a real recipe and eat it with the camp: a good meal sets you up for the road.</p>
        <div class="forge-actions"><button class="primary" id="cfCook">🍲 Cook a meal</button></div>`,
      leave: `<div class="forge-actions"><button class="secondary" id="cfClose">Leave the fire</button></div>`,
    };
    this.el.innerHTML = `
      <div class="forge-panel campfire-panel">
        <div class="eyebrow">Campfire · the bard</div>
        <h2>By the fire</h2>
        ${SECTIONS.map(([id, icon, name]) => `<div class="cf-item${this.section === id ? ' open' : ''}">
          <button class="cf-sec" data-sec="${id}" aria-expanded="${this.section === id}"><span class="cf-ico" aria-hidden="true">${icon}</span>${name}</button>
          ${this.section === id ? `<div class="cf-body">${bodies[id]}</div>` : ''}</div>`).join('')}
      </div>`;
    this.renderGrid();
  }
}
