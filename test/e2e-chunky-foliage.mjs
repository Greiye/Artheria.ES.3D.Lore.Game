// G4 (Mike 2026-11-03, graphics batch): chunkier, simpler foliage to sit with the card trees: fewer, bigger bushes
// (two or three fat lumps each) and fewer, bigger flower clumps, at about the same triangle budget.
// Usage: node test/e2e-chunky-foliage.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
const r = await page.evaluate(() => {
  const s = window.__gametool.world.scene, out = { canopyTris: 0, flowers: 0, flowerScale: 0, ferns: 0 };
  s.traverse((o) => {
    if (o.name === 'canopy' && o.geometry) out.canopyTris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    if (o.name === 'foliage:flowers') { out.flowers = o.count; const e = o.instanceMatrix.array; out.flowerScale = Math.hypot(e[0], e[1], e[2]); }
    if (o.name === 'foliage:fern') out.ferns = o.count;
  });
  return out;
});
// Before G4: 110 single-lump bushes (20 triangles each) = at most 2200 triangles; 320 flower tufts at 0.5 m.
check('Bushes: chunkier lumps at about the old triangle budget (110 single bushes)', r.canopyTris > 600 && r.canopyTris <= 2200 * 1.6, JSON.stringify(r));
check('Flowers: fewer, bigger clumps', r.flowers > 0 && r.flowers <= 200 && r.flowerScale > 0.5, JSON.stringify(r));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
