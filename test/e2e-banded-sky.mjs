// G5 (Mike 2026-11-03, graphics batch): a painted sky in soft colour bands instead of a smooth gradient.
// Usage: node test/e2e-banded-sky.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
await page.evaluate(() => { const g = window.__gametool; if (g.waking) g.endWake(); });
await page.waitForFunction(() => !window.__gametool.waking, null, { timeout: 30000 });
// Look straight up the sky from the middle of the meadow, then read a column of sky pixels.
await page.evaluate(() => { const g = window.__gametool; g.world.setTime('day'); g.player.thirdPerson = false; g.player.pos.set(0, 0, 0); g.player.pitch = 1.2; g.player.yaw = 2; });
await page.waitForTimeout(2500);
const col = await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => {
  const g = window.__gametool, gl = g.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4), out = [];
  g.renderer.render(g.world.scene, g.camera);
  for (let y = 0; y < h; y += 2) { gl.readPixels(Math.floor(w / 2), y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out.push(px[0] + px[1] + px[2]); }
  done({ out, keys: g.renderer.info.programs.map((p) => p.cacheKey).filter((k) => /sky-bands/.test(k)).length });
})));
check('The sky dome uses the banded sky shader', col.keys > 0, String(col.keys));
// Bands: the brightness down the sky has flat runs (bands) joined by short steps, not a constant slope.
const d = col.out.slice(1).map((v, i) => Math.abs(v - col.out[i]));
const flat = d.filter((x) => x === 0).length / d.length, steps = d.filter((x) => x >= 3).length;
check('The sky reads as bands: flat runs (pixel-identical neighbours) with steps between them; a smooth gradient has few', flat > 0.4 && steps >= 2, JSON.stringify({ flat: +flat.toFixed(2), steps, n: d.length }));
await page.evaluate(() => window.__gametool.world.setTime('night'));
await page.waitForTimeout(800);
check('No page or shader errors (day and night)', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
