// Mike 2026-11-05: each hand holds what you choose, in any combination, feasible or not: two torches, two swords,
// two crossbows, a sword and a crossbow... The D-pad's left and right cycle that hand; the bag has a Hands row.
// The held things are pairs of instances (A and B). A is the "first" one: whenever any hand holds that kind of thing,
// A is the one in use, so older code that asks `crossbow.equipped` or `torch.lit` still gets the right answer.
// B only joins in when both hands hold the same kind.
import type { Crossbow } from './crossbow';
import type { Sword, MeleeKind } from './sword';
import type { Thrower, ThrowKind } from './sling';
import type { Torch } from './torch';
import type { Shield } from './shield';
import { storeSet } from './store';

export type Hand = 'left' | 'right';
export type HandItem = 'none' | 'torch' | 'shield' | 'buckler' | 'crossbow' | MeleeKind | ThrowKind;
/** The order the D-pad cycles through (unowned things are skipped). */
export const HAND_ITEMS: HandItem[] = ['none', 'sword', 'dagger', 'mace', 'spear', 'crossbow', 'sling', 'rock', 'shield', 'buckler', 'torch'];
export const HAND_LABEL: Record<HandItem, string> = { none: 'Empty', torch: 'Torch', sword: 'Sword', dagger: 'Dagger', mace: 'Mace', spear: 'Spear', crossbow: 'Crossbow', sling: 'Sling', rock: 'Rocks', shield: 'Round shield', buckler: 'Buckler' };
export const MELEE_KINDS: readonly HandItem[] = ['sword', 'dagger', 'mace', 'spear'];
export const isMelee = (i: HandItem): i is MeleeKind => MELEE_KINDS.includes(i);
export const isThrow = (i: HandItem): i is ThrowKind => i === 'rock' || i === 'sling';
const sideOf = (h: Hand): 1 | -1 => (h === 'right' ? 1 : -1);
const KEY = 'gametool.hands';

export class Hands {
  /** What each hand holds. Read it; change it with set(). */
  readonly held: Record<Hand, HandItem> = { left: 'none', right: 'none' };
  onChange: () => void = () => undefined;
  private syncing = false;

  constructor(private bows: [Crossbow, Crossbow], private swords: [Sword, Sword], private torches: [Torch, Torch],
    private shields: [Shield, Shield], private throwers: [Thrower, Thrower], private owns: (item: HandItem) => boolean) {
    // Older code (and the 1 / 2 / 3 keys) equips A directly: keep the hands in step with it.
    const resync = () => { if (!this.syncing) this.readBack(); };
    for (const x of [...bows, ...swords]) { const prev = x.onChange; x.onChange = () => { prev(); resync(); }; }
  }

  get bow() { return this.bows[0]; }
  /** The crossbow / sword / torch in that hand, if it holds one. */
  bowIn(h: Hand) { return this.bows.find((b) => b.equipped && b.side === sideOf(h)) ?? null; }
  swordIn(h: Hand) { return this.swords.find((s) => s.equipped && s.side === sideOf(h)) ?? null; }
  throwerIn(h: Hand) { return this.throwers.find((s) => s.equipped && s.side === sideOf(h)) ?? null; }
  shieldIn(h: Hand) { return this.shields.find((s) => s.equipped && s.side === sideOf(h)) ?? null; }
  get shieldPair() { return this.shields; }
  /** Both hands hold the same kind. */
  both(item: HandItem) { return this.held.left === item && this.held.right === item; }
  /** The hand's button aims the crossbow (it holds nothing to use, and a crossbow is held). */
  aimsWith(h: Hand) { return (this.held[h] === 'none' || this.held[h] === 'torch') && this.bows[0].equipped && !this.both('crossbow'); }

  /** Put `item` in hand `h` (what was there goes back in the bag). False if you don't have it. */
  set(h: Hand, item: HandItem): boolean {
    if (item !== 'none' && !this.owns(item)) return false;
    this.held[h] = item;
    this.apply();
    return true;
  }
  /** The D-pad: the next thing you own for that hand. */
  cycle(h: Hand): HandItem {
    const i = HAND_ITEMS.indexOf(this.held[h]);
    for (let k = 1; k <= HAND_ITEMS.length; k++) {
      const next = HAND_ITEMS[(i + k) % HAND_ITEMS.length];
      if (next === 'none' || this.owns(next)) { this.set(h, next); return next; }
    }
    return this.held[h];
  }
  /** Drop anything you no longer own (a sword sold, a crossbow lost). */
  validate() {
    let changed = false;
    for (const h of ['left', 'right'] as Hand[]) if (this.held[h] !== 'none' && !this.owns(this.held[h])) { this.held[h] = 'none'; changed = true; }
    if (changed) this.apply();
  }

  /** Make the instances match `held`. */
  apply() {
    this.syncing = true;
    const pair = <T extends { side: 1 | -1 }>(kind: HandItem, [a, b]: [T, T], on: (x: T, yes: boolean) => void, side: (x: T, s: 1 | -1) => void) => {
      const hs = (['right', 'left'] as Hand[]).filter((h) => this.held[h] === kind);
      if (hs[0]) side(a, sideOf(hs[0]));
      if (hs[1]) side(b, sideOf(hs[1]));
      on(a, hs.length > 0); on(b, hs.length > 1);
    };
    const [ba, bb] = this.bows;
    pair('crossbow', this.bows, (x, yes) => { if (yes && !x.equipped) x.equip(); else if (!yes && x.equipped) x.unequip(); }, (x, s) => { x.side = s; });
    ba.partner = bb; bb.partner = ba; bb.drivesCamera = false;
    if (ba.dual) ba.setADS(false);
    // Hand weapons: sword, dagger, mace and spear share the pair of melee instances, one per hand that holds one.
    const mh = (['right', 'left'] as Hand[]).filter((h) => isMelee(this.held[h]));
    this.swords.forEach((x, i) => {
      const h = mh[i];
      if (!h) { if (x.equipped) x.unequip(); return; }
      x.setSide(sideOf(h)); x.setKind(this.held[h] as MeleeKind);
      if (!x.equipped) x.equip();
    });
    const th = (['right', 'left'] as Hand[]).filter((h) => isThrow(this.held[h]));
    this.throwers.forEach((x, i) => {
      const h = th[i];
      x.equipped = !!h;
      if (!h) { x.cancel(); return; }
      x.setSide(sideOf(h)); x.setKind(this.held[h] as ThrowKind);
    });
    pair('torch', this.torches, (x, yes) => x.set(yes), (x, s) => x.setSide(s));
    // Shields: both kinds share the pair of shield instances, one per hand that holds either.
    const sh = (['right', 'left'] as Hand[]).filter((h) => this.held[h] === 'shield' || this.held[h] === 'buckler');
    this.shields.forEach((x, i) => {
      const h = sh[i];
      x.equipped = !!h;
      if (!h) { x.blocking = false; return; }
      x.setSide(sideOf(h));
      const kind = this.held[h] as 'shield' | 'buckler';
      if (x.kind !== kind) x.setKind(kind);
    });
    const [ta, tb] = this.torches;
    ta.boost = tb.lit ? 1.35 : 1;
    this.syncing = false;
    this.save();
    this.onChange();
  }

  /** Something equipped A (or lit the torch) directly: work out what each hand now holds. */
  readBack() {
    const was = { ...this.held };
    const at = (h: Hand): HandItem => {
      const s = sideOf(h);
      if (this.bows.some((b) => b.equipped && b.side === s)) return 'crossbow';
      const m = this.swords.find((x) => x.equipped && x.side === s);
      if (m) return m.kind;
      const t = this.throwers.find((x) => x.equipped && x.side === s);
      if (t) return t.kind;
      if (this.torches.some((t) => t.lit && t.side === s)) return 'torch';
      const sh = this.shields.find((x) => x.equipped && x.side === s);
      if (sh) return sh.kind;
      return 'none';
    };
    // A newly drawn crossbow or sword takes over its hand: put away whatever else was there.
    const [ba] = this.bows, [sa] = this.swords;
    if (ba.equipped && sa.equipped && ba.side === sa.side) {
      if (isMelee(was[ba.side > 0 ? 'right' : 'left'])) sa.unequip(); else ba.unequip();
    }
    this.held.left = at('left'); this.held.right = at('right');
    if (this.held.left !== was.left || this.held.right !== was.right) this.apply();
  }

  save() { storeSet(KEY, JSON.stringify(this.held)); }
  load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Record<Hand, HandItem>> | null;
      if (!v) return;
      for (const h of ['left', 'right'] as Hand[]) if (v[h] && HAND_ITEMS.includes(v[h]!)) this.held[h] = v[h]!;
      this.validate(); this.apply();
    } catch { /* a bad save: keep empty hands */ }
  }
}
