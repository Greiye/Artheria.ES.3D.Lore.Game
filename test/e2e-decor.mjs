// Medieval decorations (Mike 2026-11-05, Graphics thread: "Add all decorations"): real low-poly 3D, flat painted
// colours, merged into a mesh or two per kind (src/world/decor.ts). Checks each kind is there, merged, and cheap.
// Usage: node test/e2e-decor.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
// Every decor mesh: how many of each name, its triangles, whether it is textured (they should not be).
const meshes = () => page.evaluate(() => {
  const out = {};
  window.__gametool.world.scene.traverse((o) => {
    if (!o.isMesh || !o.name.startsWith('decor-')) return;
    const m = out[o.name] ?? (out[o.name] = { n: 0, tris: 0, map: false, pos: null });
    m.n++; m.tris += o.geometry.attributes.position.count / 3; m.map ||= !!o.material.map;
    m.pos = Array.from(o.geometry.attributes.position.array.slice(0, 3));
  });
  return out;
});
const m0 = await meshes();
// 1. Banners and flags: one cloth mesh (moves in the wind), one mesh of poles and rods; untextured; cheap.
const cloth = m0['decor-banners'], poles = m0['decor-banner-poles'];
check('Banners and flags: one cloth mesh and one pole mesh, flat painted, under 3000 triangles', cloth?.n === 1 && poles?.n === 1 && !cloth.map && !poles.map && cloth.tris + poles.tris < 3000, JSON.stringify({ cloth, poles }));
const flagpoles = await page.evaluate(() => window.__gametool.world.colliders.filter((c) => c.kind === 'circle' && c.r === 0.28).length);
check('Four flagpoles on the green you bump into', flagpoles === 4, `${flagpoles}`);
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
