// UI 3 (Mike 2026-11-04, Graphics thread): larger body text and headings so the sheets read on a phone. Measures the
// size each text is actually drawn at (font size × any fit-to-screen zoom) in the shop, tailor, casebook and pause
// menu, on PC and on an iPhone held both ways.
// Usage: node test/e2e-readable.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
// Smallest drawn text, the typical (median) body text and the title, in CSS px on screen.
const sizes = (sel) => {
  const root = document.querySelector(sel); if (!root || !root.getClientRects().length) return null;
  const zoomOf = (e) => { let z = 1; for (let n = e; n; n = n.parentElement) z *= parseFloat(getComputedStyle(n).zoom || '1') || 1; return z; };
  const all = [];
  for (const e of root.querySelectorAll('*')) {
    if (!e.getClientRects().length || ![...e.childNodes].some((t) => t.nodeType === 3 && t.textContent.trim())) continue;
    if (e.closest('.fp-hide, .die, svg, .swatch')) continue;
    all.push(parseFloat(getComputedStyle(e).fontSize) * zoomOf(e));
  }
  all.sort((a, b) => a - b);
  const t = root.querySelector('h1, h2');
  return { min: +all[0]?.toFixed(1), median: +all[all.length >> 1]?.toFixed(1), title: t ? +(parseFloat(getComputedStyle(t).fontSize) * zoomOf(t)).toFixed(1) : 0, n: all.length };
};
// Median includes small print (body − 2px), so it is checked against body − 2. A PC still shrinks a tall panel a little
// to fit (B27), hence its lower title floor.
// Phones (Mike 2026-11-04, "Shrink to fit"): a panel too tall for the screen shrinks rather than scrolls, so the
// long shop and tailor drop to ~7px text; short panels keep the large text.
const shrunk = { body: 6.5, min: 4.5, title: 9.5 };
const want = { PC: { body: 13, min: 11, title: 20 }, phone: { body: 14, min: 12, title: 23 }, 'phone sideways': { body: 13, min: 12, title: 20 } };
for (const [name, opts] of [['PC', { viewport: { width: 1366, height: 768 } }], ['phone', { ...devices['iPhone 13'] }], ['phone sideways', { ...devices['iPhone 13 landscape'] }]]) {
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
  const w = want[name];
  for (const [label, open, sel, close] of [
    ['shop', () => window.__gametool.openShop(), '.shop-panel', () => document.querySelector('.shop-panel [data-act="close"]')?.click()],
    ['tailor', () => window.__gametool.openCharacterForge(), '.forge-panel', null],
    ['casebook', () => window.__gametool.casebook.open(), '.casebook-panel', () => window.__gametool.casebook.close?.()],
  ]) {
    await G(open); await page.waitForTimeout(500);
    const s = await G(sizes, sel);
    const scrolls = await G((q) => { const p = document.querySelector(q)?.closest('.forge-panel') ?? document.querySelector(q); return p ? p.scrollHeight - p.clientHeight : 0; }, sel);
    check(`${name}: ${label} fits without scrolling`, scrolls <= 1, `${scrolls}px over`);
    const w = name !== 'PC' && (label === 'shop' || label === 'tailor') ? shrunk : want[name];
    check(`${name}: ${label} typical text ≥ ${w.body}px, small print ≥ ${w.min}px, title ≥ ${w.title}px`, !!s && s.median >= w.body && s.min >= w.min && s.title >= w.title, JSON.stringify(s));
    if (close) await G(close);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
  if (name === 'PC') {
    if (await G(() => window.__gametool.state) !== 'pause') { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    await page.click('[data-group="gameplay"]'); await page.waitForTimeout(300);
    const s = await G(sizes, '#gameplaySettings'), side = await G(sizes, '#pause .pause-side');
    check('PC: pause options and sidebar read at ≥ 15px', s.median >= 15 && side.median >= 17 && s.title >= 22, JSON.stringify([s, side]));
  }
  await page.context().close();
}
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
