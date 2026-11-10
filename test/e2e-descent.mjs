// Mike 2026-11-05: the roguelike descent: floors 1-30, a new layout each, stairs down in the deepest room, harder
// goblins by band, carried books reach Natalie only if you climb out, death ends the hero (last words, the Inn tally),
// and the hoard on floor 30 plus climbing out puts your drawing on the survivors' wall beside Kavik's.
// Usage: node test/e2e-descent.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
const G = (fn, a) => page.evaluate(fn, a);
const frames = (n = 6) => G((n) => new Promise((done) => { let k = 0; const t = () => (++k >= n ? done() : requestAnimationFrame(t)); t(); }), n);

await G(() => { const g = window.__gametool; g.inventory.give('sword', 1); g.inventory.give('crown', 30); g.hands.set('right', 'sword'); });
// The trapdoor offers the descent.
await G(() => window.__gametool.openDescend());
const panel = await G(() => document.getElementById('descend').textContent + (document.getElementById('dgSeed') ? ' SEEDBOX' : ''));
check('The trapdoor offers the descent: 30 floors, a hoard, permadeath; Quick Dungeon stays as practice', /30 floors deep/.test(panel) && /hoard/.test(panel) && /this hero is gone/.test(panel) && /practice/.test(panel) && !/SEEDBOX/.test(panel), panel.slice(0, 200));
await page.click('#descend [data-act="go"]');
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await frames(3);
const f1 = await G(() => { const g = window.__gametool; return { floor: g.descent?.floor, down: g.dungeon.spots.some((s) => s.kind === 'down'), up: g.dungeon.spots.some((s) => s.kind === 'stairs'), hud: document.getElementById('delveHp').textContent, band: g.goblins.band }; });
check('Floor 1: stairs up, stairs down in the deepest room, the floor on the HUD', f1.floor === 1 && f1.down && f1.up && /Floor 1/.test(f1.hud) && f1.band === 0, JSON.stringify(f1));
// A book found below is only carried.
const seen0 = await G(() => JSON.parse(localStorage.getItem('gametool.seen') || '[]').length);
await G(() => window.__gametool.dropLoreBook('on a test shelf', 7));
const carry = await G(() => ({ books: window.__gametool.descent.books.length, seen: JSON.parse(localStorage.getItem('gametool.seen') || '[]').length }));
check('A book found below is carried, not yet on the shelves', carry.books === 1 && carry.seen === seen0, JSON.stringify({ seen0, carry }));
// Down: a new floor, wounds carry.
await G(() => { window.__gametool.delveHp = 7; window.__gametool.goDown(true); });
await page.waitForFunction(() => window.__gametool.descent?.floor === 2 && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
const f2 = await G(() => ({ hp: window.__gametool.delveHp, seed: window.__gametool.dungeon.layout.seed }));
check('Down the stairs: floor 2, a new layout, and your wounds come with you', f2.hp === 7, JSON.stringify(f2));
// Deeper bands: floor 14.
await G(() => { window.__gametool.descent.floor = 13; window.__gametool.goDown(true); });
await page.waitForFunction(() => window.__gametool.descent?.floor === 14 && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
const deep = await G(() => { const g = window.__gametool, a = g.goblins.alive; return { band: g.goblins.band, n: a.length, roles: a.map((f) => f.role), hp: g.goblins.hpMul, dmg: g.goblins.dmgBonus, hud: document.getElementById('delveHp').textContent }; });
check('Floor 14: band 3 (droppers, slingers, guards), tougher and more goblins', deep.band === 3 && deep.n >= 6 && deep.roles.some((r) => r !== 'none') && deep.hp > 1.8 && deep.dmg >= 2, JSON.stringify(deep));
await page.screenshot({ path: path.join(shots, 'descent-floor14.png') });
// Climb out: the book reaches Natalie, the depth is recorded.
await G(() => window.__gametool.exitDungeon());
await frames(2);
const out = await G(() => { const g = window.__gametool; return { inD: g.inDungeon, rec: { ...g.record }, seen: JSON.parse(localStorage.getItem('gametool.seen') || '[]').length, run: g.descent }; });
check('Climbing out hands the book to Natalie and records floor 14', !out.inD && out.rec.deepest === 14 && out.rec.delivered === 1 && out.seen === seen0 + 1 && out.run === null, JSON.stringify(out));

// Death: last words, the tally, a new hero.
await G(() => window.__gametool.startDescent());
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await G(() => window.__gametool.dropLoreBook('on a test shelf', 9));
await G(() => window.__gametool.heroFalls('Grub the Test Goblin'));
await page.waitForFunction(() => !document.getElementById('lastWords').classList.contains('hidden'), null, { timeout: 8000 });
const lw = await G(() => document.getElementById('lastWords').textContent);
await page.fill('#lwText', 'Tell them the stairs moved.');
await page.screenshot({ path: path.join(shots, 'descent-last-words.png') });
await page.click('#lastWords [data-act="write"]');
await frames(3);
// Since PR #169 a new hero starts with 500 crowns: the fallen one's purse is gone, the new one's is full.
const after = await G(() => { const g = window.__gametool; return { tally: JSON.parse(localStorage.getItem('gametool.tally') || '[]'), crowns: g.inventory.count('crown'), sword: g.inventory.count('sword'), inD: g.inDungeon, heroes: g.record.heroes, seen: JSON.parse(localStorage.getItem('gametool.seen') || '[]').length }; });
check('Death: last words, then the hero is gone (bag, crowns, the carried book); the tally keeps the name and words', /has fallen/.test(lw) && /Grub the Test Goblin/.test(lw) && after.tally.length === 1 && after.tally[0].words === 'Tell them the stairs moved.' && after.tally[0].by === 'Grub the Test Goblin' && after.crowns === 500 && after.sword === 0 && !after.inD && after.heroes === 2 && after.seen === seen0 + 1, JSON.stringify(after));
await page.waitForFunction(() => window.__gametool.state === 'forge', null, { timeout: 8000 }).catch(() => {});
check('…and the mirror opens for a new hero', await G(() => window.__gametool.state === 'forge'));
await G(() => window.__gametool.characterForge.close?.());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 }).catch(() => {});

// The Inn's walls.
await G(() => { const g = window.__gametool; g.interactables.find((i) => (!i.when || i.when()) && i.verb() === 'Read the death tally').act(); });
const tally = await G(() => document.getElementById('innWall').textContent);
check('The death tally at the Inn lists the fallen and their last words', /Death Tally/.test(tally) && /Grub the Test Goblin/.test(tally) && /stairs moved/.test(tally), tally.slice(0, 160));
await page.screenshot({ path: path.join(shots, 'descent-tally.png') });
await G(() => window.__gametool.innWalls.close());
await G(() => { const g = window.__gametool; g.interactables.find((i) => (!i.when || i.when()) && i.verb() === "Look at the survivors' wall").act(); });
const wall = await G(() => ({ text: document.getElementById('innWall').textContent, n: document.querySelectorAll('#innWall .survivor').length }));
check("The survivors' wall: only Kavik's sketch so far", wall.n === 1 && /Kavik/.test(wall.text), JSON.stringify(wall).slice(0, 160));
await G(() => window.__gametool.innWalls.close());
await frames(2);

// The good ending: floor 30, the hoard, out alive.
await G(() => window.__gametool.startDescent());
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await G(() => { window.__gametool.descent.floor = 29; window.__gametool.goDown(true); });
await page.waitForFunction(() => window.__gametool.descent?.floor === 30 && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
const f30 = await G(() => { const g = window.__gametool; return { hoard: g.dungeon.spots.some((s) => s.kind === 'hoard'), down: g.dungeon.spots.some((s) => s.kind === 'down'), keepers: g.goblins.alive.filter((f) => f.role === 'keeper').length }; });
check('Floor 30: the hoard and its keepers, no stairs down', f30.hoard && !f30.down && f30.keepers >= 1, JSON.stringify(f30));
await G(() => { const g = window.__gametool, s = g.dungeon.spots.find((x) => x.kind === 'hoard'); g.player.spawn(s.hit.position.clone().setY(0).add(new g.Vector3(0, 0, 1.6)), 0); g.player.thirdPerson = true; g.goblins.clear(); });
await frames(8);
await page.screenshot({ path: path.join(shots, 'descent-hoard.png') });
await G(() => { const g = window.__gametool, hit = g.dungeon.spots.find((x) => x.kind === 'hoard').hit; g.interactables.find((i) => i.obj === hit).act(); });
await G(() => window.__gametool.exitDungeon());
await page.waitForFunction(() => !document.getElementById('innWall').classList.contains('hidden'), null, { timeout: 8000 }).catch(() => {});
const good = await G(() => ({ n: document.querySelectorAll('#innWall .survivor').length, surv: JSON.parse(localStorage.getItem('gametool.survivors') || '[]') }));
await page.screenshot({ path: path.join(shots, 'descent-survivors.png') });
check("Out alive with the hoard: your drawing goes up beside Kavik's", good.n === 2 && good.surv.length === 1 && typeof good.surv[0].art === 'string', JSON.stringify({ n: good.n, s: good.surv.length }));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
