// Automated checks for the partial rebuild (docs/rebuild-plan.md): R1 look, R3 camera rig, R4 gameplay port.
// Usage: npm run build && node test/e2e-rebuild.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
// Wait on game state, not wall-clock: the GPU-less test browser runs a few fps.
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);

// ---------- R1: pixel textures ----------
const tex = await G(page, () => {
  const g = window.__gametool, ground = g.world.scene.getObjectByName('ground');
  const t = ground.material.map;
  return { mag: t.magFilter, linear: 1006, w: t.image.width };
});
check('R1/S3 ground uses a smooth-filtered 32 px painted texture', tex.mag === tex.linear && tex.w === 32, JSON.stringify(tex));
const batched = await G(page, () => { let n = 0; window.__gametool.world.scene.traverse((o) => { if (o.name === 'static') n++; }); return n; });
check('R1 static props are batched into a handful of meshes', batched > 0 && batched < 20, `${batched} meshes`);

await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 });

// ---------- R3: follow camera ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8.5); p.yaw = 0; p.pitch = 0; });
const follow = await until(page, () => { const g = window.__gametool; const d = g.player.eyePos.distanceTo(g.camera.position); return g.player.thirdPerson && d > 3 && d < 11 && g.camera.position.y > g.player.eyePos.y; });
check('R3/S1 default view: follow camera behind and above the player', follow);

// ---------- R3: reading shot ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(0.2, 0, 1.6); p.yaw = 0; p.pitch = -0.35; });
await until(page, () => !document.getElementById('prompt').classList.contains('hidden'));
await page.keyboard.press('KeyE');
await until(page, () => window.__gametool.state === 'book');
const framed = await until(page, () => { const g = window.__gametool; return g.camera.position.distanceTo(g.world.bookCenter) < 2.2 && Math.abs(g.camera.fov - 45) < 1; });
await page.screenshot({ path: path.join(shots, 'rebuild-reading-shot.png') });
check('R3 opening the lectern book frames it (camera < 2.2 m away, 45° FOV)', framed);
await page.keyboard.press('Tab');
const back = await until(page, () => { const g = window.__gametool; return g.state !== 'book' && !g.rig.inShot && Math.abs(g.camera.fov - g.settings.fov) < 0.5; });
check('R3 closing the book blends back to the play camera', back);

// ---------- R4: follow camera against a wall hides the body (no camera inside the player's head) ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(4, 0, -16.3); p.yaw = Math.PI; p.pitch = 0; });   // just outside the library front wall, back to it
const hidden = await until(page, () => { const g = window.__gametool; return g.player.thirdPerson && !g.player.body.visible; });
check('R4 back to a wall: the follow camera hides the player body instead of sitting in it', hidden);
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8.5); p.yaw = 0; });
check('R4 away from walls the body shows again', await until(page, () => window.__gametool.player.body.visible));

// ---------- Phase A: body turns toward movement, limbs swing, NPCs look at you, dust on landing ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(2, 0, 6); p.yaw = 0; p.pitch = 0; });
await page.keyboard.down('KeyD');
const turned = await until(page, () => { const p = window.__gametool.player; return Math.abs(Math.atan2(Math.sin(p.bodyYaw + Math.PI / 2), Math.cos(p.bodyYaw + Math.PI / 2))) < 0.25; });
// Poses step at 12 fps (S2f), so one sample can land near the swing's zero crossing: watch for a swing.
const swung = await until(page, () => Math.abs(window.__gametool.player.body.children[0].userData.rig.bones.thighN.rotation.x) > 0.1, null, 3000);
const swing = await G(page, () => Math.abs(window.__gametool.player.body.children[0].userData.rig.bones.thighN.rotation.x));
await page.keyboard.up('KeyD');
check('A strafing right turns the body to face right (third person)', turned);
check('A running swings the legs', swung, swing.toFixed(2));
await G(page, () => { const p = window.__gametool.player, h = window.__gametool.world.standees.hero.position; p.pos.set(h.x - 2.2, 0, h.z + 0.6); });
const looked = await until(page, () => Math.abs(window.__gametool.world.standees.hero.userData.rig.bones.head.rotation.y) > 0.3);
check('A the hero turns his head toward a player standing near', looked);
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8.5); });
await page.keyboard.press('Space');
check('A landing kicks up dust', await until(page, () => window.__gametool.world.scene.getObjectByName('dust').count > 0));

// R4: talk with the crossbow in hand, so the dialogue shot below also checks the viewmodel is hidden.
await G(page, () => { const i = window.__gametool.inventory; i.give('crossbow', 1); i.give('bolt', 2); });
await page.keyboard.press('Digit1');
await until(page, () => window.__gametool.crossbow.viewmodel.visible);

// ---------- R3: dialogue two-shot ----------
await G(page, () => {
  const g = window.__gametool, n = g.world.natalieTarget.position, pl = g.player;
  pl.pos.set(n.x + 0.2, 0, n.z + 1.4);
  pl.yaw = Math.atan2(-(n.x - pl.pos.x), -(n.z - pl.pos.z)); pl.pitch = -0.15;
});
await until(page, () => document.getElementById('promptVerb').textContent === 'Talk to Natalie');
await page.keyboard.press('KeyE');
await until(page, () => window.__gametool.state === 'dialogue');
const two = await until(page, () => {
  const g = window.__gametool, n = g.world.natalieTarget.position;
  const dir = g.camera.getWorldDirection(new g.Vector3()), to = new g.Vector3(n.x, 1.5, n.z).sub(g.camera.position).normalize();
  return dir.dot(to) > 0.98 && g.player.body.visible && Math.abs(g.camera.fov - 50) < 1;
});
await page.screenshot({ path: path.join(shots, 'rebuild-dialogue-shot.png') });
check('R3 talking to Natalie frames her over the player\'s shoulder', two);
check('R4 the held crossbow is not drawn in the dialogue shot', await until(page, () => !window.__gametool.crossbow.viewmodel.visible));
// ---------- Phase A (B1): rigged figures + procedural animation ----------
const rig = await G(page, () => { const r = window.__gametool.player.body.children[0].userData.rig; return r && { bones: Object.keys(r.bones).length, skinned: r.mesh.isSkinnedMesh }; });
check('A every built-in figure is one skinned mesh on a 12-bone rig', !!rig && rig.bones === 12 && rig.skinned, JSON.stringify(rig));
check('Rebuild: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
