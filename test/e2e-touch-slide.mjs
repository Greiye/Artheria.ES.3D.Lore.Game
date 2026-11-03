// B32 (Mike 2026-11-03): a finger that presses a touch button and slides off it must not trigger it. Tap buttons act on
// release over the same button; jump, fire, aim, reload, sprint and sneak stay instant; a finger from the stick zone
// can't press a button by sliding onto it. Real touch input through CDP (touchStart / touchMove / touchEnd).
// Usage: node test/e2e-touch-slide.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium, devices } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const { defaultBrowserType: _, ...iphone } = devices['iPhone 13'];
const phone = { ...iphone, viewport: { width: iphone.viewport.height, height: iphone.viewport.width } };

const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);
await page.tap('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
await page.waitForTimeout(500);

const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const centre = (sel) => G(page, (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const settle = () => page.waitForTimeout(300);

// 1. Press Map, slide well off it, lift: nothing opens and the button is no longer lit.
const m = await centre('#touch [data-act="map"]');
await touch('touchStart', m.x, m.y);
const lit = await G(page, () => document.querySelector('#touch [data-act="map"]').classList.contains('on'));
check('Pressing a tap button lights it but does not act yet', lit && (await G(page, () => window.__gametool.state)) === 'play');
await touch('touchMove', m.x + 10, m.y + 160);
await touch('touchMove', m.x + 20, m.y + 200);
await touch('touchEnd');
await settle();
const after = await G(page, () => ({ state: window.__gametool.state, on: document.querySelector('#touch [data-act="map"]').classList.contains('on') }));
check('Sliding off the Map button and lifting cancels it', after.state === 'play' && !after.on, JSON.stringify(after));

// 2. Press and lift on the button (a small wobble inside it is fine): it acts.
await touch('touchStart', m.x, m.y);
await touch('touchMove', m.x + 2, m.y + 1);
await touch('touchEnd');
await page.waitForFunction(() => window.__gametool.state !== 'play', null, { timeout: 10000 }).catch(() => {});
const opened = await G(page, () => window.__gametool.state);
check('Lifting over the same button acts (Map opens)', opened !== 'play', opened);
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 10000 }).catch(() => {});
// The key press switched the HUD to keyboard mode; a touch anywhere brings the touch buttons back (B32).
await touch('touchStart', phone.viewport.width * 0.7, phone.viewport.height * 0.5); await touch('touchEnd');
await page.waitForFunction(() => !!document.elementFromPoint(1, 1) && getComputedStyle(document.querySelector('#touch [data-act="jump"]')).display !== 'none' && document.elementFromPoint(...(() => { const r = document.querySelector('#touch [data-act="jump"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })())?.dataset.act === 'jump', null, { timeout: 10000 }).catch(() => {});

// 3. Bag: slide off, cancelled; Menu: slide off, cancelled.
for (const act of ['inventory', 'menu']) {
  const c = await centre(`#touch [data-act="${act}"]`);
  await touch('touchStart', c.x, c.y);
  await touch('touchMove', c.x - 200, c.y + 40);
  await touch('touchEnd');
  await settle();
  check(`Sliding off ${act === 'menu' ? 'Menu' : 'Bag'} cancels it`, (await G(page, () => window.__gametool.state)) === 'play');
}

// 4. Jump stays instant: it acts on press, before the finger lifts.
const j = await centre('#touch [data-act="jump"]');
await G(page, () => { window.__jumps = 0; const p = window.__gametool.player, o = p.jump.bind(p); p.jump = () => { window.__jumps++; o(); }; });
await touch('touchStart', j.x, j.y);
const jumped = await G(page, () => window.__jumps);
await touch('touchMove', j.x - 250, j.y);
await touch('touchEnd');
check('Jump still acts on press (instant)', jumped === 1, String(jumped));

// 5. Sneak stays instant; sliding off afterwards doesn't undo it.
const s = await centre('#touch [data-act="sneak"]');
const sneak0 = await G(page, () => window.__gametool.player.sneaking);
await touch('touchStart', s.x, s.y);
const sneak1 = await G(page, () => window.__gametool.player.sneaking);
await touch('touchEnd');
check('Sneak still toggles on press', sneak1 !== sneak0);
await touch('touchStart', s.x, s.y); await touch('touchEnd');

// 6. A finger that starts on the stick zone and slides onto Map never presses it.
await touch('touchStart', 120, phone.viewport.height - 80);
await touch('touchMove', m.x - 40, m.y + 40);
await touch('touchMove', m.x, m.y);
await touch('touchEnd');
await settle();
check('A stick finger sliding onto Map does not open it', (await G(page, () => window.__gametool.state)) === 'play');

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
