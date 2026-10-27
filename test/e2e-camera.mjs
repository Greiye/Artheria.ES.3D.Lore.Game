// Storybook restyle S1 checks: Dark Cloud 2 style follow camera, wheel zoom into first person,
// the Camera list (phones), free-cursor hover/click, E on the nearest thing, dungeon ceiling.
// Usage: npm run build && node test/e2e-camera.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('gametool.character')) localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
const cam = () => G(page, () => { const g = window.__gametool, c = g.camera.position, e = g.player.eyePos; return { d: c.distanceTo(e), up: c.y - e.y, y: c.y, fov: g.camera.fov, third: g.player.thirdPerson, zoom: g.rig.zoom, view: g.settings.view }; });
const place = (x, z, yaw = 0) => G(page, ([x, z, yaw]) => { const p = window.__gametool.player; p.pos.set(x, 0, z); p.yaw = yaw; p.bodyYaw = yaw; p.pitch = 0; }, [x, z, yaw]);

// ---------- follow camera ----------
await place(0, 9);
await G(page, () => { window.__gametool.rig.zoom = 0.35; });
await page.waitForTimeout(1500);
const c0 = await cam();
check('S1 starts in the follow view, above and behind the player', c0.third && c0.view === 'follow' && c0.up > 1 && c0.d > 4 && c0.d < 11, JSON.stringify(c0));
check('S1 the follow view frees the cursor (no pointer lock, no crosshair)', await G(page, () => !document.pointerLockElement && getComputedStyle(document.getElementById('crosshair')).display === 'none'));
await page.mouse.move(640, 300);
for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(40); }
await page.waitForTimeout(1500);
const c1 = await cam();
check('S1 the wheel zooms out to a high overview with a narrower field of view', c1.zoom === 1 && c1.y > 12 && c1.fov < 40, JSON.stringify(c1));
for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(40); }
await page.waitForTimeout(800);
const c2 = await cam();
check('S1 zooming all the way in keeps the follow view at its closest', c2.third && c2.zoom === 0 && c2.d < 4.5, JSON.stringify(c2));
for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(60); }
check('S1 scrolling in past the closest zoom goes first person, gliding into the eyes', await until(page, () => !window.__gametool.player.thirdPerson && window.__gametool.rig.switching, null, 3000));
check('S1 the glide ends at the eyes with the body hidden', await until(page, () => { const g = window.__gametool; return !g.rig.switching && g.camera.position.distanceTo(g.player.eyePos) < 0.05 && !g.player.body.visible; }, null, 5000));
check('S1 first person is remembered as the camera setting', (await cam()).view === 'first');
await page.mouse.wheel(0, 300);
check('S1 scrolling out of first person returns to the follow view', await until(page, () => window.__gametool.player.thirdPerson && window.__gametool.settings.view === 'follow', null, 3000));

// ---------- Camera list (how phones pick first person) ----------
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'pause');
await page.selectOption('#viewSel', 'first');
check('S1 the pause menu Camera list switches to first person and saves it', await G(page, () => !window.__gametool.player.thirdPerson && JSON.parse(localStorage.getItem('gametool.settings')).view === 'first'));
await page.selectOption('#viewSel', 'follow');
check('S1 ... and back to the follow camera', await G(page, () => window.__gametool.player.thirdPerson && window.__gametool.settings.view === 'follow'));
await page.click('#resume');
await until(page, () => window.__gametool.state === 'play');

// ---------- drag turns the camera ----------
await place(0, 9);
await page.waitForTimeout(500);
const y0 = await G(page, () => window.__gametool.player.yaw);
await page.mouse.move(500, 400); await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 8; i++) await page.mouse.move(500 + i * 25, 400);
await page.mouse.up({ button: 'right' });
check('S1 dragging turns the camera around the player', Math.abs((await G(page, () => window.__gametool.player.yaw)) - y0) > 0.2);

// ---------- hover + click, and E on the nearest thing ----------
await G(page, () => { window.__gametool.rig.zoom = 0.2; });
const fire = await G(page, () => window.__gametool.world.stations.campfire.position.clone());
await place(fire.x + 1.6, fire.z + 1.0, Math.atan2(1.6, 1.0));
await page.waitForTimeout(1500);
const scr = await G(page, () => { const g = window.__gametool, v = g.world.stations.campfire.position.clone(); v.y = 0.3; v.project(g.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; });
await page.mouse.move(scr.x, scr.y);
check('S1 hovering the campfire highlights it ("Sit by the fire", pointer cursor)', await until(page, () => document.getElementById('promptVerb').textContent === 'Sit by the fire' && !document.getElementById('prompt').classList.contains('hidden') && document.querySelector('canvas').style.cursor === 'pointer', null, 4000), JSON.stringify(scr));
await page.mouse.click(scr.x, scr.y);
check('S1 clicking it uses it', await until(page, () => window.__gametool.campfire.isOpen, null, 4000));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play');
await page.mouse.move(5, 5);   // cursor off the fire
await place(fire.x + 1.5, fire.z, Math.PI / 2);   // facing -X, toward the fire, eye ray passes over it
await page.waitForTimeout(400);
check('S1 with nothing under the cursor, E picks the nearest thing in front of you', await until(page, () => document.getElementById('promptVerb').textContent === 'Sit by the fire', null, 4000));
await page.keyboard.press('KeyE');
check('S1 E uses it', await until(page, () => window.__gametool.campfire.isOpen, null, 4000));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play');

// ---------- dungeon ceiling ----------
await G(page, () => { window.__gametool.rig.zoom = 1; window.__gametool.enterDungeon(4242); });
await page.waitForTimeout(1500);
check('S1 below ground the follow camera stays under the dungeon ceiling', await G(page, () => window.__gametool.camera.position.y < 3.2), JSON.stringify(await cam()));
await G(page, () => window.__gametool.exitDungeon());

// ---------- S2b pixel-art sprites ----------
const spr = await G(page, () => {
  const out = { figures: 0, boards: 0, hidden3d: true, nearest: true };
  window.__gametool.world.scene.traverse((o) => {
    if (!o.userData.sprite) return;
    out.figures++;
    o.traverse((c) => {
      if (c.name === 'sprite') { out.boards++; const t = c.material.uniforms.map.value; out.nearest &&= t.magFilter === 1003; }
      else if (c.isMesh && c.name !== 'blob-shadow' && c.layers.test(window.__gametool.camera.layers)) out.hidden3d = false;
    });
  });
  return out;
});
check('S2b every figure shows as a nearest-filtered pixel sprite; its 3D rig is hidden from the main camera', spr.figures >= 3 && spr.boards === spr.figures && spr.hidden3d && spr.nearest, JSON.stringify(spr));

check('Camera: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
