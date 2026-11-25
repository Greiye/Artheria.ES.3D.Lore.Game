// Save migrations (src/migrate.ts): friends open saves for years, so every step must keep working on old data.
import { describe, expect, it } from 'vitest';
import { DATA_V, upgrade } from '../../src/migrate';
import { STARTING_CROWNS, DEBUG_UNLIMITED_CROWNS } from '../../src/economy';

type Data = Record<string, string>;
const save = (items: [string, number][]) => JSON.stringify({ v: 1, at: 'x', items });
const items = (d: Data) => JSON.parse(d['gametool.save']).items as [string, number][];

describe('economy', () => {
  it('starts every hero with 500 crowns and has no debug purse', () => {
    expect(STARTING_CROWNS).toBe(500);
    expect(DEBUG_UNLIMITED_CROWNS).toBe(false);
  });
});

describe('upgrade', () => {
  it('is at data version 3', () => expect(DATA_V).toBe(3));

  it('1 -> 2: a first day part-way through moves on one step', () => {
    const d: Data = { 'gametool.firstday': JSON.stringify({ step: 2, done: false }) };
    upgrade(d, 1);
    expect(JSON.parse(d['gametool.firstday']).step).toBe(3);
  });

  it('1 -> 2: a finished or not-started first day is left alone', () => {
    const done: Data = { 'gametool.firstday': JSON.stringify({ step: 4, done: true }) };
    const fresh: Data = { 'gametool.firstday': JSON.stringify({ step: 0, done: false }) };
    upgrade(done, 1); upgrade(fresh, 1);
    expect(JSON.parse(done['gametool.firstday']).step).toBe(4);
    expect(JSON.parse(fresh['gametool.firstday']).step).toBe(0);
  });

  it('2 -> 3: a small purse is topped up to 500, first in the bag', () => {
    const d: Data = { 'gametool.save': save([['bolt', 5], ['crown', 40]]) };
    upgrade(d, 2);
    expect(items(d)).toEqual([['crown', 500], ['bolt', 5]]);
  });

  it('2 -> 3: a richer purse is kept, and a bag with no crowns gets 500', () => {
    const rich: Data = { 'gametool.save': save([['crown', 900]]) };
    const none: Data = { 'gametool.save': save([['bolt', 5]]) };
    upgrade(rich, 2); upgrade(none, 2);
    expect(items(rich)).toEqual([['crown', 900]]);
    expect(items(none)).toEqual([['crown', 500], ['bolt', 5]]);
  });

  it('runs every step from version 1 and leaves other keys alone', () => {
    const d: Data = { 'gametool.firstday': JSON.stringify({ step: 1, done: false }), 'gametool.save': save([]), 'other': 'keep' };
    upgrade(d, 1);
    expect(JSON.parse(d['gametool.firstday']).step).toBe(2);
    expect(items(d)).toEqual([['crown', 500]]);
    expect(d.other).toBe('keep');
  });

  it('a current profile is not touched', () => {
    const d: Data = { 'gametool.firstday': JSON.stringify({ step: 2, done: false }), 'gametool.save': save([['crown', 1]]) };
    const before = { ...d };
    upgrade(d, DATA_V);
    expect(d).toEqual(before);
  });

  it('unreadable data never throws and is left as it was', () => {
    const d: Data = { 'gametool.firstday': '{not json', 'gametool.save': 'nope' };
    expect(() => upgrade(d, 1)).not.toThrow();
    expect(d).toEqual({ 'gametool.firstday': '{not json', 'gametool.save': 'nope' });
  });

  it('a profile with no keys stays empty', () => {
    expect(upgrade({}, 1)).toEqual({});
  });
});
