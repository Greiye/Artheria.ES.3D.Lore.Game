// Mike 2026-11-06 ("Map pinning doesn't work right. Right click on the map, then add a note there"): A5 map notes.
// Usage: npm run build && node test/e2e-map-notes.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { if (!localStorage.getItem('gametool.character')) localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })); });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await G(() => window.__gametool.endWake?.());
await G(() => { const p = window.__gametool.player; p.pos.set(-30, 0, 30); });
await G(() => window.__gametool.openMap());
check('the map opens', await until(() => window.__gametool.livingMap.isOpen));
check('it says how to add a note', await G(() => /Right-click the map/.test(window.__gametool.livingMap.el.textContent)));

// World metres -> a screen point on the map canvas (inside its border).
const spot = (wx, wz) => G(([wx, wz]) => { const c = document.getElementById('mpCanvas'), r = c.getBoundingClientRect(); return { x: r.left + c.clientLeft + (wx + 50) / 100 * c.clientWidth, y: r.top + c.clientTop + (wz + 50) / 100 * c.clientHeight }; }, [wx, wz]);
const sp = await spot(20, -10);
await page.mouse.click(sp.x, sp.y, { button: 'right' });
check('right-click on the map opens a note box there', await until(() => !!document.querySelector('.map-note-pop #mpNoteText') && document.activeElement?.id === 'mpNoteText'));
await page.screenshot({ path: 'test/screenshots/map-note-box.png' });
await page.keyboard.type('Old well');
await page.keyboard.press('Enter');
const wellPin = await G(() => ({ ...JSON.parse(localStorage.getItem('gametool.map')).pins.find((p) => p.text === 'Old well'), pop: !!document.querySelector('.map-note-pop') }));
check('the note is pinned where you clicked, not where you stand, and saved', !!wellPin && Math.abs(wellPin.x - 20) < 0.6 && Math.abs(wellPin.z + 10) < 0.6 && !wellPin.pop, JSON.stringify(wellPin));
check('the map stays open and lists the note', await G(() => window.__gametool.livingMap.isOpen && /Old well/.test(document.querySelector('.map-pins').textContent)));

// Long-press (touch) does the same; Cancel closes the box without a pin.
const sp2 = await spot(-20, 15);
await G((p) => { document.getElementById('mpCanvas').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: p.x, clientY: p.y, pointerType: 'touch', isPrimary: true })); }, sp2);
check('a long-press on a phone opens the note box too', await until(() => !!document.querySelector('.map-note-pop'), null, 3000));
await G((p) => { document.getElementById('mpCanvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: p.x, clientY: p.y, pointerType: 'touch' })); }, sp2);
const nPins = await G(() => window.__gametool.livingMap.pins.length);
await page.click('#mpNoteCancel');
check('Cancel closes the box without pinning', await G((n) => !document.querySelector('.map-note-pop') && window.__gametool.livingMap.pins.length === n, nPins));
// A quick tap is not a long-press.
await G((p) => { const c = document.getElementById('mpCanvas'); c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: p.x, clientY: p.y, pointerType: 'touch' })); c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: p.x, clientY: p.y, pointerType: 'touch' })); }, sp2);
await page.waitForTimeout(800);
check('a quick tap does not open the box', await G(() => !document.querySelector('.map-note-pop')));
// The old button still pins at your own spot.
await page.fill('#mpText', 'Mushrooms here');
await page.click('#mpPin');
check('"Pin it here" still pins at your spot', await G(() => window.__gametool.livingMap.pins.some((p) => p.text === 'Mushrooms here' && p.x === -30 && p.z === 30)));
await page.screenshot({ path: 'test/screenshots/map-notes.png' });

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
