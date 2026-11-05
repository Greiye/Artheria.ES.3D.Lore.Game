// Mike 2026-11-05 (F1): the witch's scrolls. Each time you take the stairs down, three scrolls lie on the top step;
// take one and it imbues something you carry for the rest of the run. Some carry a curse along with the boon.
// Imbues end when the run does (climbing out, or dying).
export type ScrollSlot = 'melee' | 'crossbow' | 'shield' | 'torch' | 'throw' | 'hero';
export interface Scroll { id: string; name: string; slot: ScrollSlot; boon: string; curse?: string }

export const SCROLLS: Scroll[] = [
  { id: 'frost', name: 'Scroll of Rime', slot: 'crossbow', boon: 'Your bolts are frost: a goblin they hit slows to half speed for 3 s.' },
  { id: 'witchfire', name: 'Scroll of Witchfire', slot: 'crossbow', boon: 'Your bolts burn: +1 damage.', curse: 'Every blow that lands on you hurts 1 more.' },
  { id: 'drink', name: 'Scroll of the Drinking Edge', slot: 'melee', boon: 'Your blade drinks: each cut that lands mends 1 health.' },
  { id: 'hunger', name: 'Scroll of the Hungry Edge', slot: 'melee', boon: 'Your blade bites deeper: +1 damage.', curse: 'Rest camps no longer mend you.' },
  { id: 'thorns', name: 'Scroll of Thorns', slot: 'shield', boon: 'Your shield bites back: a blow you turn wounds whoever struck it.' },
  { id: 'seeing', name: 'Scroll of the Seeing Flame', slot: 'torch', boon: 'While your torch burns, nothing hides from you: lurkers and ambushers show, and mimics can\'t slip your aim.' },
  { id: 'stone', name: 'Scroll of the Heavy Stone', slot: 'throw', boon: 'Thrown and slung rocks hit much harder.' },
  { id: 'swift', name: 'Scroll of Quick Feet', slot: 'hero', boon: 'You move a little faster.', curse: 'Thieves find you easier: they always go for your books.' },
];
export const scrollById = (id: string) => SCROLLS.find((s) => s.id === id);

/** Three to choose from, among those that fit what you carry and you don't already have. */
export function offerScrolls(have: string[], owns: (slot: ScrollSlot) => boolean, R: () => number = Math.random): Scroll[] {
  const pool = SCROLLS.filter((s) => !have.includes(s.id) && owns(s.slot));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SLOT_LABEL: Record<ScrollSlot, string> = { melee: 'your blade', crossbow: 'your crossbow', shield: 'your shield', torch: 'your torch', throw: 'your rocks and sling', hero: 'you' };

/** The three scrolls on the step. */
export class ScrollPicker {
  readonly el: HTMLDivElement;
  isOpen = false;
  private done: (s: Scroll | null) => void = () => undefined;
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'scrolls'; this.el.className = 'screen hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-scroll]');
      if (!b) return;
      this.finish(b.dataset.scroll === 'none' ? null : scrollById(b.dataset.scroll!) ?? null);
    });
  }
  open(options: Scroll[], floor: number, done: (s: Scroll | null) => void) {
    this.done = done; this.isOpen = true;
    this.el.innerHTML = `<div class="card scroll-card"><div class="eyebrow">The top step down to floor ${floor}</div><h1>The witch's scrolls</h1>
      <p class="fine">Three scrolls, tied with black thread, left where you'd find them. Take one: it imbues ${options.length ? 'something you carry' : 'nothing you carry'} until this run ends.</p>
      <div class="scroll-row">${options.map((s) => `<button class="scroll${s.curse ? ' cursed' : ''}" data-scroll="${s.id}"><b>${esc(s.name)}</b><span class="fine">for ${SLOT_LABEL[s.slot]}</span><span>${esc(s.boon)}</span>${s.curse ? `<span class="curse">Curse: ${esc(s.curse)}</span>` : ''}</button>`).join('')}</div>
      <button class="secondary" data-scroll="none">Leave them</button></div>`;
    this.el.classList.remove('hidden');
  }
  private finish(s: Scroll | null) { if (!this.isOpen) return; this.isOpen = false; this.el.classList.add('hidden'); this.done(s); }
  close() { this.finish(null); }
}
