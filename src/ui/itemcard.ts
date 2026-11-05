// Mike 2026-11-05: Diablo-style item cards in the bag. Hover (mouse), long-press (touch) or focus (keyboard and pad)
// on a bag cell shows a card: the name coloured by kind (a forged, named weapon shows gold like a unique), the type,
// the stats that matter, which hand holds it, what it costs and what it sells for, the flavour line, and a forged
// weapon's name and legend.
import { ITEMS } from '../inventory';
import { MELEE, type MeleeKind } from '../sword';
import { BLOCK_ARC, BLOCK_LEAK } from '../shield';
import { DUAL_RELOAD } from '../crossbow';
import { PRICES, BUYS } from '../shop';

export type ItemKind = 'weapon' | 'shield' | 'ammo' | 'instrument' | 'food' | 'coin' | 'curio' | 'sundry';
const KIND_OF: Record<string, ItemKind> = {
  crossbow: 'weapon', sword: 'weapon', dagger: 'weapon', mace: 'weapon', spear: 'weapon', sling: 'weapon',
  buckler: 'shield', shield: 'shield', bolt: 'ammo', rock: 'ammo', crown: 'coin', trinket: 'curio',
  whistle: 'instrument', drum: 'instrument', lute: 'instrument', ocarina: 'instrument', violin: 'instrument',
  bread: 'food', fish: 'food', jerky: 'food', mealworms: 'food', seeds: 'food',
};
const KIND_LABEL: Record<ItemKind, string> = { weapon: 'Weapon', shield: 'Shield', ammo: 'Ammunition', instrument: 'Instrument', food: 'Food', coin: 'Coin', curio: 'Curio', sundry: 'Sundry' };
const TYPE_LINE: Record<string, string> = {
  crossbow: 'Crossbow · one hand', sword: 'Sword · one hand', dagger: 'Dagger · one hand', mace: 'Mace · one hand',
  spear: 'Spear · one hand', sling: 'Sling · one hand', rock: 'Thrown · one hand', buckler: 'Small shield · one hand',
  shield: 'Shield · one hand', bolt: 'Crossbow bolt',
};
export const kindOf = (id: string): ItemKind => KIND_OF[id] ?? 'sundry';

export interface ItemContext {
  /** Which hands hold this item now. */
  heldIn(id: string): ('left' | 'right')[];
  /** A forged weapon's own name and legend, if any. */
  forged(id: string): { name: string; legend: string; engraving: string } | null;
}

const deg = (r: number) => Math.round(r * 180 / Math.PI);
function stats(id: string): string[] {
  if (id in MELEE) {
    const m = MELEE[id as MeleeKind], d = m.damage;
    return [
      `Damage ${d[0]}–${d[d.length - 1]} (the third blow ${d[2]}${m.heavy[2] ? ', heavy' : ''})`,
      `Speed ${(1 / m.swing).toFixed(1)} cuts a second`,
      `Reach ${m.reach} m · ${m.thrust ? 'a thrust' : `a ${deg(m.arc * 2)}° sweep`}`,
      ...(m.heavy[0] ? ['Every blow is heavy: knocks goblins back'] : []),
      ...(id === 'sword' ? [`Blocks ${deg(BLOCK_ARC.sword)}° to each side, turning half the blow`] : []),
    ];
  }
  if (id === 'crossbow') return ['Damage 1 · 2 after a quick reload', 'Reload 2 s · 0.5 s in the gold zone', `Two crossbows: ${DUAL_RELOAD}× the reload, no aiming down sights`];
  if (id === 'sling') return ['Damage 0.45–1.2, by how long you whirl it', 'Whirl up to 1.2 s; let go to loose', 'Uses rocks from the bag'];
  if (id === 'rock') return ['Damage 0.5 · thrown from the hand', 'Staggers a goblin'];
  if (id === 'buckler' || id === 'shield') {
    const k = id as 'buckler' | 'shield';
    return [`Blocks ${deg(BLOCK_ARC[k])}° to each side`, BLOCK_LEAK[k] ? `Turns ${100 - BLOCK_LEAK[k] * 100}% of a blow` : 'Turns the whole blow', 'Two shields cover a wider arc'];
  }
  if (id === 'bolt') return ['Ammunition for the crossbow'];
  return [];
}

/** The card's inner HTML for `id` (count `n`). */
export function itemCardHTML(id: string, n: number, ctx: ItemContext | null): string {
  const it = ITEMS[id]; if (!it) return '';
  const kind = kindOf(id), f = ctx?.forged(id) ?? null, named = !!f?.name;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const rows: string[] = [];
  rows.push(`<div class="ic-name ic-${named ? 'unique' : kind}">${esc(named ? f!.name : it.name)}</div>`);
  rows.push(`<div class="ic-type">${named ? esc(it.name) + ' · ' : ''}${TYPE_LINE[id] ?? KIND_LABEL[kind]}${n > 1 ? ` · × ${n}` : ''}</div>`);
  const st = stats(id);
  if (st.length) rows.push(`<ul class="ic-stats">${st.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`);
  const hands = ctx?.heldIn(id) ?? [];
  if (hands.length) rows.push(`<div class="ic-held">In your ${hands.length === 2 ? 'both hands' : hands[0] + ' hand'}</div>`);
  if (f?.engraving) rows.push(`<div class="ic-eng">Engraved: “${esc(f.engraving)}”</div>`);
  if (f?.legend) rows.push(`<div class="ic-legend">${esc(f.legend)}</div>`);
  rows.push(`<div class="ic-flavour">${esc(it.note)}</div>`);
  const buy = PRICES[id], sell = BUYS[id];
  if (buy || sell) rows.push(`<div class="ic-value">${buy ? `Costs ◎ ${buy}` : ''}${buy && sell ? ' · ' : ''}${sell ? `Sells for ◎ ${sell}` : ''}</div>`);
  return rows.join('');
}

/** One floating card for a panel: shows on hover, focus or a long press on any `[data-item]` inside `root`. */
export function attachItemCards(root: HTMLElement, count: (id: string) => number, ctx: () => ItemContext | null): HTMLElement {
  const card = document.createElement('div');
  card.className = 'item-card hidden'; card.setAttribute('role', 'tooltip');
  root.appendChild(card);
  let shownFor: HTMLElement | null = null, press = 0;
  const show = (cell: HTMLElement) => {
    const id = cell.dataset.item!;
    card.innerHTML = itemCardHTML(id, count(id), ctx());
    card.dataset.item = id;
    card.classList.remove('hidden');
    shownFor = cell;
    // Beside the cell: to its right if there's room, else its left, else below it; never off screen.
    const r = cell.getBoundingClientRect(), W = innerWidth, H = innerHeight, cw = Math.min(280, W - 16);
    card.style.width = cw + 'px';
    const ch = card.offsetHeight;
    let x: number, y = r.top;
    if (r.right + 8 + cw <= W - 8) x = r.right + 8;
    else if (r.left - 8 - cw >= 8) x = r.left - 8 - cw;
    else { x = Math.max(8, Math.min(W - cw - 8, r.left)); y = r.bottom + 8 + ch > H - 8 ? r.top - 8 - ch : r.bottom + 8; }
    y = Math.max(8, Math.min(H - ch - 8, y));
    card.style.left = x + 'px'; card.style.top = y + 'px';
  };
  const hide = () => { card.classList.add('hidden'); shownFor = null; };
  const cellOf = (e: Event) => (e.target as HTMLElement).closest?.('[data-item]') as HTMLElement | null;
  root.addEventListener('pointerover', (e) => { if ((e as PointerEvent).pointerType !== 'mouse') return; const c = cellOf(e); if (c) show(c); });
  root.addEventListener('pointerout', (e) => { if ((e as PointerEvent).pointerType !== 'mouse') return; const c = cellOf(e); if (c && !c.contains((e as PointerEvent).relatedTarget as Node)) hide(); });
  root.addEventListener('focusin', (e) => { const c = cellOf(e); if (c) show(c); else hide(); });
  root.addEventListener('focusout', (e) => { if (cellOf(e) === shownFor) hide(); });
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const c = cellOf(e); clearTimeout(press);
    if (!c) { hide(); return; }
    press = window.setTimeout(() => show(c), 380);
  });
  for (const t of ['pointerup', 'pointercancel']) root.addEventListener(t, () => clearTimeout(press));
  return card;
}
