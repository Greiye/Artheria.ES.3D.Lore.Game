import { SCALE, NOTE_NAMES, INSTRUMENTS, DEFAULT_TUNE, decodeTune, encodeTune, composeBallad, loadBallads, saveBallad, balladMarkdown, type Ballad, type Instrument, type Tune, type Telling } from './ballad';
import { openSubmitSheet, escapeHtml } from '../submit';
import { audio } from '../audio';
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

export class CampfirePanel {
  readonly el: HTMLDivElement;
  tune: Tune = (() => { try { return decodeTune(localStorage.getItem(TUNE_KEY) ?? undefined); } catch { return structuredClone(DEFAULT_TUNE); } })();
  private telling: Telling = { start: '', middle: '', end: '' };
  private title = '';
  private chain = '';
  ballad: Ballad | null = null;

  constructor(private natalie: () => string[], private onShelf: (b: Ballad) => void, private onClose: () => void, private author: () => string) {
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
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.ballad = null; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  private saveTune() { try { localStorage.setItem(TUNE_KEY, encodeTune(this.tune)); } catch { /* blocked */ } }
  play(t: Tune = this.tune) { return audio.tune(t.steps, SCALE, t.instrument, t.bpm, 2); }

  // Toggle one cell (step 0–7, row 0–7 from the low C). Exposed for tests.
  toggle(step: number, row: number) { this.tune.steps[step] ^= 1 << row; this.saveTune(); this.renderGrid(); }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    if (d.step !== undefined) this.toggle(Number(d.step), Number(d.row));
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
        <p class="fine">Natalie is a bard. Tell her what happened, in your words; she'll sing it back to your tune.</p>
        ${body}
        <div class="forge-actions"><button class="secondary" id="cfClose">Leave the fire</button></div>
      </div>`;
    this.renderGrid();
  }
}
