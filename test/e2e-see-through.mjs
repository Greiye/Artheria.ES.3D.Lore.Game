// B45 (Mike 2026-11-03): the follow camera sees through walls instead of pulling in. With the setting on, the
// rig ignores buildings and the walls between camera and player open up (a dithered cut in the world shaders).
// Usage: node test/e2e-see-through.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const box = await page.evaluate(() => ({ def: window.__gametool.settings.seeThrough, box: !!document.getElementById('seeThrough') }));
check('See-through is on by default, with a Gameplay checkbox', box.def === true && box.box, JSON.stringify(box));
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });

// Stand just in front of the smithy, facing away from it, so the follow camera's spot is inside the building.
async function at(on) {
  await page.evaluate((on) => {
    const g = window.__gametool, d = g.world.town.doors.smithy, ry = d.rotation.y, pl = g.player;
    g.settings.seeThrough = on; pl.thirdPerson = true; g.rig.step = 1; g.rig.zoom = 0;
    pl.pos.set(d.position.x - Math.sin(ry) * 6.5, 0, d.position.z - Math.cos(ry) * 6.5);
    pl.yaw = pl.bodyYaw = ry; pl.pitch = 0;
  }, on);
  await page.waitForFunction(() => { const g = window.__gametool; return g.perf.frames > 0; });
  await page.waitForTimeout(3000);
  return page.evaluate(() => { const g = window.__gametool; return { dist: +g.camera.position.distanceTo(g.player.pos).toFixed(2), st: g.seeThroughUniforms.stOn.value, rig: g.rig.seeThrough }; });
}
const on = await at(true), off = await at(false);
check('Off: the camera pulls in at the wall (old behaviour)', off.dist < 2.3 && off.st === 0 && !off.rig, JSON.stringify(off));
check('On: the camera keeps its distance and the wall cut is active', on.dist > off.dist + 0.4 && on.st === 1 && on.rig, JSON.stringify(on));
const progs = await page.evaluate(() => (window.__gametool.renderer.info.programs ?? []).map((p) => p.cacheKey).filter((k) => k.includes('+st')).length);
check('World materials carry the see-through cut', progs > 0, `${progs} programs`);
await page.evaluate(() => { window.__gametool.player.thirdPerson = false; window.__gametool.settings.seeThrough = true; });
await page.waitForTimeout(500);
const fp = await page.evaluate(() => window.__gametool.seeThroughUniforms.stOn.value);
check('First person: no cut', fp === 0, String(fp));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
