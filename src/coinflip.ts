// B55 (Mike 2026-11-06, "Do it!"): a coin-flip wager at Tam's table outside the Inn. One bet at a time: pick a stake in
// crowns, call heads or tails, the coin spins, and a right call pays the stake back doubled. A fair coin at even odds
// (1 in 2, pays 1:1), shown on the table. Stakes 1 to 20 crowns, never more than you carry. Dice high/low and a card
// cut are later options. Tam is a placeholder name.
import './coinflip.css';

export const STAKES = [1, 5, 10, 20] as const;
export const MAX_STAKE = 20;
const KEY = 'gametool.coinflip';
export interface CoinStats { flips: number; won: number; net: number }
export type Side = 'heads' | 'tails';

export function loadCoinStats(): CoinStats {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (s && typeof s.flips === 'number') return { flips: s.flips | 0, won: s.won | 0, net: s.net | 0 }; } catch { /* private mode */ }
  return { flips: 0, won: 0, net: 0 };
}

export class CoinTable {
  readonly el: HTMLDivElement;
  isOpen = false;
  stats = loadCoinStats();
  stake: number = STAKES[0];
  spinning = false;
  last: { call: Side; landed: Side; stake: number; won: boolean } | null = null;
  /** The coin (tests can fix it). */
  rng: () => number = Math.random;
  /** How long the coin spins, ms (tests shorten it). */
  spinMs = 1300;
  private crowns: () => number = () => 0;
  private pay: (delta: number) => void = () => undefined;
  private done: () => void = () => undefined;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'coinTable'; this.el.className = 'screen hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (!b) return;
      const act = b.dataset.act!;
      if (act === 'close') this.close();
      else if (act === 'stake') { this.stake = Number(b.dataset.n); this.render(); }
      else if (act === 'heads' || act === 'tails') this.flip(act);
    });
  }

  open(crowns: () => number, pay: (delta: number) => void, done: () => void) {
    this.crowns = crowns; this.pay = pay; this.done = done;
    this.isOpen = true; this.last = null;
    if (this.stake > this.crowns()) this.stake = STAKES.filter((s) => s <= this.crowns()).pop() ?? STAKES[0];
    this.render();
    this.el.classList.remove('hidden');
    this.el.querySelector<HTMLButtonElement>('[data-act="heads"]:not([disabled])')?.focus();
  }
  close() {
    if (!this.isOpen || this.spinning) return;
    this.isOpen = false; this.el.classList.add('hidden'); this.done();
  }

  /** Call it: take the stake, spin, then pay double on a right call. */
  flip(call: Side) {
    const have = this.crowns(), stake = this.stake;
    if (this.spinning || stake > have || stake > MAX_STAKE || stake < 1) return;
    this.spinning = true;
    this.pay(-stake);
    const landed: Side = this.rng() < 0.5 ? 'heads' : 'tails', won = landed === call;
    this.last = null; this.render(landed);
    window.setTimeout(() => {
      this.spinning = false;
      if (won) this.pay(stake * 2);
      this.stats.flips++; if (won) this.stats.won++; this.stats.net += won ? stake : -stake;
      try { localStorage.setItem(KEY, JSON.stringify(this.stats)); } catch { /* private mode */ }
      this.last = { call, landed, stake, won };
      if (this.stake > this.crowns()) this.stake = STAKES.filter((s) => s <= this.crowns()).pop() ?? STAKES[0];
      if (this.isOpen) this.render();
    }, this.spinMs);
  }

  private render(spinTo?: Side) {
    const have = this.crowns(), l = this.last, s = this.stats;
    const coin = spinTo ? `spin-${spinTo}` : l ? `show-${l.landed}` : 'show-heads';
    const line = spinTo ? `You call it. The coin goes up…`
      : l ? (l.won ? `${cap(l.landed)}! You called it. Tam pays you ${l.stake * 2} ◎ (your ${l.stake} back and ${l.stake} more).` : `${cap(l.landed)}. Not your call: Tam keeps your ${l.stake} ◎.`)
      : have < 1 ? 'Tam taps the table. "No crowns, no coin, friend."' : '"Heads or tails? Pick your stake and call it."';
    this.el.innerHTML = `<div class="card narrow coin-card"><div class="eyebrow">The Inn · Tam's coin table</div><h1>Heads or Tails</h1>
      <div class="coin-odds">Fair coin · 1 in 2 · pays 1:1 (win your stake back doubled) · stakes 1 to ${MAX_STAKE} ◎</div>
      <div class="coin ${coin}" aria-hidden="true"><div class="coin-face coin-h">♛</div><div class="coin-face coin-t">❦</div></div>
      <p class="coin-line" aria-live="polite">${line}</p>
      <div class="coin-stakes" role="group" aria-label="Stake">${STAKES.map((n) => `<button class="secondary${n === this.stake ? ' on' : ''}" data-act="stake" data-n="${n}" ${n > have || spinTo ? 'disabled' : ''} aria-pressed="${n === this.stake}">${n} ◎</button>`).join('')}</div>
      <div class="coin-calls"><button class="primary" data-act="heads" ${spinTo || this.stake > have ? 'disabled' : ''}>Heads ♛</button><button class="primary" data-act="tails" ${spinTo || this.stake > have ? 'disabled' : ''}>Tails ❦</button></div>
      <p class="fine">You carry ${have} ◎.${s.flips ? ` ${s.flips} flip${s.flips === 1 ? '' : 's'}, ${s.won} won, ${s.net >= 0 ? '+' : ''}${s.net} ◎ all told.` : ''}</p>
      <button class="secondary" data-act="close" ${spinTo ? 'disabled' : ''}>Leave the table</button></div>`;
  }
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
