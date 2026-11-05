// Mike 2026-11-05 (F1): the witch's scrolls. Three on the top step of each stair down; take one and it imbues
// something you carry for the rest of the run (some carry a curse).
// Usage: node test/e2e-scrolls.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

await G(() => { const g = window.__gametool; g.inventory.give('sword', 1); g.hands.set('right', 'sword'); });

await G(() => { const g = window.__gametool; for (const i of ['sword', 'crossbow', 'shield', 'rock']) g.inventory.give(i, i === 'rock' ? 5 : 1); g.hands.set('right', 'sword'); });
await G(() => window.__gametool.startDescent());
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await G(() => window.__gametool.goDown());
await frames(2);
const offer = await G(() => [...document.querySelectorAll('#scrolls [data-scroll]')].map((b) => b.dataset.scroll));
check('Taking the stairs down: three scrolls on the step, and a way to leave them', offer.filter((x) => x !== 'none').length === 3 && offer.includes('none') && await G(() => window.__gametool.scrollPicker.isOpen), JSON.stringify(offer));
await page.screenshot({ path: path.join(shots, 'scrolls-offer.png') });
const pick = offer.find((x) => x !== 'none');
await page.click(`#scrolls [data-scroll="${pick}"]`);
await page.waitForFunction(() => window.__gametool.descent?.floor === 2 && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await frames(3);
const took = await G(() => ({ s: window.__gametool.descent.scrolls, hud: document.getElementById('delveHp').textContent }));
check('Taking one imbues you, shows on the HUD, and on down you go', took.s?.length === 1 && took.s[0] === pick && took.hud.includes('✦'), JSON.stringify(took));
await G(() => window.__gametool.goDown());
await frames(2);
const offer2 = await G(() => [...document.querySelectorAll('#scrolls [data-scroll]')].map((b) => b.dataset.scroll));
check("The next step doesn't offer one you already have", !offer2.includes(pick), JSON.stringify(offer2));
await page.click('#scrolls [data-scroll="none"]');
await page.waitForFunction(() => window.__gametool.descent?.floor === 3 && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
check('Leaving them: on down, no new scroll', await G(() => window.__gametool.descent.scrolls.length === 1));

// The boons themselves (set directly, then try them on a goblin in front of you).
const setup = (ids) => G((ids) => {
  const g = window.__gametool; g.descent.scrolls = ids; g.goblins.clear();
  g.spawnGoblins(1); const f = g.goblins.alive[0]; f.st.hp = 50; f.root.position.copy(g.player.pos).add(new g.Vector3(0, 0, -1.4)); f.state = 'chase';
  return !!f;
}, ids);
await setup(['frost']);
const frost = await G(() => { const g = window.__gametool, f = g.goblins.alive[0], from = g.player.pos.clone().setY(f.root.position.y + 0.9); const t = g.crossbow.targets(from, new g.Vector3(0, 0, -1), 10); if (!t) return null; t.hit(1, new g.Vector3(0, 0, -1)); return f.chillT; });
check('Rime: a bolt slows the goblin it hits', frost > 2, String(frost));
await setup(['drink']);
const drink = await G(() => { const g = window.__gametool; g.delveHp = 4; const n = g.sword.slash({ from: g.player.pos.clone().setY(1), fwd: new g.Vector3(0, 0, -1), reach: 2.5, arc: 1.2, damage: 1, heavy: false }); return { n, hp: g.delveHp }; });
check('The Drinking Edge: a cut that lands mends 1', drink.n >= 1 && drink.hp === 5, JSON.stringify(drink));
const stone = await G(() => { const g = window.__gametool; g.descent.scrolls = ['stone']; g.applyScrolls(); return g.Thrower.bonus; });
check('The Heavy Stone: thrown rocks hit harder', stone > 0, String(stone));
await G(() => window.__gametool.exitDungeon());
check('Climb out: the imbues end with the run', await G(() => window.__gametool.Thrower.bonus === 0 && !window.__gametool.goblins.booksFirst));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
