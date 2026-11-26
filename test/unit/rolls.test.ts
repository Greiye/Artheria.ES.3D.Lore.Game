// Seeds and roll tables (src/dungeon/gen.ts, src/traits/roll.ts): the same seed must always give the same floor,
// goblin and townsperson, or saved runs and shared seeds stop meaning anything.
import { describe, expect, it } from 'vitest';
import { mulberry32, seedFrom, generate, isFloor, N } from '../../src/dungeon/gen';
import { rollDie, seedOf, roll, type Archetype } from '../../src/traits/roll';
import { rollTownsfolk } from '../../src/traits/townsfolk';
import GOBLIN from '../../src/data/traits/goblin.json';

const GOBLIN_ARCH = GOBLIN as unknown as Archetype;
const plain = (v: ReturnType<typeof roll>) => ({ ...v, tags: [...v.tags].sort() });

describe('seeds', () => {
  it('mulberry32 repeats for a seed and stays in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 1000; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });

  it('seedFrom takes a whole number as is and hashes text to a fixed non-zero seed', () => {
    expect(seedFrom('1234')).toBe(1234);
    expect(seedFrom('  77 ')).toBe(77);
    expect(seedFrom('library')).toBe(seedFrom('library'));
    expect(seedFrom('library')).not.toBe(seedFrom('Library'));
    expect(seedFrom('')).toBeGreaterThan(0);
  });

  it('seedOf is fixed within a run, differs across runs and spawns, never 0', () => {
    expect(seedOf(3, 1)).toBe(seedOf(3, 1));
    const all = new Set<number>();
    for (let run = 0; run < 20; run++) for (let i = 0; i < 20; i++) { const s = seedOf(run, i); expect(s).toBeGreaterThan(0); all.add(s); }
    expect(all.size).toBe(400);
  });
});

describe('rollDie', () => {
  it('stays in range for dice and reads plain numbers', () => {
    const R = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const d = rollDie('d20', R); expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(20);
      const s = rollDie('2d6', R); expect(s).toBeGreaterThanOrEqual(2); expect(s).toBeLessThanOrEqual(12);
    }
    expect(rollDie('3', R)).toBe(3);
    expect(rollDie('junk', R)).toBe(0);
  });
});

describe('roll tables', () => {
  it('a goblin is rebuilt from its seed alone', () => {
    for (const s of [1, 99, 123456]) expect(plain(roll(GOBLIN_ARCH, s))).toEqual(plain(roll(GOBLIN_ARCH, s)));
    expect(roll(GOBLIN_ARCH, 1).name).toBeTruthy();
  });

  it('a bigger budget never rolls a lower rarity on average', () => {
    const rank = { common: 0, uncommon: 1, rare: 2, legendary: 3 } as const;
    const mean = (budget: number) => { let t = 0; for (let s = 1; s <= 300; s++) t += rank[roll(GOBLIN_ARCH, s, { budget }).rarity]; return t / 300; };
    expect(mean(18)).toBeGreaterThanOrEqual(mean(4));
  });

  it('a townsperson is rebuilt from its seed, with attributes 1 to 20', () => {
    for (const s of [2, 50, 9999]) {
      const a = rollTownsfolk(s), b = rollTownsfolk(s);
      expect({ ...a, v: plain(a.v) }).toEqual({ ...b, v: plain(b.v) });
      for (const n of [a.look.strength!, a.look.endurance!]) { expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(20); }
      expect(a.height).toBeGreaterThan(0);
    }
  });
});

describe('dungeon layout', () => {
  it('the same seed gives the same floor', () => {
    const a = generate(31337), b = generate(31337);
    expect(a.theme).toBe(b.theme);
    expect(a.rooms).toEqual(b.rooms);
    expect([...a.grid]).toEqual([...b.grid]);
  });

  it('every room is inside the map and reachable from the entrance; one entrance, one nest', () => {
    for (let s = 1; s <= 150; s++) {
      const l = generate(s);
      expect(l.rooms.filter((r) => r.tag === 'entrance').length).toBe(1);
      expect(l.rooms.filter((r) => r.tag === 'nest').length).toBe(1);
      for (let x = 0; x < N; x++) for (const y of [0, N - 1]) { expect(isFloor(l, x, y)).toBe(false); expect(isFloor(l, y, x)).toBe(false); }
      const start = l.rooms.find((r) => r.tag === 'entrance')!;
      const seen = new Uint8Array(N * N), q: [number, number][] = [[start.cx, start.cy]];
      seen[start.cy * N + start.cx] = 1;
      while (q.length) {
        const [x, y] = q.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (isFloor(l, nx, ny) && !seen[ny * N + nx]) { seen[ny * N + nx] = 1; q.push([nx, ny]); }
        }
      }
      for (const r of l.rooms) expect(seen[r.cy * N + r.cx], `seed ${s}: room at ${r.cx},${r.cy}`).toBe(1);
    }
  });
});
