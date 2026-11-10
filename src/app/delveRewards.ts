// B48: delving deeper pays, in crowns and lore books. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import { lore } from '../lore';
import { haptics } from '../input/haptics';
import { CROWN } from '../shop';
import type { DelveRewardsDeps } from '../main';

export function setupDelveRewards(deps: DelveRewardsDeps) {
  // Each room you reach pays 1 crown per room of depth (the entrance pays nothing), once per room per seed, so walking
  // the same dungeon again doesn't farm. The chest and the deepest room each give a lore book you haven't read yet (an
  // extra purse when you've read them all). Climbing out shows what the run paid.
  let run = { rooms: 0, crowns: 0, books: [] as string[] }, lastRoom = -1;
  const DEEP_PURSE = 5, READ_ALL_PURSE = 4;
  function delvePay(n: number) { if (n <= 0) return; deps.inventory.give(CROWN, n); run.crowns += n; }
  function dropLoreBook(where: string, seed: number): string | null {
    const unread = lore.entries.filter((e) => e.type === 'lore' && !deps.seen.includes('entry:' + e.id));
    if (!unread.length) { delvePay(READ_ALL_PURSE); deps.toast(`+${READ_ALL_PURSE} ◎ ${where}: you've read every lore book, so it's a purse instead.`, 3600); return null; }
    const e = unread.filter((x) => !deps.descent?.books.includes(x.id))[(seed + run.books.length * 7) % Math.max(1, unread.length - (deps.descent?.books.length ?? 0))] ?? unread[0];
    if (deps.descent) {   // below, a book is only carried: it reaches Natalie (and the gallery) when you climb out alive
      if (!deps.descent.books.includes(e.id)) deps.descent.books.push(e.id);
      run.books.push(e.title);
      haptics.play('pickup');
      deps.toast(`A lore book ${where}: "${e.title}". Carry it up to Natalie (${deps.descent.books.length} carried). Die down here and it's lost.`, 5200);
      return e.id;
    }
    deps.markSeen('entry:' + e.id); deps.refreshGallery();
    run.books.push(e.title);
    haptics.play('pickup');
    deps.toast(`A lore book ${where}: "${e.title}" by ${e.credit_as}. It's on its shelf in the Ruined Library and in the gallery.`, 5200);
    return e.id;
  }
  function delveTick() {
    if (!deps.inDungeon || !deps.dungeon.layout) return;
    const i = deps.dungeon.roomOf(deps.player.pos.x, deps.player.pos.z);
    if (i < 0 || i === lastRoom) return;
    lastRoom = i;
    const L = deps.dungeon.layout, seed = L.seed, d = deps.delves[seed], r = L.rooms[i];
    if (!d) return;
    const reached = d.rooms ?? (d.rooms = []);
    if (reached.includes(i)) return;
    reached.push(i); run.rooms++;
    const pay = Math.max(0, r.depth);
    const deepest = r.depth > 0 && r.depth === Math.max(...L.rooms.map((x) => x.depth));
    delvePay(pay);
    if (deepest && !d.deep) {
      d.deep = true; delvePay(DEEP_PURSE);
      deps.toast(`+${pay + DEEP_PURSE} ◎ the deepest room (depth ${r.depth}).`, 2600);
      deps.saveDelves();
      setTimeout(() => { if (deps.inDungeon) dropLoreBook('in the deepest room', seed); }, 1400);
      return;
    }
    deps.saveDelves();
    if (pay) { haptics.play('pickup'); deps.toast(`+${pay} ◎ room ${r.depth} deep`, 1800); }
  }
  function runSummary() {
    if (!run.rooms && !run.crowns && !run.books.length) return;
    const books = run.books.length ? `, ${run.books.length} lore book${run.books.length > 1 ? 's' : ''} (${run.books.map((t) => `"${t}"`).join(', ')})` : '';
    deps.toast(`This delve: ${run.rooms} new room${run.rooms === 1 ? '' : 's'}, ${run.crowns} ◎${books}.`, 6000);
    run = { rooms: 0, crowns: 0, books: [] };
  }
  return { delveTick, get lastRoom() { return lastRoom; }, set lastRoom(v) { lastRoom = v; }, get run() { return run; }, set run(v) { run = v; }, runSummary, dropLoreBook };
}
