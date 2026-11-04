// B44 (Mike 2026-11-03): steady aim, body-cam style. With the crossbow in first person there's no crosshair: the aim
// wanders with drift and breathing, holding still (aiming down the sights) steadies it, moving or firing unsettles
// it, and a ring shows how steady you are. Bolts fly where the wandering aim points.
// Usage: node test/e2e-steady-aim.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const deg = (r) => +(r * 180 / Math.PI).toFixed(2);

await G(() => { const g = window.__gametool; g.inventory.give('crossbow', 1); g.inventory.give('bolt', 10); g.player.pos.set(0, 0, 8); g.player.yaw = Math.PI; g.player.pitch = 0; g.player.thirdPerson = false; g.crossbow.equip(); g.crossbow.loaded = true; });
await page.waitForFunction(() => window.__gametool.crossbow.viewmodel.visible, null, { timeout: 20000 });
const hud = await G(() => ({ cross: getComputedStyle(document.getElementById('crosshair')).display, ring: !document.getElementById('steady').classList.contains('hidden') }));
check('Crossbow in first person: no crosshair, the steadiness ring instead', hud.cross === 'none' && hud.ring, JSON.stringify(hud));

// Hip: stability caps low; sampling the wander.
await page.waitForFunction(() => window.__gametool.crossbow.stability > 0.4, null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
const hip = await G(() => window.__gametool.crossbow.stability);
check('From the hip it only steadies part way', hip > 0.3 && hip <= 0.46, hip.toFixed(2));

// Aim down the sights and hold still: it fills.
await G(() => window.__gametool.crossbow.setADS(true));
await page.waitForFunction(() => window.__gametool.crossbow.stability > 0.95, null, { timeout: 15000 }).catch(() => {});
const ads = await G(() => ({ s: window.__gametool.crossbow.stability, ring: document.getElementById('steady').style.transform, steady: document.getElementById('steady').classList.contains('steady') }));
check('Aiming and holding still fills the stability meter; the ring tightens and lights', ads.s > 0.95 && ads.steady && /scale\(0\.3/.test(ads.ring), JSON.stringify(ads));

// The aim wanders: sample the sway over time while steady vs unsteady.
async function spread(ms) {
  return G((ms) => new Promise((done) => { const c = window.__gametool.crossbow, ys = []; const t0 = performance.now();
    const tick = () => { ys.push([c.sway.yaw, c.sway.pitch]); performance.now() - t0 < ms ? requestAnimationFrame(tick) : done(ys); }; tick(); }), ms);
}
const range = (ys) => Math.max(...ys.map((v) => Math.hypot(v[0], v[1])));
const calm = range(await spread(1500));
check('Steady: the aim still breathes, but only a little (< 0.5°)', calm > 0 && deg(calm) < 0.5, `${deg(calm)}°`);

// The view itself wanders (body-cam): the camera's heading differs from the player's yaw by the sway.
const view = await G(() => { const g = window.__gametool, d = new g.Vector3(); g.camera.getWorldDirection(d); const cy = Math.atan2(-d.x, -d.z);
  return { off: Math.atan2(Math.sin(cy - g.player.yaw), Math.cos(cy - g.player.yaw)), sway: g.crossbow.sway.yaw }; });
check('The first-person view moves with the sway', Math.abs(view.off - view.sway) < 0.01, JSON.stringify(view));

// Walking drains it, and the wander grows.
await G(() => { window.__gametool.player.analog.y = 1; });
await page.waitForTimeout(1500);
const walking = await G(() => window.__gametool.crossbow.stability);
const shaky = range(await spread(2000));
await G(() => { window.__gametool.player.analog.y = 0; });
check('Walking unsettles it, and the aim wanders more (> 0.5°)', walking < 0.3 && deg(shaky) > 0.5, `${walking.toFixed(2)}, ${deg(shaky)}°`);

// Firing: the bolt follows the wandering aim (not the bare view), and the kick unsettles you.
await page.waitForFunction(() => window.__gametool.crossbow.stability > 0.9, null, { timeout: 15000 }).catch(() => {});
const shot = await G(() => new Promise((done) => requestAnimationFrame(() => { const g = window.__gametool, c = g.crossbow, s0 = c.stability, sw = { ...c.sway };
  c.fire(); const b = c.bolts.at(-1); const v = b.vel.clone().normalize();
  const yaw = Math.atan2(-v.x, -v.z), pitch = Math.asin(v.y);
  done({ s0, s1: c.stability, dyaw: Math.atan2(Math.sin(yaw - g.player.yaw), Math.cos(yaw - g.player.yaw)) - sw.yaw, dpitch: pitch - g.player.pitch - sw.pitch }); })));
check('A steady shot flies along the wandering aim (within 0.3°)', Math.abs(deg(shot.dyaw)) < 0.3 && Math.abs(deg(shot.dpitch)) < 0.3, JSON.stringify(shot));
check('Firing unsettles you', shot.s1 < shot.s0 * 0.5, `${shot.s0.toFixed(2)} → ${shot.s1.toFixed(2)}`);

await G(() => { const g = window.__gametool; g.crossbow.setADS(false); g.crossbow.unequip(); });
await page.waitForTimeout(400);
const after = await G(() => ({ cross: getComputedStyle(document.getElementById('crosshair')).display, ring: document.getElementById('steady').classList.contains('hidden') }));
check('Crossbow away: the crosshair is back, the ring gone', after.cross !== 'none' && after.ring, JSON.stringify(after));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
