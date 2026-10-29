import { ITEMS, type Inventory } from './inventory';
import { DEBUG_UNLIMITED_CROWNS } from './economy';

// v0.04: the general store. The shopkeeper buys and sells for crowns (◎). Crowns come from finds (clues, the
// rock lookout's purse, curios) and from writing: a margin note, a banner sketch, a ballad or a lore page
// pays (see `earn` in main.ts). Session-only, like the rest of the inventory for now.
export const CROWN = 'crown';
export interface Ware { id: string; n: number; price: number }
const STOCK: Ware[] = [
  { id: 'bolt', n: 5, price: 6 },
  { id: 'whistle', n: 1, price: 12 },
  { id: 'drum', n: 1, price: 15 },
  { id: 'lute', n: 1, price: 30 },
  { id: 'ocarina', n: 1, price: 18 },
  { id: 'violin', n: 1, price: 40 },
];
/** v0.06 E2: everyday sundries, listed faded below the main stock. Buyable; no use in play yet. */
const SUNDRIES: Ware[] = ['candle', 'wax', 'lampOil', 'soap', 'twine', 'chalk', 'salt', 'bread'].map((id, i) => ({ id, n: 1, price: 1 + (i % 3) }));
/** What the shopkeeper pays for one of each. */
const BUYS: Record<string, number> = { trinket: 10, bolt: 1 };

export class ShopPanel {
  readonly el: HTMLDivElement;
  private line = 'Welcome in. Crowns only; I keep honest scales.';

  constructor(private inv: Inventory, private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'forge hidden';
    this.el.id = 'shop';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }

  open() { this.line = 'Welcome in. Crowns only; I keep honest scales.'; this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }

  /** Everything for sale: the main stock, then the sundries (index on from STOCK.length). */
  get wares() { return [...STOCK, ...SUNDRIES]; }
  buy(i: number): boolean {
    const w = this.wares[i];
    if (!w || (!DEBUG_UNLIMITED_CROWNS && !this.inv.take(CROWN, w.price))) { this.line = "That's more than you've got. Write something, find something, come back."; this.render(); return false; }
    this.inv.give(w.id, w.n);
    this.line = `${ITEMS[w.id].name}${w.n > 1 ? ' × ' + w.n : ''}. Pleasure.`;
    this.render();
    return true;
  }
  sell(id: string): boolean {
    const p = BUYS[id];
    if (!p || !this.inv.take(id, 1)) return false;
    this.inv.give(CROWN, p);
    this.line = `${p} crowns for the ${ITEMS[id].name.toLowerCase()}. Fair?`;
    this.render();
    return true;
  }

  private render() {
    const have = DEBUG_UNLIMITED_CROWNS ? Infinity : this.inv.count(CROWN);
    const row = (w: Ware, i: number, cls = '') => `<button class="shop-row${cls}" data-buy="${i}" ${have < w.price ? 'disabled' : ''}><span>${ITEMS[w.id].icon} ${ITEMS[w.id].name}${w.n > 1 ? ' × ' + w.n : ''}</span><span>◎ ${w.price}</span></button>`;
    const sells = Object.keys(BUYS).filter((id) => this.inv.count(id) > 0);
    this.el.innerHTML = `<div class="forge-panel shop-panel">
      <div class="eyebrow">General Store</div>
      <h2>The Shopkeeper</h2>
      <p class="shop-line">“${this.line}”</p>
      <div class="shop-purse">◎ <b>${have === Infinity ? '∞' : have}</b> crowns</div>
      <h4>Buy</h4>
      ${STOCK.map((w, i) => row(w, i)).join('')}
      <h4 class="shop-sundry-head">Sundries</h4>
      ${SUNDRIES.map((w, i) => row(w, STOCK.length + i, ' sundry')).join('')}
      <h4>Sell</h4>
      ${sells.length ? sells.map((id) => `<button class="shop-row" data-sell="${id}"><span>${ITEMS[id].icon} ${ITEMS[id].name} (${this.inv.count(id)})</span><span>+◎ ${BUYS[id]}</span></button>`).join('') : '<p class="fine">Nothing I buy. Curios from below fetch a good price.</p>'}
      <p class="fine">Crowns come from finds and from writing: margin notes, banner sketches, ballads and lore pages all pay.</p>
      <div class="forge-actions"><button class="secondary" data-act="close">Leave</button></div>
    </div>`;
  }

  private click(e: Event) {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.dataset.buy) this.buy(Number(b.dataset.buy));
    else if (b.dataset.sell) this.sell(b.dataset.sell);
    else if (b.dataset.act === 'close') this.close();
  }
}
