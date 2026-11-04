// B48 (Mike 2026-11-04): going deeper pays. Each new room pays 1 crown per room of depth, once per room per seed;
// the chest and the deepest room each give an unread lore book; climbing out shows what the delve paid.
// Usage: node test/e2e-delve-rewards.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 960, height: 600 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
const G = (fn, a) => page.evaluate(fn, a);
await G(() => { window.__toasts = []; const el = document.getElementById('toast'); new MutationObserver(() => window.__toasts.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); });
const SEED = 4242;
const enter = async () => {
  await G((s) => { const g = window.__gametool; g.enterDungeon(s); g.goblins.clear(); }, SEED);
  await page.waitForFunction(() => window.__gametool.inDungeon, null, { timeout: 30000 });
};
const crowns = () => G(() => window.__gametool.inventory.count('crown'));
// Stand in room i for a few frames.
const visit = (i) => G(async (i) => { const g = window.__gametool, r = g.dungeon.layout.rooms[i], p = g.dungeon.roomAt(r);
  g.goblins.clear(); g.player.pos.set(p.x, g.player.pos.y, p.z); await new Promise((res) => setTimeout(res, 700)); return g.dungeon.roomOf(g.player.pos.x, g.player.pos.z); }, i);

await enter();
const L = await G(() => window.__gametool.dungeon.layout.rooms.map((r, i) => ({ i, depth: r.depth, tag: r.tag })));
const maxDepth = Math.max(...L.map((r) => r.depth));
const shallow = L.filter((r) => r.depth > 0 && r.depth < maxDepth).sort((a, b) => a.depth - b.depth)[0];
const deepest = L.find((r) => r.depth === maxDepth);
const c0 = await crowns();
const at = await visit(shallow.i);
const c1 = await crowns();
check('B48 reaching a room pays 1 crown per room of depth', at === shallow.i && c1 - c0 === shallow.depth, `room ${shallow.i} depth ${shallow.depth}: ${c0} → ${c1}`);
await visit(L.find((r) => r.tag === 'entrance').i);
await visit(shallow.i);
check('B48 the same room never pays twice in a delve', await crowns() === c1);
const seenBefore = await G(() => JSON.parse(localStorage.getItem('gametool.seen') ?? '[]').filter((s) => s.startsWith('entry:')).length);
await visit(deepest.i);
await page.waitForTimeout(1800);
const c2 = await crowns();
const seenAfter = await G(() => JSON.parse(localStorage.getItem('gametool.seen') ?? '[]').filter((s) => s.startsWith('entry:')).length);
const t1 = await G(() => window.__toasts.join(' | '));
check('B48 the deepest room pays its depth plus a purse, and gives an unread lore book', c2 - c1 === maxDepth + 5 && seenAfter === seenBefore + 1 && /A lore book in the deepest room/.test(t1), `${c1} → ${c2}, books ${seenBefore} → ${seenAfter}`);
// The chest: trinket plus a lore book.
const chest = await G(async () => { const g = window.__gametool, sp = g.dungeon.spots.find((s) => s.kind === 'chest'); if (!sp) return null;
  const it = g.interactables.find((x) => x.obj === sp.hit); it.act(); await new Promise((r) => setTimeout(r, 5200)); return g.delveRun.books.length; });
check('B48 the chest gives a second lore book', chest === 2, String(chest));
await G(() => { window.__toasts = []; window.__gametool.exitDungeon(); });
await page.waitForTimeout(300);
const t2 = await G(() => window.__toasts.join(' | '));
check('B48 climbing out shows what the delve paid (rooms, crowns, books)', new RegExp(`This delve: \\d+ new rooms?, ${c2 - c0} ◎, 2 lore books`).test(t2), t2);
// Again on the same seed: nothing pays twice.
await enter();
const c3 = await crowns();
for (const r of L) await visit(r.i);
await page.waitForTimeout(1600);
const c4 = await crowns();
const rest = L.filter((r) => ![shallow.i, deepest.i].includes(r.i)).reduce((n, r) => n + r.depth, 0);
check('B48 a second delve on the same seed only pays the rooms not reached before, and no book again', c4 - c3 === rest && await G(() => window.__gametool.delveRun.books.length) === 0, `${c3} → ${c4} (expected +${rest})`);
check('B48 no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
