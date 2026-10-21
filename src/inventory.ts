// F3.4: inventory (I) — a grid of item name + count. Items are defined in content/items.json (H4).
// Dialogue actions `give:<item>:<n>` add to it. Session-only for now; H7 save JSON comes with F11 (0.08).
import itemTable from '../content/items.json';

type ItemId = keyof typeof itemTable.items;
export const ITEMS = itemTable.items as Record<string, { name: string; icon: string; note: string }>;

export class Inventory {
  readonly counts = new Map<string, number>();
  readonly root: HTMLDivElement;
  private grid: HTMLElement;
  onChange: () => void = () => undefined;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'inventory';
    this.root.className = 'screen hidden';
    this.root.innerHTML = '<div class="card narrow"><h1>Inventory</h1><div class="inv-grid"></div><p class="fine">I, Tab or Esc to close</p><button class="secondary inv-close">Close</button></div>';
    this.grid = this.root.querySelector('.inv-grid')!;
    document.body.appendChild(this.root);
  }

  count(id: string) { return this.counts.get(id) ?? 0; }
  give(id: string, n: number) {
    if (!ITEMS[id]) { console.warn(`Unknown item "${id}" (add it to content/items.json)`); return; }
    this.counts.set(id, Math.max(0, this.count(id) + n));
    this.render(); this.onChange();
  }
  take(id: string, n = 1): boolean {
    if (this.count(id) < n) return false;
    this.counts.set(id, this.count(id) - n);
    this.render(); this.onChange();
    return true;
  }

  render() {
    const cells = [...this.counts].filter(([, n]) => n > 0).map(([id, n]) => {
      const it = ITEMS[id as ItemId];
      const c = document.createElement('div');
      c.className = 'inv-cell';
      c.dataset.item = id;
      c.title = it.note;
      c.innerHTML = '<span class="inv-icon"></span><span class="inv-name"></span><span class="inv-count"></span>';
      c.querySelector('.inv-icon')!.textContent = it.icon;
      c.querySelector('.inv-name')!.textContent = it.name;
      c.querySelector('.inv-count')!.textContent = '× ' + n;
      return c;
    });
    if (!cells.length) {
      const p = document.createElement('p');
      p.className = 'inv-empty';
      p.textContent = 'Nothing yet. Someone by the library door might help.';
      this.grid.replaceChildren(p);
    } else this.grid.replaceChildren(...cells);
  }
}
