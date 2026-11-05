// Mike 2026-11-05: Diablo-style item cards in the bag: hover, focus or long-press a bag cell for name (coloured by
// kind; a forged name shows gold), type, stats, which hand holds it, value and flavour.
// Usage: node test/e2e-item-cards.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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


await G(() => { const g = window.__gametool; g.inventory.give('sword', 1); g.inventory.give('mace', 1); g.inventory.give('shield', 1); g.inventory.give('bread', 2); g.hands.set('right', 'mace'); g.hands.set('left', 'shield'); g.openInventory(); });
await page.waitForFunction(() => !document.getElementById('inventory').classList.contains('hidden'), null, { timeout: 8000 });
await frames(2);
// Hover the mace.
await page.hover('#inventory .inv-cell[data-item="mace"]');
await frames(2);
const mace = await G(() => { const c = document.querySelector('#inventory .item-card'); const r = c.getBoundingClientRect(); return { shown: !c.classList.contains('hidden'), item: c.dataset.item, text: c.textContent, cls: c.querySelector('.ic-name').className, on: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; });
check('Hovering the mace shows its card: name, type, damage, speed, reach, the hand that holds it, cost', mace.shown && mace.item === 'mace' && /Flanged Mace/.test(mace.text) && /Damage 3–4/.test(mace.text) && /Speed/.test(mace.text) && /Reach 1.6/.test(mace.text) && /right hand/.test(mace.text) && /Costs ◎ 22/.test(mace.text) && mace.on, JSON.stringify(mace));
await page.screenshot({ path: path.join(shots, 'item-card-mace.png') });
await page.hover('#inventory .inv-cell[data-item="shield"]');
await frames(1);
const sh = await G(() => { const c = document.querySelector('#inventory .item-card'); return { item: c.dataset.item, text: c.textContent, cls: c.querySelector('.ic-name').className }; });
check('The shield card: blue name, block arc, left hand', sh.item === 'shield' && /ic-shield/.test(sh.cls) && /Blocks 60°/.test(sh.text) && /left hand/.test(sh.text), JSON.stringify(sh));
await page.mouse.move(5, 5);
await frames(1);
check('Moving off hides it', await G(() => document.querySelector('#inventory .item-card').classList.contains('hidden')));
// A forged, named sword shows its name in gold, its legend and engraving.
await G(() => { const g = window.__gametool; g.sword.applyCosmetic({ ...g.sword.look, name: 'Last Word', legend: 'It never had the last word.', engraving: 'Not today' }); g.inventory.render(); document.querySelector('#inventory .inv-cell[data-item="sword"]').focus(); });
await frames(1);
const sw = await G(() => { const c = document.querySelector('#inventory .item-card'); return { shown: !c.classList.contains('hidden'), text: c.textContent, cls: c.querySelector('.ic-name').className }; });
check('Focus (keyboard or pad) on a forged sword: its own name in gold, the legend and engraving', sw.shown && /ic-unique/.test(sw.cls) && /Last Word/.test(sw.text) && /never had the last word/.test(sw.text) && /Not today/.test(sw.text) && /Practice Sword/.test(sw.text), JSON.stringify(sw));
await page.screenshot({ path: path.join(shots, 'item-card-forged-sword.png') });
check('Food is green', await G(() => { document.querySelector('#inventory .inv-cell[data-item="bread"]').focus(); return /ic-food/.test(document.querySelector('#inventory .item-card .ic-name').className); }));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

// Touch: a long press shows the card.
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const tp = await ctx.newPage();
await tp.route(/^https?:/, (r) => r.abort());
await tp.goto('file://' + file);
await tp.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await tp.waitForTimeout(400);
await tp.evaluate(() => document.getElementById('begin').click());
await tp.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
await tp.evaluate(() => { const g = window.__gametool; g.inventory.give('spear', 1); g.openInventory(); });
await tp.waitForFunction(() => !document.getElementById('inventory').classList.contains('hidden'), null, { timeout: 8000 });
const box = await tp.evaluate(() => { const r = document.querySelector('#inventory .inv-cell[data-item="spear"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
const cdp = await ctx.newCDPSession(tp);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
await tp.waitForTimeout(700);
const lp = await tp.evaluate(() => { const c = document.querySelector('#inventory .item-card'); const r = c.getBoundingClientRect(); return { shown: !c.classList.contains('hidden'), item: c.dataset.item, on: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1 }; });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await tp.screenshot({ path: path.join(shots, 'item-card-touch.png') });
check('Phone: a long press on the spear shows its card, on screen', lp.shown && lp.item === 'spear' && lp.on, JSON.stringify(lp));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
