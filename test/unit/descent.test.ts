// The descent's numbers (src/delve/descent.ts): bands, camps, guardians, flux, gifts and lost gear.
import { describe, expect, it } from 'vitest';
import { FLOORS, band, isCamp, rollGuardians, fluxFor, hasGift, carryOff, gearNear, TAKEABLE, maxFoesFor, budgetFor } from '../../src/delve/descent';
import { mulberry32 } from '../../src/dungeon/gen';

describe('descent numbers', () => {
  it('bands change at floors 4, 9, 14, 20, 25 and 30', () => {
    const at = (f: number) => band(f);
    expect([1, 3, 4, 8, 9, 13, 14, 19, 20, 24, 25, 29, 30].map(at)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
  });

  it('camps are every fifth floor, never the hoard', () => {
    const camps = Array.from({ length: FLOORS + 1 }, (_, f) => f).filter(isCamp);
    expect(camps).toEqual([5, 10, 15, 20, 25]);
  });

  it('foes and roll budget never shrink with depth, and foes cap at 9', () => {
    for (let f = 1; f < FLOORS; f++) {
      expect(maxFoesFor(f + 1)).toBeGreaterThanOrEqual(maxFoesFor(f));
      expect(budgetFor(f + 1)).toBeGreaterThanOrEqual(budgetFor(f));
    }
    expect(maxFoesFor(FLOORS)).toBe(9);
  });

  it('guardians sit 7 to 10 floors apart, all above the hoard', () => {
    for (let s = 1; s <= 200; s++) {
      const g = rollGuardians(mulberry32(s));
      expect(g.length).toBeGreaterThan(0);
      expect(g[0]).toBeGreaterThanOrEqual(7); expect(g[0]).toBeLessThanOrEqual(10);
      for (let i = 1; i < g.length; i++) { const gap = g[i] - g[i - 1]; expect(gap).toBeGreaterThanOrEqual(7); expect(gap).toBeLessThanOrEqual(10); }
      expect(Math.max(...g)).toBeLessThan(FLOORS);
    }
  });

  it('flux never lands on early floors, camps, guardian floors or the hoard', () => {
    const always = () => 0;   // R() = 0 always passes the flux chance
    const guardians = [8, 17, 26];
    for (const f of [1, 2, 5, 10, 8, 17, 26, FLOORS]) expect(fluxFor(f, guardians, always)).toBe('none');
    expect(fluxFor(3, guardians, always)).toBe('dark');
    expect(fluxFor(3, guardians, () => 0.99)).toBe('none');
  });

  it('patron gifts unlock at 2, 5, 8 and 12 books delivered', () => {
    expect([hasGift(1, 'purse'), hasGift(2, 'purse')]).toEqual([false, true]);
    expect([hasGift(4, 'smith'), hasGift(5, 'smith')]).toEqual([false, true]);
    expect([hasGift(7, 'kit'), hasGift(8, 'kit')]).toEqual([false, true]);
    expect([hasGift(11, 'scroll'), hasGift(12, 'scroll')]).toEqual([false, true]);
  });

  it('goblins carry off at most three takeable pieces, never books or food', () => {
    const lost = carryOff(['sword', 'book', 'bread', 'dagger', 'mace', 'spear', 'crossbow'], 7, 'Ash', () => 0);
    expect(lost.length).toBe(3);
    for (const g of lost) { expect(TAKEABLE).toContain(g.item); expect(g).toMatchObject({ floor: 7, owner: 'Ash' }); }
    expect(carryOff(['sword'], 7, 'Ash', () => 0.99)).toEqual([]);
  });

  it('lost gear turns up on its floor or the one either side', () => {
    const lost = [5, 6, 7, 8, 9].map((floor) => ({ item: 'sword', floor, owner: 'x' }));
    expect(gearNear(lost, 7).map((g) => g.floor)).toEqual([6, 7, 8]);
  });
});
