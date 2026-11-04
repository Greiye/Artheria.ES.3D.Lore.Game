// Town style 1 (Mike 2026-11-04): a crowd of small pixel-sprite townsfolk in 8 directions. One instanced draw for all
// of them (and one for their shadows); they walk the green between doors, keep out of the buildings and the well,
// turn the painted side that faces you, dim with the hour, and thin out on Low. The 3D townsfolk and NPCs stay.
// Usage: node test/e2e-crowd.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const G = (fn, a) => page.evaluate(fn, a);
await G(() => { const g = window.__gametool, o = g.world.town.doors.inn, d = o.position, r = o.rotation.y; g.player.spawn(new g.Vector3(d.x + Math.sin(r) * 6, 0, d.z + Math.cos(r) * 6), r + Math.PI); g.player.thirdPerson = true; });
const info = await G(() => { const c = window.__gametool.crowd, m = c.mesh, img = m.material.uniforms.map.value.image;
  return { count: m.count, inst: m.isInstancedMesh, shadows: c.shadows.count, w: img.width, h: img.height, looks: c.looks, nearest: m.material.uniforms.map.value.magFilter === 1003, shade: m.material.uniforms.shade === window.__gametool.figureLight.shade,
    folk3d: window.__gametool.townsfolk.folk.filter((f) => f.active).length };
});
check('A crowd of 40+ pixel sprites in one instanced draw, with shadows', info.inst && info.count >= 40 && info.shadows === info.count, JSON.stringify(info));
check('Sprite sheet: 8 directions × 4 frames per look, crisp pixels', info.w === 32 * 16 && info.h === info.looks * 24 && info.looks >= 8 && info.nearest, JSON.stringify(info));
check('The 3D townsfolk and NPCs are still there', info.folk3d >= 8, JSON.stringify(info));
check('They dim with the hour like the 3D characters', info.shade);
// Every painted frame has a figure in it (not blank), and left-facing frames mirror right-facing ones.
const art = await G(() => {
  const img = window.__gametool.crowd.mesh.material.uniforms.map.value.image, g = img.getContext('2d');
  const at = (col, row) => g.getImageData(col * 16, row * 24, 16, 24).data;
  let blank = 0;
  for (let col = 0; col < 32; col++) { const d = at(col, 0); let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; if (n < 60) blank++; }
  const r = at(2 * 4 + 1, 0), l = at(6 * 4 + 1, 0); let same = 0, tot = 0;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) { const a = (y * 16 + x) * 4, b = (y * 16 + 15 - x) * 4; tot++; if (r[a + 3] === l[b + 3] && r[a] === l[b]) same++; }
  return { blank, mirror: same / tot };
});
check('Every frame is painted, and left-facing frames mirror right-facing ones', art.blank === 0 && art.mirror > 0.99, JSON.stringify(art));
const dirs = await G(() => { const C = window.__gametool.crowd.constructor, cam = new window.__gametool.Vector3(0, 0, 10);
  return [C.dirFor(0, 0, 0, cam), C.dirFor(Math.PI / 2, 0, 0, cam), C.dirFor(Math.PI, 0, 0, cam), C.dirFor(-Math.PI / 2, 0, 0, cam), C.dirFor(Math.PI / 4, 0, 0, cam)]; });
check('The frame shows the side that faces you (toward, right, away, left, diagonal)', JSON.stringify(dirs) === JSON.stringify([0, 2, 4, 6, 1]), JSON.stringify(dirs));
// Watch them for a while: walkers move, frames change, nobody stands in a building or the well.
const snap = () => G(() => window.__gametool.crowd.agents.slice(0, window.__gametool.crowd.count).map((a) => [a.pos.x, a.pos.z, a.stander]));
const cellsOf = () => G(() => Array.from(window.__gametool.crowd.mesh.geometry.attributes.aCell.array.slice(0, 40)));
const s0 = await snap(), c0 = await cellsOf();
let worst = { well: Infinity, lots: Infinity };
for (let i = 0; i < 6; i++) {
  const t0 = await G(() => window.__gametool.perf.simSeconds);
  await page.waitForFunction((t) => window.__gametool.perf.simSeconds > t + 1.5, t0, { timeout: 60000 });
  const c = await G(() => { const g = window.__gametool; let well = Infinity, lots = Infinity; for (const a of g.crowd.agents.slice(0, g.crowd.count)) { const r = g.townsfolk.clearance(a.pos.x, a.pos.z); well = Math.min(well, r.well); lots = Math.min(lots, r.lots); } return { well, lots }; });
  worst = { well: Math.min(worst.well, c.well), lots: Math.min(worst.lots, c.lots) };
}
const s1 = await snap(), c1 = await cellsOf();
const moved = s0.filter((a, i) => !a[2] && Math.hypot(a[0] - s1[i][0], a[1] - s1[i][1]) > 2).length, walkers = s0.filter((a) => !a[2]).length;
check('Walkers walk between the buildings', moved >= walkers * 0.5, `${moved} of ${walkers} moved > 2 m`);
check('Their frames animate', c0.some((v, i) => v !== c1[i]));
check('Nobody walks through a building or the well', worst.well > -0.3 && worst.lots > -0.6, JSON.stringify(worst));
// Low preset: fewer of them.
const low = await G(() => { const g = window.__gametool; g.settings.preset = 'low'; g.autoQ.onChange?.(); document.getElementById('preset').value = 'low'; document.getElementById('preset').dispatchEvent(new Event('change', { bubbles: true })); return g.crowd.count; });
check('Low preset thins the crowd', low <= 20 && low > 0, `${low}`);
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
