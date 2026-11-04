// Mike 2026-11-04: "No haptic feedback for mobile buttons" (he wants it). Every button buzzes under a finger, the
// touch HUD and every menu and panel button; iPhone (no navigator.vibrate) ticks via the hidden iOS switch.
// Usage: node test/e2e-touch-haptics.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const errors = [];
async function phone(ios) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript((ios) => {
    localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test Player', motivation: '', secret: '', created: true }));
    window.__buzz = [];
    if (ios) Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true });
    else Navigator.prototype.vibrate = function (ms) { window.__buzz.push(ms); return true; };
    window.__docClicks = 0; document.addEventListener('click', () => { window.__docClicks++; });
  }, ios);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}
const H = (page) => page.evaluate(() => ({ played: window.__gametool.haptics.played, ios: window.__gametool.haptics.iosTicks, buzz: window.__buzz.length, clicks: window.__docClicks }));

// Android-style phone (vibrate exists).
{
  const { ctx, page } = await phone(false);
  const a = await H(page);
  await page.tap('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
  const b = await H(page);
  check('A menu button (Begin) buzzes under a finger', b.played > a.played && b.buzz > a.buzz, JSON.stringify([a, b]));
  await page.tap('.t-btn[data-act="jump"]');
  const c = await H(page);
  check('A touch HUD button buzzes', c.buzz > b.buzz, JSON.stringify(c));
  await page.tap('.t-menu');
  await page.waitForFunction(() => window.__gametool.state === 'pause', null, { timeout: 20000 });
  const d = await H(page);
  await page.tap('#resume');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 20000 });
  const e = await H(page);
  check('Pause menu buttons buzz', d.buzz > c.buzz && e.buzz > d.buzz, JSON.stringify([d, e]));
  await page.evaluate(() => { const g = window.__gametool; g.settings.haptics = false; document.getElementById('haptics').checked = false; document.getElementById('haptics').dispatchEvent(new Event('change', { bubbles: true })); });
  const f = await H(page);
  await page.tap('.t-btn[data-act="jump"]');
  const g = await H(page);
  check('Settings > Vibration off: no buzz', g.buzz === f.buzz, JSON.stringify([f, g]));
  await ctx.close();
}
// iPhone (no navigator.vibrate): the hidden switch ticks.
{
  const { ctx, page } = await phone(true);
  const a = await H(page);
  await page.tap('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
  await page.tap('.t-btn[data-act="jump"]');
  const b = await H(page);
  const sw = await page.evaluate(() => { const i = document.querySelector('label[aria-hidden] input[switch]'); return i ? { ok: true, checked: i.checked } : null; });
  check('iPhone: Begin and a HUD button tick the hidden iOS switch', b.ios >= a.ios + 2 && !!sw, JSON.stringify([a, b, sw]));
  const c0 = await H(page);
  await page.evaluate(() => window.__gametool.haptics.play('tap'));
  const c1 = await H(page);
  check("iPhone: the switch's click never reaches the game's listeners", c1.ios === c0.ios + 1 && c1.clicks === c0.clicks, JSON.stringify([c0, c1]));
  await ctx.close();
}
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
