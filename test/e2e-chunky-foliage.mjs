// G4 (Mike 2026-11-03, graphics batch): chunkier, simpler foliage to sit with the card trees: fewer, bigger bushes
// and fewer, bigger flower clumps. Since Mike 2026-11-04 (Graphics thread) the bushes are crossed-quad cards like the
// trees: one merged mesh, two or three cards each, walk-through.
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
  const s = window.__gametool.world.scene, out = { bushTris: 0, bushMeshes: 0, canopyTris: 0, flowers: 0, flowerScale: 0, ferns: 0 };
  s.traverse((o) => {
    if (o.name === 'bush-cards') { out.bushMeshes++; out.bushTris += o.geometry.index.count / 3; out.bushTex = !!o.material.map; }
    if (o.name === 'canopy' && o.geometry) out.canopyTris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    if (o.name === 'foliage:flowers') { out.flowers = o.count; const e = o.instanceMatrix.array; out.flowerScale = Math.hypot(e[0], e[1], e[2]); }
    if (o.name === 'foliage:fern') out.ferns = o.count;
    if (o.name === 'fence-cards') { out.fencePanels = o.geometry.index.count / 12; out.fenceTex = !!o.material.map; }
    if (o.name === 'foliage:tuftCards') { out.tufts = o.instanceMatrix.count; out.cards = new Set(o.geometry.attributes.aCard.array).size; out.tuftTex = !!o.material.map; }
  });
  return out;
});
// Each bush is 2 or 3 cards, each card two back-to-back quads: 8 or 12 triangles. About 60 bushes on the meadow.
check('Bushes: crossed-quad cards in one mesh, the old leaf lumps gone', r.bushMeshes === 1 && r.bushTex && r.bushTris >= 40 * 8 && r.bushTris <= 75 * 12 && r.canopyTris === 0, JSON.stringify(r));
check('Flowers: fewer, bigger clumps', r.flowers > 0 && r.flowers <= 200 && r.flowerScale > 0.5, JSON.stringify(r));
// Quad detail 1: denser, varied meadow tufts: one instanced mesh using all eight painted cards.
check('Meadow tufts: one instanced mesh, 2000+ tufts, all 8 cards (3 grasses, clover, 4 flowers)', r.tuftTex && r.tufts >= 2000 && r.cards === 8, JSON.stringify(r));
// Quad detail 2: painted fence panels along the paths, one mesh, with posts you bump into.
const posts = await page.evaluate(() => window.__gametool.world.colliders.filter((c) => c.kind === 'circle' && c.r === 0.16).length);
check('Fences: painted panels along the paths in one mesh, with post colliders', r.fenceTex && r.fencePanels >= 15 && posts >= r.fencePanels * 3, JSON.stringify({ panels: r.fencePanels, posts }));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
