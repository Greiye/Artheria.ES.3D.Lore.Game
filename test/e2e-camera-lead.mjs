// B39 (Mike 2026-11-03): while you walk, the follow camera drifts a little toward where you're heading (capped at
// 18°), and eases back when you stop or turn the camera yourself. Default: touch and controller players only.
// Usage: node test/e2e-camera-lead.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const def = await page.evaluate(() => ({ s: window.__gametool.settings.cameraLead, opts: [...document.querySelectorAll('#cameraLead option')].map((o) => o.value) }));
check('Default is "auto" (touch and controller), with a Gameplay setting', def.s === 'auto' && def.opts.join() === 'auto,on,off', JSON.stringify(def));
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });

const deg = (r) => +(r * 180 / Math.PI).toFixed(1);
const lead = () => page.evaluate(() => window.__gametool.rig.leadCur);
const camYawOff = () => page.evaluate(() => { const g = window.__gametool, d = new g.Vector3(); g.camera.getWorldDirection(d);
  const cy = Math.atan2(-d.x, -d.z); return Math.atan2(Math.sin(g.player.yaw - cy), Math.cos(g.player.yaw - cy)); });
async function walk(x, y, ms) {
  await page.evaluate(([x, y]) => { const pl = window.__gametool.player; pl.analog.x = x; pl.analog.y = y; }, [x, y]);
  await simWait(ms);
}
// Waits `ms` of game time (perf.simSeconds), not of wall clock: a slow CI machine simulates less than real time.
async function simWait(ms) {
  const t0 = await page.evaluate(() => window.__gametool.perf.simSeconds);
  await page.waitForFunction(([t0, s]) => window.__gametool.perf.simSeconds - t0 >= s, [t0, ms / 1000], { timeout: 90000, polling: 100 }).catch(() => {});
}
await page.evaluate(() => { const g = window.__gametool; g.player.thirdPerson = true; g.rig.step = 2; g.rig.zoom = 0.2; });

await walk(1, 0, 3000);
const mouse = await lead();
check('Auto + keyboard/mouse player: no lead', Math.abs(mouse) < 1e-3, `${deg(mouse)}°`);

await page.evaluate(() => { window.__gametool.settings.cameraLead = 'on'; });
await walk(1, 0.3, 3500);
const right = await lead(), camOff = await camYawOff();
check('Walking right: the camera leads right, close to the 18° cap', deg(right) > 14 && deg(right) <= 18.01, `${deg(right)}°`);
check('The view really turns (camera heading vs player yaw)', deg(camOff) > 10, `${deg(camOff)}°`);
await walk(-1, 0.3, 3500);
const left = await lead();
check('Walking left: it leads left', deg(left) < -14, `${deg(left)}°`);
await walk(0, 1, 3500);
const fwd = await lead();
check('Straight ahead: it settles back to neutral', Math.abs(deg(fwd)) < 2, `${deg(fwd)}°`);

await walk(1, 0, 3000);
await page.evaluate(() => { const g = window.__gametool; g.player.analogLook.x = 0.8; });
await simWait(1200);
const manual = await lead();
await page.evaluate(() => { window.__gametool.player.analogLook.x = 0; });
check('Turning the camera yourself eases the lead out', Math.abs(deg(manual)) < 4, `${deg(manual)}°`);

await walk(1, 0, 3000);
await page.evaluate(() => { window.__gametool.player.thirdPerson = false; });
await simWait(400);
const fp = await lead();
check('First person: no lead', fp === 0, `${deg(fp)}°`);
await page.evaluate(() => { const g = window.__gametool; g.player.thirdPerson = true; g.settings.cameraLead = 'off'; });
await walk(1, 0, 3000);
const off = await lead();
check('Setting off: no lead', Math.abs(deg(off)) < 1, `${deg(off)}°`);
await walk(0, 0, 100);
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
