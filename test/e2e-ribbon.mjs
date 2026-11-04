// UI 2 (Mike 2026-11-04, Graphics thread): each sheet's title sits on a green ribbon with gold lettering and
// swallowtail ends (station panels, pause groups, the journal, cards), on PC and on a phone, and reads well.
// Usage: node test/e2e-ribbon.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium, devices } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const errors = [];
const ribbon = (sel) => {
  const e = document.querySelector(sel); if (!e || !e.offsetParent) return null;
  const s = getComputedStyle(e), r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect();
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const gold = lum(s.color), gv = getComputedStyle(document.documentElement).getPropertyValue('--rb-green').trim(), green = lum(`rgb(${parseInt(gv.slice(1,3),16)},${parseInt(gv.slice(3,5),16)},${parseInt(gv.slice(5,7),16)})`);
  return { text: e.textContent.trim().slice(0, 24), green: s.backgroundImage.includes(`rgb(${parseInt(gv.slice(1,3),16)}, ${parseInt(gv.slice(3,5),16)}, ${parseInt(gv.slice(5,7),16)})`), gold: s.color, swallow: /polygon/.test(s.clipPath),
    contrast: +((Math.max(gold, green) + 0.05) / (Math.min(gold, green) + 0.05)).toFixed(2), fits: r.width <= p.width + 30 && r.height < 140 };
};
for (const [name, opts] of [['PC', { viewport: { width: 960, height: 540 } }], ['phone', { ...devices['iPhone 13'] }]]) {
  const page = await (await browser.newContext(opts)).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 120000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 120000 });
  const G = (fn, a) => page.evaluate(fn, a);
  for (const [label, open, sel, close] of [
    ['shop', () => window.__gametool.openShop(), '.shop-panel h2', () => document.querySelector('.shop-panel [data-act="close"]')?.click()],
    ['casebook', () => window.__gametool.casebook.open(), '.casebook-panel h2', () => window.__gametool.casebook.close?.()],
    ['tailor', () => window.__gametool.openCharacterForge(), '.forge-panel h2', null],
  ]) {
    await G(open); await page.waitForTimeout(400);
    const r = await G(ribbon, sel);
    check(`${name}: ${label} title is a green ribbon with gold lettering and swallowtail ends`, !!r && r.green && r.swallow && r.fits, JSON.stringify(r));
    check(`${name}: ${label} ribbon lettering reads (contrast ≥ 4.5)`, !!r && r.contrast >= 4.5, r ? `${r.contrast}` : '');
    if (close) await G(close);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
  if (name === 'PC') {
    if (await G(() => window.__gametool.state) !== 'pause') { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    if (await G(() => window.__gametool.state) === 'pause') {
      await page.click('[data-group="gameplay"]'); await page.waitForTimeout(300);
      const a = await G(ribbon, '#pause .pause-side h1'), b = await G(ribbon, '#gameplaySettings h2');
      check('PC: pause journal title and group title are ribbons', a?.green && b?.green && a.swallow && b.swallow, JSON.stringify([a, b]));
    } else check('PC: pause menu opens', false);
  }
  await page.context().close();
}
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
