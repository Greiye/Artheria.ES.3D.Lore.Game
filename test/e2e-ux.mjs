// UX pass (Mike 2026-10-31), part 1, ergonomics, on an iPhone-size screen held sideways: thumb zones with 44 px+
// targets, one context button that names its action, the joystick's resting ring, left-handed mode and button size,
// text size and reading speed, haptics on pickups and hits, and nothing more than two taps deep.
// Usage: node test/e2e-ux.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const { defaultBrowserType: _, ...iphone } = devices['iPhone 13'];
const phone = { ...iphone, viewport: { width: iphone.viewport.height, height: iphone.viewport.width } };
const atLibrary = async (page, back = 1.3) => {
  await G(page, (back) => {
    const g = window.__gametool, c = new g.Vector3(); g.world.town.doors.library.getWorldPosition(c);
    const out = new g.Vector3(-c.x, 0, -c.z).normalize(), p = g.player;
    p.pos.set(c.x + out.x * back, 0, c.z + out.z * back);
    const d = c.clone().sub(new g.Vector3(p.pos.x, 1.7, p.pos.z));
    p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); p.update(0); p.syncNow();
  }, back);
  await frames(page);
};
const rect = (page, sel) => G(page, (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; }, sel);

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
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 });
await page.waitForTimeout(500);

// Thumb zones: every touch target is at least 44 px, the face buttons sit in the bottom-right corner.
const small = await G(page, () => [...document.querySelectorAll('#touch .t-btn')].filter((b) => b.offsetParent)
  .map((b) => [b.dataset.act, b.getBoundingClientRect()]).filter(([, r]) => r.width < 44 || r.height < 44).map(([a]) => a));
check('Thumb zones: every visible touch button is at least 44 px', small.length === 0, JSON.stringify(small));
const jump = await rect(page, '.t-cluster [data-act="jump"]');
check('Thumb zones: the face buttons sit in the bottom-right corner', jump.l > phone.viewport.width / 2 && jump.t > phone.viewport.height / 2);
check('Floating joystick: a faint ring shows where it appears, under the left thumb', await page.isVisible('.t-ghost') && (await rect(page, '.t-ghost')).r < phone.viewport.width / 2);

// One context button that names what it will do.
await atLibrary(page, 8);
const far = await page.isVisible('.t-use');
await atLibrary(page);
await page.waitForTimeout(150);
const use = await G(page, () => ({ text: document.querySelector('.t-use').textContent, verb: window.__gametool.lookingAt && document.getElementById('promptVerb').textContent }));
check('One context button: hidden with nothing nearby, then names the action (not just "Use")', !far && await page.isVisible('.t-use') && use.text === use.verb && use.text !== 'Use', JSON.stringify(use));
await page.screenshot({ path: path.join(shots, 'ux-1-context-button.png') });
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8); p.update(0); });
await frames(page);

// One tap: Map, Journal, Bag, Menu.
await page.tap('.t-row [data-act="map"]');
check('One tap: Map opens the map', await G(page, () => window.__gametool.livingMap.isOpen));
await G(page, () => window.__gametool.livingMap.close()); await page.waitForTimeout(150);
await page.tap('.t-row [data-act="journal"]');
check('One tap: Journal opens the casebook', await G(page, () => window.__gametool.casebook.isOpen));
await G(page, () => window.__gametool.casebook.close()); await page.waitForTimeout(150);
await page.tap('.t-row [data-act="inventory"]');
check('One tap: Bag opens the bag', await G(page, () => window.__gametool.state === 'inventory'));
await page.tap('.inv-close');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 3000 }).catch(() => {});
// Two taps: Menu, then any options group.
const groups = [];
for (const g of ['gameplay', 'graphics', 'sound', 'controls']) {
  if (await G(page, () => window.__gametool.state) !== 'pause') await page.tap('.t-menu');
  await page.waitForTimeout(100);
  await page.tap(`#pause [data-group="${g}"]`);
  await page.waitForTimeout(100);
  if (await page.isVisible(`#pause [data-panel="${g}"]`)) groups.push(g);
}
check('Two taps deep: Menu, then each options group opens', groups.length === 4, groups.join(','));

// Comfort settings, from Pause > Gameplay.
await page.tap('#pause [data-group="gameplay"]').catch(() => {});
if (!(await page.isVisible('#lefty'))) await page.tap('#pause [data-group="gameplay"]');
await page.screenshot({ path: path.join(shots, 'ux-2-comfort-settings.png') });
await page.tap('#lefty');
await G(page, () => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }; set('buttonSize', '150'); set('textSize', '130'); set('readSpeed', '2'); });
const saved = await G(page, () => JSON.parse(localStorage.getItem('gametool.settings')));
check('Comfort settings save (left-handed, button size, text size, reading speed)', saved.lefty === true && saved.buttonSize === 150 && saved.textSize === 130 && saved.readSpeed === 2, JSON.stringify({ l: saved.lefty, b: saved.buttonSize, t: saved.textSize, r: saved.readSpeed }));
await page.tap('#resume');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 3000 }).catch(() => {});
await page.waitForTimeout(200);
const jumpL = await rect(page, '.t-cluster [data-act="jump"]'), rowL = await rect(page, '.t-row'), ghostL = await rect(page, '.t-ghost');
check('Left-handed: face buttons and the top row move left, the joystick ring moves right', jumpL.r < phone.viewport.width / 2 && rowL.l < phone.viewport.width / 2 && ghostL.l > phone.viewport.width / 2, JSON.stringify({ jumpL, rowL, ghostL }));
const overlap = await G(page, () => { const bs = [...document.querySelectorAll('#touch .t-btn')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect());
  return bs.some((a, i) => bs.some((b, j) => j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)); });
check('Left-handed at 150%: no two touch buttons overlap', !overlap);
check('Button size 150%: the Jump button is about half as big again', Math.abs(jumpL.w / jump.w - 1.5) < 0.08, `${jump.w} → ${jumpL.w}`);
await page.screenshot({ path: path.join(shots, 'ux-3-left-handed-big-buttons.png') });
check('Text size 130%: dialogue text grows with it', await G(page, () => Math.abs(parseFloat(getComputedStyle(document.querySelector('#dialogue .d-text')).fontSize) - 19 * 1.3) < 0.6));
const told = await G(page, () => {
  // Drive the telling's clock by hand (10 steps of 200 ms) so a slow test renderer can't skew it.
  const t = window.__gametool.telling, md = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
  const run = () => { t.open('Pace', 'test', md); cancelAnimationFrame(t.raf); for (let i = 0; i < 10; i++) { t.last = performance.now() - 200; t.step(); } const n = t.shown; t.close(); return n; };
  const fast = run();
  const rs = document.getElementById('readSpeed'); rs.value = '1'; rs.dispatchEvent(new Event('input'));
  return { fast, slow: run() };
});
check('Reading speed 2×: Natalie\'s telling reveals words about twice as fast', told.fast >= told.slow * 1.6 && told.slow > 0, JSON.stringify(told));

// Haptics on pickups and hits (Android buzzes; iPhone Safari has no vibration API).
await G(page, () => window.__gametool.earn(1, 'test'));
check('Haptics: a pickup buzzes', await G(page, () => window.__gametool.haptics.last === 'pickup'));

check('UX ergonomics: no console/page errors', errors.length === 0, errors.join(' | '));
await ctx.close();
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
