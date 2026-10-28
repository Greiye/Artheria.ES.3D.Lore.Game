import legendary from '../../content/quest/legendary.json';
import { clueById } from './quest';
import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';
import type { DialogueScript } from '../dialogue';

// B12 item folklore: name a thing you carry or found, give it a history and a rumor. Legendary items
// carry fixed canon lore (credited) with curated player rumors stacked under it; your own words stay on
// this device until submitted. Magister Greer (Aralon's wizard-trader, once the Curio Pedlar placeholder) by the coach road is where you tell them.
export interface Folk { name: string; history: string; rumor: string }
type Legend = { name: string; legendary: boolean; canon: string; source: string; credit_as: string; rumors: { text: string; credit_as: string }[] };
const LEGENDS = legendary.items as Record<string, Legend>;
const PEDLAR = legendary.pedlar;
const KEY = 'gametool.folklore';

function loadFolk(): Record<string, Folk> {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
function saveFolk(f: Record<string, Folk>) { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* blocked */ } }

export interface FolkItem { id: string; name: string; canon?: Legend }

function folkMarkdown(it: FolkItem, f: Folk, author: string): string {
  return entryMarkdown({
    title: f.name || it.name, author, type: 'folklore', tags: ['folklore', it.id],
    body: `*${it.name}*\n\n**History.** ${f.history || '(none yet)'}\n\n**Rumor.** ${f.rumor || '(none yet)'}`,
    extra: { item: it.id },
  });
}

// The pedlar's talk: canon for each legendary item you have seen, then "let me tell you about…".
export function pedlarScript(seen: string[]): DialogueScript {
  const known = seen.filter((id) => LEGENDS[id]);
  const nodes: DialogueScript['nodes'] = {
    p1: { text: PEDLAR.greeting, choices: [
      ...known.map((id) => ({ text: `Tell me about the ${LEGENDS[id].name}.`, next: 'l_' + id })),
      { text: "I want to tell you about something I found.", next: 'tell' },
      { text: 'Just looking.', next: 'bye' },
    ] },
    tell: { text: "Go on, then. Give it a name, a past, and one good lie.", actions: ['folklore:open'], end: true },
    bye: { text: "Looking is free. Lies cost extra. Everything else costs triple.", end: true },
  };
  for (const id of known) nodes['l_' + id] = { text: LEGENDS[id].canon, next: 'p1' };
  return { speaker: PEDLAR.name, start: 'p1', nodes };
}

export class FolklorePanel {
  readonly el: HTMLDivElement;
  private items: FolkItem[] = [];
  private sel = 0;

  constructor(private list: () => FolkItem[], private onClose: () => void, private author: () => string) {
    this.el = document.createElement('div');
    this.el.id = 'folklore';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.items = this.list(); this.sel = 0; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.store(); this.el.classList.add('hidden'); this.onClose(); }

  private store() {
    const it = this.items[this.sel];
    if (!it) return;
    const v = (id: string) => (this.el.querySelector('#' + id) as HTMLInputElement | null)?.value.trim() ?? '';
    const f = { name: v('flName'), history: v('flHistory'), rumor: v('flRumor') };
    const all = loadFolk();
    if (f.name || f.history || f.rumor) all[it.id] = f; else delete all[it.id];
    saveFolk(all);
  }
  private click(ev: Event) {
    const t = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    if (t.dataset.item !== undefined) { this.store(); this.sel = Number(t.dataset.item); this.render(); }
    else if (t.id === 'flDone') this.close();
    else if (t.id === 'flSubmit') {
      this.store();
      const it = this.items[this.sel], f = loadFolk()[it.id];
      if (f) openSubmitSheet({ kind: 'folklore', title: f.name || it.name, markdown: folkMarkdown(it, f, this.author()) });
    }
  }
  private render() {
    const it = this.items[this.sel], mine = it ? loadFolk()[it.id] : undefined;
    const legend = it?.canon;
    this.el.innerHTML = `
      <div class="forge-panel folklore-panel">
        <div class="eyebrow">Folklore · ${escapeHtml(PEDLAR.name)}</div>
        <h2>Tell its story</h2>
        <div class="chips">${this.items.map((x, i) => `<button class="chip${i === this.sel ? ' on' : ''}${x.canon ? ' legendary' : ''}" data-item="${i}">${escapeHtml(loadFolk()[x.id]?.name || x.name)}</button>`).join('') || '<p class="fine">You carry nothing worth a story yet. Find something.</p>'}</div>
        ${it ? `
          ${legend ? `<h4>Canon</h4><blockquote class="fl-canon">${escapeHtml(legend.canon)}<cite>by ${escapeHtml(legend.credit_as)}</cite></blockquote>` : ''}
          ${legend ? `<h4>Rumors</h4>${legend.rumors.length ? `<ul class="fl-rumors">${legend.rumors.map((r) => `<li>${escapeHtml(r.text)} <cite>— ${escapeHtml(r.credit_as)}</cite></li>`).join('')}</ul>` : '<p class="fine">No one has added a rumor yet. Be the first.</p>'}` : ''}
          <h4>Yours</h4>
          <label class="field">Its name<input id="flName" type="text" maxlength="48" value="${escapeHtml(mine?.name ?? '')}" placeholder="${escapeHtml(it.name)}"></label>
          <label class="field">Its history<textarea id="flHistory" rows="3" maxlength="600" placeholder="Where did it come from? Who held it before you?">${escapeHtml(mine?.history ?? '')}</textarea></label>
          <label class="field">A rumor<textarea id="flRumor" rows="2" maxlength="280" placeholder="Something people say about it. It doesn't have to be true.">${escapeHtml(mine?.rumor ?? '')}</textarea></label>
          <div class="forge-actions"><button class="primary" id="flDone">Done</button><button class="secondary" id="flSubmit">Submit…</button></div>` : '<div class="forge-actions"><button class="primary" id="flDone">Done</button></div>'}
      </div>`;
  }
}

// What the player can tell stories about: inventory items, found clues, and legendary things they have seen.
export function folkItems(inventory: string[], clues: string[], seen: string[], itemName: (id: string) => string): FolkItem[] {
  const out: FolkItem[] = [];
  const add = (id: string, name: string) => { if (!out.some((o) => o.id === id)) out.push({ id, name, canon: LEGENDS[id] }); };
  for (const id of seen) if (LEGENDS[id]) add(id, LEGENDS[id].name);
  for (const id of inventory) if (id !== 'bolt') add(id, LEGENDS[id]?.name ?? itemName(id));
  for (const id of clues) { const c = clueById(id); if (c) add('clue:' + id, c.name); }
  return out;
}
