import { mulberry32, THEMES, type Theme } from './gen';
import { escapeHtml } from '../submit';
import { rollGoblin, describeGoblin, goblinStats } from '../traits/goblin';
import { seedOf, num } from '../traits/roll';
import './quick.css';

// v0.05 §6: the Quick Dungeon. A solo, menu-only run under the library: a left-to-right graph of five layers
// (the stairs, three layers of 2–3 rooms, the goblin's nest), so exactly four picks from entry to the end.
// Each room resolves at once in a card: a fight (a summary, it costs health), an event (a carving from the
// lore) or a find (crowns, bolts, a trinket). Same seed, same graph, same rooms.
export type QKind = 'start' | 'fight' | 'event' | 'loot' | 'rest' | 'boss';
export interface QNode { id: string; layer: number; row: number; kind: QKind; next: string[] }
export interface QGraph { seed: number; theme: Theme; nodes: QNode[] }
export interface QReward { crowns: number; items: [string, number][] }
export interface Carving { line: string; title: string; credit: string }

export const LAYERS = 5;
const KIND_LABEL: Record<QKind, string> = { start: 'Stairs', fight: 'Fight', event: 'Carving', loot: 'Cache', rest: 'Spring', boss: 'The Nest' };
const KIND_ICON: Record<QKind, string> = { start: '⇣', fight: '⚔', event: '✎', loot: '◈', rest: '♨', boss: '☠' };
// Fights and the nest are rolled goblins (docs/trait-roll-tables.md): new ones every run, the dice never shown.
const TACTIC: Record<string, string> = {
  rusher: 'It charges straight at you. A scuffle in the dark, then quiet.',
  skirmisher: 'It darts in, nicks you, darts out, again and again, until you pin it.',
  coward: 'Once you wing it, it squeals and runs.',
  thief: 'It goes for your pockets, not your throat, and you chase it off.',
  ambusher: 'It drops on you from a ledge.',
  archer: 'Shots hiss out of the dark before you can close in.',
  trapper: 'You step around one snare and straight into another.',
  leader: 'It shrieks for its friends, and two more come running.',
  mimic: 'It copies every feint you make, until it can\'t.',
};
const article = (s: string) => (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s;

/** The seeded graph. Every room on layers 1–3 has a way in, and every room leads to 2–3 rooms on the next layer when there are that many. */
export function buildQuick(seed: number): QGraph {
  const R = mulberry32(seed ^ 0x51ED);
  const theme = THEMES[Math.floor(R() * THEMES.length)];
  const kinds: QKind[] = ['fight', 'fight', 'event', 'loot', 'rest'];
  const nodes: QNode[] = [{ id: 'L0', layer: 0, row: 0, kind: 'start', next: [] }];
  const layers: QNode[][] = [[nodes[0]]];
  for (let l = 1; l <= 3; l++) {
    const n = 2 + Math.floor(R() * 2), layer: QNode[] = [];
    for (let r = 0; r < n; r++) layer.push({ id: `L${l}-${r}`, layer: l, row: r, kind: kinds[Math.floor(R() * kinds.length)], next: [] });
    if (!layer.some((x) => x.kind === 'fight')) layer[Math.floor(R() * n)].kind = 'fight';   // something to fight on every layer
    layers.push(layer); nodes.push(...layer);
  }
  const boss: QNode = { id: 'L4', layer: 4, row: 0, kind: 'boss', next: [] };
  layers.push([boss]); nodes.push(boss);
  for (let l = 0; l < 4; l++) {
    const here = layers[l], there = layers[l + 1];
    for (const node of here) {
      if (there.length <= 2) { node.next = there.map((x) => x.id); continue; }
      // Three ahead: the two nearest by row, sometimes all three.
      const near = [...there].sort((a, b) => Math.abs(a.row - node.row * (there.length - 1) / Math.max(1, here.length - 1)) - Math.abs(b.row - node.row * (there.length - 1) / Math.max(1, here.length - 1)));
      node.next = (R() < 0.4 ? near : near.slice(0, 2)).map((x) => x.id).sort();
    }
    for (const t of there) if (!here.some((h) => h.next.includes(t.id))) here[Math.min(here.length - 1, t.row)].next.push(t.id);   // no unreachable rooms
  }
  return { seed, theme, nodes };
}

export class QuickDungeon {
  readonly el: HTMLDivElement;
  graph: QGraph | null = null;
  at = 'L0';
  path: string[] = [];
  hp = 10;
  sel = 0;
  result: { title: string; text: string; reward?: QReward; end?: 'won' | 'lost'; goblin?: number } | null = null;
  /** Lines for event rooms; set by main. */
  carvings: () => Carving[] = () => [];
  /** Pay out a room's reward (main gives crowns and items). */
  onReward: (r: QReward) => void = () => {};
  onFinish: (seed: number, end: 'won' | 'lost' | 'fled') => void = () => {};
  onClose: () => void = () => {};

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'quickDungeon';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-node], button') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.node) this.choose(b.dataset.node);
      else if (b.id === 'qdOk') this.ok();
      else if (b.id === 'qdLeave') this.leave();
    });
    addEventListener('keydown', (e) => {
      if (!this.isOpen || e.repeat) return;
      const dir = ({ ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'up', ArrowRight: 'down', Enter: 'ok', Space: 'ok', KeyE: 'ok', Escape: 'back' } as const)[e.code as 'Enter'];
      if (!dir) return;
      this.input(dir); e.preventDefault(); e.stopImmediatePropagation();
    }, true);
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get node() { return this.graph!.nodes.find((n) => n.id === this.at)!; }
  /** Rooms you can pick next. */
  get options() { return this.result ? [] : this.node.next; }
  /** Picks made so far (four to finish). */
  get decisions() { return this.path.length; }

  /** Which goblins this run meets: new every run (Mike), so it's set at open. */
  run = 0;
  /** A forced first goblin seed (the `?seed=` debug flag). */
  forcedGoblin = 0;
  open(seed: number, run = (Math.random() * 2 ** 31) | 0) {
    this.graph = buildQuick(seed); this.run = run;
    this.at = 'L0'; this.path = []; this.hp = 10; this.sel = 0; this.result = null;
    this.el.classList.remove('hidden');
    this.render();
  }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }
  /** D-pad / keys: up and down move between the rooms ahead, A picks or carries on, B leaves. */
  input(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') {
    if (dir === 'back') { if (this.result?.end) this.ok(); else this.leave(); return; }
    if (dir === 'ok') { if (this.result) this.ok(); else if (this.options.length) this.choose(this.options[this.sel]); return; }
    if (this.result || !this.options.length) return;
    const d = dir === 'up' || dir === 'left' ? -1 : 1;
    this.sel = (this.sel + d + this.options.length) % this.options.length;
    this.render();
  }
  choose(id: string) {
    if (!this.options.includes(id)) return;
    this.path.push(id); this.at = id; this.sel = 0;
    this.result = this.resolve(this.node);
    if (this.result.reward) this.onReward(this.result.reward);
    this.render();
  }
  ok() {
    if (!this.result) return;
    const end = this.result.end;
    this.result = null;
    if (end) { this.onFinish(this.graph!.seed, end); this.close(); return; }
    this.render();
  }
  leave() { if (this.graph) this.onFinish(this.graph.seed, 'fled'); this.close(); }

  // One room, resolved at once. Seeded by the run's seed and the room, so a replay gives the same outcome.
  private resolve(n: QNode): NonNullable<QuickDungeon['result']> {
    const R = mulberry32(this.graph!.seed * 31 + n.layer * 7 + n.row + 1);
    const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
    const idx = this.graph!.nodes.indexOf(n);
    if (n.kind === 'fight') {
      const first = !this.path.slice(0, -1).some((id) => this.graph!.nodes.find((x) => x.id === id)?.kind === 'fight');
      const v = rollGoblin(first && this.forcedGoblin ? this.forcedGoblin : seedOf(this.run, idx)), st = goblinStats(v);
      let dmg = ri(1, 2 + n.layer) + Math.floor(v.threat / 3) + (st.leader ? 1 : 0);
      if (st.behaviour === 'coward') dmg = Math.ceil(dmg / 2);
      this.hp = Math.max(1, this.hp - dmg);
      const crowns = st.behaviour === 'thief' ? 0 : ri(2, 4) + num(v, 'crowns');
      return { title: v.display, goblin: v.seed, text: `You meet ${v.display}, ${article(describeGoblin(v))}.\n${TACTIC[st.behaviour]}\nYou take ${dmg} damage (${this.hp}/10 left).`, reward: { crowns, items: st.bolts ? [['bolt', st.bolts]] : [] } };
    }
    if (n.kind === 'event') {
      const all = this.carvings(), c = all.length ? all[Math.floor(R() * all.length)] : null;
      return { title: 'A carving', text: c ? `Cut into the wall:\n“${c.line}”\n(${c.title}, by ${c.credit})` : 'Old letters, worn smooth. You trace them and move on.', reward: { crowns: 2, items: [] } };
    }
    if (n.kind === 'loot') {
      const bolts = ri(0, 1) ? ri(2, 4) : 0, crowns = ri(3, 8);
      return { title: 'A cache', text: `A cracked crate behind the shelves: ${crowns} crowns${bolts ? ` and ${bolts} bolts` : ''}.`, reward: { crowns, items: bolts ? [['bolt', bolts]] : [] } };
    }
    if (n.kind === 'rest') {
      const heal = ri(3, 5);
      this.hp = Math.min(10, this.hp + heal);
      return { title: 'A spring', text: `Cold water from a crack in the stone. You drink and rest a moment.\n+${heal} health (${this.hp}/10).` };
    }
    // The nest: its goblin rolls with a bigger budget. You win if you come in with enough left.
    const v = rollGoblin(seedOf(this.run, 99), 8), need = ri(4, 6) + (v.threat >= 6 ? 1 : 0);
    const who = `${v.display}, ${article(describeGoblin(v))}`;
    if (this.hp >= need) return { title: 'The Nest', goblin: v.seed, text: `${who}, is waiting on its heap of red-book covers. It is quick, but you are ready.\nIt drops what it was hoarding and bolts into the dark.`, reward: { crowns: 12, items: [['trinket', 1]] }, end: 'won' };
    return { title: 'The Nest', goblin: v.seed, text: `${who}, is waiting on its heap of red-book covers, and you are worn out (${this.hp}/10, you needed ${need}).\nYou back up the stairs. Rest, and try again.`, end: 'lost' };
  }

  private centre(smooth: boolean) {
    const map = this.el.querySelector<HTMLElement>('.qd-map'), n = this.el.querySelector<HTMLElement>(`[data-id="${this.at}"]`);
    if (!map || !n) return;
    const left = n.offsetLeft - map.clientWidth / 2 + 30;
    if (map.scrollTo) map.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' }); else map.scrollLeft = left;
  }

  private render() {
    // Keep the map's scroll across the re-render, then glide it to the room you're in.
    const was = this.el.querySelector<HTMLElement>('.qd-map')?.scrollLeft ?? null;
    this.draw();
    const map = this.el.querySelector<HTMLElement>('.qd-map');
    if (map && was !== null) map.scrollLeft = was;
    this.centre(was !== null);
  }
  private draw() {
    const g = this.graph!, COL = innerWidth < 600 ? 112 : 150, ROW = 92, H = ROW * 3, opts = this.options;
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const counts = [1, 0, 0, 0, 1];
    for (const n of g.nodes) if (n.layer >= 1 && n.layer <= 3) counts[n.layer]++;
    const xy = (n: QNode) => ({ x: 40 + n.layer * COL, y: H / 2 + (n.row - (counts[n.layer] - 1) / 2) * ROW });
    const visited = new Set(['L0', ...this.path]);
    const edges = g.nodes.flatMap((a) => a.next.map((id) => {
      const b = byId.get(id)!, p = xy(a), q = xy(b);
      const cls = visited.has(a.id) && visited.has(b.id) && this.path.indexOf(b.id) === (a.id === 'L0' ? 0 : this.path.indexOf(a.id) + 1) ? 'taken' : a.id === this.at && opts.includes(b.id) ? 'open' : '';
      return `<line class="qd-edge ${cls}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`;
    })).join('');
    const nodes = g.nodes.map((n) => {
      const p = xy(n), i = opts.indexOf(n.id);
      const cls = [n.id === this.at ? 'here' : '', visited.has(n.id) ? 'seen' : '', i >= 0 ? 'open' : '', i >= 0 && i === this.sel ? 'sel' : ''].join(' ');
      return `<button class="qd-node ${cls}" data-id="${n.id}" ${i >= 0 ? `data-node="${n.id}"` : 'tabindex="-1"'} style="left:${p.x - 26}px;top:${p.y - 26}px" aria-label="${KIND_LABEL[n.kind]}"><span>${KIND_ICON[n.kind]}</span><small>${KIND_LABEL[n.kind]}</small></button>`;
    }).join('');
    const W = 80 + 4 * COL;
    const r = this.result;
    this.el.innerHTML = `
      <div class="qd-panel">
        <div class="qd-head"><div><div class="eyebrow">Quick Dungeon · seed ${g.seed} · ${g.theme}</div><h2>Under the Ruined Library</h2></div>
          <div class="qd-stats"><span>♥ ${this.hp}/10</span><span>Choice ${Math.min(4, this.decisions + (r ? 0 : 1))} of 4</span></div></div>
        <div class="qd-map"><div class="qd-canvas" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}">${edges}</svg>${nodes}</div></div>
        <div class="qd-foot"><span class="fine">${r ? '' : opts.length ? 'Pick a room: tap it, or D-pad / arrows and A.' : ''}</span><button class="secondary" id="qdLeave">Back up the stairs</button></div>
        ${r ? `<div class="qd-result"><div class="card-in"><div class="credit">${escapeHtml(KIND_LABEL[this.node.kind])}</div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.text)}</p>
          ${r.reward && (r.reward.crowns || r.reward.items.length) ? `<p class="qd-loot">${r.reward.crowns ? `◎ +${r.reward.crowns}` : ''}${r.reward.items.map(([id, n]) => ` · ${escapeHtml(id)} × ${n}`).join('')}</p>` : ''}
          <div class="forge-actions"><button class="primary" id="qdOk">${r.end ? 'Back to the trapdoor' : 'Onward'}</button></div></div></div>` : ''}
      </div>`;
  }
}
