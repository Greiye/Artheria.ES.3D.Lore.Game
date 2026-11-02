// B28 (Mike 2026-11-01): the touch controls. Top: one perspective button (no more camera − / +), then quick-equip
// buttons for the crossbow, sword and torch, lit while in hand. The old "View" button is the Bag. A drag on the right
// of the screen only turns; it never zooms (it used to fight the move stick).
// Usage: node test/e2e-touch-hud.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium, devices } from 'playwright-core';
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

const top = await G(page, () => [...document.querySelectorAll('#touch .t-cam .t-btn')].map((b) => b.dataset.act));
const oldCam = await G(page, () => !!document.querySelector('[data-act="camin"], [data-act="camout"]'));
check('Top row: one perspective button, then crossbow, sword, torch (no camera − / +)', top.join() === 'pov,qbow,qsword,torch' && !oldCam, top.join());
check('Only one button changes perspective', await G(page, () => document.querySelectorAll('#touch [data-act="pov"]').length === 1));
check('The old View slot is now the Bag (and the Bag appears once)', await G(page, () => document.querySelectorAll('#touch [data-act="inventory"]').length === 1 && document.querySelector('.t-cluster [data-act="inventory"]')?.textContent === 'Bag'));
await page.screenshot({ path: path.join(shots, 'b28-touch.png') });

// Perspective: the button cycles first person → shoulder → overhead.
const views = [];
for (let i = 0; i < 3; i++) { await page.tap('.t-cam [data-act="pov"]'); await page.waitForTimeout(150); views.push(await G(page, () => window.__gametool.player.thirdPerson ? 'tp' + window.__gametool.rig.step : 'fp')); }
check('The perspective button cycles through the three views', new Set(views).size === 3, views.join());

// Quick equip: dim until owned; lit while in hand; tap again to put away.
check('Crossbow and sword buttons are dim before you own them', await G(page, () => ['qbow', 'qsword'].every((a) => document.querySelector(`[data-act="${a}"]`).classList.contains('dim'))));
await G(page, () => { const g = window.__gametool; g.inventory.give('crossbow', 1); g.inventory.give('bolt', 5); g.inventory.give('sword', 1); });
await page.tap('.t-cam [data-act="qsword"]');
await page.waitForTimeout(200);
const s1 = await G(page, () => ({ sw: window.__gametool.sword.equipped, cb: window.__gametool.crossbow.equipped, lit: document.querySelector('[data-act="qsword"]').classList.contains('latched') }));
await page.tap('.t-cam [data-act="qbow"]');
await page.waitForTimeout(200);
const s2 = await G(page, () => ({ sw: window.__gametool.sword.equipped, cb: window.__gametool.crossbow.equipped, bow: document.querySelector('[data-act="qbow"]').classList.contains('latched'), swl: document.querySelector('[data-act="qsword"]').classList.contains('latched') }));
await page.tap('.t-cam [data-act="qbow"]');
await page.waitForTimeout(200);
const s3 = await G(page, () => ({ cb: window.__gametool.crossbow.equipped, sw: window.__gametool.sword.equipped }));
check('Sword button: draws the sword, lit', s1.sw && !s1.cb && s1.lit, JSON.stringify(s1));
check('Crossbow button: swaps to the crossbow; only it is lit', s2.cb && !s2.sw && s2.bow && !s2.swl, JSON.stringify(s2));
check('Tapping the lit one again puts it away', !s3.cb && !s3.sw, JSON.stringify(s3));
await page.tap('.t-cam [data-act="torch"]');
await page.waitForTimeout(200);
check('Torch button lights the torch and lights up', await G(page, () => window.__gametool.torch.lit && document.querySelector('[data-act="torch"]').classList.contains('latched')));
await page.tap('.t-cam [data-act="torch"]');

// A vertical drag on the look side never zooms.
for (let i = 0; i < 3 && !(await G(page, () => window.__gametool.player.thirdPerson && window.__gametool.rig.step === 1)); i++) { await page.tap('.t-cam [data-act="pov"]'); await page.waitForTimeout(150); }   // over the shoulder: a drag down used to zoom out
await page.waitForTimeout(300);
const z0 = await G(page, () => window.__gametool.rig.step + ':' + window.__gametool.player.thirdPerson);
const W = phone.viewport.width, H = phone.viewport.height;
const cdp = await ctx.newCDPSession(page);
const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
await tp('touchStart', [{ x: W * 0.2, y: H * 0.6, id: 1 }, { x: W * 0.7, y: H * 0.3, id: 2 }]);
for (let i = 1; i <= 8; i++) await tp('touchMove', [{ x: W * 0.2 + i * 3, y: H * 0.6 - i * 2, id: 1 }, { x: W * 0.7 + i * 2, y: H * 0.3 + i * 18, id: 2 }]);
await tp('touchEnd', []);
await page.waitForTimeout(300);
const z1 = await G(page, () => window.__gametool.rig.step + ':' + window.__gametool.player.thirdPerson);
check('A two-finger drag (move + look) never changes the zoom or view', z0 === z1, `${z0} → ${z1}`);
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
