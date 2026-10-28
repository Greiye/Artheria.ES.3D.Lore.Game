import { SCALE, NOTE_NAMES, INSTRUMENTS, DEFAULT_TUNE, decodeTune, encodeTune, composeBallad, loadBallads, saveBallad, balladMarkdown, type Ballad, type Instrument, type Tune, type Telling } from './ballad';
import { openSubmitSheet, escapeHtml } from '../submit';
import { audio, type PlayKind } from '../audio';
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
// v0.04: playable instruments. Hum and clap are always yours; the whistle, drum and lute come from the General
// Store. One instrument at a time; Natalie keeps a lute backing going while you sit at the fire.
const PLAYABLE: { kind: PlayKind; label: string; item?: string; pads: number }[] = [
  { kind: 'hum', label: 'Hum', pads: 6 }, { kind: 'clap', label: 'Clap & stomp', pads: 2 },
  { kind: 'whistle', label: 'Tin whistle', item: 'whistle', pads: 6 }, { kind: 'drum', label: 'Hand drum', item: 'drum', pads: 2 },
  { kind: 'lute', label: 'Lute', item: 'lute', pads: 6 },
];
const PENTA = [60, 62, 64, 67, 69, 72], PAD_NAMES = ['C', 'D', 'E', 'G', 'A', 'C′'];

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
  instrument: PlayKind = 'hum';
  private stopBacking: () => void = () => {};

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
  get playable() { const own = this.owned(); return PLAYABLE.filter((p) => !p.item || own.includes(p.item)); }
  private get pads() { return PLAYABLE.find((p) => p.kind === this.instrument)?.pads ?? 6; }
  /** Play pad i (0-based) on the chosen instrument. Exposed for tests. */
  pad(i: number) {
    const melodic = this.pads > 2;
    audio.play(this.instrument, melodic ? PENTA[i] ?? 60 : i ? 64 : 55);
    const b = this.el.querySelector(`[data-pad="${i}"]`);
    if (b) { b.classList.remove('hit'); void (b as HTMLElement).offsetWidth; b.classList.add('hit'); }
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() {
    this.ballad = null;
    if (!this.playable.some((p) => p.kind === this.instrument)) this.instrument = 'hum';
    this.render(); this.el.classList.remove('hidden');
    this.stopBacking = audio.backing();   // Natalie strums while you sit
  }
  close() { if (!this.isOpen) return; this.stopBacking(); this.el.classList.add('hidden'); this.onClose(); }
  private saveTune() { try { localStorage.setItem(TUNE_KEY, encodeTune(this.tune)); } catch { /* blocked */ } }
  play(t: Tune = this.tune) { return audio.tune(t.steps, SCALE, t.instrument, t.bpm, 2); }

  // Toggle one cell (step 0–7, row 0–7 from the low C). Exposed for tests.
  toggle(step: number, row: number) { this.tune.steps[step] ^= 1 << row; this.saveTune(); this.renderGrid(); }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    if (d.step !== undefined) this.toggle(Number(d.step), Number(d.row));
    else if (d.pad !== undefined) this.pad(Number(d.pad));
    else if (d.play) { this.instrument = d.play as PlayKind; this.render(); }
    else if (b.id === 'cfWriteLore') { this.close(); this.onWriteLore(); }
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
    this.el.innerHTML = `
      <div class="forge-panel campfire-panel">
        <div class="eyebrow">Campfire · the bard</div>
        <h2>Tell it by the fire</h2>
        <p class="fine">Natalie is a bard. She strums her lute while you sit. Play along, tell her what happened and she'll sing it back, or give her a tale to write down for the library.</p>
        <h4>Play along</h4>
        <div class="chips">${this.playable.map((p) => `<button class="chip${p.kind === this.instrument ? ' on' : ''}" data-play="${p.kind}">${p.label}</button>`).join('')}</div>
        <div class="cf-pads">${Array.from({ length: this.pads }, (_, i) => `<button class="cf-pad" data-pad="${i}"><kbd>${i + 1}</kbd>${this.pads > 2 ? PAD_NAMES[i] : i ? 'Accent' : 'Beat'}</button>`).join('')}</div>
        ${this.playable.length < PLAYABLE.length ? '<p class="fine">More instruments at the General Store in town.</p>' : ''}
        <h4>Write lore</h4>
        <p class="fine">Tell Natalie a tale, a place or a person; she writes it down as a lore page for the library.</p>
        <div class="forge-actions"><button class="secondary" id="cfWriteLore">✒ Write lore with Natalie</button></div>
        ${body}
        <div class="forge-actions"><button class="secondary" id="cfClose">Leave the fire</button></div>
      </div>`;
    this.renderGrid();
  }
}
