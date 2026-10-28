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

// ---------- v0.05: three perspectives (first person, over the shoulder, overhead) ----------
await place(0, 9);
await page.waitForTimeout(1500);
const c0 = await cam();
check('v0.05 starts in the overhead view, above and behind the player', c0.third && c0.view === 'overhead' && c0.up > 3 && c0.d > 6 && await G(page, () => window.__gametool.rig.step === 2), JSON.stringify(c0));
check('S1 the overhead view frees the cursor (no pointer lock, no crosshair)', await G(page, () => !document.pointerLockElement && getComputedStyle(document.getElementById('crosshair')).display === 'none'));
await page.mouse.move(640, 300);
const wheel = async (n, dy) => { for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(150); } };
const side = () => G(page, () => { const g = window.__gametool, p = g.player.pos, c = g.camera.position; return (c.x - p.x) * -Math.cos(g.player.yaw) + (c.z - p.z) * Math.sin(g.player.yaw); });
await wheel(1, 300);
await page.waitForTimeout(800);
check('v0.05 scrolling out past overhead stays overhead (3 perspectives only)', await G(page, () => window.__gametool.rig.step === 2 && window.__gametool.player.thirdPerson));
await wheel(1, -300);
await page.waitForTimeout(1500);
const c2 = await cam(), s2 = await side();
check('v0.05 one notch in: over the shoulder (close, right of the player)', c2.third && c2.view === 'shoulder' && c2.d < 3 && s2 > 0.3 && await G(page, () => window.__gametool.rig.step === 1), JSON.stringify({ ...c2, side: s2 }));
await page.keyboard.press('KeyQ');
await page.waitForTimeout(1500);
const s3 = await side();
check('v0.05 Q swaps the shoulder view to the left shoulder', s3 < -0.3 && await G(page, () => window.__gametool.rig.shoulderSide === -1), s3.toFixed(2));
await page.keyboard.press('KeyQ');
await page.waitForTimeout(1500);
check('v0.05 ... and back to the right', (await side()) > 0.3);
await wheel(1, -300);
check('v0.05 one more notch in goes first person, gliding into the eyes', await until(page, () => !window.__gametool.player.thirdPerson && window.__gametool.rig.switching, null, 3000));
check('S1 the glide ends at the eyes with the body hidden', await until(page, () => { const g = window.__gametool; return !g.rig.switching && g.camera.position.distanceTo(g.player.eyePos) < 0.05 && !g.player.body.visible; }, null, 5000));
check('S1 first person is remembered as the camera setting', (await cam()).view === 'first');
await page.mouse.wheel(0, 300);
check('v0.05 scrolling out of first person returns to the shoulder view', await until(page, () => window.__gametool.player.thirdPerson && window.__gametool.settings.view === 'shoulder', null, 3000));
// F cycles: shoulder -> overhead -> first person -> shoulder.
const views = [];
for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyF'); await page.waitForTimeout(200); views.push(await G(page, () => window.__gametool.settings.view)); }
check('v0.05 F cycles the three perspectives', views.join(',') === 'overhead,first,shoulder', views.join(','));
await page.keyboard.press('KeyF');
await page.waitForTimeout(600);
// Outside the shoulder view, the same button switches weapon (hands <-> crossbow).
await G(page, () => window.__gametool.inventory.give('crossbow', 1));
await page.keyboard.press('KeyQ');
const armed = await until(page, () => window.__gametool.crossbow.equipped, null, 2000);
await page.keyboard.press('KeyQ');
const unarmed = await until(page, () => !window.__gametool.crossbow.equipped, null, 2000);
check('v0.05 in the overhead view Q doubles as the weapon switch (crossbow on, then off)', armed && unarmed);
await until(page, () => window.__gametool.player.thirdPerson && !window.__gametool.rig.switching, null, 3000);

// ---------- Camera list (how phones pick a perspective) ----------
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'pause');
const opts = await G(page, () => [...document.querySelectorAll('#viewSel option')].map((o) => o.value).join(','));
await page.selectOption('#viewSel', 'first');
check('v0.05 the pause menu Camera list has the three perspectives; first person saves', opts === 'overhead,shoulder,first' && await G(page, () => !window.__gametool.player.thirdPerson && JSON.parse(localStorage.getItem('gametool.settings')).view === 'first'), opts);
await page.selectOption('#viewSel', 'overhead');
check('S1 ... and back to the overhead camera', await G(page, () => window.__gametool.player.thirdPerson && window.__gametool.settings.view === 'overhead' && window.__gametool.rig.step === 2));
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

// ---------- v0.04: a wall behind the player cranes the camera up, never into first person ----------
const wall = await G(page, () => { const c = window.__gametool.world.colliders.find((c) => c.kind !== 'circle' && c.maxX - c.minX > 3 && c.minX > -40 && c.maxX < 40); return c && { x: (c.minX + c.maxX) / 2, z: c.maxZ }; });
await G(page, () => window.__gametool.rig.setStep(2));
await place(wall.x, wall.z + 0.7, Math.PI);   // facing away from the wall: the follow camera's spot is inside it
await page.waitForTimeout(1500);
const cw = await G(page, () => { const g = window.__gametool; return { third: g.player.thirdPerson, body: g.player.body.visible, eye: g.camera.position.distanceTo(g.player.eyePos), up: g.camera.position.y - g.player.pos.y }; });
check('v0.04 backed against a wall the camera stays third person, cranes up and keeps the body in view', cw.third && cw.body && cw.eye > 1 && cw.up > 2, JSON.stringify({ wall, ...cw }));

// ---------- hover + click, and E on the nearest thing ----------
await G(page, () => { window.__gametool.rig.zoom = 0.4; });
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

// ---------- S2c hybrid characters, S2b sprite option ----------
const figs = () => G(page, () => {
  const out = { figures: 0, boards: 0, bodies3d: 0, heads3d: 0, headBoards: 0, drawnHeads: 0, nearest: true };
  const cam = window.__gametool.camera;
  window.__gametool.world.scene.traverse((o) => {
    if (!o.userData.sprite) return;
    out.figures++;
    o.traverse((c) => {
      if (c.name === 'sprite' && c.visible) { out.boards++; out.nearest &&= c.material.uniforms.map.value.magFilter === 1003; }
      if (c.name === 'head-sprite' && c.visible) {
        const map = c.material.uniforms.map.value;
        out.headBoards++; out.nearest &&= map.magFilter === 1003;
        if (map.image.height === 104 && c.material.uniforms.faceMap.value) out.drawnHeads++;   // a head sheet with a face sheet
      }
      if (c.name === 'figure-body' && c.layers.test(cam.layers)) out.bodies3d++;
      if (c.name === 'figure-head' || c.name === 'face') out.heads3d++;
    });
  });
  return out;
});
const hy = await figs();
check('S2h default: every character is a 3D body under a flat 2D head (head + face sheets); no 3D head exists', hy.figures >= 3 && hy.bodies3d === hy.figures && hy.headBoards === hy.figures && hy.drawnHeads === hy.figures && hy.heads3d === 0 && hy.boards === 0 && hy.nearest, JSON.stringify(hy));
// Face swap: an expression only moves the face layer to another row of its sheet. Read the heads seen from the
// front side (the back shows no face).
const faceRows = () => G(page, () => { const r = []; window.__gametool.world.scene.traverse((o) => { if (o.name === 'head-sprite' && o.material.uniforms.faceOn.value) r.push(o.material.uniforms.faceFrame.value.w); }); return r; });
const rows0 = await faceRows();
await G(page, () => window.__gametool.world.scene.traverse((o) => { if (o.userData.look) o.userData.expression = 'talk-b'; }));
const swapped = await until(page, () => { let n = 0, moved = 0; window.__gametool.world.scene.traverse((o) => { if (o.name === 'head-sprite' && o.material.uniforms.faceOn.value) { n++; if (o.material.uniforms.faceFrame.value.w < 0.01) moved++; } }); return n > 0 && moved === n; }, null, 5000);
await G(page, () => window.__gametool.world.scene.traverse((o) => { if (o.userData.look) delete o.userData.expression; }));
check('Faces swap expressions by frame (talk-b moves every visible face to the last row of its sheet)', rows0.length > 0 && rows0.every((v) => v > 0.01) && swapped, JSON.stringify({ rows0 }));
const setChars = (v) => G(page, (v) => { const s = document.getElementById('charsSel'); s.value = v; s.dispatchEvent(new Event('change')); }, v);
await setChars('sprite');
await until(page, () => { let n = 0, f = 0; window.__gametool.world.scene.traverse((o) => { if (o.userData.sprite) f++; if (o.name === 'sprite' && o.visible) n++; }); return n === f; }, null, 5000);
const sp = await figs();
check('S2b Characters > Pixel sprites: every body becomes a nearest-filtered billboard under its 2D head; its 3D rig leaves the main camera', sp.boards === sp.figures && sp.bodies3d === 0 && sp.headBoards === sp.figures && sp.nearest, JSON.stringify(sp));
await setChars('hybrid');
await until(page, () => { let n = 0; window.__gametool.world.scene.traverse((o) => { if (o.name === 'sprite' && o.visible) n++; }); return n === 0; }, null, 5000);
const back = await figs();
check('S2c switching back restores the 3D bodies', back.bodies3d === back.figures && back.headBoards === back.figures && back.boards === 0 && await G(page, () => JSON.parse(localStorage.getItem('gametool.settings')).chars === 'hybrid'), JSON.stringify(back));

check('Camera: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
