// UI 1 (Mike 2026-11-04, Graphics thread): menus and station panels are parchment paper in a gold frame, with dark ink
// text that reads on the paper (WCAG-style contrast), on PC and on a phone. Our own art: CSS paper + an SVG grain.
// Usage: node test/e2e-parchment.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

// Contrast of each visible text element against the paper, in the page (relative luminance, WCAG formula).
const audit = (sel) => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const paper = lum('rgb(238,223,185)');
  const root = document.querySelector(sel); if (!root) return null;
  const cs = getComputedStyle(root);
  let worst = 99, worstText = '', n = 0;
  for (const e of root.querySelectorAll('*')) {
    if (!e.offsetParent || !e.childNodes.length || ![...e.childNodes].some((t) => t.nodeType === 3 && t.textContent.trim())) continue;
    if (e.closest('button.primary, kbd, select, .swatch, .qd-svg, svg')) continue;
    const s = getComputedStyle(e); if (s.opacity === '0' || s.visibility === 'hidden') continue;
    const bg = s.backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg) && !/rgba\([^)]*, 0\.[0-6]\d*\)/.test(bg)) continue;   // own solid fill
    const L = lum(s.color), r = (Math.max(L, paper) + 0.05) / (Math.min(L, paper) + 0.05); n++;
    if (r < worst) { worst = r; worstText = e.textContent.trim().slice(0, 30) + ' ' + s.color; }
  }
  return { bg: cs.backgroundImage, border: cs.borderLeftColor, worst: +worst.toFixed(2), worstText, n };
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
    ['shop', () => window.__gametool.openShop(), '.shop-panel', () => document.querySelector('.shop-panel [data-act="close"]')?.click()],
    ['casebook', () => window.__gametool.casebook.open(), '.casebook-panel', () => window.__gametool.casebook.close?.()],
  ]) {
    await G(open); await page.waitForTimeout(400);
    const a = await G(audit, sel);
    check(`${name}: ${label} is a parchment sheet in a gold frame`, !!a && /svg\+xml/.test(a.bg) && /rgb\(201, 154, 69\)/.test(a.border), a ? a.border : 'missing');
    check(`${name}: ${label} text reads on the paper (contrast ≥ 4.5)`, !!a && a.n > 3 && a.worst >= 4.5, a ? `${a.n} texts, worst ${a.worst} "${a.worstText}"` : '');
    await G(close); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
  if (name === 'PC') {
    if (await G(() => window.__gametool.state) !== 'pause') { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    const st = await G(() => window.__gametool.state);
    if (st === 'pause') {
      await page.click('[data-group="gameplay"]'); await page.waitForTimeout(300);
      const a = await G(audit, '#gameplaySettings'), s = await G(audit, '#pause .pause-side');
      check('PC: pause menu sidebar and options are parchment sheets', /svg\+xml/.test(a.bg) && /svg\+xml/.test(s.bg));
      check('PC: pause text reads on the paper (contrast ≥ 4.5)', a.worst >= 4.5 && s.worst >= 4.5, `${a.worst} "${a.worstText}" / ${s.worst} "${s.worstText}"`);
    } else check('PC: pause menu opens', false, st);
  }
  await page.context().close();
}
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
