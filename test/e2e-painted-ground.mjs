// G1 (Mike 2026-11-03, graphics batch): the ground carries a broad painted brush-stroke layer over the grass and paths.
// Usage: node test/e2e-painted-ground.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const g = window.__gametool, ground = g.world.scene.getObjectByName('ground'), m = ground.material, sh = { uniforms: {}, vertexShader: 'void main() {', fragmentShader: 'void main() {\n#include <map_fragment>' };
  m.onBeforeCompile(sh, g.renderer);
  const tex = sh.uniforms.brushMap?.value, img = tex?.image;
  let lo = 255, hi = 0;
  if (img) { const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data; for (let i = 0; i < d.length; i += 4) { lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]); } }
  return { uses: /brushMap/.test(sh.fragmentShader), size: img ? img.width : 0, lo, hi, programs: g.renderer.info.programs.filter((p) => /ground-paths/.test(p.cacheKey)).length };
});
check('The ground shader samples the painted stroke layer', r.uses && r.programs > 0, JSON.stringify(r));
check('The stroke layer is one small 256 px texture with full light-to-dark range', r.size === 256 && r.lo === 0 && r.hi === 255, JSON.stringify(r));
check('No page or shader errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
