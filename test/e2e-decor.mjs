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
    m.pos = Array.from(o.geometry.attributes.position.array.slice(0, 3)); m.user = o.userData;
  });
  return out;
});
const m0 = await meshes();
// 1. Banners and flags: one cloth mesh (moves in the wind), one mesh of poles and rods; untextured; cheap.
const cloth = m0['decor-banners'], poles = m0['decor-banner-poles'];
check('Banners and flags: one cloth mesh and one pole mesh, flat painted, under 3000 triangles', cloth?.n === 1 && poles?.n === 1 && !cloth.map && !poles.map && cloth.tris + poles.tris < 3000, JSON.stringify({ cloth, poles }));
const flagpoles = await page.evaluate(() => window.__gametool.world.colliders.filter((c) => c.kind === 'circle' && c.r === 0.28).length);
check('Four flagpoles on the green you bump into', flagpoles === 4, `${flagpoles}`);
// 2. Market stalls: three on the green, one merged mesh, with counters you bump into.
const stalls = m0['decor-stalls'];
const counters = await page.evaluate(() => window.__gametool.world.colliders.filter((c) => c.kind === 'circle' && c.r === 0.62 && c.top === 0.88).length);
check('Market stalls: one merged mesh, flat painted, three stalls with counters', stalls?.n === 1 && !stalls.map && stalls.tris < 4000 && counters === 6, JSON.stringify({ stalls, counters }));
// 3. Wall lanterns: iron brackets and glowing glass, two merged meshes; every lantern joins the night lights.
const ironM = m0['decor-lantern-iron'], glassM = m0['decor-lantern-glass'];
const lit = await page.evaluate(() => window.__gametool.world.lanterns.length);
check('Wall lanterns: iron and glass in two meshes, 2 per house, all in the night lights', ironM?.n === 1 && glassM?.n === 1 && glassM.tris === 18 * 24 && ironM.tris < 9000 && lit >= 18 * 2, JSON.stringify({ iron: ironM?.tris, glass: glassM?.tris, lit }));
// 4. Woodpiles, carts and hay: one merged mesh behind the houses, off the paths.
const rustic = m0['decor-rustic'];
check('Woodpiles, carts and hay bales: one merged mesh, flat painted, at least 3 carts and 3 hay stacks', rustic?.n === 1 && !rustic.map && rustic.tris < 20000 && rustic.user.carts >= 3 && rustic.user.stacks >= 3, JSON.stringify(rustic));
// 5. Wells and signposts: one merged mesh; signposts at the footpaths' starts, wells off the paths.
const way = m0['decor-wayside'];
check('Wells and signposts: one merged mesh, flat painted, 2 wells and 6+ signposts', way?.n === 1 && !way.map && way.tris < 12000 && way.user.wells === 2 && way.user.signs >= 6, JSON.stringify(way));
// 6. Ivy and moss: one ivy mesh, one moss mesh for every wall and plinth; cheap enough for phones.
const ivyM = m0['decor-ivy'], mossM = m0['decor-moss'];
check('Ivy and moss: one mesh each, flat painted, together under 16000 triangles', ivyM?.n === 1 && mossM?.n === 1 && !ivyM.map && !mossM.map && ivyM.user.ivyLeaves > 300 && ivyM.tris + mossM.tris < 16000, JSON.stringify({ ivy: ivyM?.tris, moss: mossM?.tris, user: ivyM?.user }));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
