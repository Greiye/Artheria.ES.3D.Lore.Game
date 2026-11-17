import { LIMBS, MOVES, STANCES, type Limb, type Move, type Stance } from './engine';
import { DECKS, LEARN_AT, LIMB_NAME, STARTER, deckStrings, loadDecks, moveCard, movesFor, saveDecks, starterSlots, stringFrom, type DeckSave } from './deck';
import { escapeHtml } from '../submit';
import './deck.css';

// B58 (Mike 2026-11-08): the deck editor, opened by meditating on the dojo mat. Four stance cards with four limb
// slots each; tap a slot to pick a learned move for it. Each move shows its speed, damage, reach, height, the stance
// it ends in and its tags, and the panel lists the strings the deck produces. "Show it" has a pale copy of you stand
// up and perform the string that starts at the chosen slot.
const LEARNABLE = Object.values(MOVES).filter((m) => m.limb !== 'throw' && !m.air).length;
const ST_SHORT = ['FL', 'FR', 'BL', 'BR'];

export class DeckPanel {
  readonly el: HTMLDivElement;
  st: DeckSave = loadDecks();
  /** The slot being edited: stance and limb index. */
  pick: { s: Stance; l: number } | null = null;

  constructor(private onPreview: (moves: Move[]) => void, private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'deck';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.id === 'dkName') { this.st.decks[this.st.active].name = t.value.trim().slice(0, 24) || `Deck ${this.st.active + 1}`; saveDecks(this.st); this.render(); }
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.st = loadDecks(); this.pick = null; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  private get deck() { return this.st.decks[this.st.active].slots; }

  private click(ev: Event) {
    const b = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    if (b.id === 'dkClose') return this.close();
    if (d.deck) { this.st.active = Number(d.deck); this.pick = null; }
    else if (b.id === 'dkNew' && this.st.decks.length < DECKS) { this.st.decks.push({ name: `Deck ${this.st.decks.length + 1}`, slots: starterSlots() }); this.st.active = this.st.decks.length - 1; this.pick = null; }
    else if (b.id === 'dkReset') { this.st.decks[this.st.active].slots = starterSlots(); this.pick = null; }
    else if (d.slot) { const [s, l] = d.slot.split(':').map(Number); this.pick = this.pick && this.pick.s === s && this.pick.l === l ? null : { s: s as Stance, l }; }
    else if (d.move !== undefined && this.pick) { this.deck[this.pick.s][this.pick.l] = d.move || null; }
    else if (b.id === 'dkShow' && this.pick) { this.onPreview(this.previewString(this.pick.s, LIMBS[this.pick.l])); return; }
    else if (b.id === 'dkBack') this.pick = null;
    else return;
    saveDecks(this.st);
    this.render();
  }
  /** The string that starts at a slot: that move, then the first filled slot of each stance it passes through. */
  previewString(s: Stance, limb: Limb): Move[] {
    const path: Limb[] = [limb];
    let cur = stringFrom(this.deck, s, path);
    while (cur.length === path.length && path.length < 4) {
      const end = moveCard(cur[cur.length - 1].move).to;
      const next = LIMBS.find((l) => !!this.deck[end]?.[LIMBS.indexOf(l)] && l !== path[path.length - 1]) ?? LIMBS.find((l) => !!this.deck[end]?.[LIMBS.indexOf(l)]);
      if (!next) break;
      path.push(next); cur = stringFrom(this.deck, s, path);
    }
    return cur.map((x) => x.move);
  }

  private moveRow(m: Move, on: boolean) {
    const c = moveCard(m);
    return `<button class="dk-move${on ? ' on' : ''}" data-move="${c.id}"><b>${escapeHtml(c.name)}</b>
      <span class="dk-stats">wind-up ${c.speed}f · dmg ${c.dmg} · reach ${c.reach.toFixed(2)} m · ${c.height} · stamina ${c.cost} · ends ${STANCES[c.to]}</span>
      ${c.tags.length ? `<span class="dk-tags">${c.tags.map(escapeHtml).join(' · ')}</span>` : ''}${c.credit ? `<span class="dk-tags">moves by ${escapeHtml(c.credit)}</span>` : ''}</button>`;
  }

  private render() {
    const st = this.st, deck = this.deck, p = this.pick;
    const cards = STANCES.map((name, s) => `
      <div class="dk-card"><h5>${name}</h5>${LIMBS.map((limb, l) => {
        const id = deck[s][l], m = id ? MOVES[id] : null;
        return `<button class="dk-slot${p && p.s === s && p.l === l ? ' on' : ''}${m ? '' : ' empty'}" data-slot="${s}:${l}" aria-label="${name}, ${LIMB_NAME[limb]}: ${m ? m.name : 'empty'}">
          <span class="dk-limb">${LIMB_NAME[limb]}</span><span class="dk-name">${m ? escapeHtml(m.name) : 'plain'}</span>${m ? `<span class="dk-to">→ ${ST_SHORT[moveCard(m).to]}</span>` : ''}</button>`;
      }).join('')}</div>`).join('');
    let body: string;
    if (p) {
      const limb = LIMBS[p.l], cur = deck[p.s][p.l];
      body = `
        <h4>${STANCES[p.s]} · ${LIMB_NAME[limb]}</h4>
        <div class="dk-list">${movesFor(st, limb).map((m) => this.moveRow(m, m.id === cur)).join('')}
          <button class="dk-move${cur ? '' : ' on'}" data-move=""><b>Plain</b><span class="dk-stats">leave the slot empty: the limb throws its ordinary move</span></button></div>
        <div class="forge-actions"><button class="primary" id="dkShow"${cur ? '' : ' disabled'}>Show it</button><button class="secondary" id="dkBack">Done</button></div>`;
    } else {
      const strings = deckStrings(deck);
      const near = Object.entries(st.seen).map(([id, n]) => `${escapeHtml(MOVES[id].name)} ${n}/${LEARN_AT}`);
      body = `
        <div class="dk-grid">${cards}</div>
        <p class="fine">Tap a slot to choose its move. Every move ends in a stance; your next press reads that stance's slots.</p>
        <h4>Strings in this deck</h4>
        <ul class="dk-strings">${strings.slice(0, 8).map((x) => `<li>${x}</li>`).join('') || '<li>None yet: fill a slot.</li>'}</ul>
        <h4>Library</h4>
        <p class="fine dk-lib">${st.learned.length} of ${LEARNABLE} moves learned (${STARTER.length} to start). Block or parry a foe's move ${LEARN_AT} times to learn it.${near.length ? ' Nearly: ' + near.join(', ') + '.' : ''}</p>
        <div class="forge-actions"><button class="secondary" id="dkReset">Starter slots</button></div>`;
    }
    this.el.innerHTML = `
      <div class="forge-panel deck-panel">
        <div class="eyebrow">Dojo mat · meditation</div>
        <h2>Combat deck</h2>
        <div class="chips">${st.decks.map((d, i) => `<button class="chip${i === st.active ? ' on' : ''}" data-deck="${i}">${escapeHtml(d.name)}</button>`).join('')}${st.decks.length < DECKS ? '<button class="chip" id="dkNew">+ New deck</button>' : ''}</div>
        <label class="field dk-namefield">Name<input id="dkName" type="text" maxlength="24" value="${escapeHtml(st.decks[st.active].name)}"></label>
        ${body}
        <div class="forge-actions"><button class="secondary" id="dkClose">Stand up</button></div>
      </div>`;
  }
}
