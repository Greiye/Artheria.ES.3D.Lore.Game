// iPhone pass (Mike 2026-10-31): first Begin goes straight into play, 16px text boxes (no Safari zoom-in), the
// rotate card's iPhone line, the Add to Home Screen tip (Safari can't hide its address bar), the canvas following
// the visual viewport, and iPhone-size screenshots. Chromium with iPhone 13 emulation (UA, touch, 3x screen).
// Usage: node test/e2e-iphone.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const landscape = { ...iphone, viewport: { width: iphone.viewport.height, height: iphone.viewport.width } };

async function open(opts, init) {
  const ctx = await browser.newContext(opts);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool);
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}
const optIn = () => { localStorage.setItem('gametool.rotateask', 'on'); localStorage.setItem('gametool.hometip', 'on'); };

// Upright: the rotate card, with the iPhone line (no orientation lock) instead of "Turn it for me".
{
  // iPhone Safari has no screen.orientation.lock; Chromium does, so take it away to stand in for Safari.
  const { ctx, page, errors } = await open(iphone, () => { try { Object.defineProperty(ScreenOrientation.prototype, 'lock', { value: undefined }); } catch { /* */ } localStorage.setItem('gametool.rotateask', 'on'); localStorage.setItem('gametool.hometip', 'on'); });
  const card = await G(page, () => ({
    shown: getComputedStyle(document.getElementById('rotateAsk')).display !== 'none',
    ios: !document.getElementById('rotateIos').classList.contains('hidden'),
    turn: !document.getElementById('rotateTurn').classList.contains('hidden'),
  }));
  check('Upright iPhone: the rotate card shows its iPhone line (Rotation Lock), not "Turn it for me"', card.shown && card.ios && !card.turn, JSON.stringify(card));
  await page.screenshot({ path: path.join(shots, 'iphone-1-upright.png') });
  check('Upright iPhone: no console/page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Sideways: title screen with the Home Screen tip; closing it remembers; Begin goes straight into play.
{
  const { ctx, page, errors } = await open(landscape, optIn);
  check('iPhone Safari: the Add to Home Screen tip is on the title screen', await page.isVisible('#homeTip'));
  const fits = await G(page, () => { const r = document.getElementById('homeTip').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
  check('The tip fits on screen', fits);
  await page.screenshot({ path: path.join(shots, 'iphone-2-title.png') });
  await page.tap('#homeTipClose');
  check('Closing the tip hides it and remembers', !(await page.isVisible('#homeTip')) && (await G(page, () => localStorage.getItem('gametool.hometip'))) === 'off');
  await page.tap('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 }).catch(() => {});
  check('A brand-new iPhone player taps Begin and is in play (no character form, no keyboard)',
    await G(page, () => window.__gametool.state === 'play' && document.getElementById('charcreate').classList.contains('hidden') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(shots, 'iphone-3-play.png') });
  // The address bar shrinking the page: the canvas follows the visual viewport.
  await page.setViewportSize({ width: landscape.viewport.width, height: landscape.viewport.height - 50 });
  await page.waitForTimeout(300);
  const canvasH = await G(page, () => document.querySelector('#app canvas').clientHeight);
  check('The canvas follows the visible area when the address bar takes room', canvasH === landscape.viewport.height - 50, String(canvasH));
  check('Touch buttons sit inside the visible area', await G(page, () => [...document.querySelectorAll('.t-btn')].filter((b) => b.offsetParent).every((b) => b.getBoundingClientRect().bottom <= innerHeight)));
  check('Sideways iPhone: no console/page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Text boxes are 16px on a phone, so Safari doesn't zoom in when one gets focus; the book sizes by the visible height.
{
  const { ctx, page, errors } = await open(landscape);
  await page.tap('#openExtras');
  await page.tap('#writeLoreTitle');
  await page.waitForTimeout(200);
  const sizes = await G(page, () => [...document.querySelectorAll('#editor input[type=text], #editor textarea')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
  check('Every text box in the lore editor is at least 16px on a phone', sizes.length > 1 && sizes.every((s) => s >= 16), JSON.stringify(sizes));
  await page.screenshot({ path: path.join(shots, 'iphone-4-write-lore.png') });
  check('Book pages size by the visible height (dvh), not the old 100vh',
    await G(page, () => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.selectorText === '.spread' && /100dvh/.test(r.cssText)); } catch { return false; } })));
  check('Write lore on iPhone: no console/page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
